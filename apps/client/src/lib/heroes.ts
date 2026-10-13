// 故事主角：只存在裝置的 IndexedDB，不上雲端。送給 API 的只有小名、年齡、性別、喜歡的東西
import type { Hero } from "@aistory/shared";
import { db, HERO_STORE } from "./storage";

export const HERO_COLORS = ["teal", "rust", "ochre", "sage"] as const;
export type HeroColor = (typeof HERO_COLORS)[number];

/** 頭像底色（Tailwind class 要寫完整字串，build 才掃得到） */
export const HERO_COLOR_CLASS: Record<HeroColor, string> = {
  teal: "bg-teal text-paper",
  rust: "bg-rust text-card",
  ochre: "bg-ochre text-ink",
  sage: "bg-sage text-ink",
};

export interface HeroProfile extends Hero {
  id: string;
  color: HeroColor;
  createdAt: number;
}

export async function listHeroes(): Promise<HeroProfile[]> {
  return (await db()).getAllFromIndex(HERO_STORE, "createdAt");
}

export async function saveHero(hero: HeroProfile) {
  await (await db()).put(HERO_STORE, hero);
}

export async function deleteHero(id: string) {
  await (await db()).delete(HERO_STORE, id);
  if (getSelectedHeroId() === id) setSelectedHeroId(null);
}

/** 只取送給 API 的欄位，不帶 id/顏色等裝置上的資料 */
export function toHero(p: HeroProfile): Hero {
  const hero: Hero = { name: p.name, age: p.age, gender: p.gender };
  if (p.likes) hero.likes = p.likes;
  return hero;
}

// ---- 目前選的主角：localStorage（私密模式可能丟例外，一律包 try/catch）----
const SELECTED_KEY = "aistory.selectedHeroId";

export function getSelectedHeroId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function setSelectedHeroId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // 存不了就算了，下次重選
  }
}

/** 取得目前選的主角；選的被刪掉了就回傳 null */
export async function getSelectedHero(): Promise<HeroProfile | null> {
  const id = getSelectedHeroId();
  if (!id) return null;
  return ((await (await db()).get(HERO_STORE, id)) as HeroProfile | undefined) ?? null;
}

export const GENDER_LABELS = { boy: "男孩", girl: "女孩", unspecified: "不指定" } as const;

export function heroSummary(h: Hero) {
  return [`${h.age} 歲`, h.gender === "unspecified" ? null : GENDER_LABELS[h.gender]].filter(Boolean).join(" · ");
}
