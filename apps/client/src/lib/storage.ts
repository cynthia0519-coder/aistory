// 故事書櫃：全部存在裝置的 IndexedDB，不上雲端。離線時可以照常閱讀與朗讀。
import { openDB, type IDBPDatabase } from "idb";
import type { HeroLook } from "./heroes";
import type { AgeBand, Hero, Language, StoryLength, StoryOutput, StorySetting, StoryStyle } from "@aistory/shared";

export interface SavedStory extends Omit<StoryOutput, "setting"> {
  id: string;
  createdAt: number;
  language: Language;
  ageBand: AgeBand;
  /** 舊版存的故事沒有以下欄位 */
  setting?: StorySetting;
  style?: StoryStyle;
  length?: StoryLength;
  hero?: Hero;
  /** 主角外觀（只存在裝置上，不送 API）；選填欄位，不需要升級 DB 版本 */
  heroLook?: HeroLook;
  /** 320px 縮圖；原圖不保存 */
  thumbnail?: Blob;
}

const DB_NAME = "aistory";
const STORE = "stories";
/** 主角資料（lib/heroes.ts 使用） */
export const HERO_STORE = "heroes";

let dbPromise: Promise<IDBPDatabase> | null = null;

// 版本 1：stories；版本 2：加上 heroes。升級時只補缺的 store，不動舊資料
export function db() {
  dbPromise ??= openDB(DB_NAME, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (oldVersion < 2 && !database.objectStoreNames.contains(HERO_STORE)) {
        const heroes = database.createObjectStore(HERO_STORE, { keyPath: "id" });
        heroes.createIndex("createdAt", "createdAt");
      }
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
