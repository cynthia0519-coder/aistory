import { test } from "node:test";
import assert from "node:assert/strict";
import type { LibraryStory } from "@aistory/shared";
import { buildAss, captionCues, episodeText, publishableStories, splitCaptions } from "../src/lib/episode";

test("splitCaptions keeps sentences and splits long ones at commas", () => {
  assert.deepEqual(splitCaptions("天黑了。「你好，小雲朵。」小寶輕輕說。"), ["天黑了。", "「你好，小雲朵。」", "小寶輕輕說。"]);
  const long = "小寶走過長長的走廊，看見一扇小小的門，門上掛著一盞會唱歌的燈，燈光一閃一閃。";
  const lines = splitCaptions(long, 16);
  assert.ok(lines.every((l) => [...l].length <= 16), lines.join("|"));
  assert.equal(lines.join(""), long);
});

test("splitCaptions hard-wraps text without punctuation", () => {
  const lines = splitCaptions("一".repeat(30), 12);
  assert.deepEqual(lines.map((l) => l.length), [12, 12, 6]);
});

test("captionCues spread one segment over its time by length", () => {
  const cues = captionCues([{ text: "天黑了。天空藍藍的，深深的藍。", start: 10, end: 16 }]);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 10);
  assert.equal(cues[1].end, 16);
  assert.ok(cues[0].end < cues[1].end && cues[0].end > 10);
});

test("buildAss escapes override braces and formats times", () => {
  const ass = buildAss({ text: "標題", start: 0, end: 3.5 }, [{ text: "a{b}\\c", start: 61.234, end: 3700 }], "Font");
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:03\.50,Title,,0,0,0,,標題/);
  assert.match(ass, /0:01:01\.23,1:01:40\.00,Caption,,0,0,0,,a｛b｝＼c/);
});

const story = (over: Partial<LibraryStory>): LibraryStory =>
  ({
    id: "s",
    title: { zh: "{name}的晚安", en: "{name}" },
    paragraphs: { zh: ["{name}睡覺了。"], en: ["{name} sleeps."] },
    style: "bedtime",
    ageBands: ["2-4", "4-6"],
    setting: "home",
    draft: true,
    ...over,
  }) as LibraryStory;

test("publishableStories needs an ok review of the current text and no sensitive theme", () => {
  const all = [
    story({ id: "ok" }),
    story({ id: "check" }),
    story({ id: "changed" }),
    story({ id: "body", theme: "saying-no" }),
    story({ id: "unreviewed" }),
  ];
  const flags = {
    ok: { status: "ok", hash: "h-ok" },
    check: { status: "check", hash: "h-check" },
    changed: { status: "ok", hash: "old" },
    body: { status: "ok", hash: "h-body" },
  };
  const ids = publishableStories(all, flags, (s) => `h-${s.id}`).map((s) => s.id);
  assert.deepEqual(ids, ["ok"]);
});

test("episodeText uses the default hero name and the age range", () => {
  const t = episodeText(story({}), "zh", "https://example.com");
  assert.equal(t.title, "小寶的晚安｜睡前故事｜2–6 歲");
  assert.match(t.description, /https:\/\/example\.com/);
});
