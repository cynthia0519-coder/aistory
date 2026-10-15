// 把 App 的隱私權政策輸出成一個獨立的 HTML，放到官網 goldenstar.com.tw/aistory/privacy/（App Store Connect 填這個網址）。
// 用法：npm run privacy:export -w @aistory/client          產生 site/aistory/privacy/index.html
//       npm run privacy:export -w @aistory/client -- --check  只檢查檔案是不是最新的（不是就結束碼 1）
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { POLICY_UPDATED, PRIVACY_CONTACT, PRIVACY_OPERATOR } from "../src/lib/privacy";
import { POLICY_INTRO, POLICY_SECTIONS } from "../src/lib/privacy-policy";

const OUT = join(__dirname, "..", "site", "aistory", "privacy", "index.html");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sections = POLICY_SECTIONS.map(
  (s) => `    <section>
      <h2>${esc(s.heading)}</h2>
      <ul>
${s.items.map((t) => `        <li>${esc(t)}</li>`).join("\n")}
      </ul>
    </section>`,
).join("\n");

const contact = PRIVACY_CONTACT
  ? `    <p>有任何隱私問題，請寫信到 <a href="mailto:${esc(PRIVACY_CONTACT)}">${esc(PRIVACY_CONTACT)}</a>。</p>\n`
  : "";

const html = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>照片說故事 隱私權政策｜${esc(PRIVACY_OPERATOR)}</title>
<meta name="description" content="照片說故事 App 的隱私權政策：照片、孩子的資料、錄音怎麼處理。">
<!-- 此檔由 apps/client/scripts/export-privacy.ts 產生，請改 apps/client/src/lib/privacy-policy.ts 後重新產生，不要直接改這裡 -->
<style>
  :root { --bg: #f4ecdc; --card: #fffaf0; --ink: #2b2a33; --soft: #5b5866; --line: #e3d6bd; --teal: #1f6f74; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14171f; --card: #1d212b; --ink: #ece8df; --soft: #b3aea3; --line: #343a48; --teal: #6cc4c8; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.8 "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 56px; }
  h1 { color: var(--teal); font-size: 28px; letter-spacing: .08em; margin: 0 0 4px; }
  .app { color: var(--soft); margin: 0 0 24px; }
  h2 { font-size: 19px; margin: 28px 0 8px; }
  ul { margin: 0; padding: 0 16px; list-style: none; background: var(--card); border: 2px solid var(--line); border-radius: 16px; }
  li { padding: 12px 0; color: var(--soft); font-size: 15px; }
  li + li { border-top: 1px solid var(--line); }
  a { color: var(--teal); }
  footer { margin-top: 32px; color: var(--soft); font-size: 14px; }
</style>
</head>
<body>
<main>
  <h1>隱私權政策</h1>
  <p class="app">照片說故事</p>
  <p>${esc(POLICY_INTRO)}</p>
${sections}
  <footer>
${contact}    <p>本服務由${esc(PRIVACY_OPERATOR)}提供。</p>
    <p>最後更新：${esc(POLICY_UPDATED)}</p>
  </footer>
</main>
</body>
</html>
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {}
  if (current !== html) {
    console.error("site/aistory/privacy/index.html 不是最新的，請跑 npm run privacy:export -w @aistory/client");
    process.exit(1);
  }
  console.log("官網隱私權政策是最新的");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  console.log(`已輸出 ${OUT}`);
}
