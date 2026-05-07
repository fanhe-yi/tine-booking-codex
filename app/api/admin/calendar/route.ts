import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin/session";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

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

  const [{ data: bookings, error: bookingError }, { data: blockedSlots, error: blockedError }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id,service,item_code,start_at,end_at,customer_name,customer_phone,note,price,status",
        )
        .lt("start_at", to)
        .gt("end_at", from)
        .order("start_at", { ascending: true }),
      supabase
        .from("blocked_slots")
        .select("id,start_at,end_at")
        .lt("start_at", to)
        .gt("end_at", from)
        .order("start_at", { ascending: true }),
    ]);

  if (bookingError || blockedError) {
    return NextResponse.json(
      {
        error:
          bookingError?.message ||
          blockedError?.message ||
          "無法讀取行事曆資料。",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    bookings: bookings || [],
    blockedSlots: blockedSlots || [],
  });
}
