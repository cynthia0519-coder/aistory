// 故事庫 AI 預審的 LLM 評審：每篇故事一次呼叫，找出要人工看的地方。
// 只由 scripts/review-library.ts 在開發機上呼叫，不經過 API route。
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AGE_RULES, LENGTH_RULES, STYLE_RULES, THEMES, type LibraryStory } from "@aistory/shared";
import { CriticOutputSchema, youngestBand, type CriticOutput, type ReviewCheck } from "./library-review";
import { client, MODEL, SAFETY_RULES, STORY_CRAFT_RULES, StoryRefusedError } from "./story-engine";
import { GUIDE_INSTRUCTIONS, SENSITIVE_THEME_GUARDRAILS, THEME_CRAFT_RULES } from "./themes";

/** 評審用的模型；預設跟生成一樣，可用 REVIEW_MODEL 覆蓋 */
export const REVIEW_MODEL = process.env.REVIEW_MODEL ?? MODEL;

// 固定不變的 system prompt，放最前面讓 prompt caching 命中
export const CRITIC_SYSTEM = `You are a careful pre-reviewer for a curated bilingual (Traditional Chinese for Taiwan + English) picture-book library for children aged 2–10. Each story was written by a model to the rules below. Your job is to find concrete problems a human editor must look at, so the editor can skip stories that are fine.

Most stories are fine. "ok" with an empty issues list is the expected result for a good story. Never invent problems, never pad the list, and never report personal taste as an issue. Report only what you can point to in the text.

The rules the story was written to:

Safety rules:
${SAFETY_RULES}

Story craft:
${STORY_CRAFT_RULES}

Themed stories:
${THEME_CRAFT_RULES}

${GUIDE_INSTRUCTIONS}

Hero tokens (these are correct, never report them): the listening child is the hero and is written only as {name}, {he}, {him}, {his}; the app fills them in on the device. The hero must not be described by gender or appearance. Chinese {his} already includes 的. Other characters may have names and pronouns.

Two languages: the Chinese version is Traditional Chinese with Taiwan usage; the English version is a natural retelling with the same events in the same order and the same number of paragraphs (paragraph N tells the same part in both). It is not a word-for-word translation, so different wording is fine.

The parent guide is read by the grown-up, not to the child, so it may state the lesson explicitly. The app adds a hotline line to body-autonomy guide cards itself. For pet loss, the pet's death may be mentioned gently as something that already happened; that is allowed.

Already checked by code (do not report these): word counts, paragraph counts, token syntax, half-width punctuation, phone numbers, and duplicate titles. You get the measured lengths only as context for pacing.

Issue kinds:
- safety: the story shows or invites unsafe behavior a child could copy, scary or violent content, injury, adult themes, brands; or a safety theme gives wrong or risky advice.
- guardrail: breaks the sensitive-theme guardrails you are given (only for sensitive themes).
- logic: plot holes, contradictions, objects or characters that change, the title not matching the story, a key message missing or contradicted by the plot.
- preachy: a narrator moral, "the lesson is", rules recited at the reader, or characters lecturing in a way no real person talks.
- age_fit: sentences, words or ideas clearly too hard or too babyish for the listed ages (follow the youngest age's sentence style; older ages in the list should not find it insulting).
- zh_en_mismatch: paragraph N tells different events in zh and en, an event or character is added or missing, or the guide questions/tip differ.
- taiwan_usage: Simplified characters, mainland-only vocabulary or phrasing (for example 視頻 instead of 影片, 質量 meaning quality, 土豆 for potato, 公交車 for 公車), or Chinese that sounds translated or unnatural to a Taiwanese parent.
- repetition: the plot, setting and solution are close to another story in the same theme (you get one-line summaries), or the same phrase is overused inside this story.
- quality: hollow or flat writing, clichés that make it dull, a weak or rushed ending, or a guide that is vague rather than concrete.
- length: pacing problems such as a rushed or padded ending; not word counts.

Severity:
- high: must change before shipping (a safety or guardrail problem, wrong safety advice, a broken plot, zh and en telling different stories).
- medium: a parent or editor would notice; should be fixed.
- low: polish; fine to ship as is.

Verdict:
- ok: no issues, or only low ones.
- check: at least one medium issue; a human should look.
- fix: at least one high issue.

Each issue:
- lang: "zh", "en" or "both".
- where: the 0-based paragraph index as a string ("3"), or "title" or "guide".
- note: Traditional Chinese, at most about 60 characters, specific: quote the words that are wrong and say what to change. Example: 「第 3 段『{name}跑到馬路對面』沒有大人牽手，改成和奶奶一起走」.
- At most 6 issues, most important first.`;

