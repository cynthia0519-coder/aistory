// 頻道節目（Podcast / YouTube）：把故事庫的故事做成音檔與影片時用到的純邏輯——
// 選哪些故事、字幕怎麼切與對時間、ASS 字幕檔、標題與說明文字。
// 呼叫 Azure 與 ffmpeg 的部分在 scripts/render-episodes.ts。
import { ageRangeLabel, renderLibraryStory, STYLE_RULES, THEMES, type Language, type LibraryStory } from "@aistory/shared";

export interface ReviewFlag {
  status: string;
  hash: string;
}

/**
 * 能公開的故事：AI 預審 ok、審完內容沒再改過（雜湊相同），且不是敏感主題（身體自主等要專業審閱）。
 * 這只是 AI 預審；發布前人還是要聽過一次。
 */
export function publishableStories(
  stories: LibraryStory[],
  flags: Record<string, ReviewFlag | undefined>,
  hashOf: (s: LibraryStory) => string,
): LibraryStory[] {
  return stories.filter((s) => {
    const f = flags[s.id];
    if (!f || f.status !== "ok" || f.hash !== hashOf(s)) return false;
    return !(s.theme && THEMES[s.theme].sensitive);
  });
}

// ---- 字幕 ----

/** 一行字幕最多幾個字；1080p、64px 的字，一行放得下約 26 個中文字 */
export const CAPTION_MAX = 24;

/** 把一段切成一句一句的字幕；太長的句子再從逗號切，還是太長就硬切 */
export function splitCaptions(text: string, max = CAPTION_MAX): string[] {
  const sentences = text.match(/[^。！？!?]+[。！？!?」』”]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const out: string[] = [];
  for (const sentence of sentences.length ? sentences : [text.trim()]) {
    if ([...sentence].length <= max) {
      out.push(sentence);
      continue;
    }
    // 從逗號切，盡量把短的片段併在一起
    let line = "";
    for (const piece of sentence.match(/[^，、；,;]+[，、；,;]?/g) ?? [sentence]) {
      if (line && [...line].length + [...piece].length > max) {
        out.push(line);
        line = "";
      }
      line += piece;
    }
    if (line) out.push(line);
  }
  // 還是太長（沒有標點的長句）：硬切
  return out.flatMap((l) => {
    const chars = [...l];
    if (chars.length <= max) return [l];
    const parts: string[] = [];
    for (let i = 0; i < chars.length; i += max) parts.push(chars.slice(i, i + max).join(""));
    return parts;
  });
}

export interface Segment {
  text: string;
  start: number;
  end: number;
}

export interface Cue {
  text: string;
  start: number;
  end: number;
}

/** 一段朗讀裡的字幕依字數分配時間（TTS 語速大致固定，誤差在一兩秒內） */
export function captionCues(segments: Segment[], max = CAPTION_MAX): Cue[] {
  const cues: Cue[] = [];
  for (const seg of segments) {
    const lines = splitCaptions(seg.text, max);
    const weights = lines.map((l) => Math.max(1, [...l.replace(/[\s，。！？、；：「」『』“”,.!?;:]/g, "")].length));
    const total = weights.reduce((a, b) => a + b, 0);
    let t = seg.start;
    lines.forEach((text, i) => {
      const end = i === lines.length - 1 ? seg.end : t + ((seg.end - seg.start) * weights[i]) / total;
      cues.push({ text, start: t, end });
      t = end;
    });
  }
  return cues;
}

const assTime = (sec: number) => {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

/** ASS 裡 {} 是特效標記、反斜線是跳脫字元 */
const assText = (t: string) => t.replace(/\\/g, "＼").replace(/[{}]/g, (c) => (c === "{" ? "｛" : "｝"));

/** 1920×1080 的字幕檔：標題在上方，故事字幕在下方半透明底框裡 */
export function buildAss(title: Cue, cues: Cue[], font: string): string {
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // BorderStyle 3 = 不透明底框，OutlineColour 是框的顏色（AABBGGRR，AA 越大越透明）
    `Style: Caption,${font},64,&H00FFFFFF,&H00FFFFFF,&H5A2A3A40,&H00000000,0,0,0,0,100,100,2,0,3,18,0,2,120,120,64,1`,
    `Style: Title,${font},88,&H00FFFFFF,&H00FFFFFF,&H5A2A3A40,&H00000000,1,0,0,0,100,100,4,0,3,24,0,8,120,120,60,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    `Dialogue: 0,${assTime(title.start)},${assTime(title.end)},Title,,0,0,0,,${assText(title.text)}`,
    ...cues.map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Caption,,0,0,0,,${assText(c.text)}`),
    "",
  ].join("\n");
}

// ---- 標題與說明 ----

export interface EpisodeText {
  title: string;
  description: string;
  tags: string[];
}

/** credit：說明最後的製作單位（例如頻道名稱），可不給 */
export function episodeText(story: LibraryStory, language: Language, appUrl: string, credit?: string): EpisodeText {
  const r = renderLibraryStory(story, language);
  const kind = story.theme ? THEMES[story.theme].label[language] : STYLE_RULES[story.style].label;
  const ages = ageRangeLabel(story.ageBands);
  const opening = r.paragraphs[0] ?? "";
  const lines = [
    opening.length > 70 ? `${[...opening].slice(0, 70).join("")}…` : opening,
    "",
  ];
  if (r.guide) {
    lines.push("【給爸媽】聽完可以這樣聊聊：");
    r.guide.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push(`今晚試試看：${r.guide.tip}`, "");
  }
  lines.push(
    `想讓故事的主角變成你家孩子的名字？到「照片說故事」：${appUrl}`,
    "",
    `適合 ${ages}・${kind}`,
    "故事由 AI 協助創作。音樂：Mureka AI 生成（商用授權）／朗讀：Microsoft Azure 神經語音／插畫：Canva AI",
  );
  if (credit) lines.push(credit);
  const tags = ["睡前故事", "兒童故事", "床邊故事", "親子共讀", kind];
  lines.push("", tags.map((t) => `#${t.replace(/\s/g, "")}`).join(" "));
  return {
    // 沒有主題的故事風格標籤（晚安、可愛）放進標題沒資訊量，只放主題
    title: `${r.title}｜${story.theme ? `${kind}・` : ""}睡前故事｜${ages}`,
    description: lines.join("\n"),
    tags,
  };
}
