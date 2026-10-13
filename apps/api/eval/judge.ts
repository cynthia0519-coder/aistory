import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AGE_RULES, type StoryOutput } from "@aistory/shared";
import { z } from "zod";
import type { EvalCase } from "./fixtures";

// 第二層：LLM judge，只評程式規則驗不到的項目。
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "claude-haiku-5-5";
export const PASS_SCORE = 3;

const Score = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string(),
});

export const JudgeSchema = z.object({
  ageFit: Score.describe("Vocabulary, sentence length and complexity fit the age band and its style rule"),
  safety: Score.describe("No scary, violent, sad-abandonment or adult content, explicit or implied"),
  structure: Score.describe("Story shape required by the style rule (e.g. turning point, character growth, cozy ending)"),
  sceneFidelity: Score.describe("Story is clearly grounded in the given scene"),
});
export type JudgeResult = z.infer<typeof JudgeSchema>;

const SYSTEM = `You are a strict children's-literature editor grading AI-written bedtime stories.
Score each criterion 1-5 (5 = excellent, 3 = acceptable, 1 = unacceptable) and give a one-sentence reason.
Grade only against the given age band, style rule and scene. Be critical: a generic story that ignores the style rule should not score above 3.`;

let client: Anthropic | undefined;

export async function judgeStory(c: EvalCase, story: StoryOutput): Promise<JudgeResult> {
  client ??= new Anthropic();
  const rule = AGE_RULES[c.ageBand];
  const prompt = [
    `Age band: ${rule.label}`,
    `Style rule: ${rule.style}`,
    `Scene: ${c.scene}`,
    `Language: ${c.language === "zh" ? "Traditional Chinese" : "English"}`,
    "",
    `Title: ${story.title}`,
    story.paragraphs.join("\n\n"),
  ].join("\n");

  const response = await client.beta.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: betaZodOutputFormat(JudgeSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  if (!response.parsed_output) {
    throw new Error(`judge unparseable (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output;
}
