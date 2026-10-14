import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STORY_SETTINGS, THEME_IDS } from "@aistory/shared";
import { SCENE_VARIANTS, sceneName } from "@aistory/shared/media";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(here, "../../client/public");

test("every scene a story can get exists and is precached by the service worker", () => {
  const sw = readFileSync(resolve(PUBLIC, "sw.js"), "utf8");
  const names = new Set<string>();
  for (const setting of STORY_SETTINGS) {
    for (const theme of [undefined, ...THEME_IDS]) {
      const base = sceneName(setting, theme);
      names.add(base);
      for (let i = 2; i <= (SCENE_VARIANTS[base] ?? 1); i++) names.add(`${base}-${i}`);
    }
  }
  for (const name of names) {
    assert.ok(existsSync(resolve(PUBLIC, "scenes", `${name}.jpg`)), `missing scenes/${name}.jpg`);
    assert.ok(sw.includes(`"${name}"`), `sw.js does not precache ${name}`);
  }
});

test("a library story gets the same scene in every language and spreads across variants", () => {
  assert.equal(sceneName("school", "sharing-turns", "library:a:zh"), sceneName("school", "sharing-turns", "library:a:en"));
  const seen = new Set(Array.from({ length: 60 }, (_, i) => sceneName("city", undefined, `story-${i}`)));
  assert.deepEqual([...seen].sort(), ["city", "city-2", "city-3", "city-4"]);
  assert.equal(sceneName("city"), "city");
});
