import { AGE_BANDS, LANGUAGES, type AgeBand, type Language } from "@aistory/shared";

// 用 scene 路徑測試（不傳照片），省掉圖片 token，也讓測資可重現。
// 隱私規則（不辨識照片中的真人）要靠照片路徑驗證，不在這份測資範圍內。
export const SCENES = [
  "A small child in yellow rain boots jumping into a puddle in a park, a red umbrella lying on the grass, cloudy sky, playful mood.",
  "A grandmother and a little boy baking cookies in a cozy kitchen, flour on the table, a cat watching from a chair, warm light.",
  "Two kids building a sandcastle on a beach at sunset, a bucket and spade, seagulls in the distance, calm waves.",
  "A girl in pajamas reading a picture book with a flashlight under a blanket fort, stuffed bunny beside her, nighttime.",
] as const;

export interface EvalCase {
  id: string;
  ageBand: AgeBand;
  language: Language;
  scene: string;
  avoidTitle?: string;
}

// 4 年齡層 × 2 語言 = 8 案例；scene 輪流分配，兩個案例額外測 avoidTitle。
export const CASES: EvalCase[] = AGE_BANDS.flatMap((ageBand, i) =>
  LANGUAGES.map((language, j) => ({
    id: `${ageBand}-${language}`,
    ageBand,
    language,
    scene: SCENES[(i + j) % SCENES.length],
    avoidTitle:
      ageBand === "4-6" ? (language === "zh" ? "跳水坑的小雨靴" : "The Puddle Jumper") : undefined,
  })),
);
