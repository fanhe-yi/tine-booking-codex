import { NextResponse } from "next/server";
import {
  buildCustomerReminderText,
  defaultCustomerNotificationSettings,
  getLineCronSecret,
  getTaipeiTomorrowRange,
  pushLineText,
  type LineChannel,
} from "@/lib/line";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ReminderBooking = {
  id: string | number;
  service: LineChannel;
  item_code: string;
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_phone: string;
  note: string | null;
  line_user_id: string | null;
};

function isAuthorized(request: Request) {
  const secret = getLineCronSecret();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function getEnabledServices() {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("line_notification_settings")
    .select("service,notify_customer_enabled");

  if (error) {
    console.error("Unable to load LINE notification settings", error);
    return defaultCustomerNotificationSettings;
  }

  return {
    ...defaultCustomerNotificationSettings,
    ...(data || []).reduce(
      (output, row) => ({
        ...output,
        [row.service as LineChannel]: Boolean(row.notify_customer_enabled),
      }),
      {} as Partial<Record<LineChannel, boolean>>,
    ),
  };
}

async function runReminders(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const settings = await getEnabledServices();
  const { from, to } = getTaipeiTomorrowRange();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id,service,item_code,start_at,end_at,customer_name,customer_phone,note,line_user_id",
    )
    .eq("status", "confirmed")
    .not("line_user_id", "is", null)
    .is("line_reminded_at", null)
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.all(
    ((bookings || []) as ReminderBooking[])
      .filter((booking) => settings[booking.service])
      .map(async (booking) => {
        const sent = await pushLineText(
          booking.service,
          booking.line_user_id || "",
          buildCustomerReminderText({
            id: booking.id,
            itemCode: booking.item_code,
            startAt: booking.start_at,
            endAt: booking.end_at,
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone,
            note: booking.note,
          }),
        );

        if (sent.ok) {
          await supabase
            .from("bookings")
            .update({ line_reminded_at: new Date().toISOString() })
            .eq("id", booking.id);
        }

        return {
          id: booking.id,
          service: booking.service,
          ok: sent.ok,
          skipped: sent.skipped,
          error: sent.error,
        };
      }),
  );

  return NextResponse.json({
    ok: true,
    window: { from, to },
    checked: bookings?.length || 0,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok && !result.skipped).length,
  });
}

export async function GET(request: Request) {
  return runReminders(request);
}

export async function POST(request: Request) {
  return runReminders(request);
}
