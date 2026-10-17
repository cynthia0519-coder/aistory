// 家長回報的故事：存在 Upstash Redis（每月一個 list，90 天後自動刪除），給人工查看、改提示詞用。
// 內容不含照片，主角名字已在手機上換成 {name}；不寫 log。沒設 Redis 時（本機）只留在記憶體。
import type { ReportRequest } from "@aistory/shared";

export const REPORT_TTL_SECONDS = 90 * 86_400;
const MAX_PER_MONTH = 5000;

export interface StoredReport extends ReportRequest {
  at: string;
}

export const reportKey = (d = new Date()) => `reports:${d.toISOString().slice(0, 7)}`;

const memory: StoredReport[] = [];

export async function saveReport(report: ReportRequest): Promise<void> {
  const entry: StoredReport = { ...report, at: new Date().toISOString() };
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    memory.push(entry);
    return;
  }
  const key = reportKey();
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify([
      ["LPUSH", key, JSON.stringify(entry)],
      ["LTRIM", key, "0", String(MAX_PER_MONTH - 1)],
      ["EXPIRE", key, String(REPORT_TTL_SECONDS)],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
}
