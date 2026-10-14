// 生成故事庫草稿：讀 library-plan.json，逐篇呼叫模型，寫進 client 的 public/library/stories.json。
// 生成的故事一律 draft: true，人工審過再改成 false。
//
//   npm run library:generate -w @aistory/api -- [--only id1,id2] [--theme id] [--force] [--dry-run]
//
// --theme 只生成這個主題的計畫條目（可和 --only 一起用）。
// --dry-run 只印出提示詞，不呼叫 API、不需要 ANTHROPIC_API_KEY。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  AGE_RULES,
  LIBRARY_DEFAULT_NAME,
  LibraryStorySchema,
  renderLibraryStory,
  storyLength,
  THEME_IDS,
  THEMES,
  type LibraryStory,
  type ThemeId,
} from "@aistory/shared";
import {
  buildLibraryPrompt,
  generateLibraryStory,
  LIBRARY_SYSTEM,
  libraryLength,
  LibraryPlanEntrySchema,
  type LibraryPlanEntry,
} from "../src/lib/library-engine";

const here = dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = resolve(here, "library-plan.json");
const OUT_PATH = resolve(here, "../../client/public/library/stories.json");

// 每百萬 token 的美元價格。預設值是目前預設模型在 Anthropic 價目表上的價格（2026-10 查詢）；
// 換模型（STORY_MODEL）時用環境變數覆蓋。
// 快取寫入（5 分鐘）是輸入價的 1.25 倍，快取讀取是 0.1 倍左右，以價目表為準。
const PRICE = {
  input: Number(process.env.LIBRARY_PRICE_INPUT ?? 4),
  output: Number(process.env.LIBRARY_PRICE_OUTPUT ?? 20),
  cacheWrite: Number(process.env.LIBRARY_PRICE_CACHE_WRITE ?? 5),
  cacheRead: Number(process.env.LIBRARY_PRICE_CACHE_READ ?? 0.2),
};

function parseArgs(argv: string[]) {
  const args = { only: null as string[] | null, theme: null as ThemeId | null, force: false, dryRun: false };
  const parseTheme = (v: string | undefined): ThemeId => {
    if (!v || !(THEME_IDS as string[]).includes(v)) throw new Error(`unknown theme: ${v ?? "(missing)"}`);
    return v as ThemeId;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--only") args.only = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (a.startsWith("--only=")) args.only = a.slice("--only=".length).split(",").filter(Boolean);
    else if (a === "--theme") args.theme = parseTheme(argv[++i]);
    else if (a.startsWith("--theme=")) args.theme = parseTheme(a.slice("--theme=".length));
    else throw new Error(`unknown option: ${a}`);
  }
  return args;
}

function readExisting(): LibraryStory[] {
  if (!existsSync(OUT_PATH)) return [];
  return z.array(LibraryStorySchema).parse(JSON.parse(readFileSync(OUT_PATH, "utf8")));
}

/**
 * 用預設名字代換後再量長度，數字才接近實際朗讀的長度。
 * 範圍是 LENGTH_RULES["3min"] 裡「最小年齡層」的原始範圍（中文不含標點），跟生成時的目標一致。
 */
function lengthReport(story: LibraryStory): { ok: boolean; text: string } {
  const len = libraryLength(story);
  const parts: string[] = [`sized for ${AGE_RULES[len.band].label}`];
  let ok = true;
  for (const lang of ["zh", "en"] as const) {
    const { paragraphs } = renderLibraryStory(story, lang);
    const n = storyLength(paragraphs, lang);
    const [min, max] = len.lang[lang].rule;
    const inRange = n >= min && n <= max;
    ok &&= inRange;
    parts.push(`${lang} ${n} (${min}–${max})${inRange ? "" : " ⚠"}`);
  }
  parts.push(`${story.paragraphs.zh.length} paragraphs (target ~${len.paragraphs})`);
  return { ok, text: parts.join("; ") };
}

