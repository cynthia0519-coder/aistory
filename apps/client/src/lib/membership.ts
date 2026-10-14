// 付費會員權益。付款還沒串接，上線前把 isMember() 改成讀真正的購買狀態（App Store / Google Play / 金流），
// 再把 ENFORCED 打開；在那之前所有人都能用，方便測試。
export const MEMBER_FEATURES = {
  /** 匯出爸媽的錄音與書櫃（匯入不限會員：換手機後還沒恢復購買，也拿得回自己的錄音） */
  recordingBackup: "錄音備份",
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
