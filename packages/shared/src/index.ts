import { z } from "zod";

// ---- 語言 ----
export const LANGUAGES = ["zh", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: "中文",
  en: "English",
};

// ---- 年齡層：唯一的規則來源，前端顯示與後端提示詞都讀這裡 ----
export const AGE_BANDS = ["2-4", "4-6", "6-8", "8-10"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export interface AgeRule {
  label: string;
  /** 中文以字計，英文以 word 計 */
  length: { zh: string; en: string };
  style: string;
  /** 閱讀頁字級（Tailwind class） */
  fontClass: string;
}

export const AGE_RULES: Record<AgeBand, AgeRule> = {
  "2-4": {
    label: "2–4 歲",
    length: { zh: "150–250 字", en: "80–150 words" },
    style:
      "Very short sentences. Repetitive patterns and onomatopoeia. Gentle rhymes are welcome. One simple idea, no conflict, cozy ending.",
    fontClass: "text-2xl leading-relaxed",
  },
  "4-6": {
    label: "4–6 歲",
    length: { zh: "350–550 字", en: "200–350 words" },
    style:
      "Short sentences, everyday vocabulary plus two or three slightly new words made clear by context. Simple cause and effect. A tiny problem that is solved kindly. Warm ending.",
    fontClass: "text-xl leading-relaxed",
  },
  "6-8": {
    label: "6–8 歲",
    length: { zh: "600–900 字", en: "400–600 words" },
    style:
      "Medium sentences, some new words explained by context. A small challenge, a turning point, and a gentle lesson that is shown, not lectured.",
    fontClass: "text-lg leading-relaxed",
  },
  "8-10": {
    label: "8–10 歲",
    length: { zh: "900–1300 字", en: "600–900 words" },
    style:
      "Richer vocabulary and varied sentence length. A clear plot with a twist, light humor, and a character who grows.",
    fontClass: "text-base leading-relaxed",
  },
};

// ---- API 契約 ----
export const StoryRequestSchema = z
  .object({
    language: z.enum(LANGUAGES),
    ageBand: z.enum(AGE_BANDS),
    /** 首次生成：前端壓縮後的 JPEG base64（不含 data: 前綴） */
    imageBase64: z.string().max(2_000_000).optional(),
    /** 再講一個：重用上次的場景描述，不再傳圖，省掉圖片 token */
    scene: z.string().max(2000).optional(),
    /** 換一個故事時，避免重複的上一個標題 */
    avoidTitle: z.string().max(200).optional(),
  })
  .refine((r) => r.imageBase64 || r.scene, {
    message: "imageBase64 or scene is required",
  });
export type StoryRequest = z.infer<typeof StoryRequestSchema>;

export const StoryOutputSchema = z.object({
  /** 照片的中性描述（英文），存在裝置上供「再講一個」重用 */
  scene: z.string(),
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
