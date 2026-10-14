// 故事庫 AI 預審的規則檢查測試：npm test -w @aistory/api
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LibraryStory } from "@aistory/shared";
import {
  checkDuplicateTitles,
  checkGuide,
  checkLength,
  checkParagraphs,
  checkHeroGender,
  checkPhoneNumbers,
  checkSensitivePatterns,
  checkTokens,
  checkZhPunctuation,
  combinedStatus,
  normalizeTitle,
  reviewContentHash,
  runDeterministicChecks,
  summarize,
  titleSimilarity,
  youngestBand,
  type ReviewEntry,
} from "../src/lib/library-review";

const guide = {
  zh: { questions: ["{name}做了什麼？", "你會怎麼做？"], tip: "今晚一起練習。" },
  en: { questions: ["What did {name} do?", "What would you do?"], tip: "Practice together tonight." },
};

/** 長度落在 2–4 歲 3 分鐘範圍（中文 250–400 漢字、英文 150–250 words）的故事 */
function makeStory(over: Partial<LibraryStory> = {}): LibraryStory {
  const zhPara = "{name}和奶奶一起走到公園，看見小鳥在樹上唱歌，大家都好開心。"; // 漢字約 25（{name} 換成「小寶」）
  const enPara = "{name} and Grandma walked to the park and heard a little bird singing in the tall tree."; // 17 words
  return {
    id: "test-story",
    style: "cute",
    ageBands: ["2-4"],
    setting: "park",
    title: { zh: "{name}的小鳥", en: "{name} and the Bird" },
    paragraphs: { zh: Array(12).fill(zhPara), en: Array(12).fill(enPara) },
    draft: true,
    ...over,
  };
}

test("youngestBand picks the youngest listed band", () => {
  assert.equal(youngestBand(["6-8", "4-6"]), "4-6");
  assert.equal(youngestBand(["8-10"]), "8-10");
});

test("length in range passes", () => {
  assert.deepEqual(checkLength(makeStory()), []);
});

test("length too short is flagged per language, hollow is high", () => {
  const s = makeStory({ paragraphs: { zh: ["{name}睡了。"], en: ["{name} slept and dreamed of the moon all night long."] } });
  const c = checkLength(s);
  assert.equal(c.length, 2);
  assert.ok(c.every((x) => x.kind === "length" && x.severity === "high"));
  assert.deepEqual(c.map((x) => x.lang).sort(), ["en", "zh"]);
});

test("length uses the youngest band's range", () => {
  // 2-4 範圍內的長度，標成 [2-4, 6-8] 也應該通過（以 2-4 為準）；只標 6-8 就太短
  assert.deepEqual(checkLength(makeStory({ ageBands: ["6-8", "2-4"] })), []);
  assert.ok(checkLength(makeStory({ ageBands: ["6-8"] })).some((c) => c.lang === "zh"));
});

test("paragraph count mismatch", () => {
  const s = makeStory({ paragraphs: { zh: ["{name}一。", "{name}二。"], en: ["{name} one."] } });
  assert.equal(checkParagraphs(s)[0]?.kind, "paragraph_mismatch");
  assert.deepEqual(checkParagraphs(makeStory()), []);
});

test("token rules", () => {
  const s = makeStory({
    paragraphs: {
      zh: ["{name}拿起{his}的帽子。", "{she}笑了。", "沒有名字。"],
      en: ["The hat was {his}.", "{name} washed {himself}... no, {name} did it alone.", "{name} looked at herself. The man introduced himself."],
    },
  });
  const notes = checkTokens(s).map((c) => `${c.lang}@${c.where}:${c.note}`);
  assert.ok(notes.some((n) => n.startsWith("zh@0") && n.includes("{his}的")));
  assert.ok(notes.some((n) => n.startsWith("zh@1") && n.includes("{she}")));
  assert.ok(notes.some((n) => n.startsWith("en@0") && n.includes("名詞")));
  assert.ok(notes.some((n) => n.startsWith("en@1") && n.includes("{himself}")));
  assert.ok(notes.some((n) => n.startsWith("en@2") && n.includes("himself/herself")));
  // 其他角色用反身代名詞不算
  const other = makeStory({ paragraphs: { zh: ["{name}笑了。"], en: ["{name} waved. The man introduced himself."] } });
  assert.deepEqual(checkTokens(other), []);
  assert.deepEqual(checkTokens(makeStory()), []);
});

