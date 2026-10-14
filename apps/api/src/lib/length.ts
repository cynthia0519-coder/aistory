// 故事長度換算：照片故事（story-engine）與故事庫（library-engine）共用。
// 規則在 @aistory/shared 的 LENGTH_RULES；這裡只處理「給模型的數字」要怎麼補正。
import { LENGTH_RULES, type AgeBand, type Language, type StoryLength } from "@aistory/shared";

// 每段大約多長（中文字／英文 word）。評測發現模型估總字數會偏少，
// 改用「幾段 × 每段多長」描述，模型比較抓得準。
export const PARAGRAPH_SIZE: Record<AgeBand, Record<Language, number>> = {
  "2-4": { zh: 40, en: 25 },
  "4-6": { zh: 60, en: 40 },
  "6-8": { zh: 80, en: 50 },
  "8-10": { zh: 100, en: 60 },
};

// LENGTH_RULES 的中文以「漢字」計（朗讀時間只跟漢字有關），但模型數字數時會把標點算進去，
// 實測標點約佔 1.2 倍。給模型的數字換算成含標點的字數，模型寫出來的漢字數才會落在規則內。
export const ZH_WITH_PUNCTUATION = 1.2;

// 低齡中文（短句、單一情節）實測只寫到要求的約 75%，而且目標調低它也跟著等比例縮短，
// 所以只能在給模型的數字上補回來（docs/eval 報告 v6）。
export const LENGTH_BOOST: Partial<Record<AgeBand, Partial<Record<Language, number>>>> = {
  "2-4": { zh: 1.35 },
  "4-6": { zh: 1.35 },
};

export interface LengthTarget {
  /** LENGTH_RULES 的原始範圍（中文不含標點）；驗收故事長度用這個 */
  rule: readonly [number, number];
  /** 給模型的範圍（已補正） */
  lo: number;
  hi: number;
  target: number;
  perParagraph: number;
  paragraphs: number;
  /** 給模型的單位說明 */
  unit: string;
}

/** 依長度、年齡層、語言算出要給模型的字數與段落結構 */
export function lengthTarget(length: StoryLength, ageBand: AgeBand, language: Language): LengthTarget {
  const rule = LENGTH_RULES[length].words[ageBand][language];
  const k = (language === "zh" ? ZH_WITH_PUNCTUATION : 1) * (LENGTH_BOOST[ageBand]?.[language] ?? 1);
  const [lo, hi] = [Math.round(rule[0] * k), Math.round(rule[1] * k)];
  const target = Math.round((lo + hi) / 2);
  const perParagraph = Math.round(PARAGRAPH_SIZE[ageBand][language] * k);
  return {
    rule,
    lo,
    hi,
    target,
    perParagraph,
    paragraphs: Math.round(target / perParagraph),
    unit: language === "zh" ? "Chinese characters including punctuation" : "words",
  };
}
