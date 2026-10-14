// 主題故事的提示詞：照片故事（story-engine）與故事庫（library-engine）共用。
// 主題清單與 keyMessages 在 @aistory/shared 的 THEMES。
import { THEMES, type ThemeId, type ThemeRule } from "@aistory/shared";

/**
 * 敏感主題（身體自主全類、寵物離世）的護欄。改這段前請先給兒少保護專業人員看過。
 * 只有故事庫會用到（這些主題 aiAllowed 都是 false），但寫成常數方便審查。
 */
export const SENSITIVE_THEME_GUARDRAILS = `- Never depict abuse, an abuser, or any harmful touch or harmful scene, not even off-page or implied.
- Use gentle metaphor and keep the focus on the child's knowledge and power: the private parts are "the parts your swimsuit covers"; the child can say no, can tell a trusted adult, and it is never the child's fault.
- Uncomfortable situations stay generic and non-sexual: a tickle that won't stop, a hug the child doesn't want, or being asked to keep a worrying secret.
- For ages 2–4, use only the hugs, tickles and secrets framing.
- Never frame danger as coming only from strangers, but never make familiar adults, family members, or secrets in general scary as a whole. Good surprises stay happy.
- Keep a warm, safe ending with a caring adult present who listens and helps.
- For pet loss: this is the only case where a death may be mentioned, and only the pet's, as a fact that has already happened (for example "died peacefully, very old"). No graphic detail of illness, injury or dying; say it gently and simply, and focus on love, memories and comfort.
- Parent-guide tips for body-autonomy themes may mention Taiwan's 113 child protection hotline (113 保護專線) for adults who need help. Never put that number, or any hotline, in the story text itself.`;

/** 主題故事的寫法：用情節教，不說教；引導卡才明講 */
export const THEME_CRAFT_RULES = `- Teach through the plot, never lecture. The hero discovers or practices each key message through what happens and what characters do and say naturally. No narrator moral, no "the lesson is", no list of rules recited at the reader.
- The parent guide card carries the explicit lesson, so the story only has to show it.
- Keep it positive and concrete: show what to do, not frightening consequences of doing the wrong thing.`;

/** 引導卡欄位說明 */
export const GUIDE_INSTRUCTIONS = `Parent guide (field "guide"): a card for the grown-up, read after the story, never read aloud to the child.
- questions: 2–3 short, open questions the grown-up asks the child about the story that connect it to the key messages and the child's own life ("What did … do when …?", "What would you do if …?").
- tip: one concrete thing the parent can do tonight or this week (a tiny routine, a game, a phrase to practice). One or two sentences.`;

export function themeBlock(id: ThemeId): string {
  const t: ThemeRule = THEMES[id];
  return [
    `Theme: ${t.label.en} (${t.label.zh}).`,
    "Key messages the story must convey:",
    ...t.keyMessages.map((m) => `- ${m}`),
    "How to write a themed story:",
    THEME_CRAFT_RULES,
    t.sensitive ? `This is a sensitive theme. Follow these guardrails strictly:\n${SENSITIVE_THEME_GUARDRAILS}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
