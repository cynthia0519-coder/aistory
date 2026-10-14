// 背景音樂：播放 public/music/ 裡的 Mureka 曲子（商用授權證書由營運端保存，不放進 repo）。
//
// 每個曲組有 2–6 首完整的歌，依序播放，歌與歌之間交叉淡化（像電台換歌）。
// 不切 loop：切短會在 10 分鐘的故事裡重播很多次，切長又找不到聽不出接縫的接點。
//
// 選曲：有主題的故事依主題分類選曲組（身體自主、寵物離別等用溫柔的那組），其他依故事風格；
// 每次從曲組的下一首開始，連聽幾個故事不會都從同一首開頭。
//
// 歌用 <audio> 串流播放、接進 Web Audio 控制音量：邊下載邊播，也不用把整首解碼進記憶體。
// iOS 每個 <audio> 第一次播放都要在使用者手勢裡，所以 start() / setEnabled(true)
// 必須在按鈕的 click 處理函式裡「同步」呼叫；兩個播放器都在那時解鎖。
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

/** 曲組與歌數；檔名是 `${曲組}-${1..n}.mp3` */
const GROUPS = {
  bedtime: 4,
  cute: 3,
  adventure: 3,
  inspiring: 6,
  "theme-tender": 2,
  "theme-careful": 2,
  "theme-routine": 2,
  "theme-calm": 2,
} as const;
type Group = keyof typeof GROUPS;

/** 換歌時交叉淡化的秒數 */
const CROSSFADE = 4;
const VOLUME = 0.5;
const DUCKED = 0.35;
const SFX_VOLUME = 0.7;
/** 開場音效先響一下，音樂再淡入 */
const MUSIC_DELAY = 1.2;

/** 情緒比較重的主題不管分類都用溫柔的那組 */
const TENDER_THEMES: ThemeId[] = ["pet-loss", "fear-of-dark", "new-sibling"];

function pickGroup(style: StoryStyle, theme?: ThemeId): Group {
  if (theme) {
    if (TENDER_THEMES.includes(theme)) return "theme-tender";
    const category = THEMES[theme]?.category;
    if (category === "body") return "theme-tender";
    if (category === "safety") return "theme-careful";
    if (category === "habits") return "theme-routine";
    if (category === "emotions") return "theme-calm";
  }
  return style;
}

const songUrl = (group: Group, n: number) => `/music/${group}-${n}.mp3`;
const sfxUrl = (name: string) => `/music/${name}.mp3`;

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
}

