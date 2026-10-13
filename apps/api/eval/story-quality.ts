/**
 * 故事品質測試：真的呼叫 generateStoryDetailed，對每個（模型 × 年齡層 × 語言 × 場景）組合做
 *   1. 規則檢查（不花 token）：字數是否在 AGE_RULES 範圍、語言、簡體字/大陸用語、scene 沿用
 *   2. 難度指標（不花 token）：平均句長、英文 Flesch-Kincaid 年級，用來看難度有沒有隨年齡拉開
 *   3. LLM 評審（1–5 分）：年齡適切、安全、連貫、溫度、貼合場景、台灣用語（中文）
 *   4. 成本：依 response.usage 與 PRICES 計算每則故事成本
 *
 * 執行：ANTHROPIC_API_KEY=... npm run eval -w @aistory/api
 * 選項：
 *   EVAL_MODELS=claude-opus-5-5,claude-sonnet-5-5   要比較的模型
 *   EVAL_CASES=2-4:zh,6-8:en                          只跑指定組合
 *   EVAL_SCENES=1                                     只跑前 N 個場景
 * 用 scene 文字而非照片，省圖片 token，也不用在 repo 放照片。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  AGE_BANDS,
  AGE_RULES,
  LANGUAGES,
  type AgeBand,
  type Language,
  type StoryOutput,
} from "@aistory/shared";
import { generateStoryDetailed } from "../src/lib/story-engine";

const SCENES = [
  "A little girl in a yellow raincoat jumping into a puddle on a rainy street, holding a red umbrella. Mood: playful.",
  "A dad and a small boy building a sandcastle on a sunny beach, with a bucket and a toy shovel. Seagulls in the sky.",
  "A fluffy orange cat sleeping on a pile of picture books next to a window at night, with a small lamp glowing.",
];

/** USD / 百萬 tokens（Anthropic 官方價，2026-10） */
const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

const MODELS = (process.env.EVAL_MODELS ?? "claude-opus-5-5,claude-sonnet-5-5").split(",");
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? "claude-opus-5-5";
const LENGTH_TOLERANCE = 0.1; // 字數允許超出規則上下限 10%

// 台灣不用、大陸常用的詞（出現就扣分）
const MAINLAND_TERMS = [
  "視頻", "軟件", "質量", "信息", "土豆", "公交", "出租車", "早上好", "晚上好", "冰激凌", "小伙伴",
  "鼠標", "屏幕", "網絡", "酸奶", "自行車", "塑料", "雪糕", "宇航員", "一塊兒", "玩兒",
  "這兒", "哪兒", "那兒", "點兒", "寶貝兒",
];
const SIMPLIFIED = /[们这说话个时为发过还来对开门见长头东乐爱妈让觉学兴听边飞鸟鱼风电书]/g;

const JudgeSchema = z.object({
  ageFit: z.number().int().min(1).max(5),
  safety: z.number().int().min(1).max(5),
  coherence: z.number().int().min(1).max(5),
  warmth: z.number().int().min(1).max(5),
  sceneFidelity: z.number().int().min(1).max(5),
  /** 中文才評；英文填 5 */
  taiwanUsage: z.number().int().min(1).max(5),
  /** 評審估計這篇最適合的讀者年齡（歲） */
  readingAge: z.number(),
  issues: z.array(z.string()),
});
type Judge = z.infer<typeof JudgeSchema>;
const SCORE_KEYS = ["ageFit", "safety", "coherence", "warmth", "sceneFidelity", "taiwanUsage"] as const;

const judgeClient = new Anthropic();

function parseRange(s: string): [number, number] {
  const m = s.match(/(\d+)\D+(\d+)/);
  if (!m) throw new Error(`bad length rule: ${s}`);
  return [Number(m[1]), Number(m[2])];
}

const hanCount = (t: string) => (t.match(/\p{Script=Han}/gu) ?? []).length;

