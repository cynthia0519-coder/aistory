import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LibraryStory } from "@aistory/shared";
import { fullWidthPunct, fullWidthStoryPunct } from "../src/lib/zh-punct";

const here = dirname(fileURLToPath(import.meta.url));
const stories = JSON.parse(readFileSync(resolve(here, "../../client/public/library/stories.json"), "utf8")) as LibraryStory[];

test("library Chinese text has no half-width punctuation next to Chinese", () => {
  const bad = stories.filter((s) => JSON.stringify(fullWidthStoryPunct(s)) !== JSON.stringify(s)).map((s) => s.id);
  assert.deepEqual(bad, []);
});

test("fullWidthStoryPunct changes only the Chinese fields", () => {
  const s = stories.find((x) => x.guide)!;
  const dirty = {
    ...s,
    title: { zh: "好!", en: "Hi, there!" },
    guide: s.guide && { ...s.guide, zh: { ...s.guide.zh, tip: "今晚,試試" } },
  };
  const out = fullWidthStoryPunct(dirty);
  assert.equal(out.title.zh, "好！");
  assert.equal(out.title.en, "Hi, there!");
  assert.equal(out.guide?.zh.tip, "今晚，試試");
  assert.equal(fullWidthPunct("咻——,{name}"), "咻——，{name}");
});
