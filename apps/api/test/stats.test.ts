import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, computeGates, recordStat, loadStats, statsDay, type StatsSnapshot } from "../src/lib/stats";

function snapshot(days: Record<string, string[]>, photo: string[] = []): StatsSnapshot {
  const snap: StatsSnapshot = { first: new Map(), active: new Map(), tried: new Map(), counts: new Map() };
  for (const day of Object.keys(days).sort()) {
    snap.active.set(day, new Set(days[day]));
    for (const id of days[day]) if (!snap.first.has(id)) snap.first.set(id, day);
  }
  snap.tried.set("photo_story", new Set(photo));
  return snap;
}

test("statsDay uses Taiwan time", () => {
  // 2026-10-19 17:00 UTC = 2026-10-20 01:00 台灣
  assert.equal(statsDay(Date.parse("2026-10-19T17:00:00Z")), "2026-10-20");
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
});

test("computeGates counts week-one days, week-two retention and photo share", () => {
  const d = (n: number) => addDays("2026-10-01", n);
  const snap = snapshot(
    {
      [d(0)]: ["a", "b", "c"],
      [d(1)]: ["a"],
      [d(2)]: ["a", "b"],
      [d(9)]: ["a"],
      [d(10)]: ["d"],
    },
    ["a", "d"],
  );
  const g = computeGates(snap, d(14));
  assert.equal(g.installs, 4);
  // a 3 天、b 2 天、c 1 天；d 還沒滿 7 天
  assert.deepEqual(g.weekOne, { eligible: 3, medianDays: 2 });
  // a、b、c 滿 14 天，只有 a 第二週有用
  assert.deepEqual(g.weekTwo, { eligible: 3, retained: 1, rate: 1 / 3 });
  assert.equal(g.triedRate.photo_story, 0.5);
});

test("recordStat without Redis keeps an in-memory snapshot", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  await recordStat("11111111-1111-4111-8111-111111111111", "open", "2026-10-01");
  await recordStat("11111111-1111-4111-8111-111111111111", "photo_story", "2026-10-02");
  const snap = await loadStats("2026-10-02");
  assert.equal(snap.first.get("11111111-1111-4111-8111-111111111111"), "2026-10-01");
  assert.equal(snap.counts.get("2026-10-02")?.photo_story, 1);
});