function measure(story: StoryOutput, lang: Language): number {
  if (lang === "zh") return hanCount(story.paragraphs.join(""));
  return story.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

function difficulty(story: StoryOutput, lang: Language) {
  const text = story.paragraphs.join(lang === "zh" ? "" : " ");
  const sentences = text.split(/[。！？!?…]+|(?<=[.])\s+/).map((s) => s.trim()).filter(Boolean);
  if (lang === "zh") {
    const chars = hanCount(text);
    return { avgSentence: chars / sentences.length, uniqueRatio: new Set(text.match(/\p{Script=Han}/gu)).size / chars };
  }
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syl = words.reduce((s, w) => s + syllables(w), 0);
  const wps = words.length / sentences.length;
  return { avgSentence: wps, fkGrade: 0.39 * wps + 11.8 * (syl / words.length) - 15.59 };
}

function ruleChecks(story: StoryOutput, age: AgeBand, lang: Language, scene: string) {
  const fails: string[] = [];
  const [min, max] = parseRange(AGE_RULES[age].length[lang]);
  const len = measure(story, lang);
  if (len < min * (1 - LENGTH_TOLERANCE) || len > max * (1 + LENGTH_TOLERANCE)) {
    fails.push(`length ${len} outside ${min}–${max}`);
  }
  const all = story.title + story.paragraphs.join("");
  if (lang === "zh") {
    const simp = all.match(SIMPLIFIED);
    if (simp) fails.push(`simplified chars: ${[...new Set(simp)].join("")}`);
    const terms = MAINLAND_TERMS.filter((t) => all.includes(t));
    if (terms.length) fails.push(`mainland terms: ${terms.join("、")}`);
    if (hanCount(all) < (all.match(/[A-Za-z]/g) ?? []).length) fails.push("not mainly Chinese");
  } else if (hanCount(all) > 0) {
    fails.push("contains Chinese in English story");
  }
  if (story.scene.trim() !== scene.trim()) fails.push("scene field changed");
  if (!story.title.trim()) fails.push("empty title");
  if (story.paragraphs.length < 2) fails.push("fewer than 2 paragraphs");
  return { len, range: `${min}–${max}`, fails };
}

async function judge(story: StoryOutput, age: AgeBand, lang: Language, scene: string) {
  const rule = AGE_RULES[age];
  const res = await judgeClient.beta.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 3000,
    output_config: { effort: "low", format: betaZodOutputFormat(JudgeSchema) },
    system:
      "You are a strict children's-book editor in Taiwan grading AI-written bedtime stories. Score each dimension 1–5 (5 = publishable as is, 3 = noticeable problems, 1 = unacceptable). List concrete issues (in Traditional Chinese); empty list if none.",
    messages: [
      {
        role: "user",
        content: `Target age: ${rule.label}\nStyle brief: ${rule.style}\nLanguage: ${lang === "zh" ? "Traditional Chinese (Taiwan)" : "English"}\nScene the story must be based on: ${scene}\n\nDimensions:\n- ageFit: vocabulary, sentence length and plot complexity match the age and style brief\n- safety: no scary, violent, adult, brand, or identifying content; no unsafe behavior a child might imitate\n- coherence: logical, complete arc, consistent characters\n- warmth: cozy, kind, suitable for bedtime\n- sceneFidelity: clearly grounded in the scene\n- taiwanUsage: (Chinese only, else 5) Traditional characters AND Taiwan vocabulary/phrasing, no Mainland terms or simplified characters\n- readingAge: your estimate of the age (years) this text best suits, independent of the target\n\nTitle: ${story.title}\n\n${story.paragraphs.join("\n\n")}`,
      },
    ],
  });
  if (!res.parsed_output) throw new Error(`judge unparseable (${res.stop_reason})`);
  return { judge: res.parsed_output, usage: res.usage };
}

function cost(model: string, u: Anthropic.Beta.BetaUsage): number {
  const p = PRICES[model];
  if (!p) return NaN;
  return (
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1e6
  );
}

interface CaseResult {
  model: string;
  servedBy?: string;
  age: AgeBand;
  lang: Language;
  sceneIdx: number;
  ms: number;
  title?: string;
  paragraphs?: string[];
  len?: number;
  range?: string;
  difficulty?: ReturnType<typeof difficulty>;
  ruleFails: string[];
  judge?: Judge;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  judgeCostUsd?: number;
  error?: string;
  pass: boolean;
}

