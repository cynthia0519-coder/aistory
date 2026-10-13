import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
