// 背景音樂。
//
// ⚠ PLACEHOLDER（暫代）：這裡的音樂全部用 Web Audio API 即時合成（振盪器、濾波器、音量包絡），
// 沒有任何音檔，也沒有授權問題。之後會換成作曲家委託創作或正式授權的曲子：
// 只要另寫一個實作 BackgroundMusic 介面的版本（例如播放 mp3 loop），StoryReader 不用改。
//
// 每種故事風格一段輕柔的循環：溫暖的長音鋪底 + 稀疏的五聲音階旋律（音樂盒或木琴的音色）。
// - bedtime：最慢、最暗、最小聲
// - cute：彈跳的撥弦
// - adventure：輕快的走路節奏
// - inspiring：溫暖的大三和弦
//
// iOS WKWebView 只允許在使用者手勢裡建立或恢復 AudioContext，所以 start() / setEnabled(true)
// 必須在按鈕的 click 處理函式裡「同步」呼叫。
import type { StoryStyle } from "@aistory/shared";

export interface BackgroundMusic {
  isSupported(): boolean;
  /** 開始（或換成）某種風格的音樂；必須在使用者手勢裡呼叫 */
  start(style: StoryStyle): void;
  /** 淡出後停止 */
  stop(fadeSeconds?: number): void;
  /** 念故事時把音樂壓低，段落之間再放大 */
  duck(on: boolean): void;
  /** 使用者的開關；關掉時淡出，打開時若正在念故事就接著播 */
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
}

type Voice = "musicbox" | "marimba" | "pluck";

interface StyleSpec {
  bpm: number;
  /** 調性的主音（MIDI） */
  key: number;
  /** 和弦進行；每個和弦是相對主音的半音數 */
  progression: number[][];
  beatsPerChord: number;
  pad: { wave: OscillatorType; cutoff: number; level: number; attack: number };
  melody: { voice: Voice; octave: number; stepBeats: number; density: number; level: number };
  /** 低音：每拍一個音，數字是相對和弦根音的半音數（低一個八度）；null = 不彈 */
  bass?: { pattern: (number | null)[]; voice: Voice; level: number };
  /** 整體音量與最後的低通濾波（越低越暗） */
  volume: number;
  tone: number;
}

// 和弦：開放排列，聽起來比較溫暖
const I = [0, 7, 16];
const IV = [5, 12, 21];
const V = [7, 14, 23];
const VI = [-3, 4, 12];

const STYLES: Record<StoryStyle, StyleSpec> = {
  bedtime: {
    bpm: 52,
    key: 50, // D3
    progression: [I, VI, IV, I],
    beatsPerChord: 8,
    pad: { wave: "triangle", cutoff: 650, level: 0.05, attack: 3 },
    melody: { voice: "musicbox", octave: 24, stepBeats: 1, density: 0.28, level: 0.05 },
    volume: 0.5,
    tone: 1600,
  },
  cute: {
    bpm: 104,
    key: 60, // C4
    progression: [I, IV, V, I],
    beatsPerChord: 4,
    pad: { wave: "triangle", cutoff: 1300, level: 0.03, attack: 0.8 },
    melody: { voice: "pluck", octave: 12, stepBeats: 0.5, density: 0.42, level: 0.07 },
    bass: { pattern: [0, null, 7, null], voice: "pluck", level: 0.06 },
    volume: 0.55,
    tone: 4200,
  },
  adventure: {
    bpm: 96,
    key: 55, // G3
    progression: [I, V, VI, IV],
    beatsPerChord: 4,
    pad: { wave: "sawtooth", cutoff: 900, level: 0.025, attack: 1 },
    melody: { voice: "marimba", octave: 12, stepBeats: 0.5, density: 0.3, level: 0.07 },
    // 走路的低音：根音、五度、八度、五度
    bass: { pattern: [0, 7, 12, 7], voice: "marimba", level: 0.07 },
    volume: 0.55,
    tone: 3600,
  },
  inspiring: {
    bpm: 72,
    key: 53, // F3
    progression: [I, V, VI, IV],
    beatsPerChord: 4,
    pad: { wave: "sawtooth", cutoff: 1500, level: 0.035, attack: 1.5 },
    melody: { voice: "marimba", octave: 24, stepBeats: 1, density: 0.32, level: 0.06 },
    volume: 0.55,
    tone: 3200,
  },
};

