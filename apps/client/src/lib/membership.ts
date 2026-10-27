// 付費會員權益。付款還沒串接，上線前把 isMember() 改成讀真正的購買狀態（App Store / Google Play / 金流），
// 再把 ENFORCED 打開；在那之前所有人都能用，方便測試。
import { FREE_PHOTO_STORIES_PER_MONTH } from "./pricing";

export const MEMBER_FEATURES = {
  /** 匯出爸媽的錄音與書櫃（匯入不限會員：換手機後還沒恢復購買，也拿得回自己的錄音） */
  recordingBackup: "錄音備份",
  longStory: "10 分鐘故事",
  /** 連載第 2 集以後；第 1 集就是一般的照片故事 */
  series: "連載故事",
} as const;
export type MemberFeature = keyof typeof MEMBER_FEATURES;

const ENFORCED = false;

function isMember(): boolean {
  return false;
}

export function canUse(feature: MemberFeature): boolean {
  void feature;
  return !ENFORCED || isMember();
}

// 免費版每月照片故事額度。沒有帳號，只能記在這台裝置：刪 App 重裝就歸零，
// 上線時要改成伺服器端依購買憑證／裝置識別計數，這裡只是先把規則定下來
const QUOTA_KEY = "aistory.photoStories";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function usedThisMonth(): number {
  try {
    const saved = JSON.parse(localStorage.getItem(QUOTA_KEY) ?? "null") as { month: string; count: number } | null;
    return saved?.month === thisMonth() ? saved.count : 0;
  } catch {
    return 0;
  }
}

/** 這個月還能編幾篇照片故事；null = 不限（會員或還沒開始收費） */
export function photoStoriesLeft(): number | null {
  if (!ENFORCED || isMember()) return null;
  return Math.max(0, FREE_PHOTO_STORIES_PER_MONTH - usedThisMonth());
}

/** 編好一篇照片故事後呼叫；沒開始收費也照記，方便封測看用量 */
export function recordPhotoStory(): void {
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ month: thisMonth(), count: usedThisMonth() + 1 }));
  } catch {
    // 私密模式等存不了就算了，不擋使用者
  }
}
