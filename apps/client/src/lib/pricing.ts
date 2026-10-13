// 購買方案：價格之後接上 App Store / Google Play 再填；null 代表還沒定價，畫面顯示「即將推出」
export interface PricingPlan {
  id: "monthly" | "pack10" | "single";
  title: string;
  detail: string;
  /** 顯示用價格字串，例如 "NT$150 / 月"；null = 即將推出 */
  price: string | null;
  badge?: string;
}

export const PRICING: { plans: PricingPlan[]; defaultPlan: PricingPlan["id"] } = {
  defaultPlan: "monthly",
  plans: [
    { id: "monthly", title: "月訂閱", detail: "每天一個故事", price: null, badge: "最划算" },
    { id: "pack10", title: "故事包 · 10 個", detail: "不會過期", price: null },
    { id: "single", title: "單買 · 1 個", detail: "先試試看", price: null },
  ],
};
