import { NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"), "sox")) {
    return NextResponse.json({ error: "Invalid LINE signature." }, { status: 401 });
  }

  const payload = (JSON.parse(rawBody || "{}") || {}) as {
    events?: unknown[];
  };

  return NextResponse.json({
    ok: true,
    channel: "sox",
    received: payload.events?.length || 0,
  });
}