test("stray braces are flagged", () => {
  const s = makeStory({ title: { zh: "{name的帽子", en: "{name} and the Hat" } });
  assert.ok(checkTokens(s).some((c) => c.where === "title" && c.note.includes("大括號")));
});

test("guide required for themed stories", () => {
  assert.equal(checkGuide(makeStory({ theme: "anger" }))[0]?.severity, "high");
  assert.deepEqual(checkGuide(makeStory({ theme: "anger", guide })), []);
  assert.equal(checkGuide(makeStory({ guide }))[0]?.severity, "low");
  assert.deepEqual(checkGuide(makeStory()), []);
});

test("half-width punctuation next to Chinese", () => {
  const s = makeStory({
    title: { zh: "{name},出發!", en: "Go, {name}!" },
    paragraphs: { zh: ["奶奶說:「好啊?」", "全形，沒問題。", "Wi-Fi, OK 在這裡。"], en: ["a", "b", "c"] },
    guide: { zh: { questions: ["你覺得呢?", "好嗎？"], tip: "一起練習；好嗎" }, en: guide.en },
  });
  const c = checkZhPunctuation(s);
  assert.deepEqual(c.map((x) => x.where).sort(), ["0", "guide", "title"]);
  assert.ok(c.every((x) => x.lang === "zh" && x.kind === "zh_half_width_punct"));
  // 英文不檢查
  assert.ok(!c.some((x) => x.lang === "en"));
});

test("phone and hotline numbers", () => {
  const s = makeStory({
    paragraphs: {
      zh: ["可以打 113 喔。", "媽媽的電話是 0912-345-678。", "撥一一三。", "她有 3 顆蘋果。"],
      en: ["Call １１３ anytime.", "We counted to 100.", "Nothing here.", "Three apples."],
    },
  });
  const c = checkPhoneNumbers(s);
  const by = (lang: string, where: string) => c.filter((x) => x.lang === lang && x.where === where);
  assert.equal(by("zh", "0")[0]?.severity, "high");
  assert.equal(by("zh", "1")[0]?.severity, "high");
  assert.equal(by("zh", "2")[0]?.severity, "high");
  assert.deepEqual(by("zh", "3"), []);
  assert.equal(by("en", "0")[0]?.severity, "high");
  assert.equal(by("en", "1")[0]?.severity, "medium");
});

test("hero counted in 她們", () => {
  const s = makeStory({
    paragraphs: {
      zh: ["媽媽和{name}一起走，她們先截圖。", "媽媽和奶奶聊天，她們笑了。{name}在玩。", "{name}和爸爸去公園。"],
      en: ["a", "b", "c"],
    },
  });
  const c = checkHeroGender(s);
  assert.deepEqual(c.map((x) => x.where), ["0"]);
  assert.equal(c[0].severity, "medium");
});

test("hotline in the guide is flagged", () => {
  const s = makeStory({
    theme: "saying-no",
    guide: { zh: { ...guide.zh, tip: "需要時可撥 113 保護專線。" }, en: guide.en },
  });
  assert.equal(checkPhoneNumbers(s)[0]?.where, "guide");
});

test("title normalization and similarity", () => {
  assert.equal(normalizeTitle("{name}的小石頭", "zh"), "小石頭");
  assert.equal(normalizeTitle("{name} and the Hat!", "en"), "hat");
  assert.equal(titleSimilarity("小石頭", "小石頭"), 1);
  assert.ok(titleSimilarity("颱風天大冒險", "颱風天的大冒險") >= 0.7);
  assert.ok(titleSimilarity("小石頭", "小紙船") < 0.5);
});

