// 主題、引導卡的契約測試
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aiThemesFor,
  LibraryStorySchema,
  renderLibraryStory,
  StoryRequestSchema,
  THEME_IDS,
  THEMES,
  type LibraryStory,
  type ThemeRule,
} from "../src/index.ts";

const baseRequest = { language: "zh", ageBand: "4-6", style: "cute", length: "3min", scene: "a park" } as const;

test("request without theme is valid", () => {
  assert.equal(StoryRequestSchema.safeParse(baseRequest).success, true);
});

test("request accepts an aiAllowed theme", () => {
  assert.equal(StoryRequestSchema.safeParse({ ...baseRequest, theme: "brushing-teeth" }).success, true);
  assert.equal(StoryRequestSchema.safeParse({ ...baseRequest, theme: "anger" }).success, true);
});

test("request rejects themes that are not aiAllowed", () => {
  for (const theme of ["crossing-road", "swimsuit-rule", "good-bad-secrets", "pet-loss"]) {
    const r = StoryRequestSchema.safeParse({ ...baseRequest, theme });
    assert.equal(r.success, false, theme);
  }
});

test("request rejects unknown themes", () => {
  assert.equal(StoryRequestSchema.safeParse({ ...baseRequest, theme: "nope" }).success, false);
});

test("theme flags follow the category rules", () => {
  for (const id of THEME_IDS) {
    const t: ThemeRule = THEMES[id];
    const aiCategory = t.category === "habits" || t.category === "emotions" || t.category === "values";
    assert.equal(t.aiAllowed, aiCategory && id !== "pet-loss", id);
    assert.equal(t.sensitive, t.category === "body" || id === "pet-loss", id);
    assert.ok(t.keyMessages.length > 0 && t.ages.length > 0, id);
    assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), id);
  }
  assert.equal(THEME_IDS.length, 46);
});

test("aiThemesFor filters by age band", () => {
  const young = aiThemesFor("2-4");
  assert.ok(young.includes("potty"));
  assert.ok(!young.includes("bullying"));
  assert.ok(!aiThemesFor("8-10").includes("potty"));
  assert.ok(aiThemesFor().every((id) => (THEMES[id] as ThemeRule).aiAllowed));
});

const story: LibraryStory = {
  id: "brush-test",
  style: "cute",
  ageBands: ["2-4"],
  setting: "home",
  theme: "brushing-teeth",
  title: { zh: "{name}刷牙", en: "{name} Brushes" },
  paragraphs: { zh: ["{name}拿起牙刷。"], en: ["{name} picks up a toothbrush."] },
  guide: {
    zh: { questions: ["{name}最喜歡刷哪一顆牙？", "{he}刷完牙感覺怎麼樣？"], tip: "今晚和{his}牙刷一起唱刷牙歌。" },
    en: { questions: ["Which tooth does {name} like to brush first?", "How does {he} feel after?"], tip: "{his} toothbrush can sing tonight." },
  },
  draft: true,
};

test("schema accepts a themed story with a guide", () => {
  assert.equal(LibraryStorySchema.safeParse(story).success, true);
});

test("schema rejects unknown tokens in the guide", () => {
  const bad = { ...story, guide: { ...story.guide!, zh: { ...story.guide!.zh, tip: "跟{she}一起刷。" } } };
  assert.equal(LibraryStorySchema.safeParse(bad).success, false);
});

test("schema rejects guides with too few or too many questions", () => {
  const one = { ...story, guide: { ...story.guide!, en: { ...story.guide!.en, questions: ["Only one?"] } } };
  assert.equal(LibraryStorySchema.safeParse(one).success, false);
  const four = { ...story, guide: { ...story.guide!, en: { ...story.guide!.en, questions: ["a", "b", "c", "d"] } } };
  assert.equal(LibraryStorySchema.safeParse(four).success, false);
});

test("schema rejects unknown theme ids", () => {
  assert.equal(LibraryStorySchema.safeParse({ ...story, theme: "flying" }).success, false);
});

test("renders the guide with hero name and pronouns", () => {
  const zh = renderLibraryStory(story, "zh", { name: "小美", gender: "girl" });
  assert.deepEqual(zh.guide, {
    questions: ["小美最喜歡刷哪一顆牙？", "她刷完牙感覺怎麼樣？"],
    tip: "今晚和她的牙刷一起唱刷牙歌。",
  });
  const en = renderLibraryStory(story, "en", { name: "Max", gender: "boy" });
  assert.deepEqual(en.guide, {
    questions: ["Which tooth does Max like to brush first?", "How does he feel after?"],
    tip: "His toothbrush can sing tonight.",
  });
});

test("stories without a guide render no guide", () => {
  const { guide: _guide, ...noGuide } = story;
  assert.equal(renderLibraryStory(noGuide, "en").guide, undefined);
});
