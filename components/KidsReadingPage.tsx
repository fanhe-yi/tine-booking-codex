"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BusyRange,
  CLOSE_HOUR,
  KIDS_PLAY_SERVICES,
  OPEN_HOUR,
  dateAtTaipeiTime,
  formatDateTime,
  formatTime,
  isSlotAvailable,
  toDateValue,
} from "@/lib/booking";
import {
  ChildProfile,
  ChildProfileInput,
  isCompleteChildProfile,
  normalizeChildProfile,
} from "@/lib/childProfiles";
import { useLineLiff } from "@/components/useLineLiff";

type Message = {
  text: string;
  type?: "error" | "success";
};

type ConfirmedBooking = {
  serviceName: string;
  start: Date;
  end: Date;
  customerName: string;
  price: number;
};

const KIDS_SLOT_STEP_MINUTES = 60;
const GROUP_CLASS_ITEM_CODE = "kids_group_class";

const serviceDetails: Record<
  string,
  { mood: string; description: string; priceLabel: string; imageAlt: string }
> = {
  kids_play: {
    mood: "安心陪伴",
    priceLabel: "1hr NT$ 300",
    imageAlt: "溫馨陪玩與日常照顧情境",
    description:
      "陪伴遊戲與日常照顧，吃飯、泡奶、換尿布、協助如廁、午休、畫畫、聽故事、自由活動、陪讀功課、戶外走走、接送任務都可依需求調整。",
  },
  kids_group_class: {
    mood: "三人成班",
    priceLabel: "每人 1hr NT$ 400",
    imageAlt: "小朋友一起互動遊戲與課程情境",
    description:
      "結合團體互動與客製課程，地點可由家長選擇，到府或指定場地皆可，讓孩子在交流中快樂成長。",
  },
  kids_talent_class: {
    mood: "含材料費",
    priceLabel: "1hr NT$ 800",
    imageAlt: "兒童才藝課與創作活動情境",
    description:
      "依孩子年齡與興趣量身設計，美術、體能、感官遊戲、故事延伸等，邊玩邊學，激發創意與自信。",
  },
};

const playSteps = [
  { title: "確認需求", text: "先了解寶貝年齡、個性、喜好與照顧重點。" },
  { title: "彈性安排", text: "依當天狀態安排遊戲、照顧、陪讀功課或戶外走走。" },
  { title: "安心回報", text: "預約送出後，店家會收到完整需求並再確認細節。" },
];

const emptyChildProfile = {
  age: "",
  gender: "",
  nickname: "",
  address: "",
  preferences: "",
  personality: "",
};

