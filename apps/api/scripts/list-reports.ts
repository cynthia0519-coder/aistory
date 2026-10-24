// 列出家長回報的故事（最近兩個月），看哪些故事出問題、改提示詞或下架故事庫故事時用。
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... npm run reports -w @aistory/api
import { REPORT_REASON_LABELS } from "@aistory/shared";
import { reportKey, type StoredReport } from "../src/lib/reports";

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are required");
  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  const keys = [reportKey(now), reportKey(lastMonth)];
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(keys.map((k) => ["LRANGE", k, "0", "-1"])),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const lists = (await res.json()) as { result: string[] }[];
  const reports = lists.flatMap((l) => l.result.map((s) => JSON.parse(s) as StoredReport));
  console.log(`${reports.length} reports (${keys.join(", ")})\n`);
  for (const r of reports) {
    console.log(`[${r.at}] ${r.source} ${r.storyId} · ${REPORT_REASON_LABELS[r.reason]} · ${r.ageBand}/${r.language}`);
    if (r.note) console.log(`  家長說：${r.note}`);
    if (r.title) console.log(`  ${r.title}`);
    for (const p of r.paragraphs ?? []) console.log(`    ${p}`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
