import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin/session";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少預約 id。" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
