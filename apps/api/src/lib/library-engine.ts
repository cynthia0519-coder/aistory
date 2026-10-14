// 故事庫生成器：事先寫好、人工審過、隨 App 打包的故事。
// 只由 scripts/generate-library.ts 在開發機上呼叫，不經過 API route，App 讀故事庫不花 token。
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  AGE_BANDS,
  AGE_RULES,
  LENGTH_RULES,
  LIBRARY_TOKENS,
  LibraryStoryFieldsSchema,
  STORY_SETTINGS,
  STYLE_RULES,
  type AgeBand,
  type Language,
} from "@aistory/shared";
import { lengthTarget, type LengthTarget } from "./length";
import { client, MODEL, SAFETY_RULES, STORY_CRAFT_RULES, StoryRefusedError } from "./story-engine";
import { GUIDE_INSTRUCTIONS, themeBlock } from "./themes";

/** library-plan.json 的一筆：{id, theme, ageBands, style, setting, premise} */
export const LibraryPlanEntrySchema = LibraryStoryFieldsSchema.pick({
  id: true,
  theme: true,
  ageBands: true,
  style: true,
  setting: true,
}).extend({
  /** 1–2 句英文故事大綱 */
  premise: z.string().min(1).max(400),
});
export type LibraryPlanEntry = z.infer<typeof LibraryPlanEntrySchema>;

// id、draft、theme 由腳本決定；bgm 是人工挑的檔名，不讓模型亂編。
// guide 只在有主題時要求（LibraryThemedOutputSchema）。
export const LibraryOutputSchema = LibraryStoryFieldsSchema.omit({ id: true, draft: true, bgm: true, theme: true, guide: true });
export const LibraryThemedOutputSchema = LibraryOutputSchema.extend({
  guide: LibraryStoryFieldsSchema.shape.guide.unwrap(),
});
export type LibraryOutput = z.infer<typeof LibraryOutputSchema> & Partial<Pick<z.infer<typeof LibraryThemedOutputSchema>, "guide">>;

/** 故事庫一律寫 3 分鐘長度 */
export const LIBRARY_STORY_LENGTH = "3min" as const;

/**
 * 一篇故事庫故事同時給多個年齡層，但長度只能有一個目標：取 ageBands 裡「最小」的年齡層。
 * 句型本來就跟著最小的年齡寫，而且 LENGTH_RULES 對年紀越小給的字數越少，
 * 用最小的年齡層才不會讓 2–4 歲的故事長到念不完。
 */
export function lengthBand(entry: Pick<LibraryPlanEntry, "ageBands">): AgeBand {
  return [...entry.ageBands].sort((a, b) => AGE_BANDS.indexOf(a) - AGE_BANDS.indexOf(b))[0];
}

/**
 * 故事庫的長度目標：沿用照片故事的 LENGTH_RULES 與中文補正（lengthTarget）。
 * 中英文段落數必須一致，所以段落數以先寫的中文為準，英文每段長度依此重新分配。
 */
export function libraryLength(entry: Pick<LibraryPlanEntry, "ageBands">): {
  band: AgeBand;
  paragraphs: number;
  lang: Record<Language, LengthTarget>;
} {
  const band = lengthBand(entry);
  const zh = lengthTarget(LIBRARY_STORY_LENGTH, band, "zh");
  const en = lengthTarget(LIBRARY_STORY_LENGTH, band, "en");
  const paragraphs = zh.paragraphs;
  return { band, paragraphs, lang: { zh, en: { ...en, paragraphs, perParagraph: Math.round(en.target / paragraphs) } } };
}