test("duplicate and near-duplicate titles", () => {
  const a = makeStory({ id: "a", title: { zh: "{name}的颱風天大冒險", en: "{name}'s Typhoon Day" } });
  const b = makeStory({ id: "b", title: { zh: "{name}的颱風天大冒險", en: "A Stormy Night" } });
  const c = makeStory({ id: "c", title: { zh: "{name}和颱風天的大冒險", en: "{name} and the Typhoon Day" } });
  const d = makeStory({ id: "d", title: { zh: "{name}的小石頭", en: "The Pebble" } });
  const m = checkDuplicateTitles([a, b, c, d]);
  assert.ok(m.get("a")!.some((x) => x.lang === "zh" && x.severity === "medium" && x.note.includes("b")));
  assert.ok(m.get("c")!.some((x) => x.lang === "zh" && x.severity === "low"));
  assert.ok(m.get("a")!.some((x) => x.lang === "en" && x.note.includes("c")));
  assert.equal(m.get("d"), undefined);
});

test("tickle + secret recurring in a sensitive category", () => {
  const ts = (id: string, theme: LibraryStory["theme"]) =>
    makeStory({
      id,
      theme,
      guide,
      paragraphs: { zh: ["叔叔一直搔癢，還說這是祕密。"], en: ["He kept tickling and said it was a secret."] },
    });
  const plain = makeStory({ id: "plain", theme: "swimsuit-rule", guide });
  // 「心裡癢癢的」不是搔癢情節
  const itchy = makeStory({
    id: "itchy",
    theme: "good-bad-secrets",
    guide,
    paragraphs: { zh: ["{name}心裡癢癢的，好想說出祕密。"], en: ["{name} really wanted to tell the secret."] },
  });
  const m = checkSensitivePatterns([ts("x", "saying-no"), ts("y", "good-bad-secrets"), plain, itchy]);
  assert.ok(m.get("x")!.some((c) => c.kind === "sensitive_pattern" && c.severity === "medium" && c.note.includes("y")));
  assert.ok(m.get("y")!.some((c) => c.note.includes("x")));
  assert.equal(m.get("plain"), undefined);
  assert.equal(m.get("itchy"), undefined);
  // 只有一篇就不算重複；非敏感主題不檢查
  assert.equal(checkSensitivePatterns([ts("x", "saying-no")]).size, 0);
  assert.equal(checkSensitivePatterns([ts("p", "anger"), ts("q", "manners")]).size, 0);
});

test("runDeterministicChecks covers every story", () => {
  const stories = [makeStory({ id: "a" }), makeStory({ id: "b", title: { zh: "{name}的大樹", en: "The Tree" } })];
  const m = runDeterministicChecks(stories);
  assert.deepEqual([...m.keys()], ["a", "b"]);
  assert.deepEqual(m.get("b"), []);
});

test("content hash changes with content only", () => {
  const s = makeStory();
  assert.equal(reviewContentHash(s), reviewContentHash({ ...s, draft: false }));
  assert.notEqual(reviewContentHash(s), reviewContentHash({ ...s, title: { ...s.title, en: "Other" } }));
});

test("combined status and summary", () => {
  const high = { kind: "tokens", severity: "high", lang: "zh", where: "0", note: "x" } as const;
  const low = { kind: "zh_half_width_punct", severity: "low", lang: "zh", where: "0", note: "x" } as const;
  assert.equal(combinedStatus([]), "unreviewed");
  assert.equal(combinedStatus([low]), "unreviewed");
  assert.equal(combinedStatus([high]), "fix");
  assert.equal(combinedStatus([], { verdict: "ok", issues: [] }), "ok");
  assert.equal(combinedStatus([low], { verdict: "check", issues: [] }), "check");
  assert.equal(
    combinedStatus([], { verdict: "ok", issues: [{ kind: "logic", severity: "medium", lang: "both", where: "2", note: "x" }] }),
    "check",
  );

  const entry = (status: ReviewEntry["status"], hash: string): ReviewEntry => ({
    hash,
    checks: status === "fix" ? [high] : [],
    model: null,
    usd: 0.01,
    status,
    reviewedAt: "",
  });
  const s = summarize({ a: entry("fix", "1"), b: entry("ok", "2"), c: entry("ok", "3") });
  assert.deepEqual(s.flagged, ["a"]);
  assert.equal(s.byStatus.ok, 2);
  assert.equal(s.byCheckKind.tokens, 1);
  assert.equal(s.spotCheck.length, 1);
  assert.equal(s.usd, 0.03);
});
