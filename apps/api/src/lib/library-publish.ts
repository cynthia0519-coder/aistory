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

/** publish = true 上架、false 下架；force 跳過 AI 預審的檢查（下架不檢查） */
export function setPublished(
  stories: LibraryStory[],
  ids: string[],
  publish: boolean,
  flags: Record<string, PublishFlag | undefined>,
  hashOf: (s: LibraryStory) => string,
  force = false,
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
    if (!targets.has(s.id) || s.draft === !publish) return s;
    changed.push(s.id);
    return { ...s, draft: !publish };
  });
  return { stories: next, changed, errors };
}
