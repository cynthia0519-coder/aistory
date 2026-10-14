// 朗讀介面。預設用雲端神經語音（cloudNarrator，經由 apps/api 的 /api/tts 呼叫 Azure），
// 拿不到時自動退回瀏覽器內建 Web Speech API（webSpeechNarrator）。
// 換供應商或改用原生 TTS（Capacitor 外掛）時，只要實作同一個介面，呼叫端不用改。
import { DEFAULT_VOICE, type Language, type TtsRequest } from "@aistory/shared";
import { API_BASE } from "./api";
import { getCachedAudio, putCachedAudio } from "./storage";

export interface Narrator {
  isSupported(): boolean;
  /** 念一段；念完（或失敗）呼叫 onEnd。呼叫 stop() 之後不會再呼叫 onEnd */
  speak(text: string, language: Language, onEnd: () => void): void;
  stop(): void;
  /** 選填：必須在使用者手勢（按下播放）裡同步呼叫，iOS 才允許之後非同步地播放聲音 */
  prepare?(): void;
  /** 選填：先準備下一段，念完這段就能接著念 */
  prefetch?(text: string, language: Language): void;
}

const LOCALES: Record<Language, string[]> = {
  zh: ["zh-TW", "zh-HK", "zh-CN", "zh"],
  en: ["en-US", "en-GB", "en"],
};

function pickVoice(language: Language): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  for (const locale of LOCALES[language]) {
    const local = voices.find((v) => v.lang.replace("_", "-").startsWith(locale) && v.localService);
    if (local) return local; // 優先用裝置內建語音，離線也能念
    const any = voices.find((v) => v.lang.replace("_", "-").startsWith(locale));
    if (any) return any;
  }
  return undefined;
}

export const webSpeechNarrator: Narrator = {
  isSupported: () => typeof window !== "undefined" && "speechSynthesis" in window,
  speak(text, language, onEnd) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(language);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? LOCALES[language][0];
    utterance.rate = 0.9; // 給小孩聽，稍微放慢
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    speechSynthesis.speak(utterance);
  },
  stop() {
    speechSynthesis.cancel();
  },
};

// ---- 雲端朗讀 ----
// 一段文字一個 mp3，存在 IndexedDB（lib/storage.ts 的 audio store），key 是「聲音 + 文字」的 SHA-256。
// 故事庫的故事在裝置上才換成主角的名字，同一個故事換了主角就是不同的文字，
// 所以音檔一定要依「實際念出來的文字」產生與快取，不能依故事 id；用文字雜湊當 key 正好處理這件事。
// 在這個功能之前存的故事不需要遷移：第一次播放時才請求並寫入快取。

/** /api/tts 回 503（伺服器沒設定金鑰）：這次開 App 期間都不再試，直接用裝置語音 */
let cloudUnavailable = false;
/** 連不上伺服器後，暫停一陣子再試，避免每段都等逾時 */
let networkBackoffUntil = 0;
const NETWORK_BACKOFF_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

/** 極短的無聲 WAV：在使用者手勢裡先播一次，iOS WKWebView 之後才允許同一個 <audio> 自動播放 */
export const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

async function audioKey(voice: string, text: string): Promise<string | null> {
  // crypto.subtle 只在安全來源（https、localhost、capacitor://）可用；不能用時就不快取
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${voice}\n${text}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 從快取或 API 拿到音檔；拿不到（離線、伺服器沒設定、網路錯誤）回傳 null，呼叫端改用裝置語音 */
async function fetchAudio(text: string, language: Language): Promise<Blob | null> {
  const voice = DEFAULT_VOICE[language];
  const key = await audioKey(voice, text).catch(() => null);
  if (key) {
    const cached = await getCachedAudio(key).catch(() => null);
    if (cached) return cached;
  }
  if (cloudUnavailable || Date.now() < networkBackoffUntil) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;

  const body: TtsRequest = { text, language, voice };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    networkBackoffUntil = Date.now() + NETWORK_BACKOFF_MS;
    return null;
  }
  if (res.status === 503) {
    cloudUnavailable = true;
    return null;
  }
  // 429 / 502 等：這段用裝置語音，下一段再試
  if (!res.ok) return null;
  const blob = await res.blob().catch(() => null);
  if (!blob || blob.size === 0) return null;
  if (key) await putCachedAudio(key, blob).catch(() => {});
  return blob;
}

/** 同一段文字同時只發一個請求；預先下載的結果給 speak() 直接用 */
const pending = new Map<string, Promise<Blob | null>>();

function getAudio(text: string, language: Language): Promise<Blob | null> {
  const id = `${language}\n${text}`;
  let p = pending.get(id);
  if (!p) {
    p = fetchAudio(text, language).finally(() => {
      // 留一下給緊接著的 speak() 用，之後就靠 IndexedDB
      setTimeout(() => pending.delete(id), 30_000);
    });
    pending.set(id, p);
  }
  return p;
}

function createCloudNarrator(fallback: Narrator): Narrator {
  /** 每次 speak / stop 都換新的 id，舊的非同步結果回來時就知道要丟掉 */
  let session = 0;
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  /** 目前這段的音檔請求；預先下載要等它成功，雲端不能用時就不多發請求 */
  let current: Promise<Blob | null> = Promise.resolve(null);

  function element(): HTMLAudioElement {
    audio ??= new Audio();
    return audio;
  }

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
    isSupported: () =>
      typeof window !== "undefined" && (typeof Audio !== "undefined" || fallback.isSupported()),

    prepare() {
      const el = element();
      el.src = SILENT_WAV;
      el.play().catch(() => {});
      // 萬一要退回裝置語音，也先在手勢裡解鎖 speechSynthesis（iOS 需要）
      if (fallback.isSupported()) {
        const u = new SpeechSynthesisUtterance("");
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    },

    prefetch(text, language) {
      current
        .then((blob) => {
          if (blob) return getAudio(text, language);
        })
        .catch(() => {});
    },

    speak(text, language, onEnd) {
      release();
      fallback.stop();
      const id = ++session;
      const useFallback = () => {
        if (id !== session) return;
        if (fallback.isSupported()) fallback.speak(text, language, onEnd);
        else onEnd();
      };

      current = getAudio(text, language).catch(() => null);
      current.then((blob) => {
        if (id !== session) return;
        if (!blob) return useFallback();
        const el = element();
        const url = URL.createObjectURL(blob);
        objectUrl = url;
        const done = (next: () => void) => {
          if (id !== session) return;
          release();
          next();
        };
        el.onended = () => done(onEnd);
        // 音檔壞了：這段改用裝置語音
        el.onerror = () => done(useFallback);
        el.src = url;
        el.play().catch((err: unknown) => {
          // stop() 中斷的 play() 會丟 AbortError，不用處理
          if (id !== session || (err instanceof DOMException && err.name === "AbortError")) return;
          done(useFallback);
        });
      });
    },

    stop() {
      session++;
      release();
      fallback.stop();
    },
  };
}

export const cloudNarrator: Narrator = createCloudNarrator(webSpeechNarrator);

/** App 預設使用的朗讀 */
export const narrator: Narrator = cloudNarrator;
