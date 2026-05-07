import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-shell">
      <section className="error-panel">
        <p className="section-kicker">404</p>
        <h1>找不到這個頁面</h1>
        <p>這個網址不存在，或頁面已經被移動。</p>
        <div className="error-actions">
          <Link className="nav-cta" href="/">
            回首頁
          </Link>
          <Link className="ghost-button" href="/admin">
            前往後台
          </Link>
        </div>
      </section>
    </main>
  );
}
