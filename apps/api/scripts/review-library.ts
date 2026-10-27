// 故事庫 AI 預審：規則檢查（不花 token）＋ 每篇一次 LLM 評審，結果寫進 eval/review-flags.json。
// 人工審稿只看被標記（check / fix）的故事，加上 summary.spotCheck 的抽查。
//
//   npm run library:review -w @aistory/api -- [--only id1,id2] [--theme id] [--no-llm] [--force] [--dry-run]
//
// --only / --theme 只限制要跑 LLM 的故事；規則檢查很便宜，每次都對全部故事重跑（重複標題要看全部）。
// --no-llm   只跑規則檢查並寫檔，不需要 ANTHROPIC_API_KEY。
// --dry-run  印出評審提示詞與規則檢查結果，不呼叫 API、不寫檔。
// --force    內容沒變也重跑 LLM。
// 可重跑：內容雜湊（reviewContentHash）沒變、上次已有 LLM 結果的故事會跳過。
//
// 結果檔放在 apps/api/eval/ 而不是 client 的 public/：public/ 會整包複製進 out/，被打包進 App。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  LibraryStorySchema,
  renderLibraryStory,
  storyLength,
  THEME_IDS,
  type LibraryStory,
  type ThemeId,
} from "@aistory/shared";
import { buildCriticPrompt, critiqueLibraryStory, CRITIC_SYSTEM, REVIEW_MODEL, storySummary } from "../src/lib/library-critic";
import {
  combinedStatus,
  estimateTokens,
  PRICE,
  reviewContentHash,
  runDeterministicChecks,
  summarize,
  usageCost,
  type ReviewCheck,
  type ReviewEntry,
  type ReviewSummary,
} from "../src/lib/library-review";

const here = dirname(fileURLToPath(import.meta.url));
const STORIES_PATH = resolve(here, "../../client/public/library/stories.json");
const PLAN_PATH = resolve(here, "library-plan.json");
const OUT_PATH = resolve(here, "../eval/review-flags.json");

interface FlagsFile {
  generatedAt: string;
  summary: ReviewSummary;
  stories: Record<string, ReviewEntry>;
}

function parseArgs(argv: string[]) {
  const args = { only: null as string[] | null, theme: null as ThemeId | null, noLlm: false, dryRun: false, force: false };
  const parseTheme = (v: string | undefined): ThemeId => {
    if (!v || !(THEME_IDS as string[]).includes(v)) throw new Error(`unknown theme: ${v ?? "(missing)"}`);
    return v as ThemeId;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-llm") args.noLlm = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force") args.force = true;
    else if (a === "--only") args.only = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (a.startsWith("--only=")) args.only = a.slice("--only=".length).split(",").filter(Boolean);
    else if (a === "--theme") args.theme = parseTheme(argv[++i]);
    else if (a.startsWith("--theme=")) args.theme = parseTheme(a.slice("--theme=".length));
    else throw new Error(`unknown option: ${a}`);
  }
  return args;
}

function readPrevious(): FlagsFile | null {
  if (!existsSync(OUT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(OUT_PATH, "utf8")) as FlagsFile;
  } catch {
    console.warn(`could not parse ${OUT_PATH}; starting fresh`);
    return null;
  }
}

function readPremises(): Map<string, string> {
  const plan = z.array(z.object({ id: z.string(), premise: z.string() }).loose()).parse(JSON.parse(readFileSync(PLAN_PATH, "utf8")));
  return new Map(plan.map((p) => [p.id, p.premise]));
}

function lengths(story: LibraryStory) {
  return {
    zh: storyLength(renderLibraryStory(story, "zh").paragraphs, "zh"),
    en: storyLength(renderLibraryStory(story, "en").paragraphs, "en"),
  };
}

function formatCheck(c: ReviewCheck): string {
  return `[${c.severity}] ${c.kind} ${c.lang}@${c.where}: ${c.note}`;
}

