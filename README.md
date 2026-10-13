# 照片說故事

上傳一張照片，AI 編一個給小孩聽的故事。可以選中文或英文、選年齡層（2–4 / 4–6 / 6–8 / 8–10 歲），還能朗讀。故事存在手機本地，離線也能看、能聽。

## 架構

```
apps/client      手機網頁（Next.js 靜態輸出）→ 之後用 Capacitor 包成 iOS / Android App
apps/api         /api/story：照片 → Claude → 故事 JSON（照片不落地）
packages/shared  年齡規則、API 契約
```

| 功能 | 需要網路？ |
|---|---|
| 編新故事 | 需要（AI 在雲端） |
| 「再講一個」 | 需要，但只送場景文字，不重傳照片 |
| 閱讀書櫃 | 不需要（IndexedDB） |
| 朗讀 | 不需要（優先使用裝置內建語音） |

## 本機開發

```bash
npm install
cp apps/api/.env.example apps/api/.env.local       # 填入 ANTHROPIC_API_KEY
cp apps/client/.env.example apps/client/.env.local
npm run dev:api     # http://localhost:3001
npm run dev:client  # http://localhost:3000
```

手機實測：連同一個 Wi-Fi，開 `http://<電腦IP>:3000`，並把這個來源加進 `ALLOWED_ORIGINS`。

## 部署
- API：把 `apps/api` 部署到 Vercel（Root Directory 設成 `apps/api`），設定 `ANTHROPIC_API_KEY` 和 `ALLOWED_ORIGINS`
- 網頁：執行 `npm run build -w @aistory/client`，把 `apps/client/out/` 放到任何靜態主機

## 上架 App Store（下一階段）
1. 在 `apps/client` 加入 Capacitor（`webDir: "out"`），產生 `ios/` 專案
2. 改用原生外掛：相機、原生 TTS、檔案儲存。這樣比較不會被審核以「只是網頁包殼」（Guideline 4.2）退件
3. 如果要上架兒童分類（Kids Category，Guideline 1.3）：不能有第三方廣告和追蹤，對外連結和購買都要加家長門檻
4. 需要 Apple Developer 帳號；iOS 建置需要 Mac 或雲端 CI（例如 Codemagic、Xcode Cloud）
