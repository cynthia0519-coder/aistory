// 故事品質的確定性檢查：不呼叫 LLM、可重現、零成本。
import { AGE_RULES, type AgeBand, type Language, type StoryOutput } from "@aistory/shared";

const HAN = /\p{Script=Han}/gu;

/** 只有簡體才會出現的常用字（排除「里、后、云、么」這類繁體也合法的字，避免誤報） */
const SIMPLIFIED_ONLY = new Set(
  "这们说时来对会过还让发长门见东车马鸟鱼师话爱头买卖听觉学习书图画样为没从两乐亲进远边实现电问间关开热饭鸡飞风读写颜觉听妈吗呢员红绿蓝湾岛灯梦变网龙鸭虫叶树园戏欢".split(""),
);

/** 大陸用語 → 台灣用語（繁體字形，用來抓「字是繁體、詞是大陸」的情況） */
const MAINLAND_TERMS: Record<string, string> = {
  視頻: "影片",
  土豆: "馬鈴薯",
  西紅柿: "番茄",
  自行車: "腳踏車",
  公交: "公車",
  出租車: "計程車",
  軟件: "軟體",
  信息: "資訊",
  屏幕: "螢幕",
  菠蘿: "鳳梨",
  酸奶: "優格",
  方便麵: "泡麵",
  宇航員: "太空人",
  網絡: "網路",
  激光: "雷射",
  塑料: "塑膠",
  摩托車: "機車",
  質量: "品質",
  早上好: "早安",
  小區: "社區",
  冰棍: "冰棒",
  橙子: "柳丁",
};

/** 不適合兒童的關鍵字（只當粗篩，最終由 LLM 評審判斷語境） */
const UNSAFE_TERMS: Record<Language, string[]> = {
  zh: ["死", "殺", "血", "鬼", "怪獸", "受傷", "流血", "槍", "刀", "被拋棄", "迷路了再也", "哭個不停", "打架", "喝酒", "香菸"],
  en: ["die", "dead", "death", "kill", "blood", "ghost", "monster", "hurt", "gun", "knife", "abandon", "fight", "beer", "cigarette"],
};

export interface Metrics {
  /** 中文：漢字數；英文：word 數 */
  length: number;
  min: number;
  max: number;
  /** 0 = 在範圍內；正負值 = 超出/不足的比例 */
  lengthDeviation: number;
  paragraphs: number;
  /** 平均句長（中文以漢字計，英文以 word 計） */
  avgSentenceLength: number;
  /** 中文：不重複漢字數；英文：不重複 word 數 */
  uniqueTokens: number;
  /** 英文才有：Flesch-Kincaid grade level */
  fkGrade?: number;
  simplifiedChars: string[];
  mainlandTerms: string[];
  unsafeHits: string[];
}

function sentences(text: string, language: Language): string[] {
  const parts = language === "zh" ? text.split(/[。！？!?…]+/) : text.split(/[.!?]+/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function syllables(word: string): number {
  const w = word.replace(/'/g, "").replace(/e$/, "");
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function deviation(n: number, min: number, max: number): number {
  if (n < min) return (n - min) / min;
  if (n > max) return (n - max) / max;
  return 0;
}

export function measure(story: StoryOutput, ageBand: AgeBand, language: Language): Metrics {
  const body = story.paragraphs.join("\n");
  const [min, max] = AGE_RULES[ageBand].length[language];
  const sents = sentences(body, language);

  let length: number;
  let uniqueTokens: number;
  let avgSentenceLength: number;
  let fkGrade: number | undefined;

  if (language === "zh") {
    const han = body.match(HAN) ?? [];
    length = han.length;
    uniqueTokens = new Set(han).size;
    avgSentenceLength = length / Math.max(1, sents.length);
  } else {
    const ws = words(body);
    length = ws.length;
    uniqueTokens = new Set(ws).size;
    avgSentenceLength = length / Math.max(1, sents.length);
    const syl = ws.reduce((sum, w) => sum + syllables(w), 0);
    fkGrade = 0.39 * avgSentenceLength + 11.8 * (syl / Math.max(1, length)) - 15.59;
  }

  const full = `${story.title}\n${body}`;
  const simplifiedChars =
    language === "zh" ? [...new Set((full.match(HAN) ?? []).filter((c) => SIMPLIFIED_ONLY.has(c)))] : [];
  const mainlandTerms =
    language === "zh" ? Object.keys(MAINLAND_TERMS).filter((t) => full.includes(t)) : [];
  const lower = full.toLowerCase();
  const unsafeHits = UNSAFE_TERMS[language].filter((t) =>
    language === "zh" ? full.includes(t) : new RegExp(`\\b${t}`, "i").test(lower),
  );

  return {
    length,
    min,
    max,
    lengthDeviation: deviation(length, min, max),
    paragraphs: story.paragraphs.length,
    avgSentenceLength,
    uniqueTokens,
    fkGrade,
    simplifiedChars,
    mainlandTerms,
    unsafeHits,
  };
}

/** 難度指標是否隨年齡遞增：回傳相鄰年齡層中「有變難」的比例（3 組相鄰中幾組遞增） */
export function monotonicRatio(values: number[]): number {
  if (values.length < 2) return 1;
  let up = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[i - 1]) up++;
  return up / (values.length - 1);
}
