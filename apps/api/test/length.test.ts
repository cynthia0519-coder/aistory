import { test } from "node:test";
import assert from "node:assert/strict";
import { lengthTarget } from "../src/lib/length";
import { LIBRARY_STORY_LENGTH, libraryLength } from "../src/lib/library-engine";

test("library 4-6 stories get a smaller length boost than photo stories; 2-4 keeps the photo-story boost", () => {
  const photo46 = lengthTarget(LIBRARY_STORY_LENGTH, "4-6", "zh");
  const lib46 = libraryLength({ ageBands: ["4-6", "6-8"] }).lang.zh;
  assert.ok(lib46.target < photo46.target, `${lib46.target} should be below ${photo46.target}`);
  assert.deepEqual(lib46.rule, photo46.rule);
  assert.equal(libraryLength({ ageBands: ["2-4"] }).lang.zh.target, lengthTarget(LIBRARY_STORY_LENGTH, "2-4", "zh").target);
});
