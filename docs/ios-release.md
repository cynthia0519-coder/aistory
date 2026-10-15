# iOS 上架手冊（TestFlight → App Store）

App 是 `apps/client` 的靜態網頁用 Capacitor 8 包起來，iOS 專案在 `apps/client/ios/`（Swift Package Manager，不用 CocoaPods）。
API 用正式環境 `https://aistory-three.vercel.app`，CORS 已允許 `capacitor://localhost`。

## 每次出新版

在 Mac 上：

```bash
git pull
npm install
npm run build:app -w @aistory/client   # 打包網頁 + 同步到 iOS 專案
open apps/client/ios/App/App.xcodeproj
```

Xcode 裡：

1. 第一次：選 App target → Signing & Capabilities → Team 選公司帳號
2. 每次上傳前把 Build 號 +1（General → Identity → Build）
3. Product → Archive → Distribute App → App Store Connect → Upload

## 第一次上傳前要確認

- [ ] **Bundle ID**：`apps/client/capacitor.config.ts` 的 `appId` 和 Xcode 的 Bundle Identifier 換成正式值（目前是 `com.example.aistory`）。上傳後就不能改
- [ ] Vercel API 專案已設 `INVITE_CODES`、`RATE_LIMIT_SALT`
- [ ] 隱私權政策的聯絡信箱（`apps/client/src/lib/privacy.ts` 的 `PRIVACY_CONTACT`）已填
- [ ] App Store Connect 的「隱私權政策網址」：要一個公開網址（可用網頁版加一頁，或另外的網站）

## 真機要測的（雲端測不到）

- [ ] 拍照、從相簿選照片（第一次會跳出相機權限說明）
- [ ] 錄爸媽的聲音（第一次會跳出麥克風權限說明）、用錄音播放
- [ ] 背景音樂和朗讀；**鎖定螢幕後是否繼續播**（Info.plist 已開背景音訊）
- [ ] 錄音備份「匯出」叫出分享選單、存到「檔案」；再用「匯入」讀回來
- [ ] 隱私權政策裡的 mailto 連結、授權頁的外部連結會用 Safari 開
- [ ] 邀請碼輸入、家長同意、回報故事

## App Store Connect 設定

**類別**：主要「教育」、次要「生活風格」或「書籍」。**不要選「兒童」類別**（Kids Category 禁止第三方資料傳輸與外部連結，我們要把照片送 AI）。

**年齡分級**：4+（內容），但問卷裡「使用者生成內容／AI 生成內容」照實勾。

**App 隱私權（資料收集）**——要和 `ios/App/App/PrivacyInfo.xcprivacy` 一致：

| 資料類型 | 收集？ | 用途 | 連結到身分 | 追蹤 |
|---|---|---|---|---|
| 照片或影片 | 是 | App 功能 | 否 | 否 |
| 姓名（孩子的暱稱，用於故事主角） | 是 | App 功能 | 否 | 否 |
| 其他使用者內容（家長回報的故事文字） | 是 | App 功能 | 否 | 否 |
| 錄音 | 否（只存在手機） | — | — | — |
| 識別碼、位置、聯絡資訊、使用數據 | 否 | — | — | — |

說明：照片和主角資料編故事時送到我們的伺服器再轉給 Anthropic（Claude），伺服器不保存；但第三方服務會依其政策暫存，所以申報為「收集」。

**審核備註（App Review Information → Notes）**：
- 提供一組邀請碼給審核人員（不然拍照編故事功能打不開）
- 說明：照片送 AI 前有家長同意畫面，回報功能在每則故事底部

**TestFlight 外部測試**：建立群組 → 加入 build → 送 Beta 審核 → 開公開連結。每個家庭另外給一組邀請碼。
