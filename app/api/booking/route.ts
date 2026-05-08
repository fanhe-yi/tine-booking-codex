import { NextResponse } from "next/server";
import {
  BUSINESS_TIMEZONE,
  CLOSE_HOUR,
  KIDS_READING_SERVICE,
  OPEN_HOUR,
  SERVICES,
} from "@/lib/booking";
import {
  buildCustomerConfirmationText,
  buildShopBookingText,
  defaultCustomerNotificationSettings,
  getLineChannelConfig,
  lineChannelFromService,
  pushLineText,
  verifyLiffAccessToken,
} from "@/lib/line";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServiceSupabaseClient>;

function taipeiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
  };
}

async function getNotifyCustomerEnabled(
  supabase: SupabaseClient,
  service: "sox" | "reading",
) {
  const { data, error } = await supabase
    .from("line_notification_settings")
    .select("notify_customer_enabled")
    .eq("service", service)
    .maybeSingle();

  if (error) {
    console.error("Unable to load LINE notification settings", error);
    return defaultCustomerNotificationSettings[service];
  }

  return data?.notify_customer_enabled ?? defaultCustomerNotificationSettings[service];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    service?: string;
    item_code?: string;
    start_at?: string;
    end_at?: string;
    customer_name?: string;
    customer_phone?: string;
    note?: string | null;
    price?: number;
    line_access_token?: string | null;
  } | null;

  const selectedService = SERVICES.find(
    (service) => service.itemCode === body?.item_code,
  );

  if (
    !body ||
    !selectedService ||
    !body.start_at ||
    !body.end_at ||
    !body.customer_name?.trim() ||
    !body.customer_phone?.trim()
  ) {
    return NextResponse.json({ error: "預約資料不完整。" }, { status: 400 });
  }

  const start = new Date(body.start_at);
  const end = new Date(body.end_at);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return NextResponse.json({ error: "預約時間格式不正確。" }, { status: 400 });
  }

  const durationMs = end.getTime() - start.getTime();
  const hourMs = 60 * 60 * 1000;
  const isKidsReading =
    selectedService.itemCode === KIDS_READING_SERVICE.itemCode;
  let bookingPrice = selectedService.price;

  if (durationMs <= 0) {
    return NextResponse.json({ error: "預約時間不正確。" }, { status: 400 });
  }

  if (isKidsReading) {
    const startParts = taipeiParts(start);
    const endParts = taipeiParts(end);
    const isSameTaipeiDate =
      startParts.year === endParts.year &&
      startParts.month === endParts.month &&
      startParts.day === endParts.day;
    const isWithinBusinessHours =
      startParts.hour >= OPEN_HOUR &&
      endParts.hour <= CLOSE_HOUR &&
      startParts.minute === 0 &&
      endParts.minute === 0;
    const isWholeHour = durationMs % hourMs === 0;
    const hours = durationMs / hourMs;

    if (
      !isSameTaipeiDate ||
      !isWithinBusinessHours ||
      !isWholeHour ||
      hours < 1 ||
      hours > 6
    ) {
      return NextResponse.json({ error: "預約時間不正確。" }, { status: 400 });
    }

    bookingPrice = hours * selectedService.price;
  } else if (durationMs !== selectedService.duration * 60 * 1000) {
    return NextResponse.json({ error: "預約時間不正確。" }, { status: 400 });
  }

  if (start <= new Date()) {
    return NextResponse.json({ error: "不可預約已過時間。" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const lineChannel = lineChannelFromService(selectedService.service);
  const lineProfile = body.line_access_token
    ? await verifyLiffAccessToken(body.line_access_token, lineChannel)
    : null;
  const bookingPayload = {
    service: selectedService.service,
    item_code: selectedService.itemCode,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    customer_name: body.customer_name.trim(),
    customer_phone: body.customer_phone.trim(),
    note: body.note?.trim() || null,
    price: bookingPrice,
    status: "confirmed",
    ...(lineProfile
      ? {
          line_user_id: lineProfile.userId,
          line_display_name: lineProfile.displayName,
          line_channel: lineChannel,
        }
      : {}),
  };
  let { data, error } = await supabase
    .from("bookings")
    .insert(bookingPayload)
    .select("id,item_code,start_at,end_at,customer_name,customer_phone,note")
    .single();

  if (error && lineProfile && error.message.includes("line_")) {
    const retryPayload = {
      service: selectedService.service,
      item_code: selectedService.itemCode,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      note: body.note?.trim() || null,
      price: bookingPrice,
      status: "confirmed",
    };
    const retry = await supabase
      .from("bookings")
      .insert(retryPayload)
      .select("id,item_code,start_at,end_at,customer_name,customer_phone,note")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const conflictCodes = [
      "BOOKING_CONFLICT_SAME_SERVICE",
      "BOOKING_CONFLICT_CROSS_SERVICE_BUFFER",
      "SLOT_BLOCKED",
    ];
    const isConflict = conflictCodes.some((code) =>
      error.message.includes(code),
    );

    return NextResponse.json(
      {
        code: isConflict ? "BOOKING_CONFLICT" : "BOOKING_FAILED",
        error: isConflict ? "這個時段剛剛已被預約，請重新選擇。" : error.message,
      },
      { status: isConflict ? 409 : 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { code: "BOOKING_FAILED", error: "預約建立失敗。" },
      { status: 500 },
    );
  }

  const adminUserId = getLineChannelConfig(lineChannel).adminUserId;
  const shopNotification = pushLineText(
    lineChannel,
    adminUserId,
    buildShopBookingText({
      id: data.id,
      itemCode: data.item_code,
      startAt: data.start_at,
      endAt: data.end_at,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      note: data.note,
    }),
  );
  const notifyCustomer = await getNotifyCustomerEnabled(supabase, lineChannel);
  const customerNotification =
    lineProfile && notifyCustomer
      ? pushLineText(
          lineChannel,
          lineProfile.userId,
          buildCustomerConfirmationText({
            id: data.id,
            itemCode: data.item_code,
            startAt: data.start_at,
            endAt: data.end_at,
            customerName: data.customer_name,
            customerPhone: data.customer_phone,
            note: data.note,
          }),
        )
      : Promise.resolve({
          ok: false,
          skipped: true,
          error: "Customer LINE notification disabled or unavailable.",
        });

  const [shopResult, customerResult] = await Promise.allSettled([
    shopNotification,
    customerNotification,
  ]);
  const customerDelivered =
    customerResult.status === "fulfilled" && customerResult.value.ok;

  if (customerDelivered) {
    await supabase
      .from("bookings")
      .update({ line_confirmed_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return NextResponse.json({
    booking: data,
    line: {
      channel: lineChannel,
      customerLinked: Boolean(lineProfile),
      customerNotificationEnabled: notifyCustomer,
      customerDelivered,
      shopDelivered: shopResult.status === "fulfilled" && shopResult.value.ok,
    },
  });
}
