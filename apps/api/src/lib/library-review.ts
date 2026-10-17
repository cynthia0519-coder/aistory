// 故事庫 AI 預審：不花 token 的規則檢查（純函式，有單元測試）。
// LLM 評審在 library-critic.ts；腳本是 scripts/review-library.ts。
// 人工審稿只看被標記的故事，加上少量抽查（spotCheck）。
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  AGE_BANDS,
  invalidLibraryTokens,
  LENGTH_RULES,
  renderLibraryStory,
  storyLength,
  THEMES,
  type AgeBand,
  type LibraryStory,
  type ThemeCategory,
} from "@aistory/shared";

/** 規則或提示詞改了就加一，讓所有故事重新審（內容雜湊會跟著變） */
export const REVIEW_VERSION = 1;

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];
export type ReviewLang = "zh" | "en" | "both";

// ---- 規則檢查 ----

export const CHECK_KINDS = [
  "length",
  "paragraph_mismatch",
  "tokens",
  "guide_missing",
  "zh_half_width_punct",
  "phone_number",
  "hero_gender",
  "duplicate_title",
  "sensitive_pattern",
] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export interface ReviewCheck {
  kind: CheckKind;
  severity: Severity;
  lang: ReviewLang;
  /** 段落索引（從 0 開始）、"title"、"guide" 或 "story" */
  where: string;
  note: string;
}

/** 故事庫一律 3 分鐘，長度以 ageBands 裡最小的年齡層為準（與 library-engine 一致） */
export function youngestBand(ageBands: readonly AgeBand[]): AgeBand {
  return [...ageBands].sort((a, b) => AGE_BANDS.indexOf(a) - AGE_BANDS.indexOf(b))[0];
}

/** 用預設名字代換後量長度，範圍是 LENGTH_RULES["3min"][最小年齡層]（中文只算漢字） */
export function checkLength(story: LibraryStory): ReviewCheck[] {
  const band = youngestBand(story.ageBands);
  const out: ReviewCheck[] = [];
  for (const lang of ["zh", "en"] as const) {
    const n = storyLength(renderLibraryStory(story, lang).paragraphs, lang);
    const [min, max] = LENGTH_RULES["3min"].words[band][lang];
    if (n >= min && n <= max) continue;
    // 差超過兩成才算 medium；空殼或一半以下是 high
    const off = n < min ? (min - n) / min : (n - max) / max;
    const severity: Severity = n < min / 2 ? "high" : off > 0.2 ? "medium" : "low";
    const unit = lang === "zh" ? "字" : "words";
    out.push({
      kind: "length",
      severity,
      lang,
      where: "story",
      note: `${lang === "zh" ? "中文" : "英文"} ${n} ${unit}，${band} 歲 3 分鐘範圍是 ${min}–${max}（${n < min ? "太短" : "太長"}）`,
    });
  }
  return out;
}

/** 中英文段落數一致 */
export function checkParagraphs(story: LibraryStory): ReviewCheck[] {
  const zh = story.paragraphs.zh.length;
  const en = story.paragraphs.en.length;
  if (zh === en) return [];
  return [
    {
      kind: "paragraph_mismatch",
      severity: "high",
      lang: "both",
      where: "story",
      note: `中文 ${zh} 段、英文 ${en} 段，段落數必須一致`,
    },
  ];
}

interface TextField {
  lang: "zh" | "en";
  where: string;
  text: string;
}

/** 故事所有要檢查的文字欄位：標題、每段、引導卡 */
export function textFields(story: LibraryStory, opts: { guide?: boolean } = {}): TextField[] {
  const fields: TextField[] = [];
  for (const lang of ["zh", "en"] as const) {
    fields.push({ lang, where: "title", text: story.title[lang] });
    story.paragraphs[lang].forEach((text, i) => fields.push({ lang, where: String(i), text }));
    const g = story.guide?.[lang];
    if (g && opts.guide !== false) {
      for (const text of [...g.questions, g.tip]) fields.push({ lang, where: "guide", text });
    }
  }
  return fields;
}

/**
 * 代換標記規則：只能用 {name} {he} {him} {his}；中文 {his} 已含「的」；
 * 英文 {his} 只能放在名詞前；不能有落單的大括號；故事裡至少要出現一次 {name}。
 */
