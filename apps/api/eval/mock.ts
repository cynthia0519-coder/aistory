import { AGE_RULES, type StoryOutput } from "@aistory/shared";
import { countLength, parseRange } from "./checks";
import type { EvalCase } from "./fixtures";

// --mock 用的假輸出：不呼叫 API，只驗證評分流程本身。
// 兩個案例刻意放入違規內容（簡體字、禁用詞），確認規則檢查真的會抓到。
const BAD_CASES = new Set(["6-8-zh", "4-6-en"]);

export function mockStory(c: EvalCase): StoryOutput {
  const bad = BAD_CASES.has(c.id);
  const sentence =
    c.language === "zh"
      ? bad ? "这个小怪物说它会死掉。" : "小雨靴在水坑裡跳啊跳，濺起亮晶晶的水花。"
      : bad
        ? "The monster said the bird was dead. "
        : "The little boots went splash, splash, splash in the shiny puddle. ";

  // 湊到目標長度的中間值，讓正常案例能通過長度檢查
  const [min, max] = parseRange(AGE_RULES[c.ageBand].length[c.language]);
  const reps = Math.ceil((min + max) / 2 / countLength(sentence, c.language) / 2);
  const paragraph = sentence.repeat(reps).trim();

  return {
    scene: c.scene,
    title: c.language === "zh" ? "雨天的小冒險" : "Rainy Day Fun",
    paragraphs: [paragraph, paragraph],
  };
}
