// 購買方案：價格依營運企劃書定案；接上 App Store / Google Play 前要確認商店有這些價格點。null 代表還沒定價，畫面顯示「即將推出」
export interface PricingPlan {
  id: "monthly_basic" | "monthly_full" | "pack10_short" | "pack10_long" | "single";
  title: string;
  detail: string;
  /** 顯示用價格字串，例如 "NT$99 / 月"；null = 即將推出 */
  price: string | null;
  badge?: string;
}

export const PRICING: { plans: PricingPlan[]; defaultPlan: PricingPlan["id"] } = {
  defaultPlan: "monthly_full",
  plans: [
    { id: "monthly_full", title: "月訂閱 · 完整", detail: "每天 1 個故事，3 或 10 分鐘任選", price: "NT$199 / 月", badge: "最划算" },
    { id: "monthly_basic", title: "月訂閱 · 基本", detail: "每天 1 個 3 分鐘故事", price: "NT$99 / 月" },
    { id: "pack10_short", title: "故事包 · 3 分鐘 × 10", detail: "不會過期", price: "NT$99" },
    { id: "pack10_long", title: "故事包 · 10 分鐘 × 10", detail: "不會過期", price: "NT$199" },
    { id: "single", title: "單買 · 1 個", detail: "3 分鐘 NT$19，10 分鐘 NT$39", price: "NT$19 起" },
  ],
};
