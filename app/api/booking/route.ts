import { NextResponse } from "next/server";
import {
  BUSINESS_TIMEZONE,
  CLOSE_HOUR,
  KIDS_PLAY_SERVICES,
  OPEN_HOUR,
  SERVICES,
} from "@/lib/booking";
import {
  type ChildProfile,
  type ChildProfileInput,
  formatChildProfileSummary,
  isCompleteChildProfile,
  normalizeChildProfile,
} from "@/lib/childProfiles";
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

const KIDS_GROUP_CLASS_ITEM_CODE = "kids_group_class";
const MIN_GROUP_PARTICIPANTS = 3;
const MAX_GROUP_PARTICIPANTS = 4;
const kidsPlayItemCodes = new Set(
  KIDS_PLAY_SERVICES.map((service) => service.itemCode),
);

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
    participant_count?: number;
    child_profile_id?: string | null;
    child_profile?: Partial<ChildProfileInput> | null;
    child_profile_ids?: string[] | null;
    child_profiles?: Array<Partial<ChildProfileInput>> | null;
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
  const isKidsPlay = kidsPlayItemCodes.has(selectedService.itemCode);
  const isKidsGroupClass = selectedService.itemCode === KIDS_GROUP_CLASS_ITEM_CODE;
  const participantCount = isKidsGroupClass
    ? Math.trunc(Number(body.participant_count))
    : 1;
  let bookingPrice = selectedService.price;

  if (durationMs <= 0) {
    return NextResponse.json({ error: "預約時間不正確。" }, { status: 400 });
  }

  if (isKidsPlay) {
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
      isKidsGroupClass &&
      (!Number.isFinite(participantCount) ||
        participantCount < MIN_GROUP_PARTICIPANTS ||
        participantCount > MAX_GROUP_PARTICIPANTS)
    ) {
      return NextResponse.json(
        { error: "小團互動課人數需為 3-4 位。" },
        { status: 400 },
      );
    }

    if (
      !isSameTaipeiDate ||
      !isWithinBusinessHours ||
      !isWholeHour ||
      hours < 1 ||
      hours > 6
    ) {
      return NextResponse.json({ error: "預約時間不正確。" }, { status: 400 });
    }

    bookingPrice = hours * selectedService.price * participantCount;
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
  let childProfileId: string | null = null;
  const childProfileIds: string[] = [];
  const childProfileSummaries: string[] = [];

  if (isKidsPlay) {
    const requestedChildProfileIds = (
      Array.isArray(body.child_profile_ids)
        ? body.child_profile_ids
        : body.child_profile_id
          ? [body.child_profile_id]
          : []
    ).filter((id): id is string => Boolean(id?.trim()));
    const requestedChildProfiles = (
      Array.isArray(body.child_profiles)
        ? body.child_profiles
        : body.child_profile
          ? [body.child_profile]
          : []
    ).map((profile) => normalizeChildProfile(profile));
    const submittedChildCount =
      requestedChildProfileIds.length + requestedChildProfiles.length;
    const requiredChildCount = isKidsGroupClass ? participantCount : 1;

    if (submittedChildCount !== requiredChildCount) {
      return NextResponse.json(
        { error: `請提供 ${requiredChildCount} 位寶貝資料。` },
        { status: 400 },
      );
    }

    if (requestedChildProfileIds.length) {
      if (!lineProfile) {
        return NextResponse.json(
          { error: "請重新透過 LINE 開啟頁面後選擇既有寶貝。" },
          { status: 400 },
        );
      }

      const { data: existingProfiles, error: profileError } = await supabase
        .from("child_profiles")
        .select("id,age,gender,nickname,address,preferences,personality")
        .eq("line_user_id", lineProfile.userId)
        .in("id", requestedChildProfileIds);

      if (profileError) {
        console.error("Unable to load selected child profiles", profileError);
      }

      if (
        !existingProfiles ||
        existingProfiles.length !== requestedChildProfileIds.length
      ) {
        return NextResponse.json(
          { error: "寶貝資料不正確，請重新選擇或新增。" },
          { status: 400 },
        );
      }

      const profilesById = new Map(
        existingProfiles.map((profile) => [profile.id, profile as ChildProfile]),
      );

      for (const id of requestedChildProfileIds) {
        const existingProfile = profilesById.get(id);

        if (existingProfile) {
          childProfileIds.push(existingProfile.id);
          childProfileSummaries.push(formatChildProfileSummary(existingProfile));
        }
      }
    }

    for (const normalizedChildProfile of requestedChildProfiles) {
      if (!isCompleteChildProfile(normalizedChildProfile)) {
        return NextResponse.json(
          { error: "請完整填寫每位寶貝的年齡、性別、稱呼與個性。" },
          { status: 400 },
        );
      }

      childProfileSummaries.push(formatChildProfileSummary(normalizedChildProfile));

      const { data: insertedProfile, error: insertProfileError } = await supabase
        .from("child_profiles")
        .insert({
          line_user_id: lineProfile?.userId || null,
          line_display_name: lineProfile?.displayName || null,
          ...normalizedChildProfile,
        })
        .select("id")
        .single();

      if (insertProfileError) {
        console.error("Unable to create child profile", insertProfileError);
        return NextResponse.json(
          { error: "寶貝資料建立失敗，請稍後再試或聯繫店家。" },
          { status: 500 },
        );
      }

      childProfileIds.push(insertedProfile.id);
    }

    childProfileId = childProfileIds[0] || null;
  }

  const childProfileSummary = childProfileSummaries
    .map((summary, index) => `寶貝 ${index + 1}：\n${summary}`)
    .join("\n\n");
  const noteSections = [
    body.note?.trim() ? `家長備註：${body.note.trim()}` : "",
    isKidsGroupClass ? `小團人數：${participantCount} 人` : "",
    childProfileSummary ? `寶貝資料：\n${childProfileSummary}` : "",
  ].filter(Boolean);
  const bookingNote = noteSections.length ? noteSections.join("\n\n") : null;
  const bookingPayload = {
    service: selectedService.service,
    item_code: selectedService.itemCode,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    customer_name: body.customer_name.trim(),
    customer_phone: body.customer_phone.trim(),
    note: bookingNote,
    price: bookingPrice,
    status: "confirmed",
    ...(childProfileId ? { child_profile_id: childProfileId } : {}),
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
    .select("id,item_code,start_at,end_at,customer_name,customer_phone,note,price")
    .single();

  if (
    error &&
    (error.message.includes("line_") || error.message.includes("child_profile_id"))
  ) {
    const retryPayload = {
      service: selectedService.service,
      item_code: selectedService.itemCode,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      note: bookingNote,
      price: bookingPrice,
      status: "confirmed",
    };
    const retry = await supabase
      .from("bookings")
      .insert(retryPayload)
      .select("id,item_code,start_at,end_at,customer_name,customer_phone,note,price")
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

  if (childProfileIds.length > 1) {
    const { error: linkError } = await supabase
      .from("booking_child_profiles")
      .insert(
        childProfileIds.map((profileId, index) => ({
          booking_id: data.id,
          child_profile_id: profileId,
          position: index + 1,
        })),
      );

    if (linkError) {
      console.error("Unable to link child profiles to booking", linkError);
    }
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
      price: data.price,
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
            price: data.price,
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