export function KidsReadingPage() {
  const [serviceCode, setServiceCode] = useState(KIDS_PLAY_SERVICES[0].itemCode);
  const [participantCount, setParticipantCount] = useState(3);
  const [dateValue, setDateValue] = useState("");
  const [busyRanges, setBusyRanges] = useState<BusyRange[]>([]);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [selectedChildProfileId, setSelectedChildProfileId] = useState("new");
  const [childProfile, setChildProfile] =
    useState<ChildProfileInput>(emptyChildProfile);
  const [message, setMessage] = useState<Message>({ text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] =
    useState<ConfirmedBooking | null>(null);
  const lineLiff = useLineLiff(process.env.NEXT_PUBLIC_READING_LIFF_ID);

  const selectedService =
    KIDS_PLAY_SERVICES.find((service) => service.itemCode === serviceCode) ||
    KIDS_PLAY_SERVICES[0];
  const isGroupClass = selectedService.itemCode === GROUP_CLASS_ITEM_CODE;
  const effectiveParticipantCount = isGroupClass ? participantCount : 1;
  const selectedExistingChild = childProfiles.find(
    (profile) => profile.id === selectedChildProfileId,
  );
  const needsChildProfileForm = !selectedExistingChild;

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

  useEffect(() => {
    async function loadChildProfiles() {
      if (!lineLiff.accessToken) {
        setChildProfiles([]);
        setSelectedChildProfileId("new");
        return;
      }

      const response = await fetch(
        `/api/child-profiles?access_token=${encodeURIComponent(lineLiff.accessToken)}`,
      );
      const result = (await response.json().catch(() => null)) as {
        childProfiles?: ChildProfile[];
      } | null;
      const profiles = result?.childProfiles || [];

      setChildProfiles(profiles);
      setSelectedChildProfileId(profiles[0]?.id || "new");
    }

    loadChildProfiles();
  }, [lineLiff.accessToken]);

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

  const selectedHours =
    selectedStart && selectedEnd
      ? Math.max(
          1,
          Math.round(
            (selectedEnd.getTime() - selectedStart.getTime()) /
              (60 * 60 * 1000),
          ),
        )
      : 1;
  const selectedPrice =
    selectedHours * selectedService.price * effectiveParticipantCount;

  function updateChildProfile(field: keyof ChildProfileInput, value: string) {
    setChildProfile((profile) => ({ ...profile, [field]: value }));
  }

  function isSlotInSelectedRange(slot: { start: Date; end: Date }) {
    return (
      !!selectedStart &&
      !!selectedEnd &&
      slot.start >= selectedStart &&
      slot.end <= selectedEnd
    );
  }

  function canExtendRangeTo(targetStart: Date) {
    if (!selectedStart) {
      return true;
    }

    return slots
      .filter((slot) => slot.start >= selectedStart && slot.start <= targetStart)
      .every((slot) => slot.available);
  }

  function chooseSlot(slot: { start: Date; end: Date; available: boolean }) {
    if (!slot.available) {
      return;
    }

    setConfirmedBooking(null);

    if (isSlotInSelectedRange(slot)) {
      setSelectedStart(null);
      setSelectedEnd(null);
      return;
    }

    if (
      !selectedStart ||
      !selectedEnd ||
      slot.start <= selectedStart ||
      !canExtendRangeTo(slot.start)
    ) {
      setSelectedStart(slot.start);
      setSelectedEnd(slot.end);
      return;
    }

    setSelectedEnd(slot.end);
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStart || !selectedEnd) {
      setMessage({ text: "請選擇一個可預約時段。", type: "error" });
      return;
    }

    if (isGroupClass && participantCount < 3) {
      setMessage({ text: "小團互動課至少 3 人成班。", type: "error" });
      return;
    }

    const normalizedChildProfile = normalizeChildProfile(childProfile);

    if (needsChildProfileForm && !isCompleteChildProfile(normalizedChildProfile)) {
      setMessage({ text: "請完整填寫寶貝資料。", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setMessage({ text: "正在送出陪玩預約..." });
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
        price: selectedPrice,
        participant_count: effectiveParticipantCount,
        child_profile_id: selectedExistingChild?.id || null,
        child_profile: needsChildProfileForm ? normalizedChildProfile : null,
        line_access_token: lineLiff.accessToken,
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      code?: string;
      error?: string;
    } | null;

    setIsSubmitting(false);

    if (!response.ok || !result) {
      console.error("Unable to submit kids play booking", result);
      setMessage({
        text:
          result?.code === "BOOKING_CONFLICT"
            ? "這個時段剛剛已被預約，請重新選擇。"
            : result?.error || "預約暫時無法送出，請稍後再試或直接聯繫店家。",
        type: "error",
      });
      setSelectedStart(null);
      setSelectedEnd(null);
      return;
    }

    setConfirmedBooking({
      serviceName: selectedService.name,
      start: selectedStart,
      end: selectedEnd,
      customerName: customerName.trim(),
      price: selectedPrice,
    });
    setMessage({ text: "已收到陪玩預約，我們會再確認細節。", type: "success" });
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
    setChildProfile(emptyChildProfile);
    setSelectedStart(null);
    setSelectedEnd(null);
  }

  const todayValue = toDateValue(new Date());

  return (
    <div className="kids-page">
      <header className="site-header">
        <nav className="nav" aria-label="主選單">
          <a className="brand" href="#top" aria-label="襪子先生陪玩首頁">
            <span className="mark" aria-hidden="true">
              襪
            </span>
            <span>襪子先生</span>
          </a>
          <div className="links">
            <a href="#services">陪玩項目</a>
            <a href="#space">陪伴方式</a>
            <a href="#booking">線上預約</a>
          </div>
          <a className="nav-cta" href="#booking">
            立即預約
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-label="襪子先生陪玩形象">
          <Image
            className="hero-media"
            src="/images/kids-reading-hero.png"
            alt="溫馨可愛的兒童陪玩空間"
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-overlay" />
          <div className="hero-inner">
            <p className="eyebrow">陪伴遊戲｜日常照顧｜客製課程</p>
            <h1>襪子先生陪玩</h1>
            <p className="hero-copy">
              讓孩子在安全感中快樂探索。陪玩、團體互動與才藝課都能依需求安排，時間可連續預約。
            </p>
            <div className="hero-actions">
              <a className="hero-cta" href="#booking">
                預約陪玩時段
              </a>
              <a className="ghost-cta" href="#services">
                查看陪玩項目
              </a>
            </div>
            <div className="hero-strip" aria-label="陪玩重點">
              <div className="hero-stat">
                <strong>陪玩照顧</strong>依需求彈性安排
              </div>
              <div className="hero-stat">
                <strong>團體互動</strong>三人成班
              </div>
              <div className="hero-stat">
                <strong>才藝課</strong>含材料費
              </div>
            </div>
          </div>
        </section>

        <section className="section intro-section" aria-label="陪玩介紹">
          <div>
            <p className="section-kicker">A warm play care hour</p>
            <h2>陪孩子玩一點、學一點，也被好好照顧</h2>
          </div>
          <p className="section-lead">
            第一次預約請留下寶貝年齡、稱呼、地址、喜好與個性。若已從 LINE 建檔，下次可直接選擇寶貝資料，店家會收到完整需求。
          </p>
        </section>

        <section className="band" id="services">
          <div className="section">
            <div className="section-head">
              <div>
                <p className="section-kicker">Services</p>
                <h2>陪玩服務項目</h2>
              </div>
              <p className="section-lead">
                可依孩子狀態選擇陪玩照顧、小團互動或專屬才藝課，所有項目都可連續預約多個小時。
              </p>
            </div>

            <div className="service-gallery play-service-gallery">
              {KIDS_PLAY_SERVICES.map((item) => {
                const detail = serviceDetails[item.itemCode];

                return (
                  <article className="service-tile" key={item.itemCode}>
                    <div className="service-image">
                      <Image
                        src="/images/kids-reading-service.png"
                        alt={detail.imageAlt}
                        fill
                        sizes="(max-width: 920px) 100vw, 33vw"
                      />
                    </div>
                    <div className="service-body">
                      <span>{detail.mood}</span>
                      <h3>{item.name}</h3>
                      <p>{detail.description}</p>
                      <div className="service-meta">
                        <strong>{detail.priceLabel}</strong>
                      </div>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setServiceCode(item.itemCode);
                          setConfirmedBooking(null);
                          document
                            .getElementById("booking")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        選這個項目
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
            <p className="section-kicker">How it works</p>
            <h2>遊戲、照顧與課程，安排在同一段安心時間裡</h2>
            <p>
              可以是吃飯泡奶、換尿布、協助如廁，也可以是畫畫、聽故事、戶外走走或陪讀功課。寶貝資料會協助店家更快掌握需求。
            </p>
          </div>
          <div className="journey-list">
            {playSteps.map((step, index) => (
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
                alt="陪玩預覽"
                fill
                sizes="(max-width: 920px) 100vw, 34vw"
              />
            </div>
            <div className="aside-note">
              <span>目前選擇</span>
              <strong>{selectedService.name}</strong>
              <p>
                {selectedHours} 小時｜NT${" "}
                {selectedPrice.toLocaleString("zh-TW")}
              </p>
            </div>
          </aside>

          <form className="booking" onSubmit={submitBooking}>
            <div className="form-head">
              <p className="section-kicker">Booking</p>
              <h2>線上預約</h2>
              <p className="hint">
                選擇服務、日期與連續時段，再留下家長與寶貝資料。
              </p>
            </div>

            <div className="grid">
              <div className={`line-status wide ${lineLiff.status}`}>
                <span>LINE 提醒</span>
                <strong>{lineLiff.message}</strong>
              </div>

              <label>
                預約項目
                <select
                  value={serviceCode}
                  onChange={(event) => {
                    setServiceCode(event.target.value);
                    setConfirmedBooking(null);
                  }}
                  required
                >
                  {KIDS_PLAY_SERVICES.map((item) => (
                    <option key={item.itemCode} value={item.itemCode}>
                      {item.name}｜{serviceDetails[item.itemCode].priceLabel}
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
                    setSelectedStart(null);
                    setSelectedEnd(null);
                    setConfirmedBooking(null);
                  }}
                  required
                />
              </label>

              {isGroupClass && (
                <label>
                  小團人數
                  <input
                    min={3}
                    type="number"
                    value={participantCount}
                    onChange={(event) =>
                      setParticipantCount(Number(event.target.value) || 3)
                    }
                    required
                  />
                </label>
              )}

              <div className="wide">
                <label>
                  可預約時段
                  <div className="slots" aria-live="polite">
                    {slots.map((slot) => (
                      <button
                        className={`slot ${
                          isSlotInSelectedRange(slot) ? "selected" : ""
                        }`}
                        disabled={!slot.available}
                        key={slot.start.toISOString()}
                        type="button"
                        aria-pressed={isSlotInSelectedRange(slot)}
                        onClick={() => chooseSlot(slot)}
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
                家長姓名
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

              <div className="wide child-profile-panel">
                <div className="child-profile-head">
                  <span>寶貝資料</span>
                  <strong>
                    {childProfiles.length
                      ? "可選既有寶貝，或新增另一位"
                      : "首次預約請完整填寫"}
                  </strong>
                </div>

                {childProfiles.length > 0 && (
                  <label>
                    選擇寶貝
                    <select
                      value={selectedChildProfileId}
                      onChange={(event) =>
                        setSelectedChildProfileId(event.target.value)
                      }
                    >
                      {childProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.nickname}｜{profile.address}
                        </option>
                      ))}
                      <option value="new">新增寶貝資料</option>
                    </select>
                  </label>
                )}

                {selectedExistingChild && (
                  <div className="child-profile-preview">
                    <strong>{selectedExistingChild.nickname}</strong>
                    <span>
                      {selectedExistingChild.age}｜{selectedExistingChild.gender}
                    </span>
                    <p>{selectedExistingChild.address}</p>
                    <p>喜好：{selectedExistingChild.preferences}</p>
                    <p>個性：{selectedExistingChild.personality}</p>
                  </div>
                )}

                {needsChildProfileForm && (
                  <div className="child-profile-grid">
                    <label>
                      年齡
                      <input
                        placeholder="例如：3 歲"
                        value={childProfile.age}
                        onChange={(event) =>
                          updateChildProfile("age", event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      性別
                      <input
                        placeholder="例如：女 / 男"
                        value={childProfile.gender}
                        onChange={(event) =>
                          updateChildProfile("gender", event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      稱呼（暱稱）
                      <input
                        placeholder="寶貝平常怎麼稱呼"
                        value={childProfile.nickname}
                        onChange={(event) =>
                          updateChildProfile("nickname", event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      地址
                      <input
                        placeholder="到府或指定場地地址"
                        value={childProfile.address}
                        onChange={(event) =>
                          updateChildProfile("address", event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      喜好
                      <input
                        placeholder="動物、樂高、卡通等等"
                        value={childProfile.preferences}
                        onChange={(event) =>
                          updateChildProfile("preferences", event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      個性
                      <input
                        placeholder="外向、怕生、慢熟等等"
                        value={childProfile.personality}
                        onChange={(event) =>
                          updateChildProfile("personality", event.target.value)
                        }
                        required
                      />
                    </label>
                  </div>
                )}
              </div>

              <label className="wide">
                備註
                <textarea
                  placeholder="可填寫接送任務、午休、泡奶、功課或其他照顧需求"
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
                <strong>NT$ {selectedPrice.toLocaleString("zh-TW")}</strong>
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
                <span>陪玩預約收到</span>
                <strong>
                  {confirmedBooking.customerName
                    ? `${confirmedBooking.customerName}，已收到你的陪玩預約`
                    : "已收到你的陪玩預約"}
                </strong>
                <p>
                  {confirmedBooking.serviceName}｜
                  {formatDateTime(confirmedBooking.start)}-
                  {formatTime(confirmedBooking.end)}
                </p>
                <p>費用 NT$ {confirmedBooking.price.toLocaleString("zh-TW")}</p>
                <p>請留意後續確認訊息，我們會一起安排適合寶貝的陪玩節奏。</p>
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className="footer">
        <span>襪子先生｜陪玩預約</span>
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
