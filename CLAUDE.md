@AGENTS.md

# 照片說故事 — 專案規則

## 結構
- `apps/client`：Next.js 靜態輸出（`output: "export"`），同一份 `out/` 給網頁與 Capacitor App 使用
- `apps/api`：Next.js Route Handler，唯一呼叫 Claude 的地方
- `packages/shared`：年齡規則、語言、API 契約（zod schema），前後端共用

## 規則
- 照片絕不寫入伺服器磁碟、資料庫或 log；原圖也不存在裝置上，只存 320px 縮圖
- 故事資料與爸媽的錄音只存在裝置的 IndexedDB（`apps/client/src/lib/storage.ts`、`recordings.ts`），不上雲端
- 所有 LLM 呼叫在 `apps/api/src/lib/`，前端不直接呼叫 Claude
- 年齡規則只能在 `packages/shared/src/index.ts` 的 `AGE_RULES` 修改
- client 不可使用需要伺服器的功能（動態路由、cookies、server actions、route handler），否則無法打包成 App
- 換 TTS 供應商時實作 `Narrator` 介面（`apps/client/src/lib/tts.ts`），不改呼叫端

## 驗證
`npm run typecheck && npm run lint && npm run build`
