// 評測腳本共用的價格表（美元 / 百萬 token）與單次呼叫成本。價格變了改這裡。
import type Anthropic from "@anthropic-ai/sdk";

export const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export function cost(model: string, u: Anthropic.Beta.BetaUsage): number {
  const p = PRICES[model];
  if (!p) return NaN;
  return (
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1e6
  );
}
