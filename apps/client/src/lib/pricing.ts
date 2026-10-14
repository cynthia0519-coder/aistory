// 購買方案：價格依營運企劃書定案；接上 App Store / Google Play 前要確認商店有這些價格點。null 代表還沒定價，畫面顯示「即將推出」
export interface PricingPlan {
  id: "yearly" | "half_year" | "monthly_basic" | "monthly_full" | "pack10_short" | "pack10_long" | "single";
  title: string;
  detail: string;
  /** 顯示用價格字串，例如 "NT$99 / 月"；null = 即將推出 */
  price: string | null;
  badge?: string;
  /** 長期方案換算每月多少、比月繳省多少（誘因文案） */
  deal?: string;
}

// 半年、一年都是「完整」方案（3 或 10 分鐘任選），和 NT$199 月訂比較
const FULL_MONTHLY = 199;
const deal = (price: number, months: number) => {
  const perMonth = Math.round(price / months);
  const saved = FULL_MONTHLY * months - price;
  return `每月約 NT$${perMonth}・省 NT$${saved.toLocaleString("en-US")}`;
};

export const PRICING: { plans: PricingPlan[]; defaultPlan: PricingPlan["id"] } = {
  // 預設選年訂：長期方案放最上面並預選，是最直接的誘因
  defaultPlan: "yearly",
  plans: [
    {
      id: "yearly",
      title: "年訂閱 · 完整",
      detail: "每天 1 個故事，3 或 10 分鐘任選",
      price: "NT$1,299 / 年",
      badge: "最划算",
      deal: deal(1299, 12),
    },
    {
      id: "half_year",
      title: "半年訂閱 · 完整",
      detail: "每天 1 個故事，3 或 10 分鐘任選",
      price: "NT$999 / 半年",
      // 半年方案是年訂的對照：只差 NT$300 就多 6 個月
      deal: deal(999, 6),
    },
    { id: "monthly_full", title: "月訂閱 · 完整", detail: "每天 1 個故事，3 或 10 分鐘任選", price: "NT$199 / 月" },
    { id: "monthly_basic", title: "月訂閱 · 基本", detail: "每天 1 個 3 分鐘故事", price: "NT$99 / 月" },
    { id: "pack10_short", title: "故事包 · 3 分鐘 × 10", detail: "不會過期", price: "NT$99" },
    { id: "pack10_long", title: "故事包 · 10 分鐘 × 10", detail: "不會過期", price: "NT$199" },
    { id: "single", title: "單買 · 1 個", detail: "3 分鐘 NT$19，10 分鐘 NT$39", price: "NT$19 起" },
  ],
};

/** 選了半年方案時的升級提示：只要再多一點就是一整年 */
export const YEARLY_NUDGE = "再加 NT$300，就從半年變一整年";
