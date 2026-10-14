// 背景音樂：播放 public/music/ 裡的 Mureka 曲子（商用授權證書由營運端保存，不放進 repo）。
//
// 每首 loop 檔案的長度是「loop 秒數 + CROSSFADE 秒」：最後幾秒是接續的音樂，
// 下一輪從頭開始播時和它交叉淡化，所以循環不會有斷點，也不受 AAC 編碼開頭的空白影響。
//
// 選曲：有主題的故事依主題分類選曲（身體自主、寵物離別等用溫柔的那首），
// 其他依故事風格，每種風格兩首輪流。
//
// iOS WKWebView 只允許在使用者手勢裡建立或恢復 AudioContext，所以 start() / setEnabled(true)
// 必須在按鈕的 click 處理函式裡「同步」呼叫；音檔下載解碼是之後的事，不影響。
import { THEMES, type StoryStyle, type ThemeId } from "@aistory/shared";

export interface BackgroundMusic {
  isSupported(): boolean;
  /** 開始（或換成）某個故事的音樂，並播開場音效；必須在使用者手勢裡呼叫 */
  start(style: StoryStyle, theme?: ThemeId): void;
  /** 淡出後停止 */
  stop(fadeSeconds?: number): void;
  /** 故事念完：播結尾音效，音樂淡出 */
  end(): void;
  /** 念故事時把音樂壓低，段落之間再放大 */
  duck(on: boolean): void;
  /** 使用者的開關；關掉時淡出，打開時若正在念故事就接著播 */
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
}

/** 每首曲子的 loop 長度（秒）；由 Mureka 原檔挑出最相似的兩點切出來 */
const LOOPS = {
  "bedtime-1": 62.0,
  "bedtime-2": 67.4,
  "cute-1": 61.6,
  "cute-2": 60.0,
  "adventure-1": 76.8,
  "adventure-2": 83.9,
  "inspiring-1": 71.8,
  "inspiring-2": 68.6,
  "theme-tender": 63.2,
  "theme-careful": 99.2,
  "theme-routine": 81.6,
  "theme-calm": 73.2,
} as const;
type Track = keyof typeof LOOPS;

const CROSSFADE = 3;
const VOLUME = 0.5;
const DUCKED = 0.35;
const SFX_VOLUME = 0.7;
/** 開場音效先響一下，音樂再淡入 */
const MUSIC_DELAY = 1.2;

/** 情緒比較重的主題不管分類都用溫柔的那首 */
const TENDER_THEMES: ThemeId[] = ["pet-loss", "fear-of-dark", "new-sibling"];

function pickTrack(style: StoryStyle, theme?: ThemeId): Track {
  if (theme) {
    if (TENDER_THEMES.includes(theme)) return "theme-tender";
    const category = THEMES[theme]?.category;
    if (category === "body") return "theme-tender";
    if (category === "safety") return "theme-careful";
    if (category === "habits") return "theme-routine";
    if (category === "emotions") return "theme-calm";
  }
  return `${style}-${nextVariant(style)}`;
}

const url = (name: string) => `/music/${name}.mp3`;

