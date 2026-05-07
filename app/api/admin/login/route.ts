import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminPassword } from "@/lib/admin/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (!body?.password) {
    return NextResponse.json({ error: "請輸入管理密碼。" }, { status: 400 });
  }

  if (!verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: "管理密碼錯誤。" }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
