// 插圖與配樂的選擇規則：App（apps/client）播故事、和頻道節目輸出（apps/api/scripts/render-episodes.ts）共用，
// 同一個故事在 App 和頻道上用同一張插圖、同一組音樂。
import { THEMES, type StorySetting, type StoryStyle, type ThemeId } from "./index";

// ---- 場景插畫 ----
// 故事的 setting（10 種，AI 輸出格式固定）決定基本插圖；
// 有主題的故事再換成更貼切的室內或街景插圖（刷牙 → 浴室、過馬路 → 斑馬線），
// 避免一大半故事都是同一張「家」或「學校」。檔案在 apps/client/public/scenes/。

/** 主題插圖；只在故事的 setting 符合時套用（例如「刷牙」發生在動物園就還是用動物園） */
const THEME_SCENES: Partial<Record<ThemeId, Partial<Record<StorySetting, string>>>> = {
  "brushing-teeth": { home: "bathroom" },
  potty: { home: "bathroom" },
  "hot-things": { home: "kitchen" },
  "trying-food": { home: "kitchen" },
  "bedtime-routine": { home: "bedroom" },
  "fear-of-dark": { home: "bedroom" },
  sockets: { home: "living_room" },
  "tidying-toys": { home: "living_room" },
  "screen-time": { home: "living_room" },
  "online-safety": { home: "living_room" },
  "doctor-shots": { home: "clinic", city: "clinic" },
  dentist: { city: "clinic", school: "clinic" },
  medicine: { home: "clinic" },
  "crossing-road": { city: "crosswalk" },
  "getting-lost": { city: "crosswalk" },
  strangers: { city: "crosswalk" },
  "windows-balcony": { home: "balcony", city: "balcony" },
  typhoon: { home: "storm" },
  earthquake: { home: "storm" },
  "water-safety": { forest: "riverside", park: "riverside", city: "riverside" },
  "new-sibling": { home: "nursery" },
  "pet-loss": { home: "garden", park: "garden" },
  "moving-house": { home: "moving", city: "moving" },
};

/** 其他有主題的故事：學校一律用教室、公園一律用遊戲場 */
const THEMED_DEFAULTS: Partial<Record<StorySetting, string>> = {
  school: "classroom",
  park: "playground",
};

export function sceneName(setting: StorySetting | undefined, theme?: ThemeId): string {
  const s = setting ?? "park";
  if (theme) return THEME_SCENES[theme]?.[s] ?? THEMED_DEFAULTS[s] ?? s;
  return s;
}

// ---- 背景音樂 ----
// 檔案在 apps/client/public/music/，檔名是 `${曲組}-${1..n}.mp3`（Mureka 生成，商用授權證書由營運端保存）。

/** 曲組與歌數 */
export const MUSIC_GROUPS = {
  bedtime: 4,
  cute: 3,
  adventure: 3,
  inspiring: 6,
  "theme-tender": 2,
  "theme-careful": 2,
  "theme-routine": 2,
  "theme-calm": 2,
} as const;
export type MusicGroup = keyof typeof MUSIC_GROUPS;

/** 情緒比較重的主題不管分類都用溫柔的那組 */
const TENDER_THEMES: ThemeId[] = ["pet-loss", "fear-of-dark", "new-sibling"];

/** 有主題的故事依主題分類選曲組（身體自主、寵物離別等用溫柔的那組），其他依故事風格 */
export function musicGroup(style: StoryStyle, theme?: ThemeId): MusicGroup {
  if (theme) {
    if (TENDER_THEMES.includes(theme)) return "theme-tender";
    const category = THEMES[theme]?.category;
    if (category === "body") return "theme-tender";
    if (category === "safety") return "theme-careful";
    if (category === "habits") return "theme-routine";
    if (category === "emotions") return "theme-calm";
  }
  return style;
}
