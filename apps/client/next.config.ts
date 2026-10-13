import type { NextConfig } from "next";

// 靜態輸出：同一份 out/ 可以部署成網頁，也可以由 Capacitor 打包成 iOS / Android App
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@aistory/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
