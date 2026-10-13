import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  AGE_RULES,
  StoryOutputSchema,
  type StoryOutput,
  type StoryRequest,
} from "@aistory/shared";

const client = new Anthropic();
const MODEL = process.env.STORY_MODEL ?? "claude-opus-5-5";

// 固定不變的 system prompt 放最前面，讓 prompt caching 能命中。
const SYSTEM = `You are a warm, imaginative bedtime storyteller for young children.

Safety rules (always apply):
- No violence, scary monsters, death, injury, abandonment, or adult themes.
- Never identify, name, or guess the identity, location, school, or personal details of any real person in the photo. Treat people as story characters ("a little girl", "a dad") only.
- Do not mention brands or copy existing copyrighted characters.
- If the photo shows something unsafe or inappropriate for children, ignore those elements and write a gentle story about the safe parts.

Output fields:
- scene: a short, neutral English description of what is in the photo (characters, setting, objects, mood). No personal identifying details. It will be reused later to write more stories without the photo.
- title: the story title, in the requested language.
- paragraphs: the story split into short paragraphs, in the requested language.`;

export class StoryRefusedError extends Error {}

export async function generateStory(req: StoryRequest): Promise<StoryOutput> {
  return (await generateStoryDetailed(req)).story;
}

/** 回傳故事加上實際用的模型與 token 用量；eval 用來比較模型與算成本 */
export async function generateStoryDetailed(
  req: StoryRequest,
  opts: { model?: string } = {},
): Promise<{ story: StoryOutput; model: string; usage: Anthropic.Beta.BetaUsage }> {
  const rule = AGE_RULES[req.ageBand];
  const languageLine =
    req.language === "zh"
      ? "Write the title and story in Traditional Chinese (繁體中文, Taiwan usage)."
      : "Write the title and story in simple, natural English.";

  const instructions = [
    `Audience age: ${rule.label}.`,
    `Length: ${rule.length[req.language]}.`,
    `Style: ${rule.style}`,
    languageLine,
    req.scene
      ? `Base the story on this scene (no photo provided): ${req.scene}\nKeep the same scene field.`
      : "Base the story on the photo.",
    req.avoidTitle
      ? `Write a different story than the previous one titled "${req.avoidTitle}".`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (req.imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: req.imageBase64 },
    });
  }
  content.push({ type: "text", text: instructions });

  const response = await client.beta.messages.parse({
    model: opts.model ?? MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // 說故事不需要深度推理，low effort 省 token、回得快
    output_config: { effort: "low", format: betaZodOutputFormat(StoryOutputSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new StoryRefusedError("refused");
  }
  if (!response.parsed_output) {
    throw new Error(`unparseable output (stop_reason=${response.stop_reason})`);
  }
  return { story: response.parsed_output, model: response.model, usage: response.usage };
}
