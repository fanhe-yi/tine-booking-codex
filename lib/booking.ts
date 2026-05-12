export const BUSINESS_TIMEZONE = "Asia/Taipei";
export const OPEN_HOUR = 15;
export const CLOSE_HOUR = 21;
export const SLOT_STEP_MINUTES = 30;

export type ServiceItem = {
  service: "sox" | "reading";
  itemCode: string;
  name: string;
  duration: number;
  price: number;
};

export type BusyRange = {
  kind: "booking" | "blocked";
  service: string | null;
  start_at: string;
  end_at: string;
};

export const EAR_SERVICES: ServiceItem[] = [
  {
    service: "sox",
    itemCode: "basic_ear_cleaning",
    name: "基礎採耳",
    duration: 30,
    price: 250,
  },
  {
    service: "sox",
    itemCode: "healing_ear_cleaning",
    name: "療癒採耳",
    duration: 40,
    price: 599,
  },
  {
    service: "sox",
    itemCode: "ear_bath_spa",
    name: "耳浴SPA",
    duration: 60,
    price: 799,
  },
  {
    service: "sox",
    itemCode: "ear_candle_spa",
    name: "耳燭SPA",
    duration: 60,
    price: 799,
  },
  {
    service: "sox",
    itemCode: "premium_ear_spa_package",
    name: "享受套餐",
    duration: 100,
    price: 1199,
  },
];

export const KIDS_READING_SERVICE: ServiceItem = {
  service: "reading",
  itemCode: "kids_reading",
  name: "陪讀",
  duration: 60,
  price: 300,
};

export const SERVICES: ServiceItem[] = [
  ...EAR_SERVICES,
  KIDS_READING_SERVICE,
];

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateAtTaipeiTime(dateValue: string, hour: number, minute = 0) {
  return new Date(`${dateValue}T${pad(hour)}:${pad(minute)}:00+08:00`);
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TIMEZONE,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TIMEZONE,
  }).format(new Date(date));
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) {
  return aStart < bEnd && aEnd > bStart;
}

export function isSlotAvailable(
  start: Date,
  end: Date,
  selectedService: ServiceItem,
  busyRanges: BusyRange[],
) {
  return !busyRanges.some((range) => {
    const rangeStart = new Date(range.start_at);
    const rangeEnd = new Date(range.end_at);

    if (range.kind === "blocked") {
      return rangesOverlap(start, end, rangeStart, rangeEnd);
    }

    if (range.service === selectedService.service) {
      return rangesOverlap(start, end, rangeStart, rangeEnd);
    }

    const bufferedStart = new Date(rangeStart.getTime() - 30 * 60 * 1000);
    const bufferedEnd = new Date(rangeEnd.getTime() + 30 * 60 * 1000);
    return rangesOverlap(start, end, bufferedStart, bufferedEnd);
  });
}
