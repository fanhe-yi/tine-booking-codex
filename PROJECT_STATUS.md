# 專案監管紀錄

更新日期：2026-05-12

## 專案定位

襪子先生採耳與陪讀預約網站，目標是提供顧客線上預約服務，並讓店家透過後台查看預約行事曆與管理休假時段。

## 目前盤點

- 技術架構：Next.js 15、React 19、TypeScript、Supabase、Vercel，Netlify 保留為備案設定。
- 前台功能：採耳預約單頁、陪讀預約單頁、服務介紹、日期與時段選擇、顧客資料填寫、預約送出、預約成功後事前告知。
- 後台功能：密碼登入、行事曆檢視、預約管理、休假時段新增與刪除。
- 部署設定：已有 `vercel.json`、`netlify.toml` 與 README 環境變數說明。
- 資料庫設定：已有公開預約、後台存取與 LINE 通知 SQL 腳本。
- 環境設定：已有 `.env.example` 與 `.env.local`。
- LINE 設定：已加入採耳與陪讀兩組官方 LINE 的 LIFF、Messaging API、webhook、店家通知、客戶通知開關與前一天 20:00 提醒設計。

## 採耳正式服務

- 基礎採耳：30 分，NT$250。
- 療癒採耳：40 分，NT$599。
- 耳浴SPA：60 分，NT$799。
- 耳燭SPA：60 分，NT$799。
- 享受套餐：100 分，NT$1199。
- 採耳預約營業時間：每日 15:00-21:00，30 分鐘時段間隔，最後可約時間依服務長度自動計算。

## 預約與 LINE 流程

- 採耳頁預約成功後，頁面會顯示服務專屬事前告知、LINE 提醒狀態與店面位置入口。
- 一般網頁預約可完成；未綁定 LINE 時，成功面板會顯示官方 LINE 加好友 CTA。
- 從官方 LINE LIFF 入口預約並成功綁定 `line_user_id` 時，若後台 LINE 通知設定開啟，前一天 20:00 由 Vercel Cron 呼叫 `/api/line/reminders` 推播提醒。
- Vercel Production 需設定 `NEXT_PUBLIC_SOX_LINE_ADD_FRIEND_URL`，成功面板才會顯示官方 LINE 加好友按鈕。

## 管理原則

- 每項任務先確認目標、影響範圍與驗收條件。
- 每次任務開始前，所有 Codex 視窗都必須先讀取本文件。
- 每次任務完成後，必須詢問使用者是否要將本次工作事項、任務過程與結果記錄到本文件。
- 修改任何檔案前，先確認 `git status --short --branch`。
- 執行中固定回報進度、風險與下一步。
- 不批量刪除檔案或目錄；如需批量清理，停止並請使用者手動處理。
- 不改 Supabase SQL，除非使用者明確要求。
- 變更會盡量維持既有架構與風格，只針對任務必要範圍修改。
- 完成後以可執行檢查或測試結果作為驗收依據。

## 目前風險

- LINE 串接前已建立 tag `pre-line-live-2026-05-08`，可回到 Vercel-only 上線版本。
- `package.json` 仍使用 `next lint`；目前可執行，但 Next 提示此指令會在 Next.js 16 移除，後續應遷移到 ESLint CLI。
- LINE 功能仍需在 Supabase Production 執行 `supabase_line_notifications.sql`，並於 Vercel/LINE Developers Console 設定兩組 channel 與 LIFF。
- 多個 Codex 視窗同時編輯同一專案時，若未先讀取本文件，容易沿用舊服務項目或舊流程判斷。

## 驗收紀錄

- 2026-05-06：`next build` 通過。
- 2026-05-06：`tsc --noEmit` 通過。
- 2026-05-06：`next lint` 通過，無 ESLint warnings 或 errors；但指令已 deprecated。
- 2026-05-07：採耳預約單頁建置完成。
- 2026-05-07：陪讀預約單頁建置完成。
- 2026-05-07：後台行事曆與休假管理建置完成。
- 2026-05-07：`next build` 通過，產出 `/`、`/kids-reading`、`/admin` 與 API routes。
- 2026-05-07：`tsc --noEmit` 通過。
- 2026-05-07：`next lint` 通過，無 ESLint warnings 或 errors；但指令已 deprecated。
- 2026-05-07：完成版 commit `c89a06e` 已建立，tag 為 `booking-complete-2026-05-07`。
- 2026-05-07：GitHub origin 已設定為 `git@github.com:fanhe-yi/tine-booking-codex.git`，`main` 與完成版 tag 已推送完成。
- 2026-05-07：LINE 功能決議暫緩；目前版本先專注網站上線。
- 2026-05-07：Vercel-only 部署設定建置完成，未啟用 LINE cron 或 webhook。
- 2026-05-08：LINE 串接前基準 tag `pre-line-live-2026-05-08` 已建立並推送到 GitHub。
- 2026-05-08：`supabase_line_notifications.sql` 建置完成，用於新增 LINE 預約欄位與後台通知設定表。
- 2026-05-08：採耳/陪讀兩組 LIFF access token 帶入、後端 token 驗證、店家通知、客戶確認通知、前一天提醒與 webhook routes 建置完成。
- 2026-05-08：`/admin` 新增 LINE 客戶通知設定區塊，保留原有行事曆、休假管理與預約刪除流程。
- 2026-05-08：`tsc --noEmit` 通過。
- 2026-05-08：`next build` 通過，產出 `/api/line/sox/webhook`、`/api/line/reading/webhook`、`/api/line/reminders` 與 `/api/admin/line-settings`。
- 2026-05-08：`next lint` 通過，無 ESLint warnings 或 errors；但指令已 deprecated。
- 2026-05-12：正式採耳服務項目更新完成，commit `0c393d0 Update ear spa service menu` 已推送到 `main`。
- 2026-05-12：預約成功事前告知、官方 LINE CTA、5 項服務專屬 LINE 前一天提醒文案建置完成，commit `8d762d7 Add booking preparation notices` 已推送到 `main`。

## 下一步

- 確認 Supabase Production 已執行 `supabase_line_notifications.sql`。
- 確認 Vercel Production 已設定採耳/陪讀兩組 LINE env、`CRON_SECRET` 與 `NEXT_PUBLIC_SOX_LINE_ADD_FRIEND_URL`。
- 在 LINE Developers Console 建立兩個 LIFF app，設定採耳與陪讀 webhook URL。
- 針對 LIFF 預約、店家通知、客戶確認通知、前一天提醒與後台開關做 production 實機驗收。
- 手機寬度驗收採耳預約成功後的事前告知區塊、官方 LINE CTA 與自動捲動位置。
- 評估是否將 lint script 從 `next lint` 遷移到 ESLint CLI。

## 回報格式

每次回報採用以下格式：

- 本次目標：
- 已完成：
- 進行中：
- 風險或阻塞：
- 下一步：
