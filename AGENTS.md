# 專案協作規則

## 每次任務開始

- 無論在哪個 Codex 視窗，只要在本專案執行任務，都必須先讀取專案根目錄的 `PROJECT_STATUS.md`。
- 修改任何檔案前，必須先確認 `git status --short --branch`。
- 不改 Supabase SQL，除非使用者明確要求。

## 每次任務完成

- 任務完成後，必須詢問使用者是否要將本次工作事項、任務過程與結果追加或更新到 `PROJECT_STATUS.md`。

## 文件與目錄操作

禁止批量刪除文件或目錄。

不要使用:
- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要刪除文件時，只能一次刪除一個明確路徑的文件。

正確示範:

```powershell
Remove-Item "C:\path\to\file.txt"
```

如果需要批量刪除文件，應停止操作，並向使用者請求，讓使用者手動刪除。
