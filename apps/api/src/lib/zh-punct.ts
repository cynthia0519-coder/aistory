import type { LibraryStory } from "@aistory/shared";

/**
 * 中文裡的半形標點換成全形：有些故事庫故事混了半形標點，標題、說明、字幕看起來不整齊。
 * 只換緊貼中文字、中文引號、破折號或刪節號的標點，英文和網址不受影響。
 */
const HALF_TO_FULL: Record<string, string> = { "!": "！", "?": "？", ",": "，", ":": "：", ";": "；" };
const CJK = "\\p{Script=Han}「」『』—…";
const HALF_IN_ZH = new RegExp(`(?<=[${CJK}])[!?,:;]|[!?,:;](?=[${CJK}])`, "gu");
export const fullWidthPunct = (s: string) => s.replace(HALF_IN_ZH, (c) => HALF_TO_FULL[c]);

/** 故事庫故事的中文欄位（標題、段落、引導卡）都換成全形標點；英文不動 */
export function fullWidthStoryPunct<T extends Pick<LibraryStory, "title" | "paragraphs" | "guide">>(story: T): T {
  const guide = story.guide && {
    ...story.guide,
    zh: { ...story.guide.zh, questions: story.guide.zh.questions.map(fullWidthPunct), tip: fullWidthPunct(story.guide.zh.tip) },
  };
  return {
    ...story,
    title: { ...story.title, zh: fullWidthPunct(story.title.zh) },
    paragraphs: { ...story.paragraphs, zh: story.paragraphs.zh.map(fullWidthPunct) },
    ...(guide ? { guide } : {}),
  };
}
