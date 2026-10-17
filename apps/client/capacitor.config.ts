import type { CapacitorConfig } from "@capacitor/cli";

// iOS App：把 next build 的靜態輸出（out/）包成 App，網頁版用同一份。
// appId 上傳到 App Store Connect 後就不能改，正式值確認後再上傳。
const config: CapacitorConfig = {
  appId: "tw.com.goldenstar.aistory",
  appName: "照片說故事",
  webDir: "out",
  ios: {
    // 內容延伸到瀏海與底部安全區，畫面本身已用 env(safe-area-inset-*) 留白
    contentInset: "never",
    backgroundColor: "#f4ecdc",
  },
};

export default config;
