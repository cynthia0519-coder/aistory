// 爸媽的錄音：每段（含標題）錄一次，之後播放故事時用爸媽的聲音念。
// 錄音只存在這支手機的 IndexedDB（recordings store），不上傳。
//
// 一段一筆，key 是「故事 id + 段落」；同時存當時的文字。
// 故事庫的故事會換成主角的名字，換了主角文字就不同，舊錄音就不拿來播（那段改用 AI 聲音），重錄會覆蓋。
import type { Language } from "@aistory/shared";
import { db, RECORDING_STORE } from "./storage";
import { SILENT_WAV, type Narrator } from "./tts";

export interface RecordingEntry {
  key: string;
  storyId: string;
  /** -1 = 標題 */
  index: number;
  /** 錄音時的文字；跟現在的文字不同就不拿來播 */
  text: string;
  blob: Blob;
  createdAt: number;
}

const keyOf = (storyId: string, index: number) => `${storyId}#${index}`;

/** 這個故事的錄音，依段落 */
export async function loadRecordings(storyId: string): Promise<Map<number, RecordingEntry>> {
  const all = (await (await db()).getAllFromIndex(RECORDING_STORE, "storyId", storyId)) as RecordingEntry[];
  return new Map(all.map((r) => [r.index, r]));
}

export async function saveRecording(storyId: string, index: number, text: string, blob: Blob): Promise<RecordingEntry> {
  const entry: RecordingEntry = { key: keyOf(storyId, index), storyId, index, text, blob, createdAt: Date.now() };
  await (await db()).put(RECORDING_STORE, entry);
  return entry;
}

export async function deleteRecordings(storyId: string) {
  const tx = (await db()).transaction(RECORDING_STORE, "readwrite");
  for (const key of await tx.store.index("storyId").getAllKeys(storyId)) await tx.store.delete(key);
  await tx.done;
}

// ---- 錄音 ----

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** iOS Safari 只錄得出 mp4；其他瀏覽器多半是 webm */
function pickMimeType(): string | undefined {
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

/** 一段最長錄 3 分鐘，忘了按停止也不會一直錄 */
const MAX_SECONDS = 180;

export interface Mic {
  start(): void;
  /** 停止並拿到這段錄音；錄太短（誤觸）回傳 null */
  stop(): Promise<Blob | null>;
  isRecording(): boolean;
  /** 關掉麥克風（iOS 的麥克風指示燈才會熄） */
  close(): void;
}

/** 打開麥克風；第一次會跳出權限詢問。整個錄音過程共用一個，不用每段都問 */
export async function openMic(onAutoStop: () => void): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const mimeType = pickMimeType();
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let limit: ReturnType<typeof setTimeout> | null = null;

  return {
    start() {
      if (recorder?.state === "recording") return;
      chunks = [];
      recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.start();
      startedAt = Date.now();
      limit = setTimeout(onAutoStop, MAX_SECONDS * 1000);
    },

    stop() {
      if (limit) clearTimeout(limit);
      limit = null;
      const r = recorder;
      if (!r || r.state === "inactive") return Promise.resolve(null);
      return new Promise((resolve) => {
        r.onstop = () => {
          const tooShort = Date.now() - startedAt < 600;
          const blob = new Blob(chunks, { type: r.mimeType || mimeType || "audio/mp4" });
          resolve(tooShort || blob.size === 0 ? null : blob);
        };
        r.stop();
      });
    },

    isRecording: () => recorder?.state === "recording",

    close() {
      if (limit) clearTimeout(limit);
      if (recorder?.state === "recording") recorder.stop();
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

// ---- 用錄音念故事 ----

/**
 * 有錄音的段落播錄音，沒錄（或文字變了）的段落交給 fallback（AI 聲音）。
 * 跟其他朗讀一樣實作 Narrator，閱讀頁的播放流程不用改。
 */
export function createRecordedNarrator(byText: Map<string, Blob>, fallback: Narrator): Narrator {
  let session = 0;
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;

  function release() {
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  return {
    isSupported: () => typeof Audio !== "undefined",

    prepare() {
      audio ??= new Audio();
      audio.src = SILENT_WAV;
      audio.play().catch(() => {});
      fallback.prepare?.();
    },

    prefetch(text: string, language: Language) {
      if (!byText.has(text)) fallback.prefetch?.(text, language);
    },

    speak(text, language, onEnd) {
      release();
      fallback.stop();
      const id = ++session;
      const blob = byText.get(text);
      if (!blob) return fallback.speak(text, language, onEnd);
      const el = (audio ??= new Audio());
      const url = URL.createObjectURL(blob);
      objectUrl = url;
      const done = (next: () => void) => {
        if (id !== session) return;
        release();
        next();
      };
      el.onended = () => done(onEnd);
      // 錄音壞了：這段改用 AI 聲音
      el.onerror = () => done(() => fallback.speak(text, language, onEnd));
      el.src = url;
      el.play().catch((err: unknown) => {
        if (id !== session || (err instanceof DOMException && err.name === "AbortError")) return;
        done(() => fallback.speak(text, language, onEnd));
      });
    },

    stop() {
      session++;
      release();
      fallback.stop();
    },
  };
}