function createEngine(): BackgroundMusic {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null; // 淡入淡出、開關
  let duckGain: GainNode | null = null; // 念故事時壓低
  let sfxGain: GainNode | null = null; // 音效不跟著壓低

  let enabled = true;
  /** 正在念的故事要的曲子；null = 沒在念 */
  let wanted: Track | null = null;
  let playing: Track | null = null;
  /** 換曲或停止時加一，讓還在下載的舊曲子作廢 */
  let generation = 0;
  let sources: AudioBufferSourceNode[] = [];
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  // 解碼後的音樂很佔記憶體（一首約 25MB），只留目前這首和兩個短音效
  const buffers = new Map<string, Promise<AudioBuffer | null>>();

  function load(name: string): Promise<AudioBuffer | null> {
    let p = buffers.get(name);
    if (!p) {
      p = fetch(url(name))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => new Promise<AudioBuffer>((ok, fail) => ctx!.decodeAudioData(data, ok, fail)))
        .catch(() => {
          buffers.delete(name); // 離線或失敗：下次再試，這次就安靜地不放音樂
          return null;
        });
      buffers.set(name, p);
    }
    return p;
  }

  function forgetOtherTracks(keep: Track) {
    for (const name of buffers.keys()) {
      if (name in LOOPS && name !== keep) buffers.delete(name);
    }
  }

  function ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0;
      duckGain = ctx.createGain();
      duckGain.connect(master);
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = SFX_VOLUME;
      sfxGain.connect(ctx.destination);
    }
    // 在手勢裡恢復；iOS 從背景回來時 context 也可能被暫停
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    return ctx;
  }

  function sfx(name: "sfx-start" | "sfx-end") {
    const c = ctx;
    if (!c || !enabled) return;
    load(name).then((buf) => {
      if (!buf || !sfxGain) return;
      const s = c.createBufferSource();
      s.buffer = buf;
      s.connect(sfxGain);
      s.start();
      s.onended = () => s.disconnect();
    });
  }

  function stopSources(at: number) {
    for (const s of sources) {
      try {
        s.stop(at);
      } catch {
        // 已經停了
      }
    }
    sources = [];
  }

  /**
   * 第 k 輪在 t0 + k*loop 開始；每輪最後 CROSSFADE 秒和下一輪的開頭重疊。
   * 一輪結束時再排下下輪，所以永遠提前約一分鐘排好，分頁在背景也不會斷。
   */
  function scheduleRound(buf: AudioBuffer, loop: number, t0: number, k: number, gen: number) {
    const c = ctx!;
    if (gen !== generation) return;
    const at = t0 + k * loop;
    const g = c.createGain();
    if (k > 0) {
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + CROSSFADE);
    }
    g.gain.setValueAtTime(1, at + loop);
    g.gain.linearRampToValueAtTime(0, at + loop + CROSSFADE);
    g.connect(duckGain!);
    const s = c.createBufferSource();
    s.buffer = buf;
    s.connect(g);
    s.start(Math.max(at, c.currentTime));
    s.stop(at + loop + CROSSFADE);
    sources.push(s);
    s.onended = () => {
      s.disconnect();
      g.disconnect();
      sources = sources.filter((x) => x !== s);
      scheduleRound(buf, loop, t0, k + 2, gen);
    };
  }

  function play(track: Track) {
    const c = ensureContext();
    if (!c || !master) return;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    const now = c.currentTime;
    if (playing !== track) {
      const gen = ++generation;
      stopSources(now + 0.8); // 舊曲子跟著 master 淡出
      playing = track;
      forgetOtherTracks(track);
      load(track).then((buf) => {
        if (!buf || gen !== generation) return;
        const t0 = Math.max(c.currentTime + 0.05, now + MUSIC_DELAY);
        scheduleRound(buf, LOOPS[track], t0, 0, gen);
        scheduleRound(buf, LOOPS[track], t0, 1, gen);
      });
    }
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(VOLUME, now + MUSIC_DELAY + 2);
  }

  function fadeOut(seconds: number) {
    if (!ctx || !master || !playing) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + seconds);
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      stopTimer = null;
      generation++;
      stopSources(0);
      playing = null;
      // 不播時暫停 context，省電；下次 start() 在手勢裡再恢復
      ctx?.suspend().catch(() => {});
    }, seconds * 1000 + 100);
  }

  return {
    isSupported: () =>
      typeof window !== "undefined" &&
      ("AudioContext" in window || "webkitAudioContext" in (window as unknown as Record<string, unknown>)),

    start(style, theme) {
      wanted = pickTrack(style, theme);
      if (!enabled) return;
      ensureContext();
      sfx("sfx-start");
      play(wanted);
    },

    stop(fadeSeconds = 1.5) {
      wanted = null;
      fadeOut(fadeSeconds);
    },

    end() {
      wanted = null;
      if (!playing) return;
      sfx("sfx-end");
      fadeOut(4);
    },

    duck(on) {
      if (!ctx || !duckGain) return;
      duckGain.gain.setTargetAtTime(on ? DUCKED : 1, ctx.currentTime, on ? 0.25 : 0.6);
    },

    setEnabled(on) {
      enabled = on;
      if (!on) fadeOut(0.8);
      else if (wanted) play(wanted);
    },

    isEnabled: () => enabled,
  };
}

export const bgm: BackgroundMusic = createEngine();

// ---- 使用者偏好，記在 localStorage（私密模式等情況可能讀寫失敗，失敗就用預設）----
const PREF_KEY = "aistory.bgm";
const VARIANT_KEY = "aistory.bgm.variant";

/** 同一種風格的兩首輪流播，連聽幾個故事比較不膩 */
function nextVariant(style: StoryStyle): 1 | 2 {
  try {
    const all = JSON.parse(localStorage.getItem(VARIANT_KEY) ?? "{}") as Record<string, number>;
    const v = all[style] === 1 ? 2 : 1;
    localStorage.setItem(VARIANT_KEY, JSON.stringify({ ...all, [style]: v }));
    return v;
  } catch {
    return Math.random() < 0.5 ? 1 : 2;
  }
}

export function loadMusicPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveMusicPref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // 存不了就只在這次有效
  }
}
