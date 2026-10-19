// 購買方案：免費＋月訂＋年訂三種，其他方案（半年、故事包、單買）2026-10 拿掉，避免選擇障礙。
// 價格是暫定，封測數據出來再調；接上 App Store / Google Play 前要確認商店有這些價格點
export interface PricingPlan {
  id: "yearly" | "monthly";
  title: string;
  /** 顯示用價格字串，例如 "NT$199 / 月" */
  price: string;
  badge?: string;
  /** 年訂換算每月多少、比月繳省多少（誘因文案） */
  deal?: string;
}

const MONTHLY = 199;
const YEARLY = 1499;

export const FREE_PHOTO_STORIES_PER_MONTH = 3;

/** 免費版和付費會員各有什麼，購買頁的對照表 */
export const PLAN_PERKS = {
  free: [`照片故事每月 ${FREE_PHOTO_STORIES_PER_MONTH} 篇（3 分鐘）`, "故事庫部分故事", "爸媽錄音（不含備份）"],
  member: ["照片故事每天 1 篇", "3 或 10 分鐘任選", "完整故事庫", "爸媽錄音備份，換手機也帶得走"],
};

export const PRICING: { plans: PricingPlan[]; defaultPlan: PricingPlan["id"] } = {
  // 預設選年訂：長期方案放最上面並預選，是最直接的誘因
  defaultPlan: "yearly",
  plans: [
    {
      id: "yearly",
      title: "年訂閱",
      price: `NT$${YEARLY.toLocaleString("en-US")} / 年`,
      badge: "最划算",
      deal: `每月約 NT$${Math.round(YEARLY / 12)}・省 NT$${(MONTHLY * 12 - YEARLY).toLocaleString("en-US")}`,
    },
    { id: "monthly", title: "月訂閱", price: `NT$${MONTHLY} / 月` },
  ],
};