function printSummary(s: ReviewSummary) {
  const fmt = (r: Record<string, number>) =>
    Object.entries(r)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(", ") || "none";
  console.log(`\n${s.stories} stories. status: ${fmt(s.byStatus)}`);
  console.log(`code checks by kind: ${fmt(s.byCheckKind)}`);
  console.log(`LLM issues by kind: ${fmt(s.byIssueKind)}`);
  console.log(`flagged for human review (${s.flagged.length}): ${s.flagged.join(", ") || "none"}`);
  console.log(`spot checks (${s.spotCheck.length}): ${s.spotCheck.join(", ") || "none"}`);
  console.log(`total LLM cost recorded: $${s.usd.toFixed(4)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stories = z.array(LibraryStorySchema).parse(JSON.parse(readFileSync(STORIES_PATH, "utf8")));
  const premises = readPremises();
  const previous = readPrevious();

  if (args.only) {
    const unknown = args.only.filter((id) => !stories.some((s) => s.id === id));
    if (unknown.length) throw new Error(`not in stories.json: ${unknown.join(", ")}`);
  }

  const checks = runDeterministicChecks(stories);
  const selected = stories.filter((s) => (!args.only || args.only.includes(s.id)) && (!args.theme || s.theme === args.theme));
  if (!selected.length) throw new Error("no stories match --only / --theme");

  // 同主題（沒主題的算一組）其他故事的一行摘要
  const siblingsOf = (story: LibraryStory) =>
    stories.filter((o) => o.id !== story.id && o.theme === story.theme).map((o) => storySummary(o, premises.get(o.id)));
  const promptFor = (story: LibraryStory) =>
    buildCriticPrompt(story, { siblings: siblingsOf(story), checks: checks.get(story.id) ?? [], lengths: lengths(story) });

  if (args.dryRun) {
    console.log("=== critic system prompt (cached) ===\n" + CRITIC_SYSTEM + "\n");
    const systemTokens = estimateTokens(CRITIC_SYSTEM);
    let estTotal = 0;
    for (const story of selected) {
      const prompt = promptFor(story);
      // 估算：system 第一次寫快取、之後讀快取；輸出含思考約 1500–3000 token
      const inTok = estimateTokens(prompt);
      const est = (inTok * PRICE.input + systemTokens * PRICE.cacheRead + 2500 * PRICE.output) / 1_000_000;
      estTotal += est;
      console.log(`=== ${story.id} (~${inTok} input tokens, est. $${est.toFixed(3)}) ===\n${prompt}\n`);
    }
    console.log(`=== code checks (${selected.length} stories) ===`);
    for (const story of selected) {
      const c = checks.get(story.id) ?? [];
      console.log(`${story.id}: ${c.length ? "" : "no findings"}`);
      for (const x of c) console.log(`  ${formatCheck(x)}`);
    }
    console.log(
      `\ndry run: ${selected.length} LLM review call(s) would be made (model ${REVIEW_MODEL}); ` +
        `estimated ~$${estTotal.toFixed(2)} total, ~$${(estTotal / selected.length).toFixed(3)} per story ` +
        `(system ~${systemTokens} tokens cached, ~2500 output tokens assumed). No API calls made, nothing written.`,
    );
    return;
  }

  if (!args.noLlm && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required (use --no-llm for code checks only, or --dry-run)");
  }

  const prev = previous?.stories ?? {};
  const entries: Record<string, ReviewEntry> = {};
  const now = new Date().toISOString();
  // 先依規則檢查更新全部故事；沒變的故事沿用上次的 LLM 結果
  for (const story of stories) {
    const hash = reviewContentHash(story);
    const old = prev[story.id];
    const keep = old && old.hash === hash ? old : undefined;
    const c = checks.get(story.id) ?? [];
    entries[story.id] = {
      hash,
      checks: c,
      ...(keep?.llm ? { llm: keep.llm } : {}),
      model: keep?.llm ? keep.model : null,
      usd: keep?.llm ? keep.usd : 0,
      status: combinedStatus(c, keep?.llm),
      reviewedAt: keep?.llm ? keep.reviewedAt : now,
    };
  }

  const write = () => {
    const file: FlagsFile = { generatedAt: new Date().toISOString(), summary: summarize(entries), stories: entries };
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(file, null, 2) + "\n");
  };

  let total = 0;
  let failed = 0;
  let reviewed = 0;
  if (!args.noLlm) {
    for (const story of selected) {
      const e = entries[story.id];
      if (e.llm && !args.force) {
        console.log(`skip ${story.id} (unchanged since last review; use --force to re-run)`);
        continue;
      }
      process.stdout.write(`${story.id} … `);
      try {
        const { output, model, usage } = await critiqueLibraryStory(promptFor(story));
        const usd = usageCost(usage);
        total += usd;
        reviewed++;
        entries[story.id] = { ...e, llm: output, model, usd, status: combinedStatus(e.checks, output), reviewedAt: new Date().toISOString() };
        console.log(
          `${output.verdict} (${output.issues.length} issue${output.issues.length === 1 ? "" : "s"}) [${model}] ` +
            `in ${usage.input_tokens} + cache w ${usage.cache_creation_input_tokens ?? 0} / r ${usage.cache_read_input_tokens ?? 0}, ` +
            `out ${usage.output_tokens} tokens, $${usd.toFixed(4)}`,
        );
        for (const i of output.issues) console.log(`  [${i.severity}] ${i.kind} ${i.lang}@${i.where}: ${i.note}`);
        // 每篇寫一次，中途失敗也保留已審的
        write();
      } catch (err) {
        failed++;
        console.log(`failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  write();

  console.log("\n=== code checks ===");
  for (const story of stories) {
    for (const c of entries[story.id].checks) console.log(`${story.id}: ${formatCheck(c)}`);
  }
  printSummary(summarize(entries));
  if (!args.noLlm) {
    console.log(
      `this run: ${reviewed} reviewed, ${failed} failed, $${total.toFixed(4)}` +
        (reviewed ? ` ($${(total / reviewed).toFixed(4)} per story)` : "") +
        ` (prices per 1M tokens: in $${PRICE.input}, out $${PRICE.output}, cache write $${PRICE.cacheWrite}, cache read $${PRICE.cacheRead})`,
    );
  }
  console.log(`wrote ${OUT_PATH}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
