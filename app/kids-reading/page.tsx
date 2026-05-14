import type { Metadata } from "next";
import { KidsReadingPage } from "@/components/KidsReadingPage";

export const metadata: Metadata = {
  title: "襪子先生陪玩預約",
  description: "陪伴小孩遊戲、日常照顧與客製課程的線上預約",
};

export default function KidsReading() {
  return <KidsReadingPage />;
}