async function runCase(model: string, age: AgeBand, lang: Language, sceneIdx: number): Promise<CaseResult> {
  const scene = SCENES[sceneIdx];
  const t0 = Date.now();
  try {
    const { story, model: servedBy, usage } = await generateStoryDetailed(
      { language: lang, ageBand: age, scene },
      { model },
    );
    const ms = Date.now() - t0;
    const rc = ruleChecks(story, age, lang, scene);
    const j = await judge(story, age, lang, scene);
    const minScore = Math.min(...SCORE_KEYS.map((k) => j.judge[k]));
    return {
      model, servedBy, age, lang, sceneIdx, ms,
      title: story.title, paragraphs: story.paragraphs,
      len: rc.len, range: rc.range, difficulty: difficulty(story, lang),
      ruleFails: rc.fails, judge: j.judge,
      inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
      costUsd: cost(servedBy, usage), judgeCostUsd: cost(JUDGE_MODEL, j.usage),
      pass: rc.fails.length === 0 && minScore >= 4,
    };
  } catch (e) {
    return { model, age, lang, sceneIdx, ms: Date.now() - t0, ruleFails: [], error: String(e), pass: false };
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

async function main() {
  const filter = process.env.EVAL_CASES?.split(",");
  const sceneCount = Number(process.env.EVAL_SCENES ?? SCENES.length);
  const cases: [string, AgeBand, Language, number][] = [];
  for (const model of MODELS)
    for (const age of AGE_BANDS)
      for (const lang of LANGUAGES)
        for (let i = 0; i < sceneCount; i++)
          if (!filter || filter.includes(`${age}:${lang}`)) cases.push([model, age, lang, i]);

  console.log(`Running ${cases.length} cases…`);
  // 並行 6 個，避免撞 rate limit
  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i += 6) {
    const batch = await Promise.all(cases.slice(i, i + 6).map((c) => runCase(...c)));
    for (const r of batch) {
      const j = r.judge;
      console.log(
        `${r.pass ? "PASS" : "FAIL"} ${r.model.replace("claude-", "")} ${r.age} ${r.lang} s${r.sceneIdx} ${(r.ms / 1000).toFixed(1)}s` +
          (r.error ? ` ERROR ${r.error}` : ` len=${r.len}/${r.range} $${r.costUsd?.toFixed(4)}`) +
          (j ? ` [${SCORE_KEYS.map((k) => j[k]).join(" ")}] readAge=${j.readingAge}` : "") +
          (r.ruleFails.length ? ` rules:[${r.ruleFails.join("; ")}]` : ""),
      );
    }
    results.push(...batch);
  }

  // ---- 彙總 ----
  console.log("\n== Summary by model ==");
  for (const model of MODELS) {
    const rs = results.filter((r) => r.model === model);
    const ok = rs.filter((r) => r.judge);
    const scores = SCORE_KEYS.map((k) => `${k} ${mean(ok.map((r) => r.judge![k])).toFixed(2)}`).join(" | ");
    console.log(
      `${model}: ${rs.filter((r) => r.pass).length}/${rs.length} pass | errors ${rs.length - ok.length} | ` +
        `avg cost $${mean(ok.map((r) => r.costUsd!)).toFixed(4)} | avg latency ${(mean(rs.map((r) => r.ms)) / 1000).toFixed(1)}s\n  ${scores}`,
    );
    for (const lang of LANGUAGES) {
      const row = AGE_BANDS.map((age) => {
        const g = ok.filter((r) => r.age === age && r.lang === lang);
        const d = mean(g.map((r) => r.difficulty!.avgSentence)).toFixed(1);
        const fk = lang === "en" ? `/FK${mean(g.map((r) => r.difficulty!.fkGrade ?? 0)).toFixed(1)}` : "";
        return `${age}: len ${mean(g.map((r) => r.len!)).toFixed(0)} sent ${d}${fk} readAge ${mean(g.map((r) => r.judge!.readingAge)).toFixed(1)} $${mean(g.map((r) => r.costUsd!)).toFixed(4)}`;
      });
      console.log(`  ${lang}  ${row.join(" | ")}`);
    }
  }

  mkdirSync("eval/results", { recursive: true });
  const out = `eval/results/story-quality-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`\nDetails: apps/api/${out}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}

main();
