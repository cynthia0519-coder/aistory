// 無主題故事補引導卡：選故事與提示詞的測試（npm test -w @aistory/api）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LibraryStory } from "@aistory/shared";
import { buildPlainGuidePrompt, needsPlainGuide, PLAIN_GUIDE_SYSTEM } from "../src/lib/library-guides";
import { selectStories } from "../scripts/library-guides";

const here = dirname(fileURLToPath(import.meta.url));
const stories = JSON.parse(readFileSync(resolve(here, "../../client/public/library/stories.json"), "utf8")) as LibraryStory[];
const themed = stories.find((s) => s.theme && s.guide)!;
const plain = stories.find((s) => !s.theme)!;
const bare = { ...plain, guide: undefined };

test("only untheme stories without a guide need a plain guide", () => {
  assert.equal(needsPlainGuide(bare), true);
  assert.equal(needsPlainGuide(themed), false);
  assert.equal(needsPlainGuide({ ...themed, guide: undefined }), false);
  assert.equal(needsPlainGuide({ ...bare, guide: themed.guide }), false);
});

test("selectStories never picks themed stories, even with --force", () => {
  const all = [themed, bare, { ...plain, id: "has-guide", guide: themed.guide }];
  assert.deepEqual(selectStories(all, { only: null, force: false }).map((s) => s.id), [bare.id]);
  assert.deepEqual(selectStories(all, { only: null, force: true }).map((s) => s.id), [bare.id, "has-guide"]);
  assert.deepEqual(selectStories(all, { only: [themed.id], force: true }), []);
});

test("every untheme story in the library has a guide", () => {
  assert.deepEqual(stories.filter((s) => !s.theme && !s.guide).map((s) => s.id), []);
});

test("plain guide prompt carries the story and no lesson", () => {
  const p = buildPlainGuidePrompt(bare);
  assert.ok(p.includes(bare.title.zh) && p.includes(bare.title.en));
  for (const para of bare.paragraphs.zh) assert.ok(p.includes(para));
  assert.ok(!/Theme:|Key messages/.test(p));
  assert.match(PLAIN_GUIDE_SYSTEM, /must not teach/);
  assert.match(PLAIN_GUIDE_SYSTEM, /bedtime/);
});
