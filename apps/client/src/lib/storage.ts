// 故事書櫃：全部存在裝置的 IndexedDB，不上雲端。離線時可以照常閱讀與朗讀。
import { openDB, type IDBPDatabase } from "idb";
import type { HeroLook } from "./heroes";
import type { AgeBand, Hero, Language, StoryLength, StoryOutput, StorySetting, StoryStyle, ThemeId } from "@aistory/shared";

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
  /** 想聊的主題（選填）；引導卡 guide 來自 StoryOutput，也是選填 */
  theme?: ThemeId;
  /** 主角外觀（只存在裝置上，不送 API）；選填欄位，不需要升級 DB 版本 */
  heroLook?: HeroLook;
  /** 320px 縮圖；原圖不保存 */
  thumbnail?: Blob;
  /** 連載的第 2 集以後才有；第 1 集是原本的故事，id 就是連載的 id */
  series?: { id: string; chapter: number };
}

/** 這個故事屬於哪一套連載、第幾集（沒接過下一集的故事也算第 1 集） */
export function seriesOf(story: SavedStory): { id: string; chapter: number } {
  return story.series ?? { id: story.id, chapter: 1 };
}

/** 同一套連載的所有集數，照集數排 */
export async function listSeries(seriesId: string): Promise<SavedStory[]> {
  const all = await listStories();
  return all.filter((s) => seriesOf(s).id === seriesId).sort((a, b) => seriesOf(a).chapter - seriesOf(b).chapter);
}

/** 書櫃上一套連載只放最新的一集 */
export function latestChapters(stories: SavedStory[]): SavedStory[] {
  const best = new Map<string, SavedStory>();
  for (const s of stories) {
    const { id, chapter } = seriesOf(s);
    const cur = best.get(id);
    if (!cur || seriesOf(cur).chapter < chapter) best.set(id, s);
  }
  return stories.filter((s) => best.get(seriesOf(s).id) === s);
}

const DB_NAME = "aistory";
const STORE = "stories";
/** 主角資料（lib/heroes.ts 使用） */
export const HERO_STORE = "heroes";
/** 雲端朗讀的音檔快取（lib/tts.ts 使用） */
const AUDIO_STORE = "audio";
/** 爸媽的錄音（lib/recordings.ts 使用）；只存在這支手機 */
export const RECORDING_STORE = "recordings";

let dbPromise: Promise<IDBPDatabase> | null = null;

// 版本 1：stories；版本 2：加上 heroes；版本 3：加上 audio；版本 4：加上 recordings。升級時只補缺的 store，不動舊資料
export function db() {
  dbPromise ??= openDB(DB_NAME, 4, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (oldVersion < 2 && !database.objectStoreNames.contains(HERO_STORE)) {
        const heroes = database.createObjectStore(HERO_STORE, { keyPath: "id" });
        heroes.createIndex("createdAt", "createdAt");
      }
      if (oldVersion < 3 && !database.objectStoreNames.contains(AUDIO_STORE)) {
        const audio = database.createObjectStore(AUDIO_STORE, { keyPath: "key" });
        audio.createIndex("lastUsed", "lastUsed");
      }
      if (oldVersion < 4 && !database.objectStoreNames.contains(RECORDING_STORE)) {
        const recordings = database.createObjectStore(RECORDING_STORE, { keyPath: "key" });
        recordings.createIndex("storyId", "storyId");
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
  const database = await db();
  await database.delete(STORE, id);
  // 這個故事的錄音也一起刪
  const tx = database.transaction(RECORDING_STORE, "readwrite");
  for (const key of await tx.store.index("storyId").getAllKeys(id)) await tx.store.delete(key);
  await tx.done;
}

/** 要求瀏覽器不要在空間不足時自動清掉資料（iOS Safari 尤其會清） */
export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // 不支援就算了，不影響功能
  }
}

// ---- 朗讀音檔快取 ----
// key 是「聲音 + 文字」的 SHA-256，不跟故事綁在一起：同一段文字在不同故事裡共用一份，
// 故事庫換了主角名字就是不同文字、自然是不同的 key。
// 也因為不知道音檔屬於哪個故事，刪故事時不刪音檔，改用總量上限：超過就從最久沒播的開始刪（LRU）。
// 一段約 100 字的中文 mp3（48kbps）約 150–250 KB，300 MB 大約是 60 個 10 分鐘故事。

interface AudioEntry {
  key: string;
  blob: Blob;
  size: number;
  lastUsed: number;
}

export const AUDIO_CACHE_MAX_BYTES = 300 * 1024 * 1024;

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const database = await db();
  const entry = (await database.get(AUDIO_STORE, key)) as AudioEntry | undefined;
  if (!entry) return null;
  // 更新最後使用時間，LRU 才不會刪到常聽的故事；寫入失敗不影響播放
  database.put(AUDIO_STORE, { ...entry, lastUsed: Date.now() }).catch(() => {});
  return entry.blob;
}

export async function putCachedAudio(key: string, blob: Blob) {
  const database = await db();
  const entry: AudioEntry = { key, blob, size: blob.size, lastUsed: Date.now() };
  await database.put(AUDIO_STORE, entry);
  await evictAudio(database);
}

async function evictAudio(database: IDBPDatabase) {
  const tx = database.transaction(AUDIO_STORE, "readwrite");
  const index = tx.store.index("lastUsed");
  // 第一遍算總量（只讀 size，Blob 本身不會被載入記憶體）
  let total = 0;
  for (let cursor = await index.openCursor(); cursor; cursor = await cursor.continue()) {
    total += (cursor.value as AudioEntry).size;
  }
  // 第二遍從最舊的開始刪，直到低於上限
  for (let cursor = await index.openCursor(); cursor && total > AUDIO_CACHE_MAX_BYTES; cursor = await cursor.continue()) {
    total -= (cursor.value as AudioEntry).size;
    await cursor.delete();
  }
  await tx.done;
}