/** 故事的一行摘要（給評審判斷重複）：有計畫大綱就用大綱，否則用英文標題加第一句 */
export function storySummary(story: LibraryStory, premise?: string): string {
  if (premise) return `${story.id}: ${premise}`;
  const first = story.paragraphs.en[0]?.split(/(?<=[.!?])\s/)[0] ?? "";
  return `${story.id}: "${story.title.en}" — ${first}`.slice(0, 300);
}

function numbered(paragraphs: readonly string[]): string {
  return paragraphs.map((p, i) => `[${i}] ${p}`).join("\n");
}

export function buildCriticPrompt(
  story: LibraryStory,
  ctx: { siblings: string[]; checks: readonly ReviewCheck[]; lengths: { zh: number; en: number } },
): string {
  const theme = story.theme ? THEMES[story.theme] : null;
  const band = youngestBand(story.ageBands);
  const rule = LENGTH_RULES["3min"].words[band];
  const lines = [
    `Story id: ${story.id}`,
    `Ages: ${story.ageBands.map((a) => AGE_RULES[a].label).join(", ")}. Sentence style follows the youngest age.`,
    ...story.ageBands.map((a) => `Age style for ${AGE_RULES[a].label}: ${AGE_RULES[a].style}`),
    `Story type (${story.style}): ${STYLE_RULES[story.style].prompt}`,
    `Setting: ${story.setting}`,
    theme
      ? [`Theme: ${theme.label.en} (${theme.label.zh}).`, "Key messages:", ...theme.keyMessages.map((m) => `- ${m}`)].join("\n")
      : "Theme: none (an everyday story without a lesson).",
    theme?.sensitive ? `This is a sensitive theme. The story must follow these guardrails:\n${SENSITIVE_THEME_GUARDRAILS}` : "",
    `Measured length (3-minute target for ${AGE_RULES[band].label}): zh ${ctx.lengths.zh} Han characters (target ${rule.zh.join("–")}), en ${ctx.lengths.en} words (target ${rule.en.join("–")}).`,
    ctx.checks.length
      ? `Code checks already flagged (do not repeat):\n${ctx.checks.map((c) => `- ${c.kind} (${c.where}): ${c.note}`).join("\n")}`
      : "",
    ctx.siblings.length
      ? `Other stories ${theme ? "in the same theme" : "without a theme"} (judge repetition against these):\n${ctx.siblings.map((s) => `- ${s}`).join("\n")}`
      : "",
    `<story lang="zh">\nTitle: ${story.title.zh}\n${numbered(story.paragraphs.zh)}\n</story>`,
    `<story lang="en">\nTitle: ${story.title.en}\n${numbered(story.paragraphs.en)}\n</story>`,
    story.guide
      ? `<guide lang="zh">\n${story.guide.zh.questions.map((q) => `Q: ${q}`).join("\n")}\nTip: ${story.guide.zh.tip}\n</guide>\n<guide lang="en">\n${story.guide.en.questions.map((q) => `Q: ${q}`).join("\n")}\nTip: ${story.guide.en.tip}\n</guide>`
      : "",
    "Review this story and return the verdict and issues.",
  ];
  return lines.filter(Boolean).join("\n\n");
}

export async function critiqueLibraryStory(
  prompt: string,
  opts: { model?: string } = {},
): Promise<{ output: CriticOutput; model: string; usage: Anthropic.Beta.BetaUsage }> {
  const response = await client.beta.messages.parse({
    model: opts.model ?? REVIEW_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      // low effort 在故事庫生成時會吐出空殼，評審也用 medium
      effort: "medium",
      format: betaZodOutputFormat(CriticOutputSchema),
    },
    system: [{ type: "text", text: CRITIC_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new StoryRefusedError("refused");
  if (!response.parsed_output) throw new Error(`unparseable output (stop_reason=${response.stop_reason})`);
  return { output: response.parsed_output, model: response.model, usage: response.usage };
}
