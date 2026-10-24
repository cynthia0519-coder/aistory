// 故事庫上架：人工審過的故事把 draft 改成 false，App 才看得到（apps/client/src/lib/library.ts 會藏草稿）。
// AI 預審只是第一關：status 是 fix、或審完內容又改過（雜湊不同）的故事不讓上架，要先重跑 library:review。
import type { LibraryStory } from "@aistory/shared";

export interface PublishFlag {
  status: string;
  hash: string;
}

export interface PublishResult {
  stories: LibraryStory[];
  changed: string[];
  errors: string[];
}

/** 排程時間：「2026-11-17」= 那天台灣時間 19:30（節目發布時間）；也可以給完整 ISO 時間 */
export function parsePublishAt(value: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T19:30:00+08:00` : value;
  if (Number.isNaN(Date.parse(iso)) || !/(Z|[+-]\d{2}:\d{2})$/.test(iso)) throw new Error(`看不懂的時間：${value}`);
  return iso;
}

/**
 * publish = true 上架、false 下架；force 跳過 AI 預審的檢查（下架不檢查）。
 * schedule 是 id → 上架時間；有給的故事到那個時間 App 才顯示，沒給的立刻顯示（下架一律清掉排程）。
 */
export function setPublished(
  stories: LibraryStory[],
  ids: string[],
  publish: boolean,
  flags: Record<string, PublishFlag | undefined>,
  hashOf: (s: LibraryStory) => string,
  force = false,
  schedule: Record<string, string> = {},
): PublishResult {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const errors: string[] = [];
  const targets = new Set<string>();
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) {
      errors.push(`${id}: 故事庫裡沒有這則`);
      continue;
    }
    if (publish && !force) {
      const f = flags[id];
      if (!f) errors.push(`${id}: 還沒跑過 AI 預審`);
      else if (f.hash !== hashOf(s)) errors.push(`${id}: 預審後內容改過，先重跑 library:review`);
      else if (f.status === "fix") errors.push(`${id}: AI 預審要求修改（fix）`);
      else targets.add(id);
    } else targets.add(id);
  }
  // 有任何錯誤就整批不動，避免只上架一半
  if (errors.length) return { stories, changed: [], errors };
  const changed: string[] = [];
  const next = stories.map((s) => {
    if (!targets.has(s.id)) return s;
    const publishAt = publish ? schedule[s.id] : undefined;
    if (s.draft === !publish && s.publishAt === publishAt) return s;
    changed.push(s.id);
    const updated: LibraryStory = { ...s, draft: !publish };
    if (publishAt) updated.publishAt = publishAt;
    else delete updated.publishAt;
    return updated;
  });
  return { stories: next, changed, errors };
}
