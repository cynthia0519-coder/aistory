// 故事庫：隨 App 打包的故事（public/library/stories.json）；只顯示人工審過的（draft: false）。
// 在裝置上換成主角的名字與代名詞，不呼叫 API、不花 token。
// 網頁版由 service worker（public/sw.js）快取，第一次載入後離線也能讀；App 版檔案本來就在裝置上。
// 故事庫的故事只在閱讀時臨時組成 SavedStory，不寫進 IndexedDB。
import {
  ageBandFor,
  ageRangeLabel,
  LibraryStorySchema,
  renderLibraryStory,
  THEME_CATEGORIES,
  THEME_CATEGORY_IDS,
  THEMES,
  type AgeBand,
  type Language,
  type LibraryStory,
  type ThemeCategory,
} from "@aistory/shared";
import { lookOf, type HeroProfile } from "./heroes";
import type { SavedStory } from "./storage";

/** 書櫃頁的分頁與故事庫篩選；放在頁面層，讀完故事回來還是同一個篩選 */
export interface LibraryPrefs {
  tab: "mine" | "library";
  language: Language;
  /** null = 跟著主角的年齡層（沒主角就是全部） */
  age: AgeBand | "all" | null;
  /** 主題分類；沒有主題的故事只出現在「全部」 */
  category: ThemeCategory | "all";
}

/** 分類 chip 的文字（比 THEME_CATEGORIES 的全名短，一排放得下） */
export const CATEGORY_CHIPS: { id: ThemeCategory | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  ...THEME_CATEGORY_IDS.map((id) => ({ id, label: id === "emotions" ? "情緒" : THEME_CATEGORIES[id].zh })),
];

/** 目前篩選下的故事庫故事 */
export function filterLibrary(
  stories: LibraryStory[],
  age: AgeBand | "all",
  category: ThemeCategory | "all" = "all",
): LibraryStory[] {
  return stories.filter(
    (s) =>
      (age === "all" || s.ageBands.includes(age)) &&
      (category === "all" || (s.theme !== undefined && THEMES[s.theme].category === category)),
  );
}

const LIBRARY_URL = "/library/stories.json";

// 草稿（draft: true）還沒人工審過，一般使用者看不到。
// 審稿時在網址加 ?drafts=1 打開審稿模式（記在這台裝置上），?drafts=0 關掉。
const DRAFTS_KEY = "aistory.showDrafts";

/** 這台裝置是不是在審稿模式；只能在瀏覽器裡呼叫 */
export function draftMode(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("drafts");
    if (q === "1") localStorage.setItem(DRAFTS_KEY, "1");
    if (q === "0") localStorage.removeItem(DRAFTS_KEY);
    return localStorage.getItem(DRAFTS_KEY) === "1";
  } catch {
    return false;
  }
}

/** 給使用者看的故事：審稿模式全部，否則只有審過的 */
export function visibleLibrary(stories: LibraryStory[], showDrafts: boolean): LibraryStory[] {
  return showDrafts ? stories : stories.filter((s) => !s.draft);
}

let cache: Promise<LibraryStory[]> | null = null;

/** 讀取並驗證故事庫；不合格的條目丟掉並在 console 警告，不讓整個故事庫壞掉 */
export function loadLibrary(): Promise<LibraryStory[]> {
  cache ??= fetch(LIBRARY_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error("stories.json must be an array");
      const stories: LibraryStory[] = [];
      data.forEach((entry, i) => {
        const parsed = LibraryStorySchema.safeParse(entry);
        if (parsed.success) stories.push(parsed.data);
        else console.warn(`故事庫第 ${i} 筆格式不對，已略過`, (entry as { id?: unknown })?.id, parsed.error.issues);
      });
      return stories;
    })
    .catch((e) => {
      cache = null; // 下次再試
      throw e;
    });
  return cache;
}

/** 依目前主角換好名字的標題與段落 */
export function renderForHero(story: LibraryStory, language: Language, hero: HeroProfile | null) {
  return renderLibraryStory(story, language, hero ? { name: hero.name, gender: hero.gender } : undefined);
}

/** 組成閱讀頁用的臨時故事物件（不存檔） */
export function toReadableStory(story: LibraryStory, language: Language, hero: HeroProfile | null): SavedStory {
  const { title, paragraphs, guide } = renderForHero(story, language, hero);
  const heroBand = hero ? ageBandFor(hero.age) : null;
  const ageBand: AgeBand = heroBand && story.ageBands.includes(heroBand) ? heroBand : story.ageBands[0];
  return {
    id: `library:${story.id}:${language}`,
    createdAt: 0,
    language,
    ageBand,
    setting: story.setting,
    style: story.style,
    length: "3min",
    scene: "",
    title,
    paragraphs,
    theme: story.theme,
    guide,
    heroLook: hero ? lookOf(hero) : undefined,
  };
}

/** 卡片上的年齡範圍，例如 ["2-4","4-6"] → "2–6 歲" */
export { ageRangeLabel };