function createEngine(): BackgroundMusic {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null; // 淡入淡出、開關
  let duckGain: GainNode | null = null; // 念故事時壓低
  let sfxGain: GainNode | null = null; // 音效不跟著壓低
  /** 兩個播放器輪流：一個在播，另一個準備接下一首 */
  let decks: [Deck, Deck] | null = null;
  let active = 0;

  let enabled = true;
  /** 正在念的故事要的曲組；null = 沒在念 */
  let wanted: Group | null = null;
  let playing: Group | null = null;
  /** 目前在播曲組裡的第幾首（1 起算） */
  let song = 1;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  const sfxBuffers = new Map<string, Promise<AudioBuffer | null>>();

  function ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) {
      // iOS：Web Audio 預設跟著側邊靜音開關，開了靜音就聽不到音樂（朗讀用 <audio> 不受影響）。
      // 設成 playback 才跟朗讀一樣照常出聲（iOS 17 / Safari 17 起支援）
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0;
      duckGain = ctx.createGain();
      duckGain.connect(master);
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = SFX_VOLUME;
      sfxGain.connect(ctx.destination);
      const c = ctx;
      const makeDeck = (): Deck => {
        const el = new Audio();
        el.preload = "auto";
        const gain = c.createGain();
        gain.gain.value = 0;
        c.createMediaElementSource(el).connect(gain);
        gain.connect(duckGain!);
        el.addEventListener("timeupdate", () => onTime(el));
        el.addEventListener("ended", () => onTime(el, true));
        return { el, gain };
      };
      decks = [makeDeck(), makeDeck()];
    }
    // 在手勢裡恢復；iOS 從背景回來時 context 也可能被暫停
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    return ctx;
  }

  /** 快播完時，讓另一個播放器接下一首 */
  function onTime(el: HTMLAudioElement, ended = false) {
    if (!decks || !playing || decks[active].el !== el) return;
    const left = el.duration - el.currentTime;
    if (ended || (Number.isFinite(left) && left <= CROSSFADE)) {
      song = (song % GROUPS[playing]) + 1;
      crossfadeTo(playing, song, CROSSFADE);
    }
  }

  function crossfadeTo(group: Group, n: number, fade: number, delay = 0) {
    const c = ctx!;
    const [outgoing, incoming] = [decks![active], decks![1 - active]];
    active = 1 - active;
    const now = c.currentTime;

    outgoing.gain.gain.cancelScheduledValues(now);
    outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now);
    outgoing.gain.gain.linearRampToValueAtTime(0, now + fade);
    const old = outgoing.el;
    setTimeout(() => {
      // 淡完才停；這段時間如果又換回這個播放器就不要停
      if (decks![active].el !== old) old.pause();
    }, fade * 1000 + 100);

    incoming.el.src = songUrl(group, n);
    incoming.el.currentTime = 0;
    incoming.el.play().catch(() => {});
    incoming.gain.gain.cancelScheduledValues(now);
    incoming.gain.gain.setValueAtTime(0, now);
    incoming.gain.gain.setValueAtTime(0, now + delay);
    incoming.gain.gain.linearRampToValueAtTime(1, now + delay + fade);
  }

  /** iOS：第一次在手勢裡讓兩個播放器都播一下，之後程式才能自己換歌 */
  function unlockDecks() {
    for (const d of decks ?? []) {
      if (d.el.dataset.unlocked) continue;
      d.el.dataset.unlocked = "1";
      if (!d.el.src) d.el.src = sfxUrl("sfx-start");
      d.el
        .play()
        .then(() => {
          if (decks![active] !== d || !playing) d.el.pause();
        })
        .catch(() => {});
    }
  }

  function sfx(name: "sfx-start" | "sfx-end") {
    const c = ctx;
    if (!c || !enabled) return;
    let p = sfxBuffers.get(name);
    if (!p) {
      p = fetch(sfxUrl(name))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => new Promise<AudioBuffer>((ok, fail) => c.decodeAudioData(data, ok, fail)))
        .catch(() => {
          sfxBuffers.delete(name); // 離線或失敗：下次再試，這次就不放音效
          return null;
        });
      sfxBuffers.set(name, p);
    }
    p.then((buf) => {
      if (!buf || !sfxGain) return;
      const s = c.createBufferSource();
      s.buffer = buf;
      s.connect(sfxGain);
      s.start();
      s.onended = () => s.disconnect();
    });
  }

  function play(group: Group) {
    const c = ensureContext();
    if (!c || !master) return;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    const now = c.currentTime;
    if (playing !== group) {
      playing = group;
      song = nextStart(group);
      crossfadeTo(group, song, 2, MUSIC_DELAY);
    }
    unlockDecks();
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(VOLUME, now + 1);
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
      playing = null;
      for (const d of decks ?? []) {
        d.el.pause();
        d.gain.gain.value = 0;
      }
      // 不播時暫停 context，省電；下次 start() 在手勢裡再恢復
      ctx?.suspend().catch(() => {});
    }, seconds * 1000 + 100);
  }

  return {
    isSupported: () =>
      typeof window !== "undefined" &&
      ("AudioContext" in window || "webkitAudioContext" in (window as unknown as Record<string, unknown>)),

    start(style, theme) {
      wanted = pickGroup(style, theme);
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
const START_KEY = "aistory.bgm.next";

/** 每個曲組下次從第幾首開始：每聽一個故事往後一首 */
function nextStart(group: Group): number {
  try {
    const all = JSON.parse(localStorage.getItem(START_KEY) ?? "{}") as Record<string, number>;
    const n = Math.min(Math.max(all[group] ?? 1, 1), GROUPS[group]);
    localStorage.setItem(START_KEY, JSON.stringify({ ...all, [group]: (n % GROUPS[group]) + 1 }));
    return n;
  } catch {
    return 1 + Math.floor(Math.random() * GROUPS[group]);
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