// 固定不變的 system prompt，放最前面讓 prompt caching 命中
export const LIBRARY_SYSTEM = `You are a warm, imaginative storyteller writing for a curated picture-book library for young children. A person reviews every story before it ships, and parents will later record themselves reading it aloud, one paragraph at a time.

Safety rules (always apply):
${SAFETY_RULES}

Story craft:
${STORY_CRAFT_RULES}

The hero (filled in on the device later):
- The main character is the listening child. Their name and gender are unknown, so write the hero only with these tokens: {name} for the name, {he} for the subject pronoun, {him} for the object pronoun, {his} for the possessive before a noun ("{his} boots", "{his}小手").
- Never write a name, "he", "she", "him", "her", "his", "他" or "她" for the hero. Other characters may have their own names and pronouns.
- Prefer {name}. Use a pronoun token only where repeating the name would sound clumsy, and never twice in a row.
- Chinese: {his} already includes 的, so write "{his}帽子", never "{his}的帽子". English: use {his} only before a noun, never alone ("hers"), and avoid reflexives ("himself", "herself"); rephrase instead. Tokens may start a sentence; capitalization is handled automatically.
- The only curly-brace tokens allowed anywhere are ${LIBRARY_TOKENS.join(" ")}.
- The story must work for any child: nothing may depend on the hero's gender or appearance. Do not describe the hero's hair, face, skin, body, or clothes, and do not call the hero a boy, girl, son, daughter, brother, sister, prince, or princess.

Two languages:
- Write the Chinese version first, in Traditional Chinese (繁體中文, Taiwan usage and vocabulary).
- Then write the English version as a natural retelling in simple, idiomatic English: the same plot, the same events in the same order, and exactly the same number of paragraphs, with paragraph N telling the same part of the story in both languages. Do not translate word for word.

Paragraphs:
- Each paragraph is recorded as one take, so make it one small scene that reads aloud smoothly in one breath unit and ends at a natural pause. Never split a sentence or a line of dialogue across paragraphs.

Output fields:
- style, ageBands, setting: copy the values you are given. setting is one of: ${STORY_SETTINGS.join(", ")}.
- title.zh, title.en: the story title in each language.
- paragraphs.zh, paragraphs.en: the story paragraphs in each language.
- guide.zh, guide.en: only when the request gives a theme; follow the parent guide instructions given there.`;

export function buildLibraryPrompt(entry: LibraryPlanEntry): string {
  const len = libraryLength(entry);
  const { zh, en } = len.lang;
  return [
    `Audience ages: ${entry.ageBands.map((a) => AGE_RULES[a].label).join(", ")}. The story must work for all of these ages; follow the youngest age's sentence style.`,
    ...entry.ageBands.map((a) => `Age style for ${AGE_RULES[a].label}: ${AGE_RULES[a].style}`),
    `Story type (style: ${entry.style}): ${STYLE_RULES[entry.style].prompt}`,
    `Setting: ${entry.setting}`,
    `Premise: ${entry.premise}`,
    entry.theme ? themeBlock(entry.theme) : "",
    `Length (sized for the youngest age, ${AGE_RULES[len.band].label}; read aloud in about ${LENGTH_RULES[LIBRARY_STORY_LENGTH].label}): about ${len.paragraphs} paragraphs in each language. Chinese: ${zh.lo}–${zh.hi} ${zh.unit} in total, roughly ${zh.perParagraph} per paragraph. English: ${en.lo}–${en.hi} ${en.unit} in total, roughly ${en.perParagraph} per paragraph. Do not end early; give the middle of the story more events and detail rather than padding the ending.`,
    entry.theme
      ? `${GUIDE_INSTRUCTIONS}\n- Write guide.zh in Traditional Chinese and guide.en in English, with the same questions and tip in both. Refer to the hero only with the tokens ({name}, {he}, {him}, {his}).`
      : "",
    `Copy these values: style "${entry.style}", ageBands ${JSON.stringify(entry.ageBands)}, setting "${entry.setting}".`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateLibraryStory(
  entry: LibraryPlanEntry,
  opts: { model?: string } = {},
): Promise<{ story: LibraryOutput; model: string; usage: Anthropic.Beta.BetaUsage }> {
  const response = await client.beta.messages.parse({
    model: opts.model ?? MODEL,
    // 中英文各一份 3 分鐘故事
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: betaZodOutputFormat(entry.theme ? LibraryThemedOutputSchema : LibraryOutputSchema),
    },
    system: [{ type: "text", text: LIBRARY_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildLibraryPrompt(entry) }],
  });

  if (response.stop_reason === "refusal") {
    throw new StoryRefusedError("refused");
  }
  if (!response.parsed_output) {
    throw new Error(`unparseable output (stop_reason=${response.stop_reason})`);
  }
  return { story: response.parsed_output, model: response.model, usage: response.usage };
}
