"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SERVICES, formatDateTime, formatTime, toDateValue } from "@/lib/booking";

type Booking = {
  id: string | number;
  service: string;
  item_code: string;
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_phone: string;
  note: string | null;
  price: number | null;
  status: string;
  line_user_id?: string | null;
  line_display_name?: string | null;
  line_confirmed_at?: string | null;
  line_reminded_at?: string | null;
};

type BlockedSlot = {
  id: string | number;
  start_at: string;
  end_at: string;
};

type CalendarData = {
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
};

type Message = {
  text: string;
  type?: "error" | "success";
};

type LineSetting = {
  service: "sox" | "reading";
  notify_customer_enabled: boolean;
};

const lineServiceLabels: Record<LineSetting["service"], string> = {
  sox: "採耳",
  reading: "陪讀",
};

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, 1));
}

function addMonths(monthValue: string, amount: number) {
  const [year, month] = monthValue.split("-").map(Number);
  return toMonthValue(new Date(year, month - 1 + amount, 1));
}

function getCalendarDays(monthValue: string) {
  const { start, end } = getMonthRange(monthValue);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const days: Date[] = [];
  while (cursor < end || days.length % 7 !== 0) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function serviceName(itemCode: string) {
  return SERVICES.find((service) => service.itemCode === itemCode)?.name || itemCode;
}

export function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [monthValue, setMonthValue] = useState(toMonthValue(new Date()));
  const [selectedDate, setSelectedDate] = useState(toDateValue(new Date()));
  const [data, setData] = useState<CalendarData>({
    bookings: [],
    blockedSlots: [],
  });
  const [message, setMessage] = useState<Message>({ text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [lineSettings, setLineSettings] = useState<LineSetting[]>([]);
  const [lineSettingsMessage, setLineSettingsMessage] = useState<Message>({
    text: "",
  });

  const calendarDays = useMemo(() => getCalendarDays(monthValue), [monthValue]);
  const monthLabel = useMemo(() => formatMonthLabel(monthValue), [monthValue]);

  async function loadCalendar() {
    const { start, end } = getMonthRange(monthValue);
    setIsLoading(true);
    const response = await fetch(
      `/api/admin/calendar?from=${encodeURIComponent(
        start.toISOString(),
      )}&to=${encodeURIComponent(end.toISOString())}`,
    );
    setIsLoading(false);

    if (response.status === 401) {
      setIsAuthed(false);
      return;
    }

    const payload = await response.json();
    if (!response.ok) {
      setMessage({ text: payload.error || "無法讀取行事曆。", type: "error" });
      return;
    }

    setData(payload);
    setIsAuthed(true);
    setMessage({ text: "" });
    await loadLineSettings();
  }

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setIsLoading(false);
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ text: payload.error || "登入失敗。", type: "error" });
      return;
    }

    setPassword("");
    setIsAuthed(true);
    setMessage({ text: "已登入後台。", type: "success" });
    await loadCalendar();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAuthed(false);
  }

  async function loadLineSettings() {
    const response = await fetch("/api/admin/line-settings");

    if (response.status === 401) {
      setIsAuthed(false);
      return;
    }

    const payload = await response.json().catch(() => null) as {
      settings?: LineSetting[];
      warning?: string;
      error?: string;
    } | null;

    if (!response.ok || !payload) {
      setLineSettingsMessage({
        text: payload?.error || "無法讀取 LINE 通知設定。",
        type: "error",
      });
      return;
    }

    setLineSettings(payload.settings || []);
    setLineSettingsMessage({
      text: payload.warning || "",
      type: payload.warning ? "error" : undefined,
    });
  }

  async function updateLineSetting(service: LineSetting["service"], enabled: boolean) {
    setIsLoading(true);
    const response = await fetch("/api/admin/line-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service,
        notify_customer_enabled: enabled,
      }),
    });
    setIsLoading(false);
    const payload = await response.json().catch(() => null) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setLineSettingsMessage({
        text: payload?.error || "更新 LINE 通知設定失敗。",
        type: "error",
      });
      return;
    }

    setLineSettings((current) =>
      current.map((setting) =>
        setting.service === service
          ? { ...setting, notify_customer_enabled: enabled }
          : setting,
      ),
    );
    setLineSettingsMessage({ text: "LINE 通知設定已更新。", type: "success" });
  }

  async function createBlockedSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = new Date(blockStart);
    const end = new Date(blockEnd);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      setMessage({ text: "請確認休假開始與結束時間。", type: "error" });
      return;
    }

    if (end <= start) {
      setMessage({ text: "休假結束時間必須晚於開始時間。", type: "error" });
      return;
    }

    setIsLoading(true);
    const response = await fetch("/api/admin/blocked-slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        reason: blockReason,
      }),
    });
    setIsLoading(false);
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ text: payload.error || "新增休假失敗。", type: "error" });
      return;
    }

    setBlockStart("");
    setBlockEnd("");
    setBlockReason("");
    setMessage({ text: "休假時段已新增。", type: "success" });
    await loadCalendar();
  }

  async function deleteBlockedSlot(id: string | number) {
    setIsLoading(true);
    const response = await fetch(
      `/api/admin/blocked-slots?id=${encodeURIComponent(String(id))}`,
      { method: "DELETE" },
    );
    setIsLoading(false);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage({ text: payload.error || "刪除休假失敗。", type: "error" });
      return;
    }

    setMessage({ text: "休假時段已刪除。", type: "success" });
    await loadCalendar();
  }

  async function deleteBooking(id: string | number) {
    const confirmed = window.confirm("確定要刪除這筆預約嗎？此操作無法復原。");
    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    const response = await fetch(
      `/api/admin/bookings?id=${encodeURIComponent(String(id))}`,
      { method: "DELETE" },
    );
    setIsLoading(false);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage({ text: payload.error || "刪除預約失敗。", type: "error" });
      return;
    }

    setMessage({ text: "預約已刪除。", type: "success" });
    await loadCalendar();
  }

  const selectedBookings = data.bookings.filter(
    (booking) => toDateValue(new Date(booking.start_at)) === selectedDate,
  );
  const selectedBlockedSlots = data.blockedSlots.filter(
    (slot) => toDateValue(new Date(slot.start_at)) === selectedDate,
  );

  if (!isAuthed) {
    return (
      <main className="admin-shell login-shell">
        <form className="admin-login" onSubmit={login}>
          <div>
            <p className="eyebrow admin-eyebrow">後台管理</p>
            <h1>襪子先生採耳</h1>
            <p className="admin-muted">
              請輸入管理密碼，登入後可查看預約行事曆與管理休假時段。
            </p>
          </div>
          <label>
            管理密碼
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="submit" disabled={isLoading} type="submit">
            登入
          </button>
          <div className={`message ${message.type || ""}`} role="status">
            {message.text}
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow admin-eyebrow">後台管理</p>
          <h1>預約行事曆</h1>
        </div>
        <button className="ghost-button" type="button" onClick={logout}>
          登出
        </button>
      </header>

      <section className="admin-grid">
        <div className="calendar-panel">
          <div className="calendar-heading">
            <button
              aria-label="上一個月"
              className="month-nav-button"
              disabled={isLoading}
              type="button"
              onClick={() => setMonthValue((current) => addMonths(current, -1))}
            >
              ‹
            </button>
            <h2>{monthLabel}</h2>
            <button
              aria-label="下一個月"
              className="month-nav-button"
              disabled={isLoading}
              type="button"
              onClick={() => setMonthValue((current) => addMonths(current, 1))}
            >
              ›
            </button>
            <button
              aria-label="重新整理行事曆"
              className="refresh-button"
              disabled={isLoading}
              type="button"
              onClick={loadCalendar}
            >
              重新整理
            </button>
          </div>
          <div className={`admin-inline-message ${message.type || ""}`} role="status">
            {message.text}
          </div>
          <div className="weekday-row">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const value = toDateValue(day);
              const bookings = data.bookings.filter(
                (booking) => toDateValue(new Date(booking.start_at)) === value,
              );
              const blocks = data.blockedSlots.filter(
                (slot) => toDateValue(new Date(slot.start_at)) === value,
              );
              const isOutside = value.slice(0, 7) !== monthValue;

              return (
                <button
                  className={`calendar-day ${
                    selectedDate === value ? "selected" : ""
                  } ${isOutside ? "outside" : ""}`}
                  key={value}
                  type="button"
                  onClick={() => setSelectedDate(value)}
                >
                  <strong>{day.getDate()}</strong>
                  {bookings.length ? (
                    <span className="calendar-day-status">
                      <span>預約</span>
                      {bookings.length}
                    </span>
                  ) : null}
                  {blocks.length ? (
                    <span className="calendar-day-status">
                      <span>休假</span>
                      {blocks.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="day-panel">
          <div className="panel-head">
            <h2>{selectedDate}</h2>
            <span>{selectedBookings.length} 筆預約</span>
          </div>

          <div className="admin-list">
            {selectedBookings.map((booking) => (
              <article className="admin-card booking-card" key={booking.id}>
                <div>
                  <strong>{formatTime(booking.start_at)} 預約</strong>
                  <span>
                    {serviceName(booking.item_code)}｜{booking.status}
                  </span>
                </div>
                <p>
                  {booking.customer_name}｜{booking.customer_phone}
                </p>
                <p>
                  {formatDateTime(booking.start_at)} - {formatTime(booking.end_at)}
                </p>
                <p>
                  NT$ {Number(booking.price || 0).toLocaleString("zh-TW")}
                </p>
                <p>
                  LINE：
                  {booking.line_user_id
                    ? `已綁定${booking.line_display_name ? `（${booking.line_display_name}）` : ""}`
                    : "未綁定"}
                  ｜確認：{booking.line_confirmed_at ? "已通知" : "未通知"}
                  ｜提醒：{booking.line_reminded_at ? "已通知" : "未通知"}
                </p>
                {booking.note ? <p className="note">{booking.note}</p> : null}
                <div className="admin-card-actions">
                  <button
                    className="danger-button"
                    disabled={isLoading}
                    type="button"
                    onClick={() => deleteBooking(booking.id)}
                  >
                    刪除預約
                  </button>
                </div>
              </article>
            ))}
            {!selectedBookings.length ? (
              <p className="empty-state">這天沒有預約。</p>
            ) : null}
          </div>

          <div className="panel-head block-head">
            <h2>休假時段</h2>
            <span>{selectedBlockedSlots.length} 段</span>
          </div>
          <div className="admin-list">
            {selectedBlockedSlots.map((slot) => (
              <article className="admin-card block-card" key={slot.id}>
                <div>
                  <strong>
                    {formatTime(slot.start_at)} - {formatTime(slot.end_at)}
                  </strong>
                  <span>不可預約</span>
                </div>
                <button
                  className="danger-button"
                  disabled={isLoading}
                  type="button"
                  onClick={() => deleteBlockedSlot(slot.id)}
                >
                  刪除
                </button>
              </article>
            ))}
            {!selectedBlockedSlots.length ? (
              <p className="empty-state">這天沒有休假。</p>
            ) : null}
          </div>

          <form className="block-form" onSubmit={createBlockedSlot}>
            <h2>新增休假</h2>
            <label>
              開始
              <input
                type="datetime-local"
                value={blockStart}
                onChange={(event) => setBlockStart(event.target.value)}
                required
              />
            </label>
            <label>
              結束
              <input
                type="datetime-local"
                value={blockEnd}
                onChange={(event) => setBlockEnd(event.target.value)}
                required
              />
            </label>
            <label>
              原因
              <input
                placeholder="例：公休、店休、私人行程"
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
              />
            </label>
            <button className="submit" disabled={isLoading} type="submit">
              新增休假
            </button>
          </form>
        </aside>
      </section>

      <section className="block-form-panel">
        <div className="line-settings-panel">
          <div>
            <h2>LINE 通知設定</h2>
            <p>店家新預約通知固定開啟；下方只控制客戶是否收到確認與前一天提醒。</p>
          </div>
          <div className="line-settings-list">
            {lineSettings.map((setting) => (
              <label className="line-toggle" key={setting.service}>
                <span>
                  <strong>{lineServiceLabels[setting.service]}</strong>
                  客戶通知
                </span>
                <input
                  checked={setting.notify_customer_enabled}
                  disabled={isLoading}
                  type="checkbox"
                  onChange={(event) =>
                    updateLineSetting(setting.service, event.target.checked)
                  }
                />
              </label>
            ))}
          </div>
          <div className={`admin-inline-message ${lineSettingsMessage.type || ""}`} role="status">
            {lineSettingsMessage.text}
          </div>
        </div>
      </section>
    </main>
  );
}
