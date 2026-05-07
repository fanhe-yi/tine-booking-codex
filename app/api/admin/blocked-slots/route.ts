import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin/session";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    start_at?: string;
    end_at?: string;
    reason?: string;
  } | null;

  if (!body?.start_at || !body.end_at) {
    return NextResponse.json(
      { error: "請選擇休假開始與結束時間。" },
      { status: 400 },
    );
  }

  const start = new Date(body.start_at);
  const end = new Date(body.end_at);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return NextResponse.json({ error: "休假時間格式不正確。" }, { status: 400 });
  }

  if (end <= start) {
    return NextResponse.json(
      { error: "休假結束時間必須晚於開始時間。" },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();
  const payloadWithReason = {
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    reason: body.reason?.trim() || null,
  };

  let { data, error } = await supabase
    .from("blocked_slots")
    .insert(payloadWithReason)
    .select("id,start_at,end_at")
    .single();

  if (error && error.message.includes("reason")) {
    const retry = await supabase
      .from("blocked_slots")
      .insert({
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      })
      .select("id,start_at,end_at")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blockedSlot: data });
}

export async function DELETE(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少休假 id。" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
