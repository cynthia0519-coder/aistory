// 錄音備份：把爸媽的錄音、書櫃裡的故事和主角打包成一個檔案，換手機時匯入。
// 檔案只經過使用者自己（存到「檔案」、AirDrop、雲端硬碟），不經過我們的伺服器。
//
// 格式：「AISTORY-BACKUP\n」+ 4 位元組（little-endian）標頭長度 + 標頭 JSON + 依序接起來的音檔與縮圖。
// 不用 base64 塞進 JSON：一個 10 分鐘故事的錄音約 5MB，打包與解開都直接切 Blob，不用整份讀進記憶體。
import { HERO_STORE, db, listStories, RECORDING_STORE, saveStory, type SavedStory } from "./storage";
import type { HeroProfile } from "./heroes";
import { recordingKey, type RecordingEntry } from "./recordings";

const MAGIC = "AISTORY-BACKUP\n";
const VERSION = 1;
const MAX_HEADER_BYTES = 20 * 1024 * 1024;

interface BlobRef {
  type: string;
  size: number;
}

interface Header {
  version: number;
  createdAt: number;
  heroes: HeroProfile[];
  /** thumbnail 換成 blobs 的索引 */
  stories: (Omit<SavedStory, "thumbnail"> & { thumbnail?: number })[];
  recordings: (Omit<RecordingEntry, "blob" | "key"> & { blob: number })[];
  blobs: BlobRef[];
}

export interface BackupSummary {
  recordings: number;
  stories: number;
  heroes: number;
}

export async function hasRecordings(): Promise<boolean> {
  return (await (await db()).count(RECORDING_STORE)) > 0;
}

export async function exportBackup(): Promise<{ file: File; summary: BackupSummary }> {
  const database = await db();
  const [stories, heroes, recordings] = await Promise.all([
    listStories(),
    database.getAll(HERO_STORE) as Promise<HeroProfile[]>,
    database.getAll(RECORDING_STORE) as Promise<RecordingEntry[]>,
  ]);
  const blobs: Blob[] = [];
  const add = (b: Blob) => blobs.push(b) - 1;

  const header: Header = {
    version: VERSION,
    createdAt: Date.now(),
    heroes,
    stories: stories.map(({ thumbnail, ...s }) => ({ ...s, ...(thumbnail ? { thumbnail: add(thumbnail) } : {}) })),
    recordings: recordings.map((r) => ({
      storyId: r.storyId,
      index: r.index,
      text: r.text,
      createdAt: r.createdAt,
      blob: add(r.blob),
    })),
    blobs: [],
  };
  header.blobs = blobs.map((b) => ({ type: b.type, size: b.size }));

  const json = new TextEncoder().encode(JSON.stringify(header));
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, json.byteLength, true);
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([MAGIC, len, json, ...blobs], `aistory-backup-${date}.aistory`, {
    type: "application/octet-stream",
  });
  return { file, summary: { recordings: recordings.length, stories: stories.length, heroes: heroes.length } };
}

/** 分享或下載備份檔：手機上叫出分享選單（存到「檔案」、AirDrop），不支援時直接下載 */
export async function shareBackup(file: File) {
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 使用者取消
      // 其他錯誤改用下載
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export class BackupError extends Error {}

const isStr = (v: unknown): v is string => typeof v === "string";

/** 匯入：已經有的故事與主角不覆蓋；同一段錄音以檔案裡的為準 */
export async function importBackup(file: File): Promise<BackupSummary> {
  const magic = await file.slice(0, MAGIC.length).text();
  if (magic !== MAGIC) throw new BackupError("這不是說故事的備份檔。");
  const lenBuf = await file.slice(MAGIC.length, MAGIC.length + 4).arrayBuffer();
  if (lenBuf.byteLength < 4) throw new BackupError("備份檔不完整。");
  const len = new DataView(lenBuf).getUint32(0, true);
  const start = MAGIC.length + 4;
  if (len > MAX_HEADER_BYTES || start + len > file.size) throw new BackupError("備份檔不完整。");

  let header: Header;
  try {
    header = JSON.parse(await file.slice(start, start + len).text()) as Header;
  } catch {
    throw new BackupError("備份檔壞掉了。");
  }
  if (header.version !== VERSION) throw new BackupError("這個備份檔的版本太新，請先更新 App。");
  if (!Array.isArray(header.blobs) || !Array.isArray(header.recordings) || !Array.isArray(header.stories)) {
    throw new BackupError("備份檔壞掉了。");
  }

  // 每個音檔／縮圖在檔案裡的位置
  let offset = start + len;
  const blobs = header.blobs.map((b) => {
    const blob = file.slice(offset, offset + b.size, b.type);
    offset += b.size;
    return blob;
  });
  if (offset > file.size) throw new BackupError("備份檔不完整。");
  const blobAt = (i: unknown) => (typeof i === "number" ? blobs[i] : undefined);

  const database = await db();
  const summary: BackupSummary = { recordings: 0, stories: 0, heroes: 0 };

  for (const h of Array.isArray(header.heroes) ? header.heroes : []) {
    if (!isStr(h?.id) || !isStr(h.name)) continue;
    if (await database.get(HERO_STORE, h.id)) continue;
    await database.put(HERO_STORE, h);
    summary.heroes++;
  }

  const existing = new Set((await listStories()).map((s) => s.id));
  for (const { thumbnail, ...s } of header.stories) {
    if (!isStr(s?.id) || !isStr(s.title) || !Array.isArray(s.paragraphs) || existing.has(s.id)) continue;
    const thumb = blobAt(thumbnail);
    // 縮圖讀成獨立的 Blob 再存，不留著指向備份檔的參照
    await saveStory({ ...s, ...(thumb ? { thumbnail: new Blob([await thumb.arrayBuffer()], { type: thumb.type }) } : {}) });
    summary.stories++;
  }

  for (const r of header.recordings) {
    const blob = blobAt(r?.blob);
    if (!blob || !isStr(r.storyId) || !isStr(r.text) || !Number.isInteger(r.index) || r.index < -1) continue;
    const entry: RecordingEntry = {
      key: recordingKey(r.storyId, r.index),
      storyId: r.storyId,
      index: r.index,
      text: r.text,
      blob: new Blob([await blob.arrayBuffer()], { type: blob.type }),
      createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    };
    await database.put(RECORDING_STORE, entry);
    summary.recordings++;
  }
  return summary;
}