export function checkTokens(story: LibraryStory): ReviewCheck[] {
  const out: ReviewCheck[] = [];
  const add = (lang: "zh" | "en", where: string, note: string, severity: Severity = "high") =>
    out.push({ kind: "tokens", severity, lang, where, note });
  for (const f of textFields(story)) {
    const bad = invalidLibraryTokens(f.text);
    if (bad.length) add(f.lang, f.where, `不允許的標記：${bad.join(" ")}`);
    const stripped = f.text.replace(/\{(name|he|him|his)\}/g, "");
    if (/[{}]/.test(stripped) && !bad.length) add(f.lang, f.where, "有落單的大括號");
    if (f.lang === "zh" && f.text.includes("{his}的")) add(f.lang, f.where, "「{his}的」重複了「的」，應寫「{his}○○」");
    if (f.lang === "en" && /\{his\}(?=\s*(?:[.,!?;:"”’)]|$))/.test(f.text)) {
      add(f.lang, f.where, "{his} 後面沒有名詞（英文 {his} 只能放在名詞前）");
    }
    // 反身代名詞只在同一句有主角標記時才算（其他角色可以用 himself/herself）
    if (f.lang === "en" && f.text.split(/(?<=[.!?])\s+/).some((x) => /\{(name|he|him|his)\}/.test(x) && /\b(himself|herself)\b/i.test(x))) {
      add(f.lang, f.where, "主角那句用了 himself/herself，主角不能用反身代名詞", "medium");
    }
  }
  for (const lang of ["zh", "en"] as const) {
    if (!story.paragraphs[lang].some((p) => p.includes("{name}"))) {
      add(lang, "story", `${lang === "zh" ? "中文" : "英文"}故事沒有出現 {name}`, "medium");
    }
  }
  return out;
}

/** 有主題就要有引導卡；沒主題卻有引導卡也標記（App 不會顯示） */
export function checkGuide(story: LibraryStory): ReviewCheck[] {
  if (story.theme && !story.guide) {
    return [{ kind: "guide_missing", severity: "high", lang: "both", where: "guide", note: "主題故事缺少引導卡" }];
  }
  // 沒有主題的故事也要有卡（npm run library:guides 補），只是不教道理、問感受與想像
  if (!story.theme && !story.guide) {
    return [{ kind: "guide_missing", severity: "low", lang: "both", where: "guide", note: "缺少引導卡（npm run library:guides 補）" }];
  }
  return [];
}

// 中文旁邊的半形標點。代換標記（{name} 等）在中文裡也算中文字。
const CJK = String.raw`(?:\p{Script=Han}|[，。、！？：；「」『』（）…—～]|\{(?:name|he|him|his)\})`;
const HALF_WIDTH_NEAR_CJK = new RegExp(String.raw`${CJK}[,?!:;]|[,?!:;]${CJK}`, "gu");

/** 中文文字（標題、段落、引導卡）裡緊鄰中文的半形 , ? ! : ; */
export function checkZhPunctuation(story: LibraryStory): ReviewCheck[] {
  const out: ReviewCheck[] = [];
  for (const f of textFields(story)) {
    if (f.lang !== "zh") continue;
    const hits = f.text.match(HALF_WIDTH_NEAR_CJK);
    if (!hits) continue;
    const marks = [...new Set(hits.map((h) => h.replace(new RegExp(CJK, "gu"), "")))];
    out.push({
      kind: "zh_half_width_punct",
      severity: "low",
      lang: "zh",
      where: f.where,
      note: `中文裡有半形標點 ${marks.join(" ")}（${hits.slice(0, 3).join("、")}），改成全形`,
    });
  }
  return out;
}

/** 台灣常見的專線與緊急電話（3–4 碼） */
export const KNOWN_HOTLINES = ["110", "112", "113", "119", "165", "1919", "1925", "1955", "1957", "1966", "1980", "1995", "1999"];

// 3 位以上的數字，可夾空白或 -（全形數字也算）；中文數字只抓已知專線的唸法。
const DIGIT_RUN = /[0-9０-９](?:[\s\-－]?[0-9０-９]){2,}/g;
const ZH_HOTLINE = /[一幺][一幺][三零〇九二]/g;

function toAsciiDigits(s: string): string {
  return s.replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10)).replace(/[^0-9]/g, "");
}

/**
 * 故事或引導卡裡像電話、專線的數字。App 會自己在身體自主的引導卡加上 113，
 * 所以文字裡出現任何專線或電話都要拿掉。
 */
export function checkPhoneNumbers(story: LibraryStory): ReviewCheck[] {
  const out: ReviewCheck[] = [];
  for (const f of textFields(story)) {
    const found = new Set<string>();
    for (const m of f.text.match(DIGIT_RUN) ?? []) found.add(toAsciiDigits(m));
    for (const m of f.text.match(ZH_HOTLINE) ?? []) found.add(m);
    for (const n of found) {
      const known = KNOWN_HOTLINES.includes(n) || /^[一幺][一幺][三零〇九]$/.test(n) || n.startsWith("0800");
      const phoneLike = /^\d{7,}$/.test(n);
      out.push({
        kind: "phone_number",
        severity: known || phoneLike ? "high" : "medium",
        lang: f.lang,
        where: f.where,
        note: known
          ? `出現專線號碼 ${n}；App 會自己加 113，故事與引導卡不寫號碼`
          : phoneLike
            ? `出現像電話的號碼 ${n}，請拿掉`
            : `出現數字 ${n}，確認不是電話或專線`,
      });
    }
  }
  return out;
}

/** 單篇故事的規則檢查（不含跨故事的重複標題、敏感情節） */
/**
 * 主角不指定性別（{he} 會依設定換成他／她或名字），所以主角所在的句子不能出現「她們」：
 * 例如「媽媽和{name}……她們」會把主角寫成女生。LLM 評審只抓得到一部分，這裡用規則補。
 */
export function checkHeroGender(story: LibraryStory): ReviewCheck[] {
  const out: ReviewCheck[] = [];
  for (const f of textFields(story)) {
    if (f.lang !== "zh") continue;
    for (const sentence of f.text.split(/(?<=[。！？])/)) {
      if (!sentence.includes("她們")) continue;
      if (/\{(?:name|he|him|his)\}/.test(sentence)) {
        out.push({
          kind: "hero_gender",
          severity: "medium",
          lang: "zh",
          where: f.where,
          note: `「${sentence.trim().slice(0, 40)}」：主角和「她們」在同一句，可能把主角寫成女生；包含主角時用「他們」或改寫`,
        });
      } else if (f.where === "guide") {
        // 引導卡常寫「媽媽……她們一起做了什麼」，主角在前一句，同一句沒有標記也會漏抓
        out.push({
          kind: "hero_gender",
          severity: "medium",
          lang: "zh",
          where: f.where,
          note: `「${sentence.trim().slice(0, 40)}」：引導卡的「她們」常把主角算進去；確認不包含主角，否則用「他們」或寫出「媽媽和{name}」`,
        });
      }
    }
  }
  return out;
}

export function checkStory(story: LibraryStory): ReviewCheck[] {
  return [
    ...checkParagraphs(story),
    ...checkLength(story),
    ...checkTokens(story),
    ...checkGuide(story),
    ...checkZhPunctuation(story),
    ...checkPhoneNumbers(story),
    ...checkHeroGender(story),
  ];
}

// ---- 跨故事檢查 ----

/** 標題正規化：去掉標記、標點、空白與英文冠詞，轉小寫 */
export function normalizeTitle(title: string, lang: "zh" | "en"): string {
  let t = title.replace(/\{(?:name|he|him|his)\}(?:'s)?/g, " ").toLowerCase();
  if (lang === "zh") t = t.replace(/^[\s的和與跟]+/, "");
  else t = t.replace(/\b(the|a|an|and|of|to|in|on|at|with)\b/g, " ");
  return t.replace(/[^\p{L}\p{N}]+/gu, "");
}

function bigrams(s: string): string[] {
  const chars = [...s];
  if (chars.length < 2) return chars;
  return chars.slice(1).map((c, i) => chars[i] + c);
}

/** 字元二元組的 Dice 係數，0–1 */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  const pool = new Map<string, number>();
  for (const x of B) pool.set(x, (pool.get(x) ?? 0) + 1);
  let shared = 0;
  for (const x of A) {
    const n = pool.get(x) ?? 0;
    if (n > 0) {
      shared++;
      pool.set(x, n - 1);
    }
  }
  return (2 * shared) / (A.length + B.length);
}

export const NEAR_DUPLICATE_TITLE = 0.7;

/** 完全相同或很像的標題（中英文分開比） */
export function checkDuplicateTitles(stories: readonly LibraryStory[]): Map<string, ReviewCheck[]> {
  const out = new Map<string, ReviewCheck[]>();
  const add = (id: string, c: ReviewCheck) => out.set(id, [...(out.get(id) ?? []), c]);
  for (const lang of ["zh", "en"] as const) {
    const norm = stories.map((s) => normalizeTitle(s.title[lang], lang));
    for (let i = 0; i < stories.length; i++) {
      for (let j = i + 1; j < stories.length; j++) {
        const sim = titleSimilarity(norm[i], norm[j]);
        if (sim < NEAR_DUPLICATE_TITLE) continue;
        const exact = norm[i] === norm[j];
        for (const [me, other] of [
          [i, j],
          [j, i],
        ] as const) {
          add(stories[me].id, {
            kind: "duplicate_title",
            severity: exact ? "medium" : "low",
            lang,
            where: "title",
            note: `${exact ? "標題與" : "標題很像"} ${stories[other].id}「${stories[other].title[lang]}」${exact ? "相同" : `（相似度 ${sim.toFixed(2)}）`}`,
          });
        }
      }
    }
  }
  return out;
}

// 「心裡癢癢的」「鼻子好癢」不算搔癢情節，所以不抓單獨的「癢」；「搔頭」也不算
const TICKLE = /tickl|搔(?!頭)|呵癢|撓癢/i;
const SECRET = /secret|祕密|秘密/i;

/** 故事全文（中英文、含引導卡）有沒有「搔癢＋祕密」這組情節元素 */
export function hasTickleSecret(story: LibraryStory): { tickle: boolean; secret: boolean } {
  const text = textFields(story).map((f) => f.text).join("\n");
  return { tickle: TICKLE.test(text), secret: SECRET.test(text) };
}

/**
 * 敏感主題：同一類（例如身體自主）裡「搔癢＋祕密」的情節一再出現就標記，避免故事庫千篇一律。
 * 搔癢情節單獨出現 3 篇以上也提醒（低）。
 */
export function checkSensitivePatterns(stories: readonly LibraryStory[]): Map<string, ReviewCheck[]> {
  const out = new Map<string, ReviewCheck[]>();
  const byCategory = new Map<ThemeCategory, LibraryStory[]>();
  for (const s of stories) {
    if (!s.theme || !THEMES[s.theme].sensitive) continue;
    const c = THEMES[s.theme].category;
    byCategory.set(c, [...(byCategory.get(c) ?? []), s]);
  }
  for (const [category, group] of byCategory) {
    const flags = group.map((s) => ({ s, ...hasTickleSecret(s) }));
    const both = flags.filter((f) => f.tickle && f.secret);
    if (both.length >= 2) {
      for (const f of both) {
        const others = both.filter((o) => o !== f).map((o) => o.s.id);
        out.set(f.s.id, [
          ...(out.get(f.s.id) ?? []),
          {
            kind: "sensitive_pattern",
            severity: "medium",
            lang: "both",
            where: "story",
            note: `「搔癢＋祕密」情節在 ${category} 類重複出現（另見 ${others.join(", ")}），考慮換情境`,
          },
        ]);
      }
    }
    const tickleOnly = flags.filter((f) => f.tickle && !f.secret);
    if (tickleOnly.length + both.length >= 3) {
      for (const f of tickleOnly) {
        out.set(f.s.id, [
          ...(out.get(f.s.id) ?? []),
          {
            kind: "sensitive_pattern",
            severity: "low",
            lang: "both",
            where: "story",
            note: `${category} 類已有 ${tickleOnly.length + both.length} 篇提到搔癢，確認這篇需要`,
          },
        ]);
      }
    }
  }
  return out;
}

/** 整個故事庫的規則檢查，依故事 id 回傳 */
export function runDeterministicChecks(stories: readonly LibraryStory[]): Map<string, ReviewCheck[]> {
  const dup = checkDuplicateTitles(stories);
  const sens = checkSensitivePatterns(stories);
  return new Map(stories.map((s) => [s.id, [...checkStory(s), ...(dup.get(s.id) ?? []), ...(sens.get(s.id) ?? [])]]));
}

// ---- LLM 評審的輸出格式 ----

export const CRITIC_ISSUE_KINDS = [
  "safety",
  "guardrail",
  "logic",
  "preachy",
  "age_fit",
  "zh_en_mismatch",
  "taiwan_usage",
  "repetition",
  "quality",
  "length",
] as const;
export type CriticIssueKind = (typeof CRITIC_ISSUE_KINDS)[number];

export const VERDICTS = ["ok", "check", "fix"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CriticOutputSchema = z.object({
  verdict: z.enum(VERDICTS),
  issues: z.array(
    z.object({
      kind: z.enum(CRITIC_ISSUE_KINDS),
      severity: z.enum(SEVERITIES),
      lang: z.enum(["zh", "en", "both"]),
      /** 段落索引（從 0 開始）、"guide" 或 "title" */
      where: z.string(),
      /** 繁體中文，簡短具體 */
      note: z.string(),
    }),
  ),
});
export type CriticOutput = z.infer<typeof CriticOutputSchema>;

// ---- 結果檔 ----

export interface ReviewEntry {
  /** reviewContentHash；沒變就不重審 LLM */
  hash: string;
  checks: ReviewCheck[];
  llm?: CriticOutput;
  /** 這次 LLM 評審用的模型；沒跑 LLM 時是 null */
  model: string | null;
  usd: number;
  /** 合併規則檢查與 LLM 結果後的狀態；unreviewed = 還沒跑 LLM 且規則檢查沒問題 */
  status: Verdict | "unreviewed";
  reviewedAt: string;
}

/** 影響審稿結果的欄位 + REVIEW_VERSION 的雜湊 */
export function reviewContentHash(story: LibraryStory): string {
  const { title, paragraphs, guide, theme, ageBands, style, setting } = story;
  const payload = JSON.stringify({ v: REVIEW_VERSION, title, paragraphs, guide, theme, ageBands, style, setting });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

/** 規則檢查 high → fix，medium → check；LLM 結果取較嚴重的一方 */
export function combinedStatus(checks: readonly ReviewCheck[], llm?: CriticOutput): ReviewEntry["status"] {
  const worst = Math.max(-1, ...checks.map((c) => RANK[c.severity]), ...(llm?.issues ?? []).map((i) => RANK[i.severity]));
  const fromSeverity: Verdict | null = worst >= 2 ? "fix" : worst === 1 ? "check" : null;
  const order: Verdict[] = ["ok", "check", "fix"];
  if (!llm) return fromSeverity ?? "unreviewed";
  const a = order.indexOf(llm.verdict);
  const b = fromSeverity ? order.indexOf(fromSeverity) : 0;
  return order[Math.max(a, b)];
}

/** 抽查比例：沒被標記的故事裡挑這麼多給人看，確認 AI 沒漏 */
export const SPOT_CHECK_RATE = 0.15;

export interface ReviewSummary {
  stories: number;
  byStatus: Record<string, number>;
  byCheckKind: Record<string, number>;
  byIssueKind: Record<string, number>;
  /** 要人工看的：status 是 check 或 fix */
  flagged: string[];
  /** 沒被標記、依雜湊穩定挑出的抽查名單 */
  spotCheck: string[];
  usd: number;
}

export function summarize(entries: Record<string, ReviewEntry>): ReviewSummary {
  const byStatus: Record<string, number> = {};
  const byCheckKind: Record<string, number> = {};
  const byIssueKind: Record<string, number> = {};
  let usd = 0;
  const ids = Object.keys(entries).sort();
  for (const id of ids) {
    const e = entries[id];
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    for (const c of e.checks) byCheckKind[c.kind] = (byCheckKind[c.kind] ?? 0) + 1;
    for (const i of e.llm?.issues ?? []) byIssueKind[i.kind] = (byIssueKind[i.kind] ?? 0) + 1;
    usd += e.usd;
  }
  const flagged = ids.filter((id) => entries[id].status === "check" || entries[id].status === "fix");
  const rest = ids.filter((id) => !flagged.includes(id)).sort((a, b) => entries[a].hash.localeCompare(entries[b].hash));
  const spotCheck = rest.slice(0, Math.ceil(rest.length * SPOT_CHECK_RATE)).sort();
  return { stories: ids.length, byStatus, byCheckKind, byIssueKind, flagged, spotCheck, usd: Number(usd.toFixed(4)) };
}

// ---- 成本 ----

/** 每百萬 token 美元價；與 generate-library 用同一組環境變數覆蓋 */
export const PRICE = {
  input: Number(process.env.LIBRARY_PRICE_INPUT ?? 4),
  output: Number(process.env.LIBRARY_PRICE_OUTPUT ?? 20),
  cacheWrite: Number(process.env.LIBRARY_PRICE_CACHE_WRITE ?? 5),
  cacheRead: Number(process.env.LIBRARY_PRICE_CACHE_READ ?? 0.2),
};

export function usageCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): number {
  return (
    (usage.input_tokens * PRICE.input +
      usage.output_tokens * PRICE.output +
      (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead) /
    1_000_000
  );
}

/** 粗估 token 數（乾跑估成本用）：中文約一字一 token，其他約四字元一 token */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\p{Script=Han}　-〿＀-￯]/gu) ?? []).length;
  return Math.ceil(cjk + (text.length - cjk) / 4);
}
