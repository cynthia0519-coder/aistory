// 場景插畫：選圖規則在 @aistory/shared/media（App 與頻道節目共用），這裡只組出網址。
import type { StorySetting, ThemeId } from "@aistory/shared";
import { sceneName } from "@aistory/shared/media";

export { sceneName };

export const sceneSrc = (setting: StorySetting | undefined, theme?: ThemeId) => `/scenes/${sceneName(setting, theme)}.jpg`;
