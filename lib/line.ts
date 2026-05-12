import { createHmac, timingSafeEqual } from "node:crypto";
import { BUSINESS_TIMEZONE, SERVICES, formatDateTime, formatTime } from "@/lib/booking";
import { getServicePreparationNotice } from "@/lib/serviceNotices";

export type LineChannel = "sox" | "reading";

type LineChannelConfig = {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  adminUserId: string;
};

type LineProfile = {
  userId: string;
  displayName: string;
};

type LineBookingMessageInput = {
  id?: string | number;
  itemCode: string;
  startAt: string;
  endAt: string;
  customerName: string;
  customerPhone: string;
  note?: string | null;
};

export const defaultCustomerNotificationSettings: Record<LineChannel, boolean> = {
  sox: true,
  reading: false,
};

export function getLineChannelConfig(channel: LineChannel): LineChannelConfig {
  if (channel === "reading") {
    return {
      channelId: process.env.READING_LINE_CHANNEL_ID || "",
      channelSecret: process.env.READING_LINE_CHANNEL_SECRET || "",
      channelAccessToken: process.env.READING_LINE_CHANNEL_ACCESS_TOKEN || "",
      adminUserId: process.env.READING_LINE_ADMIN_USER_ID || "",
    };
  }

  return {
    channelId: process.env.SOX_LINE_CHANNEL_ID || "",
    channelSecret: process.env.SOX_LINE_CHANNEL_SECRET || "",
    channelAccessToken: process.env.SOX_LINE_CHANNEL_ACCESS_TOKEN || "",
    adminUserId: process.env.SOX_LINE_ADMIN_USER_ID || "",
  };
}

export function lineChannelFromService(service: string): LineChannel {
  return service === "reading" ? "reading" : "sox";
}

export function getLineCronSecret() {
  return process.env.CRON_SECRET || process.env.LINE_REMINDER_CRON_SECRET || "";
}

export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channel: LineChannel,
) {
  const config = getLineChannelConfig(channel);

  if (!config.channelSecret || !signature) {
    return false;
  }

  const expected = createHmac("sha256", config.channelSecret)
    .update(rawBody)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function verifyLiffAccessToken(
  accessToken: string,
  channel: LineChannel,
) {
  const config = getLineChannelConfig(channel);

  if (!accessToken || !config.channelId) {
    return null;
  }

  const verifyUrl = new URL("https://api.line.me/oauth2/v2.1/verify");
  verifyUrl.searchParams.set("access_token", accessToken);

  const verifyResponse = await fetch(verifyUrl);
  const verifyPayload = (await verifyResponse.json().catch(() => null)) as {
    client_id?: string;
    expires_in?: number;
  } | null;

  if (
    !verifyResponse.ok ||
    !verifyPayload?.client_id ||
    verifyPayload.client_id !== config.channelId
  ) {
    return null;
  }

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const profile = (await profileResponse.json().catch(() => null)) as
    | LineProfile
    | null;

  if (!profileResponse.ok || !profile?.userId) {
    return null;
  }

  return profile;
}

export async function pushLineText(channel: LineChannel, to: string, text: string) {
  const config = getLineChannelConfig(channel);

  if (!config.channelAccessToken || !to) {
    return { ok: false, skipped: true, error: "Missing LINE token or recipient." };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      ok: false,
      skipped: false,
      error: errorText || `LINE API failed with ${response.status}.`,
    };
  }

  return { ok: true, skipped: false, error: "" };
}

function serviceName(itemCode: string) {
  return SERVICES.find((service) => service.itemCode === itemCode)?.name || itemCode;
}

export function buildCustomerConfirmationText(booking: LineBookingMessageInput) {
  return [
    "襪子先生已收到你的預約。",
    "",
    `項目：${serviceName(booking.itemCode)}`,
    `時間：${formatDateTime(booking.startAt)}-${formatTime(booking.endAt)}`,
    "若需調整時間，請直接聯繫店家。",
  ].join("\n");
}

export function buildShopBookingText(booking: LineBookingMessageInput) {
  return [
    "有新的線上預約。",
    "",
    `項目：${serviceName(booking.itemCode)}`,
    `時間：${formatDateTime(booking.startAt)}-${formatTime(booking.endAt)}`,
    `姓名：${booking.customerName}`,
    `手機：${booking.customerPhone}`,
    booking.note?.trim() ? `備註：${booking.note.trim()}` : "備註：無",
    booking.id ? `預約編號：${booking.id}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCustomerReminderText(booking: LineBookingMessageInput) {
  return [
    getServicePreparationNotice(booking.itemCode),
    "",
    `時間：${formatDateTime(booking.startAt)}-${formatTime(booking.endAt)}`,
  ].join("\n");
}

export function getTaipeiTomorrowRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const dateValue = `${tomorrow.getUTCFullYear()}-${String(
    tomorrow.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;

  return {
    from: new Date(`${dateValue}T00:00:00+08:00`).toISOString(),
    to: new Date(`${dateValue}T23:59:59+08:00`).toISOString(),
  };
}
