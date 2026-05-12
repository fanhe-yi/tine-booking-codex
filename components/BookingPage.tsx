"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BusyRange,
  CLOSE_HOUR,
  EAR_SERVICES,
  OPEN_HOUR,
  SLOT_STEP_MINUTES,
  dateAtTaipeiTime,
  formatDateTime,
  formatTime,
  isSlotAvailable,
  toDateValue,
} from "@/lib/booking";
import { useLineLiff } from "@/components/useLineLiff";
import { getServicePreparationNotice } from "@/lib/serviceNotices";

type Message = {
  text: string;
  type?: "error" | "success";
};

type ConfirmedBooking = {
  itemCode: string;
  serviceName: string;
  start: Date;
  end: Date;
  customerName: string;
  lineLinked: boolean;
  lineDelivered: boolean;
  lineNotificationEnabled: boolean;
};

const serviceDetails = {
  basic_ear_cleaning: {
    label: "基礎採耳",
    image: "/images/service-basic-ear-cleaning.png",
    description: "輕柔整理耳周與外耳，適合初次體驗或日常快速保養。",
    mood: "日常保養",
  },
  healing_ear_cleaning: {
    label: "療癒採耳",
    image: "/images/service-healing-ear-cleaning.png",
    description:
      "內視鏡探索、耳道清潔、耳道酥麻減壓、面部舒壓與耳穴按摩撥筋。",
    mood: "舒壓療癒",
  },
  ear_bath_spa: {
    label: "耳浴SPA",
    image: "/images/service-ear-bath-spa.png",
    description:
      "暖流耳浴、面部肩頸精油紓壓、內視鏡探索、耳道清潔與耳穴按摩撥筋。",
    mood: "暖流放鬆",
  },
  ear_candle_spa: {
    label: "耳燭SPA",
    image: "/images/service-ear-candle-spa.png",
    description:
      "薰香耳燭、頭肩頸精油舒壓、內視鏡探索、耳道清潔與耳穴按摩撥筋。",
    mood: "耳燭舒壓",
  },
  premium_ear_spa_package: {
    label: "享受套餐",
    image: "/images/service-premium-package.png",
    description:
      "暖流耳浴、薰香耳燭、頭肩頸精油舒壓、內視鏡探索與耳道酥麻減壓。",
    mood: "完整享受",
  },
} as const;

const journeySteps = [
  { title: "入店放鬆", text: "安靜空間、柔和燈光，先讓身體慢下來。" },
  { title: "確認需求", text: "依照當天狀況與喜好，安排適合的服務節奏。" },
  { title: "細緻保養", text: "採耳、耳浴與耳燭都以舒適感為核心。" },
];

function getLineSuccessMessage(booking: ConfirmedBooking) {
  if (booking.lineLinked && booking.lineNotificationEnabled) {
    return booking.lineDelivered
      ? "已連結 LINE，預約確認訊息已送出，前一天 20:00 會再提醒你。"
      : "已連結 LINE，預約前一天 20:00 會提醒你。";
  }

  if (booking.lineLinked) {
    return "已連結 LINE，目前店家尚未開啟自動提醒。";
  }

  return "加入官方 LINE，有問題或特殊需求可以直接告訴我們。";
}

