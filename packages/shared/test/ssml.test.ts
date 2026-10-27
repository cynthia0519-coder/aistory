// SSML 組字與跳脫的測試：node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSsml, escapeXml, voiceLocale } from "../src/ssml.ts";
import { DEFAULT_VOICE, TTS_VOICES, TtsRequestSchema } from "../src/index.ts";

test("escapeXml escapes all five XML special characters", () => {
  assert.equal(escapeXml(`a & b < c > d "e" 'f'`), "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;");
  assert.equal(escapeXml("&amp;"), "&amp;amp;"); // 已跳脫的也再跳脫一次，原文照念
  assert.equal(escapeXml("小寶說：「晚安。」"), "小寶說：「晚安。」");
});

test("buildSsml sets xml:lang from the voice and slows the rate", () => {
  const ssml = buildSsml("晚安，小寶。", "zh-TW-HsiaoChenNeural");
  assert.equal(
    ssml,
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW">' +
      '<voice name="zh-TW-HsiaoChenNeural"><prosody rate="-8%">晚安，小寶。</prosody></voice></speak>',
  );
  assert.match(buildSsml("Hi", "en-US-AnaNeural"), /xml:lang="en-US"/);
});

test("buildSsml escapes injected markup in the text", () => {
  const ssml = buildSsml(`Tom</prosody><break time="10s"/> & "Ann"`, "en-US-AnaNeural");
  assert.ok(!ssml.includes("<break"));
  assert.ok(ssml.includes("Tom&lt;/prosody&gt;&lt;break time=&quot;10s&quot;/&gt; &amp; &quot;Ann&quot;"));
  // 結構完整：只有一組 speak / voice / prosody
  assert.equal(ssml.match(/<prosody /g)?.length, 1);
  assert.equal(ssml.match(/<\/prosody>/g)?.length, 1);
});

test("voiceLocale rejects malformed names", () => {
  assert.equal(voiceLocale("en-US-JennyNeural"), "en-US");
  assert.throws(() => voiceLocale("bogus"));
});

test("default voices belong to their language list", () => {
  assert.ok((TTS_VOICES.zh as readonly string[]).includes(DEFAULT_VOICE.zh));
  assert.ok((TTS_VOICES.en as readonly string[]).includes(DEFAULT_VOICE.en));
  for (const v of [...TTS_VOICES.zh, ...TTS_VOICES.en]) assert.match(v, /^[a-z]{2}-[A-Z]{2}-\w+Neural$/);
});

test("TtsRequestSchema validates text length and voice", () => {
  assert.ok(TtsRequestSchema.safeParse({ text: "hi", language: "en" }).success);
  assert.ok(TtsRequestSchema.safeParse({ text: "hi", language: "en", voice: "en-US-JennyNeural" }).success);
  assert.ok(!TtsRequestSchema.safeParse({ text: "", language: "en" }).success);
  assert.ok(!TtsRequestSchema.safeParse({ text: "x".repeat(1201), language: "zh" }).success);
  assert.ok(!TtsRequestSchema.safeParse({ text: "hi", language: "fr" }).success);
  assert.ok(!TtsRequestSchema.safeParse({ text: "hi", language: "en", voice: "en-US-Evil" }).success);
  assert.ok(!TtsRequestSchema.safeParse({ text: "hi", language: "en", voice: "zh-TW-HsiaoYuNeural" }).success);
});
