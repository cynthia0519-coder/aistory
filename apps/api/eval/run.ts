// 故事品質評測：3 場景 × 4 年齡層 × 2 語言 × N 模型，輸出 Markdown 報告與原始 JSON。
// 用法：ANTHROPIC_API_KEY=... npm run eval:story -w @aistory/api
//   EVAL_MODELS=claude-opus-5-5,claude-sonnet-5-5   受測模型（逗號分隔）
//   EVAL_JUDGE_MODEL=claude-haiku-5-5               評審模型；刻意不用受測模型，避免自評偏差
//   EVAL_CONCURRENCY=4
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AGE_BANDS, AGE_RULES, LANGUAGES, type AgeBand, type Language, type StoryOutput } from "@aistory/shared";
import { runStory } from "../src/lib/story-engine";
import { measure, monotonicRatio, type Metrics } from "./checks";
import { SCENES } from "./scenes";

const MODELS = (process.env.EVAL_MODELS ?? "claude-opus-5-5,claude-sonnet-5-5").split(",").map((s) => s.trim());
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? "claude-haiku-5-5";
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 4);

// USD / 1M tokens（Anthropic 官方價，2026-10 版）。快取寫入 = 輸入 × 1.25（5 分鐘 TTL）
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

function cost(model: string, u: Anthropic.Beta.BetaUsage): number {
  const p = PRICES[model];
  if (!p) return NaN;
  return (
    (u.input_tokens * p.input +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      u.output_tokens * p.output) /
    1_000_000
  );
}

const JudgeSchema = z.object({
  ageFit: z.number().int().min(1).max(5).describe("用字、句長、情節複雜度是否符合目標年齡，5=完全符合"),
  ageFitNote: z.string().describe("一句話說明，特別指出太難或太簡單的詞"),
  safe: z.boolean().describe("是否完全適合該年齡兒童睡前閱讀"),
  safetyIssues: z.array(z.string()).describe("不適合的段落或元素，沒有則空陣列"),
  taiwanUsageOk: z.boolean().describe("中文：是否為繁體字且符合台灣用語；英文一律 true"),
  taiwanUsageIssues: z.array(z.string()).describe("簡體字、大陸用語，附建議的台灣說法"),
  storyQuality: z.number().int().min(1).max(5).describe("情節完整、溫暖、貼合場景、有畫面感，5=最好"),
  storyNote: z.string(),
});
type Judge = z.infer<typeof JudgeSchema>;

const client = new Anthropic();

async function judge(story: StoryOutput, ageBand: AgeBand, language: Language, scene: string) {
  const rule = AGE_RULES[ageBand];
  const response = await client.beta.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: betaZodOutputFormat(JudgeSchema) },
    system:
      "You are a strict children's-book editor in Taiwan. Grade bedtime stories for the target age. " +
      "Be critical: a score of 5 must be rare. Write notes in Traditional Chinese.",
    messages: [
      {
        role: "user",
        content: [
          `Target age: ${rule.label}`,
          `Required style: ${rule.style}`,
          `Language: ${language === "zh" ? "Traditional Chinese, Taiwan usage" : "English"}`,
          `Source scene: ${scene}`,
          "",
          `Title: ${story.title}`,
          story.paragraphs.join("\n\n"),
        ].join("\n"),
      },
    ],
  });
  if (!response.parsed_output) throw new Error(`judge unparseable (stop_reason=${response.stop_reason})`);
  return { verdict: response.parsed_output, cost: cost(JUDGE_MODEL, response.usage) };
}

interface Row {
  model: string;
  servedBy: string;
  scene: string;
  ageBand: AgeBand;
  language: Language;
  ms: number;
  usage: Anthropic.Beta.BetaUsage;
  cost: number;
  story: StoryOutput;
  metrics: Metrics;
  judge: Judge;
  judgeCost: number;
}

interface Failure {
  model: string;
  scene: string;
  ageBand: AgeBand;
  language: Language;
  error: string;
}

async function pool<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < tasks.length) {
        const idx = i++;
        out[idx] = await tasks[idx]();
      }
    }),
  );
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const usd = (x: number) => `$${x.toFixed(4)}`;

