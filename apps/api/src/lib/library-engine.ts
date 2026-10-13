// 故事庫生成器：事先寫好、人工審過、隨 App 打包的故事。
// 只由 scripts/generate-library.ts 在開發機上呼叫，不經過 API route，App 讀故事庫不花 token。
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  AGE_RULES,
  LENGTH_RULES,
  LIBRARY_TOKENS,
  LibraryStoryFieldsSchema,
  STORY_SETTINGS,
  STYLE_RULES,
} from "@aistory/shared";
import { client, MODEL, SAFETY_RULES, STORY_CRAFT_RULES, StoryRefusedError } from "./story-engine";

/** library-plan.json 的一筆 */
export const LibraryPlanEntrySchema = LibraryStoryFieldsSchema.pick({
  id: true,
  style: true,
  ageBands: true,
  setting: true,
}).extend({
  /** 1–2 句英文故事大綱 */
  premise: z.string().min(1).max(400),
});
export type LibraryPlanEntry = z.infer<typeof LibraryPlanEntrySchema>;

// id 與 draft 由腳本決定；bgm 是人工挑的檔名，不讓模型亂編
export const LibraryOutputSchema = LibraryStoryFieldsSchema.omit({ id: true, draft: true, bgm: true });
export type LibraryOutput = z.infer<typeof LibraryOutputSchema>;

/**
 * 故事庫一律寫 3 分鐘長度。故事庫一篇要同時給多個年齡層、中英文段落數要一致，
 * 所以用自己固定的段落結構，不用 App 依年齡層設定的 LENGTH_RULES.words。
 */
export const LIBRARY_LENGTH = {
  label: LENGTH_RULES["3min"].label,
  /** 全文字數（中文不含標點） */
  words: { zh: [500, 700], en: [300, 420] },
  paragraphs: [6, 7],
  perParagraph: { zh: [85, 100], en: [50, 55] },
} as const;

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
- paragraphs.zh, paragraphs.en: the story paragraphs in each language.`;

export function buildLibraryPrompt(entry: LibraryPlanEntry): string {
  const [pMin, pMax] = LIBRARY_LENGTH.paragraphs;
  const range = (r: readonly [number, number]) => `${r[0]}–${r[1]}`;
  return [
    `Audience ages: ${entry.ageBands.map((a) => AGE_RULES[a].label).join(", ")}. The story must work for all of these ages; follow the youngest age's sentence style.`,
    ...entry.ageBands.map((a) => `Age style for ${AGE_RULES[a].label}: ${AGE_RULES[a].style}`),
    `Story type (style: ${entry.style}): ${STYLE_RULES[entry.style].prompt}`,
    `Setting: ${entry.setting}`,
    `Premise: ${entry.premise}`,
    `Length: read aloud in about ${LIBRARY_LENGTH.label}. Stories usually come out too short, so follow this structure: ${pMin}–${pMax} paragraphs in each language; each Chinese paragraph ${range(LIBRARY_LENGTH.perParagraph.zh)} Chinese characters (not counting punctuation), ${range(LIBRARY_LENGTH.words.zh)} in total; each English paragraph ${range(LIBRARY_LENGTH.perParagraph.en)} words, ${range(LIBRARY_LENGTH.words.en)} in total. Give the middle of the story more events and detail rather than padding the ending.`,
    `Copy these values: style "${entry.style}", ageBands ${JSON.stringify(entry.ageBands)}, setting "${entry.setting}".`,
  ].join("\n");
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
    output_config: { effort: "low", format: betaZodOutputFormat(LibraryOutputSchema) },
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
