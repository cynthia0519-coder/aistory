// 不記名使用統計：只記「哪個安裝代號、哪一天、做了哪一類事」，不含名字、照片、故事內容，也不記 IP。
// 存在 Upstash Redis，180 天後自動刪除；沒設 Redis 時（本機）只留在記憶體。
// 封測判斷門檻（每週使用天數、第二週留存、試過照片故事的比例）由 computeGates 計算，`npm run stats` 印出來。
import { STATS_EVENTS, type StatsEvent } from "@aistory/shared";

export const STATS_TTL_SECONDS = 180 * 86_400;

/** 台灣時間的日期（YYYY-MM-DD），一天的界線照家長的作息算 */
export function statsDay(at = Date.now()): string {
  return new Date(at + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export interface StatsSnapshot {
  /** 安裝代號 → 第一次出現的日期 */
  first: Map<string, string>;
  /** 日期 → 那天有用的安裝代號 */
  active: Map<string, Set<string>>;
  /** 事件 → 做過的安裝代號 */
  tried: Map<StatsEvent, Set<string>>;
  /** 日期 → 各事件次數 */
  counts: Map<string, Partial<Record<StatsEvent, number>>>;
}

const emptySnapshot = (): StatsSnapshot => ({ first: new Map(), active: new Map(), tried: new Map(), counts: new Map() });

const memory = emptySnapshot();

function recordInMemory(id: string, event: StatsEvent, day: string) {
  if (!memory.first.has(id)) memory.first.set(id, day);
  if (!memory.active.has(day)) memory.active.set(day, new Set());
  memory.active.get(day)!.add(id);
  if (!memory.tried.has(event)) memory.tried.set(event, new Set());
  memory.tried.get(event)!.add(id);
  const c = memory.counts.get(day) ?? {};
  c[event] = (c[event] ?? 0) + 1;
  memory.counts.set(day, c);
}

function upstash(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function pipeline(commands: string[][]): Promise<unknown[]> {
  const r = upstash()!;
  const res = await fetch(`${r.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}` },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return ((await res.json()) as { result: unknown }[]).map((x) => x.result);
}

const TTL = String(STATS_TTL_SECONDS);

export async function recordStat(id: string, event: StatsEvent, day = statsDay()): Promise<void> {
  if (!upstash()) return recordInMemory(id, event, day);
  await pipeline([
    ["SADD", "stats:ids", id],
    ["EXPIRE", "stats:ids", TTL],
    ["SET", `stats:first:${id}`, day, "NX", "EX", TTL],
    ["SADD", `stats:day:${day}`, id],
    ["EXPIRE", `stats:day:${day}`, TTL],
    ["SADD", `stats:ev:${event}`, id],
    ["EXPIRE", `stats:ev:${event}`, TTL],
    ["HINCRBY", `stats:count:${day}`, event, "1"],
    ["EXPIRE", `stats:count:${day}`, TTL],
  ]);
}

/** 讀出全部統計（封測規模小，直接全讀） */
export async function loadStats(today = statsDay()): Promise<StatsSnapshot> {
  if (!upstash()) return memory;
  const snap = emptySnapshot();
  const [ids] = (await pipeline([["SMEMBERS", "stats:ids"]])) as string[][];
  if (ids.length === 0) return snap;
  const firsts = (await pipeline([["MGET", ...ids.map((id) => `stats:first:${id}`)]]))[0] as (string | null)[];
  ids.forEach((id, i) => firsts[i] && snap.first.set(id, firsts[i]!));
  const start = [...snap.first.values()].sort()[0] ?? today;
  const days: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);
  const results = await pipeline([
    ...days.map((d) => ["SMEMBERS", `stats:day:${d}`]),
    ...STATS_EVENTS.map((e) => ["SMEMBERS", `stats:ev:${e}`]),
    ...days.map((d) => ["HGETALL", `stats:count:${d}`]),
  ]);
  days.forEach((d, i) => snap.active.set(d, new Set(results[i] as string[])));
  STATS_EVENTS.forEach((e, i) => snap.tried.set(e, new Set(results[days.length + i] as string[])));
  days.forEach((d, i) => {
    const flat = results[days.length + STATS_EVENTS.length + i] as string[];
    const c: Partial<Record<StatsEvent, number>> = {};
    for (let j = 0; j < flat.length; j += 2) c[flat[j] as StatsEvent] = Number(flat[j + 1]);
    snap.counts.set(d, c);
  });
  return snap;
}

export interface Gates {
  installs: number;
  /** 出現滿 7 天的安裝：第一週用了幾天的中位數 */
  weekOne: { eligible: number; medianDays: number | null };
  /** 出現滿 14 天的安裝：第 8–14 天還有用的比例 */
  weekTwo: { eligible: number; retained: number; rate: number | null };
  /** 試過各事件的安裝比例 */
  triedRate: Partial<Record<StatsEvent, number>>;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 依封測門檻計算；只看今天以前完整的天數 */
export function computeGates(snap: StatsSnapshot, today = statsDay()): Gates {
  const activeOn = (id: string, day: string) => snap.active.get(day)?.has(id) ?? false;
  const daysActive = (id: string, from: string, n: number) =>
    Array.from({ length: n }, (_, i) => addDays(from, i)).filter((d) => activeOn(id, d)).length;

  const weekOneDays: number[] = [];
  let weekTwoEligible = 0;
  let retained = 0;
  for (const [id, first] of snap.first) {
    if (addDays(first, 7) <= today) weekOneDays.push(daysActive(id, first, 7));
    if (addDays(first, 14) <= today) {
      weekTwoEligible += 1;
      if (daysActive(id, addDays(first, 7), 7) > 0) retained += 1;
    }
  }
  const installs = snap.first.size;
  const triedRate: Partial<Record<StatsEvent, number>> = {};
  for (const e of STATS_EVENTS) triedRate[e] = installs ? (snap.tried.get(e)?.size ?? 0) / installs : 0;
  return {
    installs,
    weekOne: { eligible: weekOneDays.length, medianDays: median(weekOneDays) },
    weekTwo: { eligible: weekTwoEligible, retained, rate: weekTwoEligible ? retained / weekTwoEligible : null },
    triedRate,
  };
}
