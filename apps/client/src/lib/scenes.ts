// 場景插畫：故事的 setting（10 種，AI 輸出格式固定）決定基本插圖；
// 有主題的故事再換成更貼切的室內或街景插圖（刷牙 → 浴室、過馬路 → 斑馬線），
// 避免一大半故事都是同一張「家」或「學校」。
import type { StorySetting, ThemeId } from "@aistory/shared";

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

export const sceneSrc = (setting: StorySetting | undefined, theme?: ThemeId) => `/scenes/${sceneName(setting, theme)}.jpg`;

