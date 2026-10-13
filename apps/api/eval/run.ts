import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoryOutput } from "@aistory/shared";
import { runChecks, type CheckResult } from "./checks";
import { CASES, type EvalCase } from "./fixtures";
import type { JudgeResult } from "./judge";
import { mockStory } from "./mock";

// 用法：
//   npm run eval -w @aistory/api                 # 真的呼叫 Claude（需 ANTHROPIC_API_KEY）
//   npm run eval -w @aistory/api -- --mock       # 不花 token，只驗證評分流程
//   npm run eval -w @aistory/api -- --no-judge   # 只跑程式規則檢查
//   npm run eval -w @aistory/api -- --only 6-8   # 只跑 id 含 6-8 的案例

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const MOCK = args.includes("--mock");
const JUDGE = !MOCK && !args.includes("--no-judge");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

try {
  process.loadEnvFile(join(here, "..", ".env.local"));
} catch {
  // 沒有 .env.local 時改用環境變數
}

interface CaseReport {
  id: string;
  ok: boolean;
  checks: CheckResult[];
  judge?: JudgeResult;
  judgeSkipped?: string;
  story?: StoryOutput;
  error?: string;
}

async function evalCase(c: EvalCase): Promise<CaseReport> {
  let story: StoryOutput;
  try {
    if (MOCK) {
      story = mockStory(c);
    } else {
      // 動態載入：story-engine 在載入時就建立 Anthropic client，--mock 時不該需要 key
      const { generateStory } = await import("../src/lib/story-engine");
      story = await generateStory({
        language: c.language,
        ageBand: c.ageBand,
        scene: c.scene,
        avoidTitle: c.avoidTitle,
      });
    }
  } catch (e) {
    return { id: c.id, ok: false, checks: [], error: `generate: ${(e as Error).message}` };
  }

  const checks = runChecks(c, story);
  const hardFail = checks.some((r) => r.severity === "fail");
  const report: CaseReport = { id: c.id, ok: !hardFail, checks, story };

  if (!JUDGE) return report;
  // 規則沒過就不送 judge，省 token
  if (hardFail) {
    report.judgeSkipped = "rule check failed";
    return report;
  }
  try {
    const { judgeStory, PASS_SCORE } = await import("./judge");
    report.judge = await judgeStory(c, story);
    report.ok = Object.values(report.judge).every((s) => s.score >= PASS_SCORE);
  } catch (e) {
    report.ok = false;
    report.error = `judge: ${(e as Error).message}`;
  }
  return report;
}

const ICON = { pass: "✓", warn: "!", fail: "✗" } as const;

function print(r: CaseReport) {
  console.log(`\n${r.ok ? "PASS" : "FAIL"}  ${r.id}${r.story ? `  《${r.story.title}》` : ""}`);
  if (r.error) console.log(`  ✗ ${r.error}`);
  for (const c of r.checks) console.log(`  ${ICON[c.severity]} ${c.name}: ${c.detail}`);
  if (r.judgeSkipped) console.log(`  - judge: skipped (${r.judgeSkipped})`);
  if (r.judge) {
    for (const [k, v] of Object.entries(r.judge)) {
      console.log(`  ${v.score >= 3 ? "✓" : "✗"} ${k} ${v.score}/5: ${v.reason}`);
    }
  }
}

async function main() {
  const cases = ONLY ? CASES.filter((c) => c.id.includes(ONLY)) : CASES;
  if (cases.length === 0) throw new Error(`no case matches --only ${ONLY}`);
  console.log(`Story eval: ${cases.length} cases, mode=${MOCK ? "mock" : "live"}, judge=${JUDGE ? "on" : "off"}`);

  // 案例之間沒有相依，並行跑；SDK 內建 429 重試
  const reports = await Promise.all(cases.map(evalCase));
  reports.forEach(print);

  const passed = reports.filter((r) => r.ok).length;
  const warns = reports.flatMap((r) => r.checks).filter((c) => c.severity === "warn").length;
  console.log(`\n${passed}/${reports.length} passed, ${warns} warnings`);

  const outDir = join(here, "results");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}${MOCK ? "-mock" : ""}.json`);
  writeFileSync(file, JSON.stringify({ mock: MOCK, judge: JUDGE, passed, total: reports.length, reports }, null, 2));
  console.log(`report: ${file}`);

  process.exitCode = passed === reports.length ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