/** 大調五聲音階：怎麼彈都不會不和諧 */
const PENTATONIC = [0, 2, 4, 7, 9];
const DUCKED = 0.35;
const LOOKAHEAD = 0.25;
const TICK_MS = 60;

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function createEngine(): BackgroundMusic {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null; // 淡入淡出、開關
  let duckGain: GainNode | null = null; // 念故事時壓低
  let tone: BiquadFilterNode | null = null; // 整體亮度
  let bus: GainNode | null = null; // 各音色匯流

  let enabled = true;
  /** 正在念的故事風格；null = 沒在念 */
  let wanted: StoryStyle | null = null;
  let playing: StoryStyle | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let nextTime = 0;
  let step = 0;
  let melodyIndex = 5;

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
      tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.Q.value = 0.3;
      bus = ctx.createGain();

      // 一點點回音，讓音樂盒聽起來有空間感
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.38;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      bus.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(tone);

      bus.connect(tone);
      tone.connect(duckGain);
      duckGain.connect(master);
      master.connect(ctx.destination);
    }
    // 在手勢裡恢復；iOS 從背景回來時 context 也可能被暫停
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    return ctx;
  }

  // ---- 音色 ----

  function envelope(c: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  function osc(c: AudioContext, type: OscillatorType, hz: number, at: number, end: number, out: AudioNode, detune = 0) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = detune;
    o.connect(out);
    o.start(at);
    o.stop(end);
    o.onended = () => o.disconnect();
  }

  function note(voice: Voice, midi: number, at: number, level: number) {
    const c = ctx!;
    const hz = freq(midi);
    if (voice === "musicbox") {
      // 音樂盒：正弦波加上很快消失的高泛音
      const body = envelope(c, at, level, 0.005, 2.2);
      body.connect(bus!);
      osc(c, "sine", hz, at, at + 2.3, body);
      const bell = envelope(c, at, level * 0.25, 0.002, 0.4);
      bell.connect(bus!);
      osc(c, "sine", hz * 4, at, at + 0.5, bell);
    } else if (voice === "marimba") {
      // 木琴：短促的正弦波加上約 4 倍頻的敲擊聲
      const body = envelope(c, at, level, 0.004, 0.9);
      body.connect(bus!);
      osc(c, "sine", hz, at, at + 1, body);
      const knock = envelope(c, at, level * 0.3, 0.002, 0.12);
      knock.connect(bus!);
      osc(c, "sine", hz * 3.9, at, at + 0.15, knock);
    } else {
      // 撥弦：三角波經過一個快速關上的低通濾波
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(hz * 6, at);
      filter.frequency.exponentialRampToValueAtTime(hz * 1.2, at + 0.25);
      const g = envelope(c, at, level, 0.003, 0.45);
      filter.connect(g);
      g.connect(bus!);
      osc(c, "triangle", hz, at, at + 0.5, filter);
    }
  }

  function pad(spec: StyleSpec, chord: number[], at: number, duration: number) {
    const c = ctx!;
    const { wave, cutoff, level, attack } = spec.pad;
    const release = attack * 1.2;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + attack);
    g.gain.setValueAtTime(level, at + duration);
    g.gain.linearRampToValueAtTime(0, at + duration + release);
    filter.connect(g);
    g.connect(bus!);
    for (const offset of chord) {
      const hz = freq(spec.key + offset);
      // 兩個稍微走音的振盪器疊在一起，聲音比較厚、比較暖
      osc(c, wave, hz, at, at + duration + release + 0.05, filter, -6);
      osc(c, wave, hz, at, at + duration + release + 0.05, filter, 6);
    }
  }

  // ---- 排程：每隔一小段時間，把接下來 LOOKAHEAD 秒內的音符排進 AudioContext ----

  function schedule(spec: StyleSpec) {
    const c = ctx!;
    const beat = 60 / spec.bpm;
    const stepLen = beat * spec.melody.stepBeats;
    const stepsPerBeat = 1 / spec.melody.stepBeats;
    const stepsPerChord = spec.beatsPerChord * stepsPerBeat;

    // 分頁在背景時計時器會變慢；落後太多就跳過，不要一次補一堆音
    if (nextTime < c.currentTime - 0.1) nextTime = c.currentTime + 0.05;

    while (nextTime < c.currentTime + LOOKAHEAD) {
      const chordIndex = Math.floor(step / stepsPerChord) % spec.progression.length;
      const chord = spec.progression[chordIndex];
      const onBeat = step % stepsPerBeat === 0;

      if (step % stepsPerChord === 0) pad(spec, chord, nextTime, spec.beatsPerChord * beat);

      if (spec.bass && onBeat) {
        const beatInBar = (step / stepsPerBeat) % spec.bass.pattern.length;
        const offset = spec.bass.pattern[beatInBar];
        if (offset !== null) note(spec.bass.voice, spec.key - 12 + chord[0] + offset, nextTime, spec.bass.level);
      }

      // 稀疏的旋律：在五聲音階上隨機小步移動，正拍比較容易出現
      const chance = spec.melody.density * (onBeat ? 1.4 : 0.6);
      if (Math.random() < chance) {
        melodyIndex = Math.max(0, Math.min(9, melodyIndex + Math.floor(Math.random() * 5) - 2));
        const midi =
          spec.key + spec.melody.octave + PENTATONIC[melodyIndex % 5] + 12 * Math.floor(melodyIndex / 5);
        note(spec.melody.voice, midi, nextTime, spec.melody.level * (onBeat ? 1 : 0.7));
      }

      nextTime += stepLen;
      step++;
    }
  }

  function play(style: StoryStyle) {
    const c = ensureContext();
    if (!c || !master || !tone || !duckGain) return;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    const spec = STYLES[style];
    const now = c.currentTime;
    if (playing !== style) {
      if (timer) clearInterval(timer);
      // 換風格：已排好的音很快就會結束，不需要特別清掉
      step = 0;
      melodyIndex = 5;
      nextTime = now + 0.1;
      tone.frequency.setTargetAtTime(spec.tone, now, 0.1);
      timer = setInterval(() => schedule(spec), TICK_MS);
      schedule(spec);
      playing = style;
    }
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(spec.volume, now + 2);
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
      if (timer) clearInterval(timer);
      timer = null;
      playing = null;
      // 不播時暫停 context，省電；下次 start() 在手勢裡再恢復
      ctx?.suspend().catch(() => {});
    }, seconds * 1000 + 100);
  }

  return {
    isSupported: () =>
      typeof window !== "undefined" &&
      ("AudioContext" in window || "webkitAudioContext" in (window as unknown as Record<string, unknown>)),

    start(style) {
      wanted = style;
      if (enabled) play(style);
    },

    stop(fadeSeconds = 1.5) {
      wanted = null;
      fadeOut(fadeSeconds);
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

// ---- 使用者的開關，記在 localStorage（私密模式等情況可能讀寫失敗，失敗就用預設：開）----
const PREF_KEY = "aistory.bgm";

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
