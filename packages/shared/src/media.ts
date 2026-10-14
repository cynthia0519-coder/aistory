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

/** 同一個場景有幾張插圖；第 1 張是原本的檔名，第 2 張起是 `${場景}-2.jpg`。故事依 id 固定分到其中一張 */
export const SCENE_VARIANTS: Record<string, number> = {
  // 第 1–3 張：暖秋色；第 4 張起：春、夏、雨季、冬、銀河等其他色調
  classroom: 4,
  city: 4,
  home: 3,
  living_room: 3,
  sea: 3,
  playground: 3,
  clinic: 3,
  crosswalk: 3,
  mountain: 3,
  night_sky: 4,
  forest: 3,
  zoo: 2,
  bedroom: 3,
  garden: 2,
  riverside: 2,
  snow: 2,
};

/** 故事庫的故事在裝置上的 id 是 `library:${id}:${語言}`；同一則故事不分語言、主角都用同一張圖 */
function seedOf(id: string): string {
  return id.startsWith("library:") ? id.split(":")[1] : id;
}

/** FNV-1a；只要穩定、分布均勻 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** 故事要用的插圖；給 storyId 才會在同一場景的幾張插圖裡分配，不給就用第 1 張 */
export function sceneName(setting: StorySetting | undefined, theme?: ThemeId, storyId?: string): string {
  const s = setting ?? "park";
  const base = theme ? (THEME_SCENES[theme]?.[s] ?? THEMED_DEFAULTS[s] ?? s) : s;
  const count = SCENE_VARIANTS[base] ?? 1;
  if (!storyId || count === 1) return base;
  const n = hash(seedOf(storyId)) % count;
  return n === 0 ? base : `${base}-${n + 1}`;
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
    if (category === "values") return "inspiring";
  }
  // 寓言還沒有專屬配樂，先用勵志那組
  return style === "fable" ? "inspiring" : style;
}
