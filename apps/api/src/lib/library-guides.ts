// 沒有主題的故事庫故事補「給爸媽卡」：主題故事的引導卡在生成時一起寫（library-engine.ts），
// 沒有主題的故事當初沒有，這裡只看已經寫好的故事補一張，不改標題和內文。
// 只由 scripts/library-guides.ts 在開發機上呼叫。
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AGE_RULES, LIBRARY_TOKENS, LibraryStoryFieldsSchema, STYLE_RULES, type LibraryStory } from "@aistory/shared";
import { client, MODEL, StoryRefusedError } from "./story-engine";

/** 跟主題故事的 guide 同一個形狀：中英各 2–3 題 + 1 個 tip */
export const PlainGuideOutputSchema = LibraryStoryFieldsSchema.shape.guide.unwrap();
export type PlainGuide = NonNullable<LibraryStory["guide"]>;

/** 只補沒有主題、也還沒有引導卡的故事；有主題的引導卡由生成器負責 */
export function needsPlainGuide(story: Pick<LibraryStory, "theme" | "guide">): boolean {
  return !story.theme && !story.guide;
}

// 固定不變的 system prompt，放最前面讓 prompt caching 命中
export const PLAIN_GUIDE_SYSTEM = `You write the parent guide card for stories in a curated picture-book library for young children. The card is for the grown-up: it is shown after the story and is never read aloud as part of the story. Its purpose is to get the child talking.

These stories have no lesson theme, so the card must not teach:
- No moral, no lesson, no "what did we learn", no right or wrong answers, no rules to remember.
- Ask about feelings, favourite moments, and imagination, tied to this story's actual characters and events (for example 「如果你也能飛到月亮上，你想帶什麼去？」 / "If you could fly to the moon too, what would you bring?").
- Questions are short and open, so any answer is a good answer.

Fields:
- questions: exactly 3 questions, in story order where it makes sense.
- tip: one light parent–child activity for tonight or this week, in one or two sentences. It must fit bedtime: quiet and calm, no screens, nothing that gets the child excited or out of bed (for example a whispered guessing game, a cuddle and a "favourite part" chat, drawing it together tomorrow).

Age fit:
- Follow the youngest age given. For ages 2–4, questions are very short and concrete (one idea each, about something the child can point to or feel); avoid "why" and hypotheticals that need long answers.

The hero:
- The child listening is the story's hero. Refer to the hero only with these tokens: {name}, {he}, {him}, {his}. Never write a name, "he", "she", "him", "her", "他" or "她" for the hero, and never write 她們 or 他們 for a group that includes the hero; say who they are instead (for example 「媽媽和{name}」).
- Chinese: {his} already includes 的 ("{his}小手"). English: use {his} only before a noun and avoid "himself"/"herself".
- The only curly-brace tokens allowed are ${LIBRARY_TOKENS.join(" ")}.

Two languages:
- guide.zh in Traditional Chinese (Taiwan usage) with full-width punctuation; guide.en in simple, natural English.
- The same three questions and the same tip in both languages, in the same order. Not a word-for-word translation, but the same meaning.
- Do not include phone numbers, hotlines, links, or brand names.`;

export function buildPlainGuidePrompt(story: LibraryStory): string {
  return [
    `Audience ages: ${story.ageBands.map((a) => AGE_RULES[a].label).join(", ")}. Write for the youngest.`,
    `Story type (style: ${story.style}): ${STYLE_RULES[story.style].prompt}`,
    `Title: ${story.title.zh} / ${story.title.en}`,
    "Story (Chinese):",
    ...story.paragraphs.zh,
    "Story (English):",
    ...story.paragraphs.en,
    "Write the parent guide card (guide.zh and guide.en) for this story.",
  ].join("\n");
}

export async function generatePlainGuide(
  story: LibraryStory,
  opts: { model?: string } = {},
): Promise<{ guide: PlainGuide; model: string; usage: Anthropic.Beta.BetaUsage }> {
  const response = await client.beta.messages.parse({
    model: opts.model ?? MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // 跟故事庫生成一樣用 medium：low 偶爾會吐出 "x" 佔位字
    output_config: { effort: "medium", format: betaZodOutputFormat(PlainGuideOutputSchema) },
    system: [{ type: "text", text: PLAIN_GUIDE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildPlainGuidePrompt(story) }],
  });

  if (response.stop_reason === "refusal") {
    throw new StoryRefusedError("refused");
  }
  if (!response.parsed_output) {
    throw new Error(`unparseable output (stop_reason=${response.stop_reason})`);
  }
  return { guide: response.parsed_output, model: response.model, usage: response.usage };
}
