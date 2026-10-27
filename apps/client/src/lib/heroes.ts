// 故事主角：只存在裝置的 IndexedDB，不上雲端。送給 API 的只有小名、年齡、性別、喜歡的東西
import type { Hero } from "@aistory/shared";
import { db, HERO_STORE } from "./storage";

export const HERO_COLORS = ["teal", "rust", "ochre", "sage"] as const;
export type HeroColor = (typeof HERO_COLORS)[number];

// ---- 主角外觀：只存在裝置上、只用來畫卡通頭像，不送給 API ----
export const HAIR_STYLES = ["short", "bob", "ponytail", "braids", "curly"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HAIR_COLORS = ["dark", "brown", "auburn"] as const;
export type HairColor = (typeof HAIR_COLORS)[number];
export const SKIN_TONES = ["light", "medium", "deep"] as const;
export type SkinTone = (typeof SKIN_TONES)[number];
export const OUTFITS = ["overalls", "dress", "raincoat", "sweater"] as const;
export type Outfit = (typeof OUTFITS)[number];

export interface HeroLook {
  hair: HairStyle;
  hairColor: HairColor;
  skin: SkinTone;
  outfit: Outfit;
  glasses: boolean;
}

export const DEFAULT_LOOK: HeroLook = {
  hair: "short",
  hairColor: "dark",
  skin: "light",
  outfit: "overalls",
  glasses: false,
};

export const HAIR_LABELS: Record<HairStyle, string> = {
  short: "短髮",
  bob: "妹妹頭",
  ponytail: "馬尾",
  braids: "辮子",
  curly: "捲髮",
};
export const HAIR_COLOR_LABELS: Record<HairColor, string> = { dark: "深棕", brown: "栗色", auburn: "紅棕" };
export const SKIN_LABELS: Record<SkinTone, string> = { light: "淺膚色", medium: "小麥膚色", deep: "深膚色" };
export const OUTFIT_LABELS: Record<Outfit, string> = {
  overalls: "吊帶褲",
  dress: "洋裝",
  raincoat: "雨衣",
  sweater: "毛衣",
};

/** 舊資料沒有外觀（或缺欄位、值不認得）時補上預設值 */
export function lookOf(h: { look?: Partial<HeroLook> } | null | undefined): HeroLook {
  const l = h?.look ?? {};
  return {
    hair: HAIR_STYLES.includes(l.hair as HairStyle) ? (l.hair as HairStyle) : DEFAULT_LOOK.hair,
    hairColor: HAIR_COLORS.includes(l.hairColor as HairColor) ? (l.hairColor as HairColor) : DEFAULT_LOOK.hairColor,
    skin: SKIN_TONES.includes(l.skin as SkinTone) ? (l.skin as SkinTone) : DEFAULT_LOOK.skin,
    outfit: OUTFITS.includes(l.outfit as Outfit) ? (l.outfit as Outfit) : DEFAULT_LOOK.outfit,
    glasses: typeof l.glasses === "boolean" ? l.glasses : DEFAULT_LOOK.glasses,
  };
}

export interface HeroProfile extends Hero {
  id: string;
  color: HeroColor;
  createdAt: number;
  /** 舊版存的主角沒有外觀，用 lookOf() 補預設 */
  look?: HeroLook;
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

/** 只取送給 API 的欄位，不帶 id/顏色/外觀等裝置上的資料 */
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
