// 印出封測判斷門檻：每週使用天數、第二週還在用的比例、試過照片故事／連載的比例。
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... npm run stats -w @aistory/api
import { STATS_EVENTS } from "@aistory/shared";
import { computeGates, loadStats, statsDay } from "../src/lib/stats";

const pct = (x: number | null) => (x === null ? "—（還沒有人滿天數）" : `${Math.round(x * 100)}%`);

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are required");
  }
  const today = statsDay();
  const snap = await loadStats(today);
  const g = computeGates(snap, today);
  console.log(`統計到 ${today}（台灣時間），共 ${g.installs} 個安裝\n`);
  console.log("門檻                      目前        繼續做   要重新想");
  console.log(`第一週使用天數（中位數）  ${g.weekOne.medianDays ?? "—"} 天（${g.weekOne.eligible} 個滿 7 天）  ≥ 3     ≤ 1`);
  console.log(`第二週還在用             ${pct(g.weekTwo.rate)}（${g.weekTwo.retained}/${g.weekTwo.eligible}）  ≥ 40%   < 20%`);
  console.log(`試過照片故事             ${pct(g.triedRate.photo_story ?? 0)}   ≥ 60%   < 30%\n`);
  console.log("試過各功能的比例：");
  for (const e of STATS_EVENTS) console.log(`  ${e.padEnd(14)} ${pct(g.triedRate[e] ?? 0)}`);
  console.log("\n最近 14 天：日期 / 使用的安裝數 / 各事件次數");
  for (const [day, ids] of [...snap.active].slice(-14)) {
    const c = snap.counts.get(day) ?? {};
    console.log(`  ${day}  ${String(ids.size).padStart(3)}  ${STATS_EVENTS.map((e) => `${e}:${c[e] ?? 0}`).join(" ")}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
