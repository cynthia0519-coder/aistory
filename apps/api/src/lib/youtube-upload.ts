// YouTube 自動上架的純邏輯（關卡、時間、metadata）；實際呼叫 API 在 scripts/upload-episodes.ts。
// 關卡沿用故事庫：故事要已上架（draft: false），且 App 顯示時間不晚於節目時間，才准上傳。
// 身體自主與原創集要 Cynthia 先聽過才會 library:publish，所以這道關也自動擋住它們。
import type { LibraryStory } from "@aistory/shared";
import { parsePublishAt } from "./library-publish";

export type Lang = "zh" | "en";

export interface PlannedEpisode {
  date: string; // YYYY-MM-DD，節目日
  id: string;
}

export interface UploadRecord {
  videoId: string;
  publishAt: string;
  uploadedAt: string;
}

export type Ledger = Record<string, UploadRecord>; // key: `${lang}-${id}`

export const ledgerKey = (lang: Lang, id: string) => `${lang}-${id}`;

/** 節目日 → YouTube 公開時間（台灣 19:30，轉成 UTC ISO） */
export function episodePublishAt(date: string): string {
  return new Date(parsePublishAt(date)).toISOString();
}

/** 回傳不能上傳的原因；可以上傳回傳 undefined */
export function blockReason(ep: PlannedEpisode, stories: Map<string, LibraryStory>, now: Date): string | undefined {
  const s = stories.get(ep.id);
  if (!s) return "故事庫裡沒有這則";
  if (s.draft) return "故事還是草稿（沒有 library:publish）";
  const at = Date.parse(episodePublishAt(ep.date));
  if (s.publishAt && Date.parse(s.publishAt) > at) return `App 上架時間 ${s.publishAt} 晚於節目時間，會偷跑`;
  // 過去的 publishAt 會讓 YouTube 立刻公開；留 15 分鐘緩衝
  if (at - now.getTime() < 15 * 60 * 1000) return "節目時間已過或太近，不自動上傳";
  return undefined;
}

/** YouTube 標題上限 100 字、不能有 < >；說明上限 5000 bytes */
export function cleanTitle(t: string): string {
  const s = t.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return [...s].slice(0, 100).join("");
}

export function cleanDescription(d: string): string {
  let s = d.replace(/[<>]/g, "");
  while (Buffer.byteLength(s, "utf8") > 5000) s = s.slice(0, -1);
  return s;
}

export function videoResource(
  info: { title: string; description: string },
  lang: Lang,
  publishAt: string,
  categoryId: string,
) {
  return {
    snippet: {
      title: cleanTitle(info.title),
      description: cleanDescription(info.description),
      categoryId,
      defaultLanguage: lang === "zh" ? "zh-Hant" : "en",
      defaultAudioLanguage: lang === "zh" ? "zh-Hant" : "en",
    },
    status: {
      privacyStatus: "private", // 到 publishAt 才公開；之前都還能刪
      publishAt,
      selfDeclaredMadeForKids: true,
      embeddable: true,
    },
  };
}
