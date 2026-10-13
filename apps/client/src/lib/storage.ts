// 故事書櫃：全部存在裝置的 IndexedDB，不上雲端。離線時可以照常閱讀與朗讀。
import { openDB, type IDBPDatabase } from "idb";
import type { AgeBand, Language, StoryOutput } from "@aistory/shared";

export interface SavedStory extends StoryOutput {
  id: string;
  createdAt: number;
  language: Language;
  ageBand: AgeBand;
  /** 320px 縮圖；原圖不保存 */
  thumbnail?: Blob;
}

const DB_NAME = "aistory";
const STORE = "stories";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
    },
  });
  return dbPromise;
}

export async function saveStory(story: SavedStory) {
  await (await db()).put(STORE, story);
}

export async function listStories(): Promise<SavedStory[]> {
  const all = await (await db()).getAllFromIndex(STORE, "createdAt");
  return all.reverse();
}

export async function deleteStory(id: string) {
  await (await db()).delete(STORE, id);
}

/** 要求瀏覽器不要在空間不足時自動清掉資料（iOS Safari 尤其會清） */
export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // 不支援就算了，不影響功能
  }
}
