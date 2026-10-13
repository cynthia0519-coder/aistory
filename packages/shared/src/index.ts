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
      "Very short sentences: in Chinese at most about 10 characters, in English at most about 8 words. Reach the length with more sentences and repetition, never by making sentences longer. Repetitive patterns and onomatopoeia. Gentle rhymes are welcome. One simple idea, no conflict, cozy ending.",
    fontClass: "text-2xl leading-relaxed",
  },
  "4-6": {
    label: "4–6 歲",
    style:
      "Short sentences: in Chinese at most about 15 characters, in English at most about 10 words. Reach the length with more events, not longer sentences. Everyday vocabulary plus 2–3 slightly new words made clear by context. Simple cause and effect. A tiny problem that is solved kindly. Warm ending.",
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
      "Rich, precise vocabulary that stretches a 9-year-old: vivid verbs, a few less common words made clear by context, and in Chinese some fitting idioms (成語). Mix short punchy sentences with longer ones. A clear plot with a surprise the reader discovers (never announce it as 'the twist' or 'the surprise' in the text), light humor, and a character who grows.",
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
      "A calm bedtime story: slow pace, soothing repetition, low excitement, the world gradually getting quiet and sleepy.",
  },
};

// ---- 故事長度：以朗讀時間換算字數（中文以字計，英文以 word 計）----
// 同樣的朗讀時間，年紀越小念得越慢、篇幅也該越短；所以字數依年齡層設定。
// 依據：docs/eval 品質測試（2026-10-13 v3），全年齡共用一組字數時，2–4 歲寫不到下限、8–10 歲情節被壓淺。
export const STORY_LENGTHS = ["3min", "10min"] as const;
export type StoryLength = (typeof STORY_LENGTHS)[number];

type WordRange = readonly [number, number];

export const LENGTH_RULES: Record<
  StoryLength,
  { label: string; words: Record<AgeBand, Record<Language, WordRange>> }
> = {
  "3min": {
    label: "3 分鐘",
    words: {
      "2-4": { zh: [250, 400], en: [150, 250] },
      "4-6": { zh: [400, 550], en: [250, 350] },
      "6-8": { zh: [500, 700], en: [300, 420] },
      "8-10": { zh: [600, 800], en: [380, 500] },
    },
  },
  "10min": {
    label: "10 分鐘",
    words: {
      "2-4": { zh: [800, 1100], en: [500, 700] },
      "4-6": { zh: [1200, 1600], en: [750, 1000] },
      "6-8": { zh: [1700, 2200], en: [1000, 1300] },
      "8-10": { zh: [1900, 2400], en: [1150, 1450] },
    },
  },
};

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
