import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "缺少查詢起訖時間。" },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();

  const [
    { data: bookings, error: bookingError },
    { data: blockedSlots, error: blockedError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("service,start_at,end_at")
      .eq("status", "confirmed")
      .lt("start_at", to)
      .gt("end_at", from),
    supabase
      .from("blocked_slots")
      .select("start_at,end_at")
      .lt("start_at", to)
      .gt("end_at", from),
  ]);

  if (bookingError || blockedError) {
    return NextResponse.json(
      {
        error:
          bookingError?.message ||
          blockedError?.message ||
          "無法讀取可預約時段。",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    busyRanges: [
      ...(bookings || []).map((booking) => ({
        kind: "booking",
        service: booking.service,
        start_at: booking.start_at,
        end_at: booking.end_at,
      })),
      ...(blockedSlots || []).map((blockedSlot) => ({
        kind: "blocked",
        service: null,
        start_at: blockedSlot.start_at,
        end_at: blockedSlot.end_at,
      })),
    ],
  });
}
