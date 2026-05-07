"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BusyRange,
  CLOSE_HOUR,
  KIDS_READING_SERVICE,
  OPEN_HOUR,
  dateAtTaipeiTime,
  formatDateTime,
  formatTime,
  isSlotAvailable,
  toDateValue,
} from "@/lib/booking";

type Message = {
  text: string;
  type?: "error" | "success";
};

type ConfirmedBooking = {
  start: Date;
  end: Date;
  customerName: string;
};

const service = KIDS_READING_SERVICE;
const KIDS_SLOT_STEP_MINUTES = 60;

const readingSteps = [
  { title: "閱讀陪伴", text: "用溫柔節奏陪孩子看書、說故事，慢慢進入專注。" },
  { title: "讀玩樂", text: "加入小遊戲、圖卡或積木，讓學習保有輕鬆感。" },
  { title: "安靜練習", text: "依孩子當天狀態安排任務，保留休息與鼓勵。" },
];

export function KidsReadingPage() {
  const [dateValue, setDateValue] = useState("");
  const [busyRanges, setBusyRanges] = useState<BusyRange[]>([]);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<Message>({ text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] =
    useState<ConfirmedBooking | null>(null);

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );
    setDateValue(toDateValue(tomorrow));
  }, []);

  useEffect(() => {
    async function loadBusyRanges() {
      if (!dateValue) {
        return;
      }

      setSelectedStart(null);
      setSelectedEnd(null);
      setMessage({ text: "正在讀取可預約時段..." });

      const from = dateAtTaipeiTime(dateValue, 0).toISOString();
      const to = dateAtTaipeiTime(dateValue, 23, 59).toISOString();
      const response = await fetch(
        `/api/booking/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const result = (await response.json().catch(() => null)) as {
        busyRanges?: BusyRange[];
        error?: string;
      } | null;

      if (!response.ok || !result) {
        console.error("Unable to load busy ranges", result);
        setMessage({
          text: "目前無法讀取時段，請稍後再試或直接聯繫店家。",
          type: "error",
        });
        setBusyRanges([]);
        return;
      }

      setBusyRanges(result.busyRanges || []);
      setMessage({ text: "" });
    }

    loadBusyRanges();
  }, [dateValue]);

  const slots = useMemo(() => {
    if (!dateValue) {
      return [];
    }

    const dayStart = dateAtTaipeiTime(dateValue, OPEN_HOUR);
    const dayEnd = dateAtTaipeiTime(dateValue, CLOSE_HOUR);
    const now = new Date();
    const output: Array<{ start: Date; end: Date; available: boolean }> = [];

    for (
      let cursor = new Date(dayStart);
      cursor < dayEnd;
      cursor = new Date(cursor.getTime() + KIDS_SLOT_STEP_MINUTES * 60 * 1000)
    ) {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + service.duration * 60000);

      if (end > dayEnd) {
        continue;
      }

      output.push({
        start,
        end,
        available: start > now && isSlotAvailable(start, end, service, busyRanges),
      });
    }

    return output;
  }, [busyRanges, dateValue]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStart || !selectedEnd) {
      setMessage({ text: "請選擇一個可預約時段。", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setMessage({ text: "正在送出陪讀預約..." });
    setConfirmedBooking(null);

    const response = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: service.service,
        item_code: service.itemCode,
        start_at: selectedStart.toISOString(),
        end_at: selectedEnd.toISOString(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        note: note.trim() || null,
        price: service.price,
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      code?: string;
      error?: string;
    } | null;

    setIsSubmitting(false);

    if (!response.ok || !result) {
      console.error("Unable to submit kids reading booking", result);
      setMessage({
        text:
          result?.code === "BOOKING_CONFLICT"
            ? "這個時段剛剛已被預約，請重新選擇。"
            : "預約暫時無法送出，請稍後再試或直接聯繫店家。",
        type: "error",
      });
      setSelectedStart(null);
      setSelectedEnd(null);
      return;
    }

    setConfirmedBooking({
      start: selectedStart,
      end: selectedEnd,
      customerName: customerName.trim(),
    });
    setMessage({ text: "已收到陪讀預約，我們會再確認細節。", type: "success" });
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
    setSelectedStart(null);
    setSelectedEnd(null);
  }

  const todayValue = toDateValue(new Date());

  return (
    <div className="kids-page">
      <header className="site-header">
        <nav className="nav" aria-label="主選單">
          <a className="brand" href="#top" aria-label="襪子先生陪讀首頁">
            <span className="mark" aria-hidden="true">
              襪
            </span>
            <span>襪子先生</span>
          </a>
          <div className="links">
            <a href="#services">陪讀項目</a>
            <a href="#space">陪伴方式</a>
            <a href="#booking">線上預約</a>
          </div>
          <a className="nav-cta" href="#booking">
            立即預約
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-label="襪子先生陪讀形象">
          <Image
            className="hero-media"
            src="/images/kids-reading-hero.png"
            alt="溫馨可愛的兒童陪讀空間"
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-overlay" />
          <div className="hero-inner">
            <p className="eyebrow">陪伴閱讀｜讀玩樂｜安靜練習</p>
            <h1>襪子先生陪讀</h1>
            <p className="hero-copy">
              用溫柔陪伴與小小遊戲，讓孩子在放鬆的節奏裡閱讀、表達，也慢慢建立專注感。
            </p>
            <div className="hero-actions">
              <a className="hero-cta" href="#booking">
                預約陪讀時段
              </a>
              <a className="ghost-cta" href="#services">
                查看陪讀項目
              </a>
            </div>
            <div className="hero-strip" aria-label="陪讀重點">
              <div className="hero-stat">
                <strong>1 小時</strong>穩定陪伴節奏
              </div>
              <div className="hero-stat">
                <strong>讀玩樂</strong>閱讀與遊戲並行
              </div>
              <div className="hero-stat">
                <strong>NT$ 300</strong>簡單好安排
              </div>
            </div>
          </div>
        </section>

        <section className="section intro-section" aria-label="陪讀介紹">
          <div>
            <p className="section-kicker">A warm reading hour</p>
            <h2>陪孩子讀一點、玩一點，也慢慢安定下來</h2>
          </div>
          <p className="section-lead">
            陪讀不是考試壓力，而是有人在旁邊穩穩陪著。從故事、圖卡到小遊戲，依孩子狀態安排一段舒服的學習時間。
          </p>
        </section>

        <section className="band" id="services">
          <div className="section">
            <div className="section-head">
              <div>
                <p className="section-kicker">Service</p>
                <h2>陪讀</h2>
              </div>
              <p className="section-lead">
                適合需要短時間陪伴閱讀、練習表達，或在遊戲中慢慢進入學習狀態的孩子。
              </p>
            </div>

            <div className="service-gallery single-service">
              <article className="service-tile">
                <div className="service-image">
                  <Image
                    src="/images/kids-reading-service.png"
                    alt="陪讀服務情境"
                    fill
                    sizes="(max-width: 920px) 100vw, 48vw"
                  />
                </div>
                <div className="service-body">
                  <span>溫馨陪伴</span>
                  <h3>{service.name}</h3>
                  <p>
                    以閱讀、故事互動與簡單遊戲陪孩子度過一段穩定時間，讓學習變得輕鬆可親。
                  </p>
                  <div className="service-meta">
                    <strong>{service.duration} 分鐘</strong>
                    <strong>NT$ {service.price.toLocaleString("zh-TW")}</strong>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("booking")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    預約這個時段
                  </button>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section space-section" id="space">
          <div className="space-copy">
            <p className="section-kicker">How it works</p>
            <h2>讀書、遊戲與陪伴，安排在同一段安靜時間裡</h2>
            <p>
              每次陪讀都以孩子當天狀態為主，保留彈性與鼓勵。想安靜看書、練習表達，或加入一點玩樂，都可以在備註中告訴我們。
            </p>
          </div>
          <div className="journey-list">
            {readingSteps.map((step, index) => (
              <div className="journey-item" key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section booking-section" id="booking">
          <aside className="booking-aside" aria-label="預約服務預覽">
            <div className="aside-photo">
              <Image
                src="/images/kids-reading-service.png"
                alt="陪讀預覽"
                fill
                sizes="(max-width: 920px) 100vw, 34vw"
              />
            </div>
            <div className="aside-note">
              <span>目前選擇</span>
              <strong>{service.name}</strong>
              <p>
                {service.duration} 分鐘｜NT${" "}
                {service.price.toLocaleString("zh-TW")}
              </p>
            </div>
          </aside>

          <form className="booking" onSubmit={submitBooking}>
            <div className="form-head">
              <p className="section-kicker">Booking</p>
              <h2>線上預約</h2>
              <p className="hint">選擇日期與時段，再留下聯絡方式。</p>
            </div>

            <div className="grid">
              <label>
                預約項目
                <input readOnly value={`${service.name}｜60 分｜NT$ 300`} />
              </label>

              <label>
                預約日期
                <input
                  type="date"
                  min={todayValue}
                  value={dateValue}
                  onChange={(event) => {
                    setDateValue(event.target.value);
                    setConfirmedBooking(null);
                  }}
                  required
                />
              </label>

              <div className="wide">
                <label>
                  可預約時段
                  <div className="slots" aria-live="polite">
                    {slots.map((slot) => (
                      <button
                        className={`slot ${
                          selectedStart?.getTime() === slot.start.getTime()
                            ? "selected"
                            : ""
                        }`}
                        disabled={!slot.available}
                        key={slot.start.toISOString()}
                        type="button"
                        onClick={() => {
                          setSelectedStart(slot.start);
                          setSelectedEnd(slot.end);
                          setConfirmedBooking(null);
                        }}
                      >
                        {formatTime(slot.start)}
                      </button>
                    ))}
                    {!slots.length && (
                      <span className="empty-slot">此日期沒有可預約時段</span>
                    )}
                  </div>
                </label>
              </div>

              <label>
                姓名
                <input
                  autoComplete="name"
                  placeholder="請輸入家長姓名"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                />
              </label>

              <label>
                手機
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  required
                />
              </label>

              <label className="wide">
                備註
                <textarea
                  placeholder="可填寫孩子年齡、閱讀需求，或不方便的時間"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>

            <div className="summary">
              <div>
                預約內容
                <strong>
                  {selectedStart && selectedEnd
                    ? `${service.name}，${formatDateTime(selectedStart)}-${formatTime(
                        selectedEnd,
                      )}`
                    : "尚未選擇時段"}
                </strong>
              </div>
              <div>
                費用
                <strong>NT$ {service.price.toLocaleString("zh-TW")}</strong>
              </div>
            </div>

            <button className="submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "送出中..." : "送出預約"}
            </button>
            <div className={`message ${message.type || ""}`} role="status">
              {message.text}
            </div>
            {confirmedBooking && (
              <div className="success-panel" role="status" aria-live="polite">
                <span>陪讀預約收到</span>
                <strong>
                  {confirmedBooking.customerName
                    ? `${confirmedBooking.customerName}，已收到你的陪讀預約`
                    : "已收到你的陪讀預約"}
                </strong>
                <p>
                  {service.name}｜{formatDateTime(confirmedBooking.start)}-
                  {formatTime(confirmedBooking.end)}
                </p>
                <p>請留意後續確認訊息，我們會一起安排適合孩子的陪讀節奏。</p>
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className="footer">
        <span>襪子先生｜陪讀預約</span>
        <span>
          designed by{" "}
          <a href="https://www.chen-yi.tw" rel="noreferrer" target="_blank">
            梵和易學
          </a>
        </span>
      </footer>
    </div>
  );
}
