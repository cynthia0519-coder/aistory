import type { Metadata, Viewport } from "next";
import { LXGW_WenKai_TC } from "next/font/google";
import "./globals.css";

// 手寫感標題與故事內文字體。build 時下載並跟著 App 打包，離線也能顯示
const wenkai = LXGW_WenKai_TC({
  weight: ["400", "700"],
  variable: "--font-wenkai",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "照片說故事",
  description: "上傳一張照片，編一個給小孩聽的中英文故事",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "照片說故事", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4ecdc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className={`${wenkai.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
