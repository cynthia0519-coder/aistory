import { z } from "zod";

// ---- 語言 ----
export const LANGUAGES = ["zh", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: "中文",
  en: "English",
};

// ---- 年齡層：控制用字與句型（長度改由 STORY_LENGTHS 控制）----
export const AGE_BANDS = ["2-4", "4-6", "6-8", "8-10"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export interface AgeRule {
  label: string;
  style: string;
  /** 閱讀頁字級（Tailwind class） */
  fontClass: string;
}

export const AGE_RULES: Record<AgeBand, AgeRule> = {
  "2-4": {
    label: "2–4 歲",
    style:
      "Very short sentences. Repetitive patterns and onomatopoeia. Gentle rhymes are welcome. One simple idea, no conflict, cozy ending.",
    fontClass: "text-2xl leading-relaxed",
  },
  "4-6": {
    label: "4–6 歲",
    style:
      "Short sentences, everyday vocabulary plus 2–3 slightly new words made clear by context. Simple cause and effect. A tiny problem that is solved kindly. Warm ending.",
    fontClass: "text-xl leading-relaxed",
  },
  "6-8": {
    label: "6–8 歲",
    style:
      "Medium sentences, some new words made clear by context (never define them outright). A small challenge, a turning point, and a gentle lesson that is shown, not lectured.",
    fontClass: "text-lg leading-relaxed",
  },
  "8-10": {
    label: "8–10 歲",
    style:
      "Richer vocabulary and varied sentence length. A clear plot with a twist, light humor, and a character who grows.",
    fontClass: "text-base leading-relaxed",
  },
};

/** 主角年齡 → 年齡層。主角年齡是唯一輸入，前後端都用這個換算 */
export function ageBandFor(age: number): AgeBand {
  if (age <= 3) return "2-4";
  if (age <= 5) return "4-6";
  if (age <= 7) return "6-8";
  return "8-10";
}

// ---- 故事風格 ----
export const STORY_STYLES = ["adventure", "inspiring", "cute", "bedtime"] as const;
export type StoryStyle = (typeof STORY_STYLES)[number];

export const STYLE_RULES: Record<StoryStyle, { label: string; hint: string; prompt: string }> = {
  adventure: {
    label: "冒險",
    hint: "出發去探險",
    prompt: "An adventure: a small journey or quest with discovery and excitement, resolved safely.",
  },
  inspiring: {
    label: "勵志",
    hint: "學會勇敢",
    prompt:
      "An encouraging story: the hero tries something hard, struggles a little, and grows through effort or kindness. Show the growth through actions.",
  },
  cute: {
    label: "可愛",
    hint: "軟軟萌萌",
    prompt: "A cute, playful story: gentle humor, small funny moments, soft and cheerful mood.",
  },
  bedtime: {
    label: "晚安",
    hint: "安靜好入睡",
    prompt:
      "A calm bedtime story: slow pace, soothing repetition, low excitement, the world gradually getting quiet and sleepy. A slow pace means more gentle sensory detail (sounds, warmth, soft light), not fewer words: still reach the requested length.",
  },
};

// ---- 故事長度：以朗讀時間換算字數（中文以字計，英文以 word 計）----
export const STORY_LENGTHS = ["3min", "10min"] as const;
export type StoryLength = (typeof STORY_LENGTHS)[number];

type Range = readonly [number, number];
interface LengthRule {
  label: string;
  /** 全文字數（中文不含標點） */
  words: Record<Language, Range>;
  /** 段落數與每段字數：模型對總字數估不準、常寫太短，用段落結構引導比較能達標 */
  paragraphs: Range;
  perParagraph: Record<Language, Range>;
}

export const LENGTH_RULES: Record<StoryLength, LengthRule> = {
  "3min": {
    label: "3 分鐘",
    words: { zh: [500, 700], en: [300, 420] },
    paragraphs: [6, 7],
    perParagraph: { zh: [85, 100], en: [50, 55] },
  },
  "10min": {
    label: "10 分鐘",
    words: { zh: [1700, 2200], en: [1000, 1300] },
    // 實測模型每段約寫 100 字、不太照每段字數，所以用段落數拉長度；段落數 × 每段字數的範圍要落在 words 之內
    paragraphs: [18, 19],
    perParagraph: { zh: [100, 115], en: [56, 68] },
  },
};

/**
 * 某種長度、語言、風格要寫幾段、每段幾字。
 * 實測中文 10 分鐘晚安故事每段只寫約 80 字（改提示詞無效），模型會寫到段落數上限附近，所以用更多段落補足長度。
 */
export function lengthStructure(length: StoryLength, language: Language, style: StoryStyle) {
  const rule = LENGTH_RULES[length];
  if (length === "10min" && language === "zh" && style === "bedtime") {
    return { paragraphs: [23, 24] as Range, perParagraph: [75, 90] as Range };
  }
  return { paragraphs: rule.paragraphs, perParagraph: rule.perParagraph[language] };
}

/** 依 LENGTH_RULES 的算法計算故事長度：中文算漢字（不含標點），英文算 word */
export function storyLength(paragraphs: readonly string[], language: Language): number {
  const text = paragraphs.join("\n");
  if (language === "zh") return (text.match(/\p{Script=Han}/gu) ?? []).length;
  return text.split(/\s+/).filter(Boolean).length;
}

// ---- 主角（只存在裝置上，送到 API 只用於這一次生成）----
export const GENDERS = ["boy", "girl", "unspecified"] as const;
export type Gender = (typeof GENDERS)[number];

/** 只允許文字、數字、空白與少數標點，降低提示詞注入的空間 */
const SAFE_TEXT = /^[\p{L}\p{N} ·・\-、，,]+$/u;

export const HeroSchema = z.object({
  name: z.string().trim().min(1).max(12).regex(SAFE_TEXT),
  age: z.number().int().min(2).max(10),
  gender: z.enum(GENDERS),
  likes: z.string().trim().max(30).regex(SAFE_TEXT).optional(),
});
export type Hero = z.infer<typeof HeroSchema>;

// ---- 故事場景：AI 從固定清單挑一個，前端依此換背景插畫 ----
export const STORY_SETTINGS = [
  "home",
  "park",
  "school",
  "zoo",
  "forest",
  "sea",
  "mountain",
  "city",
  "snow",
  "night_sky",
] as const;
export type StorySetting = (typeof STORY_SETTINGS)[number];

// ---- API 契約 ----
export const StoryRequestSchema = z
  .object({
    language: z.enum(LANGUAGES),
    ageBand: z.enum(AGE_BANDS),
    style: z.enum(STORY_STYLES),
    length: z.enum(STORY_LENGTHS),
    hero: HeroSchema.optional(),
    /** 首次生成：前端壓縮後的 JPEG base64（不含 data: 前綴） */
    imageBase64: z.string().max(2_000_000).optional(),
    /** 再講一個：重用上次的場景描述，不再傳圖，省掉圖片 token */
    scene: z.string().max(2000).optional(),
    /** 換一個故事時，避免重複的上一個標題 */
    avoidTitle: z.string().max(200).optional(),
  })
  .refine((r) => r.imageBase64 || r.scene, {
    message: "imageBase64 or scene is required",
  })
  .refine((r) => !r.hero || ageBandFor(r.hero.age) === r.ageBand, {
    message: "ageBand must match hero.age",
  });
export type StoryRequest = z.infer<typeof StoryRequestSchema>;

export const StoryOutputSchema = z.object({
  /** 照片的中性描述（英文），存在裝置上供「再講一個」重用 */
  scene: z.string(),
  /** 故事主要發生的地方，決定閱讀頁背景 */
  setting: z.enum(STORY_SETTINGS),
  title: z.string(),
  paragraphs: z.array(z.string()),
});
export type StoryOutput = z.infer<typeof StoryOutputSchema>;

export interface StoryResponse {
  story: StoryOutput;
}

export interface ApiError {
  error: string;
}

// ---- 故事庫：人工審過、隨 App 打包的故事。在裝置上換成主角名字與代名詞，不花 LLM token ----
// 第二版的「KTV 模式」會讓爸媽一段一段錄音，所以段落是基本單位，中英文段落數必須一致。

/** 故事庫文字裡唯一允許的代換標記 */
export const LIBRARY_TOKENS = ["{name}", "{he}", "{him}", "{his}"] as const;
export type LibraryToken = (typeof LIBRARY_TOKENS)[number];

/** 沒選主角時用的預設名字（性別不指定） */
export const LIBRARY_DEFAULT_NAME: Record<Language, string> = { zh: "小寶", en: "Bo" };

const TOKEN_PATTERN = /\{[^{}]*\}/g;

/** 回傳文字中不被允許的 {...} 標記 */
export function invalidLibraryTokens(text: string): string[] {
  return (text.match(TOKEN_PATTERN) ?? []).filter((t) => !(LIBRARY_TOKENS as readonly string[]).includes(t));
}

const LibraryText = z
  .string()
  .trim()
  .min(1)
  .refine((s) => invalidLibraryTokens(s).length === 0, {
    message: `only ${LIBRARY_TOKENS.join(" ")} tokens are allowed`,
  });

const Bilingual = <T extends z.ZodType>(schema: T) => z.object({ zh: schema, en: schema });

/** 不含整體檢查的欄位定義；生成器用它 omit 掉 id / draft 等欄位 */
export const LibraryStoryFieldsSchema = z.object({
  /** kebab-case slug，例如 "moon-blanket" */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  style: z.enum(STORY_STYLES),
  ageBands: z.array(z.enum(AGE_BANDS)).min(1),
  setting: z.enum(STORY_SETTINGS),
  title: Bilingual(LibraryText),
  paragraphs: Bilingual(z.array(LibraryText).min(1)),
  /** 背景音樂檔名（選填，之後再加） */
  bgm: z.string().optional(),
  /** true = 還沒人工審過 */
  draft: z.boolean(),
});

export const LibraryStorySchema = LibraryStoryFieldsSchema.refine(
  (s) => s.paragraphs.zh.length === s.paragraphs.en.length,
  { message: "zh and en must have the same number of paragraphs", path: ["paragraphs"] },
);
export type LibraryStory = z.infer<typeof LibraryStorySchema>;

export interface LibraryHero {
  name: string;
  gender: Gender;
}

type PronounToken = "he" | "him" | "his";

function pronouns(language: Language, name: string, gender: Gender): Record<PronounToken, string> {
  if (language === "zh") {
    if (gender === "boy") return { he: "他", him: "他", his: "他的" };
    if (gender === "girl") return { he: "她", him: "她", his: "她的" };
    return { he: name, him: name, his: `${name}的` };
  }
  if (gender === "boy") return { he: "he", him: "him", his: "his" };
  if (gender === "girl") return { he: "she", him: "her", his: "her" };
  return { he: name, him: name, his: `${name}'s` };
}

/** 段落開頭，或句尾標點（可接收尾引號）加空白，之後可以有開頭引號 */
const SENTENCE_START = /(?:^|[.!?…]["'”’)]?\s+)["'“‘(]?$/;

function fillTokens(text: string, language: Language, name: string, words: Record<PronounToken, string>): string {
  return text.replace(/\{(name|he|him|his)\}/g, (_, token: "name" | PronounToken, offset: number) => {
    const value = token === "name" ? name : words[token];
    if (language === "en" && SENTENCE_START.test(text.slice(0, offset))) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  });
}

/** 把故事庫故事換成指定語言與主角；沒給主角就用預設名字、不指定性別 */
export function renderLibraryStory(
  story: Pick<LibraryStory, "title" | "paragraphs">,
  language: Language,
  hero?: LibraryHero,
): { title: string; paragraphs: string[] } {
  const name = hero?.name.trim() || LIBRARY_DEFAULT_NAME[language];
  const gender = hero ? hero.gender : "unspecified";
  const words = pronouns(language, name, gender);
  return {
    title: fillTokens(story.title[language], language, name, words),
    paragraphs: story.paragraphs[language].map((p) => fillTokens(p, language, name, words)),
  };
}

// ---- 朗讀（雲端 TTS，Azure Speech 神經語音）----
// 清單放在共用套件，之後要做「選聲音」時前後端用同一份。

/** 可用的語音；每種語言的第一個是預設 */
export const TTS_VOICES = {
  zh: ["zh-TW-HsiaoChenNeural", "zh-TW-HsiaoYuNeural", "zh-TW-YunJheNeural"],
  // AnaNeural 是童聲
  en: ["en-US-AnaNeural", "en-US-JennyNeural"],
} as const satisfies Record<Language, readonly string[]>;
export type TtsVoice = (typeof TTS_VOICES)[Language][number];

export const DEFAULT_VOICE: Record<Language, TtsVoice> = {
  zh: TTS_VOICES.zh[0],
  en: TTS_VOICES.en[0],
};

const ALL_VOICES = [...TTS_VOICES.zh, ...TTS_VOICES.en] as [TtsVoice, ...TtsVoice[]];

/** 單段朗讀的長度上限；故事段落與標題都遠低於這個數字 */
export const TTS_MAX_CHARS = 1200;

export const TtsRequestSchema = z
  .object({
    text: z.string().min(1).max(TTS_MAX_CHARS),
    language: z.enum(LANGUAGES),
    voice: z.enum(ALL_VOICES).optional(),
  })
  .refine((r) => !r.voice || (TTS_VOICES[r.language] as readonly string[]).includes(r.voice), {
    message: "voice must match language",
  });
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
