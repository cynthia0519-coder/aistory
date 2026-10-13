// 速率限制：擋住刷 API 的人，並設每日總量上限把 Claude 費用封頂。
//
// 有設定 Upstash Redis（UPSTASH_REDIS_REST_URL / TOKEN）時使用 Redis，計數在所有 serverless 實例之間共享。
// 沒設定時退回記憶體計數：本機開發夠用，但部署到 Vercel 後每個實例各算各的，擋不住刷量，上線前一定要設定 Redis。

export interface Limit {
  /** 計數用的 key 前綴 */
  name: string;
  max: number;
  windowSeconds: number;
}

export const LIMITS = {
  perIpMinute: { name: "ip-m", max: Number(process.env.RATE_IP_PER_MINUTE ?? 5), windowSeconds: 60 },
  perIpDay: { name: "ip-d", max: Number(process.env.RATE_IP_PER_DAY ?? 50), windowSeconds: 86_400 },
  globalDay: { name: "all-d", max: Number(process.env.RATE_GLOBAL_PER_DAY ?? 2000), windowSeconds: 86_400 },
} satisfies Record<string, Limit>;

interface Counter {
  /** 計數加一，回傳目前視窗內的累計次數 */
  increment(key: string, windowSeconds: number): Promise<number>;
}

// ---- 記憶體實作（固定視窗）----
const memory = new Map<string, { count: number; resetAt: number }>();

const memoryCounter: Counter = {
  async increment(key, windowSeconds) {
    const now = Date.now();
    const entry = memory.get(key);
    if (!entry || entry.resetAt <= now) {
      memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      if (memory.size > 10_000) {
        for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      }
      return 1;
    }
    entry.count += 1;
    return entry.count;
  },
};

// ---- Upstash Redis REST 實作（固定視窗）----
function upstashCounter(url: string, token: string): Counter {
  return {
    async increment(key, windowSeconds) {
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, String(windowSeconds), "NX"],
        ]),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`upstash ${res.status}`);
      const [incr] = (await res.json()) as [{ result: number }];
      return incr.result;
    },
  };
}

const counter: Counter =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? upstashCounter(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN)
    : memoryCounter;

function windowKey(limit: Limit, id: string) {
  const bucket = Math.floor(Date.now() / 1000 / limit.windowSeconds);
  return `rl:${limit.name}:${id}:${bucket}`;
}

export type RateLimitResult = { ok: true } | { ok: false; reason: "ip" | "global" };

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    const [minute, day, global] = await Promise.all([
      counter.increment(windowKey(LIMITS.perIpMinute, ip), LIMITS.perIpMinute.windowSeconds),
      counter.increment(windowKey(LIMITS.perIpDay, ip), LIMITS.perIpDay.windowSeconds),
      counter.increment(windowKey(LIMITS.globalDay, "all"), LIMITS.globalDay.windowSeconds),
    ]);
    if (global > LIMITS.globalDay.max) return { ok: false, reason: "global" };
    if (minute > LIMITS.perIpMinute.max || day > LIMITS.perIpDay.max) return { ok: false, reason: "ip" };
    return { ok: true };
  } catch (err) {
    // Redis 掛掉時放行，避免整個服務停擺；每日總量上限仍由 Anthropic Console 的用量上限兜底
    console.error("rate limit backend error", err instanceof Error ? err.message : err);
    return { ok: true };
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