export function BookingPage() {
  const [serviceCode, setServiceCode] = useState(EAR_SERVICES[0].itemCode);
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
  const successPanelRef = useRef<HTMLDivElement | null>(null);
  const lineLiff = useLineLiff(process.env.NEXT_PUBLIC_SOX_LIFF_ID);
  const officialLineUrl = process.env.NEXT_PUBLIC_SOX_LINE_ADD_FRIEND_URL || "";

  const selectedService =
    EAR_SERVICES.find((service) => service.itemCode === serviceCode) ||
    EAR_SERVICES[0];
  const selectedDetail =
    serviceDetails[selectedService.itemCode as keyof typeof serviceDetails] ||
    serviceDetails.basic_ear_cleaning;

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
  }, [dateValue, serviceCode]);

  useEffect(() => {
    if (!confirmedBooking) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      successPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [confirmedBooking]);

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
      cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60 * 1000)
    ) {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + selectedService.duration * 60000);

      if (end > dayEnd) {
        continue;
      }

      output.push({
        start,
        end,
        available:
          start > now &&
          isSlotAvailable(start, end, selectedService, busyRanges),
      });
    }

    return output;
  }, [busyRanges, dateValue, selectedService]);

  function chooseService(itemCode: string) {
    setServiceCode(itemCode);
    setConfirmedBooking(null);
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStart || !selectedEnd) {
      setMessage({ text: "請選擇一個可預約時段。", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setMessage({ text: "正在送出預約..." });
    setConfirmedBooking(null);

    const response = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: selectedService.service,
        item_code: selectedService.itemCode,
        start_at: selectedStart.toISOString(),
        end_at: selectedEnd.toISOString(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        note: note.trim() || null,
        price: selectedService.price,
        line_access_token: lineLiff.accessToken,
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      line?: {
        customerLinked?: boolean;
        customerDelivered?: boolean;
        customerNotificationEnabled?: boolean;
      };
      code?: string;
      error?: string;
    } | null;

    setIsSubmitting(false);

    if (!response.ok || !result) {
      console.error("Unable to submit booking", result);
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
      itemCode: selectedService.itemCode,
      serviceName: selectedService.name,
      start: selectedStart,
      end: selectedEnd,
      customerName: customerName.trim(),
      lineLinked: Boolean(result.line?.customerLinked),
      lineDelivered: Boolean(result.line?.customerDelivered),
      lineNotificationEnabled: Boolean(result.line?.customerNotificationEnabled),
    });
    setMessage({ text: "預約已送出，我們已收到你的預約資料。", type: "success" });
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
    setSelectedStart(null);
    setSelectedEnd(null);
  }

  const todayValue = toDateValue(new Date());

  return (
    <>
      <header className="site-header">
        <nav className="nav" aria-label="主選單">
          <a className="brand" href="#top" aria-label="襪子先生首頁">
            <span className="mark" aria-hidden="true">
              襪
            </span>
            <span>襪子先生</span>
          </a>
          <div className="links">
            <a href="#services">服務項目</a>
            <a href="#space">環境體驗</a>
            <a href="#booking">線上預約</a>
            <a href="#location">位置</a>
          </div>
          <a className="nav-cta" href="#booking">
            立即預約
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-label="襪子先生採耳形象">
          <Image
            className="hero-media"
            src="/images/hero-ear-spa.png"
            alt="溫暖放鬆的採耳空間"
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-overlay" />
          <div className="hero-inner">
            <p className="eyebrow">耳部保養｜採耳放鬆｜耳燭舒壓</p>
            <h1>襪子先生採耳</h1>
            <p className="hero-copy">
              在柔和燈光與安靜節奏裡，完成一段細緻、舒服、讓人真正放鬆的耳部保養。
            </p>
            <div className="hero-actions">
              <a className="hero-cta" href="#booking">
                預約放鬆時段
              </a>
              <a className="ghost-cta" href="#services">
                查看服務項目
              </a>
            </div>
            <div className="hero-strip" aria-label="服務重點">
              <div className="hero-stat">
                <strong>安靜包廂</strong>慢下來的私人時光
              </div>
              <div className="hero-stat">
                <strong>細緻採耳</strong>耳部清潔與放鬆並重
              </div>
              <div className="hero-stat">
                <strong>耳燭舒壓</strong>柔和儀式感體驗
              </div>
            </div>
          </div>
        </section>

        <section className="section intro-section" aria-label="品牌介紹">
          <div>
            <p className="section-kicker">A quiet ear care ritual</p>
            <h2>把耳部保養，變成一段安靜放鬆的儀式</h2>
          </div>
          <p className="section-lead">
            採耳重點不只是清潔，更是節奏、距離感與舒適度。從躺下開始，讓耳朵被細心照顧，也讓身體慢慢進入休息狀態。
          </p>
        </section>

        <section className="band" id="services">
          <div className="section">
            <div className="section-head">
              <div>
                <p className="section-kicker">Services</p>
                <h2>選一段適合今天的耳部保養</h2>
              </div>
              <p className="section-lead">
                每個服務都有不同節奏。想快速保養、深度放鬆，或安排耳浴與耳燭 SPA，都可以直接從下方選擇。
              </p>
            </div>

            <div className="service-gallery">
              {EAR_SERVICES.map((service) => {
                const detail =
                  serviceDetails[
                    service.itemCode as keyof typeof serviceDetails
                  ] || serviceDetails.basic_ear_cleaning;

                return (
                  <article className="service-tile" key={service.itemCode}>
                    <div className="service-image">
                      <Image
                        src={detail.image}
                        alt={`${detail.label}服務情境`}
                        fill
                        sizes="(max-width: 920px) 100vw, 25vw"
                      />
                    </div>
                    <div className="service-body">
                      <span>{detail.mood}</span>
                      <h3>{service.name}</h3>
                      <p>{detail.description}</p>
                      <div className="service-meta">
                        <strong>{service.duration} 分鐘</strong>
                        <strong>
                          NT$ {service.price.toLocaleString("zh-TW")}
                        </strong>
                      </div>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => chooseService(service.itemCode)}
                      >
                        選這個服務
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section space-section" id="space">
          <div className="space-copy">
            <p className="section-kicker">Experience</p>
            <h2>溫暖、安靜、沒有壓力的採耳空間</h2>
            <p>
              以柔和木質、乾淨器具與低干擾動線，讓客人不用被過度打擾。服務過程保留充分時間，專心感受耳部被照顧的舒適。
            </p>
          </div>
          <div className="journey-list">
            {journeySteps.map((step, index) => (
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
                src={selectedDetail.image}
                alt={`${selectedService.name}預覽`}
                fill
                sizes="(max-width: 920px) 100vw, 34vw"
              />
            </div>
            <div className="aside-note">
              <span>目前選擇</span>
              <strong>{selectedService.name}</strong>
              <p>
                {selectedService.duration} 分鐘｜NT${" "}
                {selectedService.price.toLocaleString("zh-TW")}
              </p>
            </div>
          </aside>

          <form className="booking" onSubmit={submitBooking}>
            <div className="form-head">
              <p className="section-kicker">Booking</p>
              <h2>線上預約</h2>
              <p className="hint">選擇服務、日期與時段，再留下聯絡方式。</p>
            </div>

            <div className="grid">
              <div className={`line-status wide ${lineLiff.status}`}>
                <span>LINE 提醒</span>
                <strong>{lineLiff.message}</strong>
              </div>

              <label>
                服務項目
                <select
                  value={serviceCode}
                  onChange={(event) => {
                    setServiceCode(event.target.value);
                    setConfirmedBooking(null);
                  }}
                  required
                >
                  {EAR_SERVICES.map((service) => (
                    <option key={service.itemCode} value={service.itemCode}>
                      {service.name}｜{service.duration} 分｜NT${" "}
                      {service.price.toLocaleString("zh-TW")}
                    </option>
                  ))}
                </select>
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
                  placeholder="請輸入姓名"
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
                  placeholder="可填寫想詢問的事項或不方便的時間"
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
                    ? `${selectedService.name}，${formatDateTime(
                        selectedStart,
                      )}-${formatTime(selectedEnd)}`
                    : "尚未選擇時段"}
                </strong>
              </div>
              <div>
                費用
                <strong>
                  NT$ {selectedService.price.toLocaleString("zh-TW")}
                </strong>
              </div>
            </div>

            <button className="submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "送出中..." : "送出預約"}
            </button>
            <div className={`message ${message.type || ""}`} role="status">
              {message.text}
            </div>
            {confirmedBooking && (
              <div
                className="success-panel"
                ref={successPanelRef}
                role="status"
                aria-live="polite"
              >
                <span>預約收到</span>
                <strong>
                  {confirmedBooking.customerName
                    ? `${confirmedBooking.customerName}，你的預約已送出`
                    : "你的預約已送出"}
                </strong>
                <p>
                  {confirmedBooking.serviceName}｜
                  {formatDateTime(confirmedBooking.start)}-
                  {formatTime(confirmedBooking.end)}
                </p>
                <div className="success-notice">
                  <span>體驗前提醒</span>
                  <p>{getServicePreparationNotice(confirmedBooking.itemCode)}</p>
                </div>
                <div
                  className={`success-line ${
                    confirmedBooking.lineLinked ? "linked" : ""
                  }`}
                >
                  <span>LINE 提醒</span>
                  <strong>{getLineSuccessMessage(confirmedBooking)}</strong>
                  {!confirmedBooking.lineLinked && (
                    <p>
                      若下次從官方 LINE 預約入口完成預約，系統可綁定預約提醒。
                    </p>
                  )}
                  {officialLineUrl && !confirmedBooking.lineLinked && (
                    <a
                      className="line-add-button"
                      href={officialLineUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      加入官方 LINE
                    </a>
                  )}
                </div>
                <a href="#location">查看店面位置</a>
              </div>
            )}
          </form>
        </section>

        <section className="band" id="location">
          <div className="section location">
            <div className="location-card">
              <p className="section-kicker">Location</p>
              <h2>店面位置</h2>
              <p className="address">
                交通便利，建議依預約時間提前抵達。詳細位置可直接在地圖中開啟導航。
              </p>
              <div className="info-row">
                <span>地址</span>
                <strong>高雄市三民區建興路99巷20弄3號4樓</strong>
              </div>
              <div className="info-row">
                <span>營業時間</span>
                <strong>每日 15:00-21:00</strong>
              </div>
              <div className="info-row">
                <span>提醒</span>
                <strong>預約確認後再前往</strong>
              </div>
            </div>
            <div className="map-frame" aria-label="Google 地圖">
              <iframe
                title="襪子先生採耳位置地圖"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps?q=%E9%AB%98%E9%9B%84%E5%B8%82%E4%B8%89%E6%B0%91%E5%8D%80%E5%BB%BA%E8%88%88%E8%B7%AF99%E5%B7%B720%E5%BC%843%E8%99%9F4%E6%A8%93&output=embed"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>襪子先生｜線上預約</span>
        <span>
          designed by{" "}
          <a href="https://www.chen-yi.tw" rel="noreferrer" target="_blank">
            梵和易學
          </a>
        </span>
      </footer>
    </>
  );
}
