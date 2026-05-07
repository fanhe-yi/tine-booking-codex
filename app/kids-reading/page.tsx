import type { Metadata } from "next";
import { KidsReadingPage } from "@/components/KidsReadingPage";

export const metadata: Metadata = {
  title: "襪子先生陪讀預約",
  description: "陪伴小孩閱讀、讀玩樂與安靜練習的線上預約",
};

export default function KidsReading() {
  return <KidsReadingPage />;
}
