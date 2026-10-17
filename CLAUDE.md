@AGENTS.md

# 照片說故事 — 專案規則

## 結構
- `apps/client`：Next.js 靜態輸出（`output: "export"`），同一份 `out/` 給網頁與 Capacitor App 使用；iOS 專案在 `apps/client/ios/`，出版流程見 `docs/ios-release.md`
- `apps/api`：Next.js Route Handler，唯一呼叫 Claude 的地方
- `packages/shared`：年齡規則、語言、API 契約（zod schema），前後端共用

## 規則
- 照片絕不寫入伺服器磁碟、資料庫或 log；原圖也不存在裝置上，只存 320px 縮圖
- 故事資料與爸媽的錄音只存在裝置的 IndexedDB（`apps/client/src/lib/storage.ts`、`recordings.ts`），不上雲端
- 改到資料流向（照片、主角資料、錄音送去哪裡或存在哪裡）時，同步更新隱私權政策 `apps/client/src/components/Privacy.tsx`，並把 `lib/privacy.ts` 的 `CONSENT_VERSION` 加一；政策文字在 `apps/client/src/lib/privacy-policy.ts`，改完跑 `npm run privacy:export -w @aistory/client` 更新官網那份（`apps/client/site/aistory/privacy/index.html`，放到 goldenstar.com.tw/aistory/privacy/）
- 所有 LLM 呼叫在 `apps/api/src/lib/`，前端不直接呼叫 Claude
- 故事庫的草稿（`draft: true`）App 不顯示；人工審過後用 `npm run library:publish -w @aistory/api -- <id>` 上架，審稿時網址加 `?drafts=1` 看草稿
- 頻道節目與 App 故事庫同步：每批節目使用者聽完確認後，同一批故事 id 也要 `library:publish` 上架（AI 預審是 check 的先排除，處理完再補上）；節目只用已上架或同批要上架的故事
- 年齡規則只能在 `packages/shared/src/index.ts` 的 `AGE_RULES` 修改
- client 不可使用需要伺服器的功能（動態路由、cookies、server actions、route handler），否則無法打包成 App
- 換 TTS 供應商時實作 `Narrator` 介面（`apps/client/src/lib/tts.ts`），不改呼叫端

## 驗證
`npm run typecheck && npm run lint && npm run build`