function report(rows: Row[], failures: Failure[]): string {
  const L: string[] = [];
  L.push(`# 故事品質評測報告`, "");
  L.push(`- 時間：${new Date().toISOString()}`);
  L.push(`- 受測模型：${MODELS.join("、")}；評審：${JUDGE_MODEL}`);
  L.push(`- 矩陣：${SCENES.length} 場景 × ${AGE_BANDS.length} 年齡 × ${LANGUAGES.length} 語言 = ${SCENES.length * AGE_BANDS.length * LANGUAGES.length} 則/模型`);
  L.push(`- 失敗：${failures.length} 則`, "");

  L.push(`## 1. 總覽`, "");
  L.push(`| 模型 | 字數達標 | 平均偏差 | 簡體/大陸用語 | 評審判不安全 | 年齡適配(1-5) | 故事品質(1-5) | 每則成本 | 平均延遲 |`);
  L.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const m of MODELS) {
    const rs = rows.filter((r) => r.model === m);
    if (!rs.length) continue;
    const zh = rs.filter((r) => r.language === "zh");
    L.push(
      `| ${m} | ${pct(avg(rs.map((r) => (r.metrics.lengthDeviation === 0 ? 1 : 0))))} | ${pct(avg(rs.map((r) => Math.abs(r.metrics.lengthDeviation))))} | ${zh.filter((r) => r.metrics.simplifiedChars.length || r.metrics.mainlandTerms.length || !r.judge.taiwanUsageOk).length}/${zh.length} | ${rs.filter((r) => !r.judge.safe).length}/${rs.length} | ${avg(rs.map((r) => r.judge.ageFit)).toFixed(2)} | ${avg(rs.map((r) => r.judge.storyQuality)).toFixed(2)} | ${usd(avg(rs.map((r) => r.cost)))} | ${(avg(rs.map((r) => r.ms)) / 1000).toFixed(1)}s |`,
    );
  }
  L.push("");

  L.push(`## 2. 字數（實際 / 規定範圍）`, "");
  for (const lang of LANGUAGES) {
    L.push(`### ${lang === "zh" ? "中文（漢字數）" : "English (words)"}`, "");
    L.push(`| 模型 | 場景 | ${AGE_BANDS.map((a) => `${a} (${AGE_RULES[a].length[lang].join("–")})`).join(" | ")} |`);
    L.push(`|---|---|${AGE_BANDS.map(() => "---").join("|")}|`);
    for (const m of MODELS)
      for (const s of SCENES) {
        const cells = AGE_BANDS.map((a) => {
          const r = rows.find((x) => x.model === m && x.scene === s.id && x.ageBand === a && x.language === lang);
          if (!r) return "失敗";
          const d = r.metrics.lengthDeviation;
          return d === 0 ? `${r.metrics.length} ✅` : `${r.metrics.length} ❌ ${d > 0 ? "+" : ""}${pct(d)}`;
        });
        L.push(`| ${m} | ${s.id} | ${cells.join(" | ")} |`);
      }
    L.push("");
  }

  L.push(`## 3. 難度是否隨年齡拉開`, "");
  L.push(`每格為 4 個年齡層的平均值（2-4 → 8-10）。「遞增率」= 相鄰年齡層中有變難的比例，100% 代表完全單調遞增。`, "");
  L.push(`| 模型 | 語言 | 指標 | 2-4 | 4-6 | 6-8 | 8-10 | 遞增率(逐場景平均) |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  const metricDefs: { name: string; lang: Language | "both"; get: (m: Metrics) => number | undefined }[] = [
    { name: "平均句長", lang: "both", get: (m) => m.avgSentenceLength },
    { name: "不重複字/詞數", lang: "both", get: (m) => m.uniqueTokens },
    { name: "FK grade", lang: "en", get: (m) => m.fkGrade },
  ];
  for (const m of MODELS)
    for (const lang of LANGUAGES)
      for (const def of metricDefs) {
        if (def.lang !== "both" && def.lang !== lang) continue;
        const byAge = AGE_BANDS.map((a) =>
          avg(rows.filter((r) => r.model === m && r.language === lang && r.ageBand === a).map((r) => def.get(r.metrics) ?? NaN)),
        );
        const mono = avg(
          SCENES.map((s) =>
            monotonicRatio(
              AGE_BANDS.map((a) => {
                const r = rows.find((x) => x.model === m && x.scene === s.id && x.ageBand === a && x.language === lang);
                return r ? (def.get(r.metrics) ?? NaN) : NaN;
              }),
            ),
          ),
        );
        L.push(`| ${m} | ${lang} | ${def.name} | ${byAge.map((v) => v.toFixed(1)).join(" | ")} | ${pct(mono)} |`);
      }
  L.push("");

  L.push(`## 4. 繁體 / 台灣用語問題`, "");
  const zhIssues = rows.filter(
    (r) => r.language === "zh" && (r.metrics.simplifiedChars.length || r.metrics.mainlandTerms.length || !r.judge.taiwanUsageOk),
  );
  if (!zhIssues.length) L.push(`無。`);
  for (const r of zhIssues)
    L.push(
      `- **${r.model} / ${r.scene} / ${r.ageBand}**：簡體字 ${r.metrics.simplifiedChars.join("") || "無"}；大陸用語 ${r.metrics.mainlandTerms.join("、") || "無"}；評審：${r.judge.taiwanUsageIssues.join("；") || "—"}`,
    );
  L.push("");

  L.push(`## 5. 兒童安全`, "");
  const unsafe = rows.filter((r) => !r.judge.safe || r.metrics.unsafeHits.length);
  if (!unsafe.length) L.push(`無。`);
  for (const r of unsafe)
    L.push(
      `- **${r.model} / ${r.scene} / ${r.ageBand} / ${r.language}**：評審判定 ${r.judge.safe ? "安全" : "**不安全**"}；關鍵字命中 ${r.metrics.unsafeHits.join("、") || "無"}；${r.judge.safetyIssues.join("；")}`,
    );
  L.push("", `> 關鍵字命中只是粗篩（例如「海浪打在岸上」的「打」不算），以評審判定為準。`, "");

  L.push(`## 6. 成本明細（USD / 則，不含評審）`, "");
  L.push(`| 模型 | 年齡 | 平均輸入 tokens | 平均輸出 tokens | 平均成本 |`);
  L.push(`|---|---|---|---|---|`);
  for (const m of MODELS)
    for (const a of AGE_BANDS) {
      const rs = rows.filter((r) => r.model === m && r.ageBand === a);
      if (!rs.length) continue;
      const inTok = avg(rs.map((r) => r.usage.input_tokens + (r.usage.cache_creation_input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0)));
      L.push(`| ${m} | ${a} | ${inTok.toFixed(0)} | ${avg(rs.map((r) => r.usage.output_tokens)).toFixed(0)} | ${usd(avg(rs.map((r) => r.cost)))} |`);
    }
  const fallbacks = rows.filter((r) => !r.servedBy.startsWith(r.model));
  L.push("", `- 評審總成本：${usd(rows.reduce((s, r) => s + r.judgeCost, 0))}`);
  L.push(`- server-side fallback 觸發：${fallbacks.length} 則${fallbacks.map((r) => `（${r.model}→${r.servedBy}）`).join("")}`);
  L.push(`- 注意：評測走 scene 路徑（無圖片），首次生成會多一張圖的輸入 tokens（約 1–1.6k），實際首則成本會略高。`, "");

  L.push(`## 7. 評審逐則意見`, "");
  for (const r of rows)
    L.push(
      `- **${r.model} / ${r.scene} / ${r.ageBand} / ${r.language}**「${r.story.title}」 年齡 ${r.judge.ageFit}・品質 ${r.judge.storyQuality} — ${r.judge.ageFitNote}；${r.judge.storyNote}`,
    );

  if (failures.length) {
    L.push("", `## 8. 失敗`, "");
    for (const f of failures) L.push(`- ${f.model} / ${f.scene} / ${f.ageBand} / ${f.language}：${f.error}`);
  }
  return L.join("\n") + "\n";
}

