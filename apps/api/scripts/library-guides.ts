// 幫沒有主題的故事庫故事補「給爸媽卡」（guide）：只加 guide，不動標題、內文和 draft。
// 補完要對改到的故事重跑 npm run library:review -w @aistory/api（內容雜湊會變）。
//
//   npm run library:guides -w @aistory/api -- [--only id1,id2] [--force] [--dry-run]
//
// --force 連已經補過卡的無主題故事也重寫（有主題的故事一律不動）。
// --dry-run 只印出提示詞，不呼叫 API、不需要 ANTHROPIC_API_KEY。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { LibraryStorySchema, type LibraryStory } from "@aistory/shared";
import { cost } from "../eval/prices";
import { buildPlainGuidePrompt, generatePlainGuide, needsPlainGuide, PLAIN_GUIDE_SYSTEM } from "../src/lib/library-guides";
import { fullWidthStoryPunct } from "../src/lib/zh-punct";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(here, "../../client/public/library/stories.json");

function parseArgs(argv: string[]) {
  const args = { only: null as string[] | null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--only") args.only = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (a.startsWith("--only=")) args.only = a.slice("--only=".length).split(",").filter(Boolean);
    else throw new Error(`unknown option: ${a}`);
  }
  return args;
}

/** 選出要補卡的故事：沒有主題，且還沒有卡（--force 時連已有卡的無主題故事也算） */
export function selectStories(stories: LibraryStory[], opts: { only: string[] | null; force: boolean }): LibraryStory[] {
  return stories.filter(
    (s) => (!opts.only || opts.only.includes(s.id)) && !s.theme && (opts.force || needsPlainGuide(s)),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stories = z.array(LibraryStorySchema).parse(JSON.parse(readFileSync(OUT_PATH, "utf8")));
  if (args.only) {
    const unknown = args.only.filter((id) => !stories.some((s) => s.id === id));
    if (unknown.length) throw new Error(`not in stories.json: ${unknown.join(", ")}`);
  }
  const todo = selectStories(stories, args);

  if (args.dryRun) {
    console.log("=== system prompt (cached) ===\n" + PLAIN_GUIDE_SYSTEM + "\n");
    for (const s of todo) console.log(`=== ${s.id} ===\n${buildPlainGuidePrompt(s)}\n`);
    console.log(`dry run: ${todo.length} guide(s) would be written, no API calls made.`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required (use --dry-run to only print prompts)");
  }

  let total = 0;
  let failed = 0;
  for (const s of todo) {
    process.stdout.write(`${s.id} … `);
    try {
      const { guide, model, usage } = await generatePlainGuide(s);
      // 用整份故事的 schema 驗證（含標記檢查），中文欄位換成全形標點
      const story = fullWidthStoryPunct(LibraryStorySchema.parse({ ...s, guide }));
      for (const lang of ["zh", "en"] as const) {
        const g = story.guide![lang];
        if ([...g.questions, g.tip].some((t) => t.replace(/\s/g, "").length < 4)) throw new Error(`hollow ${lang} guide`);
      }
      if (story.guide!.zh.questions.length !== story.guide!.en.questions.length) throw new Error("guide question count differs");
      const usd = cost(model, usage);
      total += usd;
      console.log(`ok [${model}] out ${usage.output_tokens} tokens, $${usd.toFixed(4)}`);
      for (const q of story.guide!.zh.questions) console.log(`  ・${q}`);
      console.log(`  今晚：${story.guide!.zh.tip}`);
      stories[stories.findIndex((x) => x.id === s.id)] = story;
      // 每篇寫一次，中途失敗也保留已補的
      writeFileSync(OUT_PATH, JSON.stringify(stories, null, 2) + "\n");
    } catch (e) {
      failed++;
      console.log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n${todo.length - failed}/${todo.length} guides written, total $${total.toFixed(4)}`);
  console.log("next: npm run library:review -w @aistory/api (content hashes changed)");
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
