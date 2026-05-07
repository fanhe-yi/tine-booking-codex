"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-shell">
      <section className="error-panel">
        <p className="section-kicker">Error</p>
        <h1>頁面暫時無法載入</h1>
        <p>
          {error.message ||
            "系統載入時發生錯誤，請重新整理或回到後台再試一次。"}
        </p>
        <div className="error-actions">
          <button className="nav-cta" type="button" onClick={reset}>
            重新載入
          </button>
          <Link className="ghost-button" href="/admin">
            回後台
          </Link>
        </div>
      </section>
    </main>
  );
}
