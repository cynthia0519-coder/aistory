// 故事庫代換規則的測試：node --test（Node 22.18+ 原生支援 TypeScript）
import { test } from "node:test";
import assert from "node:assert/strict";
import { LibraryStorySchema, renderLibraryStory, type LibraryStory } from "../src/index.ts";

const story: LibraryStory = {
  id: "test-story",
  style: "cute",
  ageBands: ["4-6"],
  setting: "park",
  title: { zh: "{name}的帽子", en: "{name} and the Hat" },
  paragraphs: {
    zh: ["{name}找到一頂帽子。{he}笑了，風把{his}帽子吹給{him}。", "第二段。", "第三段。"],
    en: ["{he} found a hat. {his} hat flew to {him}! {he} laughed.", '"Wait," said {name}. "{he} is here."', "Look at {him}."],
  },
  draft: true,
};
const render = (lang: "zh" | "en", hero?: Parameters<typeof renderLibraryStory>[2]) =>
  renderLibraryStory(story, lang, hero);

test("zh boy", () => {
  const r = render("zh", { name: "小明", gender: "boy" });
  assert.equal(r.title, "小明的帽子");
  assert.equal(r.paragraphs[0], "小明找到一頂帽子。他笑了，風把他的帽子吹給他。");
});

test("zh girl", () => {
  const r = render("zh", { name: "小美", gender: "girl" });
  assert.equal(r.paragraphs[0], "小美找到一頂帽子。她笑了，風把她的帽子吹給她。");
});

test("zh unspecified uses the name", () => {
  const r = render("zh", { name: "安安", gender: "unspecified" });
  assert.equal(r.paragraphs[0], "安安找到一頂帽子。安安笑了，風把安安的帽子吹給安安。");
});

test("zh no hero uses default name", () => {
  const r = render("zh");
  assert.equal(r.title, "小寶的帽子");
  assert.equal(r.paragraphs[0], "小寶找到一頂帽子。小寶笑了，風把小寶的帽子吹給小寶。");
});

test("en boy with capitalization", () => {
  const r = render("en", { name: "Max", gender: "boy" });
  assert.equal(r.title, "Max and the Hat");
  assert.equal(r.paragraphs[0], "He found a hat. His hat flew to him! He laughed.");
  assert.equal(r.paragraphs[1], '"Wait," said Max. "He is here."');
  assert.equal(r.paragraphs[2], "Look at him.");
});

test("en girl", () => {
  const r = render("en", { name: "Mia", gender: "girl" });
  assert.equal(r.paragraphs[0], "She found a hat. Her hat flew to her! She laughed.");
  assert.equal(r.paragraphs[2], "Look at her.");
});

test("en unspecified uses name and name's", () => {
  const r = render("en", { name: "Sam", gender: "unspecified" });
  assert.equal(r.paragraphs[0], "Sam found a hat. Sam's hat flew to Sam! Sam laughed.");
});

test("en no hero uses default name", () => {
  const r = render("en");
  assert.equal(r.title, "Bo and the Hat");
  assert.equal(r.paragraphs[2], "Look at Bo.");
});

test("schema accepts valid tokens", () => {
  assert.equal(LibraryStorySchema.safeParse(story).success, true);
});

test("schema rejects unknown tokens", () => {
  const bad = { ...story, title: { zh: "{name}的{she}", en: "Hi" } };
  assert.equal(LibraryStorySchema.safeParse(bad).success, false);
});

test("schema rejects mismatched paragraph counts", () => {
  const bad = { ...story, paragraphs: { zh: ["一"], en: ["One", "Two"] } };
  assert.equal(LibraryStorySchema.safeParse(bad).success, false);
});

test("schema rejects non-kebab id", () => {
  assert.equal(LibraryStorySchema.safeParse({ ...story, id: "Test_Story" }).success, false);
});
