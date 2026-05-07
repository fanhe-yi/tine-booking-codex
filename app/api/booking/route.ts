import { NextResponse } from "next/server";
import { SERVICES } from "@/lib/booking";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

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

  if (end <= start || end.getTime() - start.getTime() > 4 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "預約時間不正確。" }, { status: 400 });
  }

  if (start <= new Date()) {
    return NextResponse.json({ error: "不可預約已過時間。" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      service: selectedService.service,
      item_code: selectedService.itemCode,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      note: body.note?.trim() || null,
      price: selectedService.price,
      status: "confirmed",
    })
    .select("id,start_at,end_at")
    .single();

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

  return NextResponse.json({ booking: data });
}
