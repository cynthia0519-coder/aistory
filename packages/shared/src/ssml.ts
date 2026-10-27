// SSML 組字：純函式、不依賴任何環境，放在共用套件方便用 node --test 測試。
// 只有 apps/api 會用到（經由 "@aistory/shared/ssml"），前端不會打包這支。

/** XML 跳脫：文字裡可能有小孩的名字或引號，一律跳脫，避免破壞 SSML 結構 */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&apos;",
  );
}

/** 語音名稱的前兩段就是語系，例如 zh-TW-HsiaoChenNeural → zh-TW */
export function voiceLocale(voice: string): string {
  const [lang, region] = voice.split("-");
  if (!lang || !region) throw new Error(`invalid voice name: ${voice}`);
  return `${lang}-${region}`;
}

/** 睡前故事的語速：比預設慢一點，聽起來比較安穩 */
export const SSML_RATE = "-8%";

export function buildSsml(text: string, voice: string): string {
  const locale = voiceLocale(voice);
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(locale)}">` +
    `<voice name="${escapeXml(voice)}">` +
    `<prosody rate="${SSML_RATE}">${escapeXml(text)}</prosody>` +
    `</voice></speak>`
  );
}
