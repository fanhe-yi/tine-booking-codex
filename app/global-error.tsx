"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <main className="error-shell">
          <section className="error-panel">
            <p className="section-kicker">Error</p>
            <h1>系統暫時無法載入</h1>
            <p>
              {error.message ||
                "應用程式載入時發生錯誤，請重新整理或稍後再試。"}
            </p>
            <div className="error-actions">
              <button className="nav-cta" type="button" onClick={reset}>
                重新載入
              </button>
              <Link className="ghost-button" href="/">
                回首頁
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
