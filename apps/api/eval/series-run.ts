// 連載實測：從一個場景連寫 SERIES_CHAPTERS 集，看角色、世界是否連貫、每集有沒有收尾、會不會吊胃口。
//   ANTHROPIC_API_KEY=... npm run eval:series -w @aistory/api [-- zh|en]
// 結果寫到 eval/out/series-<語言>.md，給人看，不進 git
import { mkdirSync, writeFileSync } from "node:fs";
import { SERIES_CHAPTERS, storyLength, type Language, type StoryOutput, type StoryRequest } from "@aistory/shared";
import { generateStoryDetailed } from "../src/lib/story-engine";

const language = (process.argv[2] === "en" ? "en" : "zh") as Language;
const base: StoryRequest = {
  language,
  ageBand: "4-6",
  style: "bedtime",
  length: "3min",
  hero: { name: language === "zh" ? "小安" : "Annie", age: 5, gender: "girl", likes: language === "zh" ? "恐龍" : "dinosaurs" },
  scene: "A small brown teddy bear sitting on a windowsill at dusk, a jar of glowing fairy lights beside it, a garden outside.",
};

async function main() {
  const lines: string[] = [`# 連載實測（${language}）`, ""];
  let prev: StoryOutput | null = null;
  for (let chapter = 1; chapter <= SERIES_CHAPTERS; chapter++) {
    const req: StoryRequest = prev
      ? { ...base, series: { chapter, memory: prev.memory, previous: { title: prev.title, paragraphs: prev.paragraphs } } }
      : base;
    const { story, usage } = await generateStoryDetailed(req);
    lines.push(
      `## 第 ${chapter} 集：${story.title}`,
      `（${storyLength(story.paragraphs, language)} ${language === "zh" ? "字" : "words"}，輸入 ${usage.input_tokens} / 輸出 ${usage.output_tokens} tokens）`,
      "",
      ...story.paragraphs.flatMap((p) => [p, ""]),
      story.memory ? `> 前情摘要：${story.memory.replace(/\n/g, " ")}` : "",
      "",
    );
    console.log(`chapter ${chapter}: ${story.title}`);
    prev = story;
  }
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  const file = new URL(`./out/series-${language}.md`, import.meta.url);
  writeFileSync(file, lines.join("\n"));
  console.log(`wrote ${file.pathname}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
