import { test } from "node:test";
import assert from "node:assert/strict";
import type { LibraryStory } from "@aistory/shared";
import { parsePublishAt, setPublished } from "../src/lib/library-publish";

const story = (id: string, draft = true) => ({ id, draft }) as LibraryStory;
const hashOf = (s: LibraryStory) => `h-${s.id}`;
const flags = {
  ok: { status: "ok", hash: "h-ok" },
  check: { status: "check", hash: "h-check" },
  fix: { status: "fix", hash: "h-fix" },
  stale: { status: "ok", hash: "old" },
};
const all = [story("ok"), story("check"), story("fix"), story("stale"), story("new")];

test("publishes reviewed stories, including ones a person checked after an AI 'check'", () => {
  const r = setPublished(all, ["ok", "check"], true, flags, hashOf);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.changed, ["ok", "check"]);
  assert.deepEqual(r.stories.filter((s) => !s.draft).map((s) => s.id), ["ok", "check"]);
});

test("refuses fix, stale, unreviewed and unknown stories, and changes nothing", () => {
  const r = setPublished(all, ["ok", "fix", "stale", "new", "nope"], true, flags, hashOf);
  assert.equal(r.errors.length, 4);
  assert.deepEqual(r.changed, []);
  assert.equal(r.stories, all);
});

test("--force skips the review checks; unpublishing never checks", () => {
  assert.deepEqual(setPublished(all, ["fix"], true, flags, hashOf, true).changed, ["fix"]);
  const live = [story("fix", false)];
  assert.deepEqual(setPublished(live, ["fix"], false, flags, hashOf).changed, ["fix"]);
});

test("scheduled publishing sets publishAt; publishing again without a time or unpublishing clears it", () => {
  const at = parsePublishAt("2026-11-17");
  assert.equal(at, "2026-11-17T19:30:00+08:00");
  const r = setPublished(all, ["ok"], true, flags, hashOf, false, { ok: at });
  assert.equal(r.stories.find((s) => s.id === "ok")?.publishAt, at);
  const now = setPublished(r.stories, ["ok"], true, flags, hashOf);
  assert.deepEqual(now.changed, ["ok"]);
  assert.equal(now.stories.find((s) => s.id === "ok")?.publishAt, undefined);
  const off = setPublished(r.stories, ["ok"], false, flags, hashOf);
  assert.equal(off.stories.find((s) => s.id === "ok")?.publishAt, undefined);
  assert.throws(() => parsePublishAt("next tuesday"));
  assert.throws(() => parsePublishAt("2026-11-17T19:30:00"));
});