async function main() {
  const jobs = MODELS.flatMap((model) =>
    SCENES.flatMap((s) => AGE_BANDS.flatMap((ageBand) => LANGUAGES.map((language) => ({ model, s, ageBand, language })))),
  );
  console.log(`running ${jobs.length} stories (${MODELS.join(", ")}), judge=${JUDGE_MODEL}`);

  const failures: Failure[] = [];
  const results = await pool(
    jobs.map(({ model, s, ageBand, language }) => async (): Promise<Row | null> => {
      const tag = `${model} ${s.id} ${ageBand} ${language}`;
      try {
        const t0 = Date.now();
        const run = await runStory({ language, ageBand, scene: s.scene }, model);
        const ms = Date.now() - t0;
        const j = await judge(run.story, ageBand, language, s.scene);
        console.log(`✓ ${tag} ${(ms / 1000).toFixed(1)}s`);
        return {
          model,
          servedBy: run.model,
          scene: s.id,
          ageBand,
          language,
          ms,
          usage: run.usage,
          cost: cost(run.model, run.usage),
          story: run.story,
          metrics: measure(run.story, ageBand, language),
          judge: j.verdict,
          judgeCost: j.cost,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`✗ ${tag}: ${error}`);
        failures.push({ model, scene: s.id, ageBand, language, error });
        return null;
      }
    }),
    CONCURRENCY,
  );
  const rows = results.filter((r): r is Row => r !== null);
  if (!rows.length) {
    console.error("all stories failed — check ANTHROPIC_API_KEY / model access");
    process.exit(1);
  }

  const dir = join("eval", "results", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "raw.json"), JSON.stringify({ rows, failures }, null, 2));
  writeFileSync(join(dir, "report.md"), report(rows, failures));
  console.log(`report: ${join(dir, "report.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
