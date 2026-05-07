import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "襪子先生線上預約",
  description: "採耳、耳燭與放鬆保養線上預約",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
