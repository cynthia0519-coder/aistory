import assert from "node:assert/strict";
import { test } from "node:test";
import { measure, monotonicRatio } from "./checks";

test("中文以漢字計數，標點不算", () => {
  const m = measure({ scene: "", title: "小貓", paragraphs: ["小貓睡覺。", "喵！"] }, "2-4", "zh");
  assert.equal(m.length, 5);
  assert.equal(m.min, 150);
  assert.ok(m.lengthDeviation < 0);
});

test("抓出簡體字與大陸用語，繁體台灣用語不誤報", () => {
  const bad = measure({ scene: "", title: "这是视频", paragraphs: ["我們騎自行車去看視頻。"] }, "4-6", "zh");
  assert.deepEqual(bad.simplifiedChars, ["这"]);
  assert.deepEqual(bad.mainlandTerms.sort(), ["自行車", "視頻"]);

  const ok = measure(
    { scene: "", title: "公園裡的早晨", paragraphs: ["我們騎腳踏車去公園，皇后花開了，鄰里都來看。"] },
    "4-6",
    "zh",
  );
  assert.deepEqual(ok.simplifiedChars, []);
  assert.deepEqual(ok.mainlandTerms, []);
});

test("英文 word 計數與 FK grade：長句長字的分數較高", () => {
  const easy = measure({ scene: "", title: "Cat", paragraphs: ["The cat sat. The cat ran. It was fun."] }, "2-4", "en");
  const hard = measure(
    {
      scene: "",
      title: "Expedition",
      paragraphs: ["The adventurous explorer carefully investigated the mysterious, overgrown botanical garden."],
    },
    "8-10",
    "en",
  );
  assert.equal(easy.length, 9);
  assert.ok((hard.fkGrade ?? 0) > (easy.fkGrade ?? 0));
});

test("英文不安全詞以字首比對，不誤抓字中間的子字串（firefighter、studied）", () => {
  const m = measure({ scene: "", title: "x", paragraphs: ["The firefighter helped. A studied bird."] }, "6-8", "en");
  assert.deepEqual(m.unsafeHits, []);
});

test("monotonicRatio", () => {
  assert.equal(monotonicRatio([1, 2, 3, 4]), 1);
  assert.equal(monotonicRatio([1, 3, 2, 4]), 2 / 3);
});
