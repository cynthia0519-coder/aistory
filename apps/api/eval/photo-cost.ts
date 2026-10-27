/**
 * 拍照編故事的實際成本：真的傳照片給 generateStoryDetailed（跟 App 同一條路），記下 token 與費用。
 * story-quality.ts 用 scene 文字、不傳照片；這支補上照片那部分，封測前估預算用。
 * 測試照片用 App 裡的場景插畫（不含人物），不需要在 repo 放真的照片。
 *
 * 執行：ANTHROPIC_API_KEY=... npm run eval:photo -w @aistory/api
 * 選項：PHOTO_MODELS=claude-opus-5-5,claude-sonnet-5-5  PHOTO_COUNT=10
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AGE_BANDS, LANGUAGES, type StoryRequest } from "@aistory/shared";
import { generateStoryDetailed } from "../src/lib/story-engine";
import { cost } from "./prices";

const here = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(here, "../../client/public/scenes");
const models = (process.env.PHOTO_MODELS ?? "claude-opus-5-5").split(",").filter(Boolean);
const count = Number(process.env.PHOTO_COUNT ?? 10);

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");
  const photos = readdirSync(SCENES).filter((f) => f.endsWith(".jpg")).sort().slice(0, count);
  for (const model of models) {
    const rows: { usd: number; inTok: number; outTok: number; ms: number }[] = [];
    for (const [i, file] of photos.entries()) {
      const req: StoryRequest = {
        language: LANGUAGES[i % LANGUAGES.length],
        ageBand: AGE_BANDS[i % AGE_BANDS.length],
        style: "bedtime",
        length: "3min",
        imageBase64: readFileSync(resolve(SCENES, file)).toString("base64"),
      };
      const t0 = Date.now();
      try {
        const { model: served, usage } = await generateStoryDetailed(req, { model });
        const row = { usd: cost(served, usage), inTok: usage.input_tokens, outTok: usage.output_tokens, ms: Date.now() - t0 };
        rows.push(row);
        console.log(`${model} ${file} ${req.ageBand}/${req.language}: in ${row.inTok} out ${row.outTok} $${row.usd.toFixed(4)} ${(row.ms / 1000).toFixed(1)}s`);
      } catch (e) {
        console.log(`${model} ${file}: ERROR ${e instanceof Error ? e.message : e}`);
      }
    }
    const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / Math.max(rows.length, 1);
    console.log(
      `\n${model}: ${rows.length} stories, avg $${avg((r) => r.usd).toFixed(4)} per story (in ${avg((r) => r.inTok).toFixed(0)} / out ${avg((r) => r.outTok).toFixed(0)} tokens, ${(avg((r) => r.ms) / 1000).toFixed(1)}s)` +
        `\n  600 stories/month ≈ $${(avg((r) => r.usd) * 600).toFixed(2)}\n`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
