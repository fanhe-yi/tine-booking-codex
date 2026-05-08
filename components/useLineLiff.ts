"use client";

import { useEffect, useState } from "react";

type LiffClient = {
  init(options: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(options?: { redirectUri?: string }): void;
  isInClient(): boolean;
  getAccessToken(): string | null;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

type LineLiffState = {
  accessToken: string | null;
  status: "disabled" | "loading" | "ready" | "error";
  message: string;
};

const liffScriptUrl = "https://static.line-scdn.net/liff/edge/2/sdk.js";

function loadLiffSdk() {
  if (window.liff) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${liffScriptUrl}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = liffScriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

export function useLineLiff(liffId: string | undefined) {
  const [state, setState] = useState<LineLiffState>({
    accessToken: null,
    status: "disabled",
    message: "",
  });

  useEffect(() => {
    const resolvedLiffId = liffId || "";

    if (!resolvedLiffId) {
      setState({
        accessToken: null,
        status: "disabled",
        message: "一般網頁預約不會綁定 LINE 提醒。",
      });
      return;
    }

    let cancelled = false;

    async function initLiff() {
      setState({
        accessToken: null,
        status: "loading",
        message: "正在確認 LINE 身份...",
      });

      try {
        await loadLiffSdk();
        const liff = window.liff;

        if (!liff) {
          throw new Error("LIFF SDK unavailable.");
        }

        await liff.init({ liffId: resolvedLiffId });

        const shouldLogin =
          liff.isInClient() ||
          new URLSearchParams(window.location.search).get("line_liff") === "1";

        if (!liff.isLoggedIn()) {
          if (shouldLogin) {
            liff.login({ redirectUri: window.location.href });
          } else if (!cancelled) {
            setState({
              accessToken: null,
              status: "disabled",
              message: "一般網頁預約不會綁定 LINE 提醒。",
            });
          }
          return;
        }

        const accessToken = liff.getAccessToken();

        if (!accessToken) {
          throw new Error("Missing LIFF access token.");
        }

        if (!cancelled) {
          setState({
            accessToken,
            status: "ready",
            message: "已連結 LINE，預約後可接收 LINE 通知。",
          });
        }
      } catch (error) {
        console.error("Unable to initialize LIFF", error);

        if (!cancelled) {
          setState({
            accessToken: null,
            status: "error",
            message: "目前無法取得 LINE 身份，仍可用一般預約送出。",
          });
        }
      }
    }

    initLiff();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  return state;
}