function cost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): number {
  return (
    (usage.input_tokens * PRICE.input +
      usage.output_tokens * PRICE.output +
      (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead) /
    1_000_000
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan: LibraryPlanEntry[] = z.array(LibraryPlanEntrySchema).parse(JSON.parse(readFileSync(PLAN_PATH, "utf8")));

  // 主題故事的年齡層必須在主題允許的範圍內
  for (const p of plan) {
    const allowed: readonly string[] = p.theme ? THEMES[p.theme].ages : [];
    const bad = p.theme ? p.ageBands.filter((a) => !allowed.includes(a)) : [];
    if (bad.length) throw new Error(`${p.id}: ages ${bad.join(", ")} are not listed for theme ${p.theme}`);
  }

  if (args.only) {
    const unknown = args.only.filter((id) => !plan.some((p) => p.id === id));
    if (unknown.length) throw new Error(`not in plan: ${unknown.join(", ")}`);
  }

  const existing = readExisting();
  if (args.theme && !plan.some((p) => p.theme === args.theme)) throw new Error(`no plan entries for theme: ${args.theme}`);

  const todo = plan.filter((p) => {
    if (args.only && !args.only.includes(p.id)) return false;
    if (args.theme && p.theme !== args.theme) return false;
    if (!args.force && existing.some((s) => s.id === p.id)) {
      console.log(`skip ${p.id} (already in stories.json; use --force to regenerate)`);
      return false;
    }
    return true;
  });

  if (args.dryRun) {
    console.log("=== system prompt (cached) ===\n" + LIBRARY_SYSTEM + "\n");
    for (const entry of todo) {
      const len = libraryLength(entry);
      const sensitive = entry.theme && THEMES[entry.theme].sensitive ? ", sensitive" : "";
      console.log(
        `=== ${entry.id} (theme: ${entry.theme ?? "none"}${sensitive}; length sized for ${AGE_RULES[len.band].label}: ` +
          `zh ${len.lang.zh.rule.join("–")}, en ${len.lang.en.rule.join("–")}) ===\n${buildLibraryPrompt(entry)}\n`,
      );
    }
    const byCategory = new Map<string, number>();
    for (const p of plan) {
      const c = p.theme ? THEMES[p.theme].category : "(no theme)";
      byCategory.set(c, (byCategory.get(c) ?? 0) + 1);
    }
    const uncovered = THEME_IDS.flatMap((id) =>
      THEMES[id].ages.filter((a) => !plan.some((p) => p.theme === id && p.ageBands.includes(a))).map((a) => `${id} ${a}`),
    );
    console.log(`plan: ${plan.length} entries; ${[...byCategory].map(([c, n]) => `${c} ${n}`).join(", ")}`);
    if (uncovered.length) console.log(`theme ages without a story: ${uncovered.join(", ")}`);
    console.log(`dry run: ${todo.length} stor${todo.length === 1 ? "y" : "ies"} would be generated, no API calls made.`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required (use --dry-run to only print prompts)");
  }

  const stories = [...existing];
  let total = 0;
  let failed = 0;
  const outOfRange: string[] = [];
  for (const entry of todo) {
    process.stdout.write(`${entry.id} … `);
    try {
      const { story: out, model, usage } = await generateLibraryStory(entry);
      // 分類欄位以計畫為準，模型抄錯也不影響
      const story = LibraryStorySchema.parse({
        id: entry.id,
        ...out,
        ...(entry.theme ? { theme: entry.theme } : {}),
        style: entry.style,
        ageBands: entry.ageBands,
        setting: entry.setting,
        draft: true,
      });
      const len = lengthReport(story);
      // 空殼故事（標題或段落像 "x"）不寫入，算失敗，之後用 --only 重跑
      for (const lang of ["zh", "en"] as const) {
        const n = storyLength(renderLibraryStory(story, lang).paragraphs, lang);
        if (n < libraryLength(story).lang[lang].rule[0] / 2) throw new Error(`hollow ${lang} story (${n})`);
      }
      const usd = cost(usage);
      total += usd;
      console.log(
        `ok [${model}] in ${usage.input_tokens} + cache w ${usage.cache_creation_input_tokens ?? 0} / r ${usage.cache_read_input_tokens ?? 0}, out ${usage.output_tokens} tokens, $${usd.toFixed(4)}`,
      );
      console.log(`  「${story.title.zh}」/ "${story.title.en}" — ${len.text}`);
      if (!len.ok) outOfRange.push(`${entry.id}: ${len.text}`);
      if (!len.ok) console.log("  ⚠ length out of range; review or regenerate with --only " + entry.id + " --force");

      const i = stories.findIndex((s) => s.id === story.id);
      if (i >= 0) stories[i] = story;
      else stories.push(story);
      // 每篇寫一次，中途失敗也保留已生成的
      mkdirSync(dirname(OUT_PATH), { recursive: true });
      writeFileSync(OUT_PATH, JSON.stringify(stories, null, 2) + "\n");
    } catch (e) {
      failed++;
      console.log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `\n${todo.length - failed}/${todo.length} generated, total $${total.toFixed(4)} ` +
      `(prices per 1M tokens: in $${PRICE.input}, out $${PRICE.output}, cache write $${PRICE.cacheWrite}, cache read $${PRICE.cacheRead}). ` +
      `Default hero name used for length: ${LIBRARY_DEFAULT_NAME.zh} / ${LIBRARY_DEFAULT_NAME.en}.`,
  );
  if (outOfRange.length) {
    console.log(`\n${outOfRange.length} out of the per-age length range (LENGTH_RULES 3min, youngest band):`);
    for (const line of outOfRange) console.log(`  ⚠ ${line}`);
  } else if (todo.length - failed > 0) {
    console.log("all generated stories are within the per-age length range (LENGTH_RULES 3min, youngest band).");
  }
  console.log(`wrote ${OUT_PATH}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
