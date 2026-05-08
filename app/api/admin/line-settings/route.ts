import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin/session";
import {
  defaultCustomerNotificationSettings,
  type LineChannel,
} from "@/lib/line";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const services: LineChannel[] = ["sox", "reading"];

function normalizeSettings(
  rows: Array<{ service: LineChannel; notify_customer_enabled: boolean }> | null,
) {
  return services.map((service) => {
    const row = rows?.find((item) => item.service === service);

    return {
      service,
      notify_customer_enabled:
        row?.notify_customer_enabled ?? defaultCustomerNotificationSettings[service],
    };
  });
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("line_notification_settings")
    .select("service,notify_customer_enabled")
    .order("service", { ascending: true });

  if (error) {
    return NextResponse.json({
      settings: normalizeSettings(null),
      warning: "尚未建立 LINE 通知設定資料表，已使用預設值。",
    });
  }

  return NextResponse.json({ settings: normalizeSettings(data) });
}

export async function PUT(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "未登入。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    service?: LineChannel;
    notify_customer_enabled?: boolean;
  } | null;

  if (
    !body ||
    !services.includes(body.service as LineChannel) ||
    typeof body.notify_customer_enabled !== "boolean"
  ) {
    return NextResponse.json({ error: "LINE 通知設定資料不完整。" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from("line_notification_settings").upsert({
    service: body.service,
    notify_customer_enabled: body.notify_customer_enabled,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
