import { test } from "node:test";
import assert from "node:assert/strict";
import type { LibraryStory } from "@aistory/shared";
import { blockReason, cleanDescription, cleanTitle, episodePublishAt, videoResource } from "../src/lib/youtube-upload";

const now = new Date("2026-11-11T05:00:00Z");
const map = (...s: Partial<LibraryStory>[]) => new Map(s.map((x) => [x.id!, x as LibraryStory]));

test("節目時間是台灣 19:30，換成 UTC", () => {
  assert.equal(episodePublishAt("2026-11-16"), "2026-11-16T11:30:00.000Z");
});

test("已上架、沒排程或排程不晚於節目的故事可以上傳", () => {
  const s = map({ id: "a", draft: false }, { id: "b", draft: false, publishAt: "2026-11-16T19:30:00+08:00" });
  assert.equal(blockReason({ id: "a", date: "2026-11-16" }, s, now), undefined);
  assert.equal(blockReason({ id: "b", date: "2026-11-16" }, s, now), undefined);
});

test("草稿（包括還沒給 Cynthia 聽過的原創集）不准上傳", () => {
  const s = map({ id: "mumu-jerry-20-new", draft: true });
  assert.match(blockReason({ id: "mumu-jerry-20-new", date: "2026-11-20" }, s, now)!, /草稿/);
});

test("App 排程晚於節目會偷跑，擋下", () => {
  const s = map({ id: "c", draft: false, publishAt: "2026-11-20T19:30:00+08:00" });
  assert.match(blockReason({ id: "c", date: "2026-11-16" }, s, now)!, /偷跑/);
});

test("找不到的故事、時間已過或太近的節目都擋下", () => {
  const s = map({ id: "d", draft: false });
  assert.match(blockReason({ id: "x", date: "2026-11-16" }, s, now)!, /沒有/);
  assert.match(blockReason({ id: "d", date: "2026-11-10" }, s, now)!, /已過/);
  const close = new Date("2026-11-16T11:20:00Z");
  assert.match(blockReason({ id: "d", date: "2026-11-16" }, s, close)!, /太近/);
});

test("影片一律私人加排程、標成兒童內容", () => {
  const r = videoResource({ title: "t", description: "d" }, "zh", "2026-11-16T11:30:00.000Z", "24");
  assert.equal(r.status.privacyStatus, "private");
  assert.equal(r.status.selfDeclaredMadeForKids, true);
  assert.equal(r.snippet.defaultLanguage, "zh-Hant");
});

test("標題去掉 < >、最多 100 字；說明最多 5000 bytes", () => {
  assert.equal(cleanTitle("a<b>c  d"), "abc d");
  assert.equal([...cleanTitle("字".repeat(150))].length, 100);
  assert.ok(Buffer.byteLength(cleanDescription("字".repeat(3000))) <= 5000);
});
