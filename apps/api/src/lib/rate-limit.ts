// 速率限制：擋住刷 API 的人，並設每日總量上限把 Claude 與 Azure TTS 費用封頂。
//
// 有設定 Upstash Redis（UPSTASH_REDIS_REST_URL / TOKEN）時使用 Redis，計數在所有 serverless 實例之間共享。
// 沒設定時退回記憶體計數：本機開發夠用，但部署到 Vercel 後每個實例各算各的，擋不住刷量，上線前一定要設定 Redis。

import { createHash } from "node:crypto";

export interface Limit {
  /** 計數用的 key 前綴 */
  name: string;
  max: number;
  windowSeconds: number;
}

/** 一組限制：每個 IP 每分鐘、每個 IP 每天、全站每天 */
export interface Bucket {
  perIpMinute: Limit;
  perIpDay: Limit;
  globalDay: Limit;
}

const env = (key: string, fallback: number) => Number(process.env[key] ?? fallback);

/**
 * 每種用途各有一個 bucket，計數 key 以 bucket 名稱開頭（rl:<bucket>:<limit>:...），彼此不互相佔用額度。
 * - story：呼叫 Claude，貴，限制嚴
 * - tts：一個 10 分鐘的故事約 24 段，每段一次請求，所以每分鐘要放寬；全站上限把 Azure 費用封頂
 */
export const BUCKETS = {
  story: {
    perIpMinute: { name: "ip-m", max: env("RATE_IP_PER_MINUTE", 5), windowSeconds: 60 },
    perIpDay: { name: "ip-d", max: env("RATE_IP_PER_DAY", 50), windowSeconds: 86_400 },
    globalDay: { name: "all-d", max: env("RATE_GLOBAL_PER_DAY", 2000), windowSeconds: 86_400 },
  },
  tts: {
    perIpMinute: { name: "ip-m", max: env("RATE_TTS_IP_PER_MINUTE", 60), windowSeconds: 60 },
    perIpDay: { name: "ip-d", max: env("RATE_TTS_IP_PER_DAY", 800), windowSeconds: 86_400 },
    globalDay: { name: "all-d", max: env("RATE_TTS_GLOBAL_PER_DAY", 50_000), windowSeconds: 86_400 },
  },
} satisfies Record<string, Bucket>;
export type BucketName = keyof typeof BUCKETS;

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

function windowKey(bucket: BucketName, limit: Limit, id: string) {
  const window = Math.floor(Date.now() / 1000 / limit.windowSeconds);
  return `rl:${bucket}:${limit.name}:${id}:${window}`;
}

export type RateLimitResult = { ok: true } | { ok: false; reason: "ip" | "global" };

/**
 * 計數用的連線位址先雜湊，Redis 裡不留原始 IP（隱私權政策寫的「不存原始位址」）。
 * RATE_LIMIT_SALT 有設的話一起雜湊，比較難從雜湊反查 IP。
 */
export function ipKey(ip: string): string {
  return createHash("sha256").update(`${process.env.RATE_LIMIT_SALT ?? ""}:${ip}`).digest("hex").slice(0, 16);
}

export async function checkRateLimit(rawIp: string, bucket: BucketName = "story"): Promise<RateLimitResult> {
  const limits = BUCKETS[bucket];
  const ip = ipKey(rawIp);
  try {
    const [minute, day, global] = await Promise.all([
      counter.increment(windowKey(bucket, limits.perIpMinute, ip), limits.perIpMinute.windowSeconds),
      counter.increment(windowKey(bucket, limits.perIpDay, ip), limits.perIpDay.windowSeconds),
      counter.increment(windowKey(bucket, limits.globalDay, "all"), limits.globalDay.windowSeconds),
    ]);
    if (global > limits.globalDay.max) return { ok: false, reason: "global" };
    if (minute > limits.perIpMinute.max || day > limits.perIpDay.max) return { ok: false, reason: "ip" };
    return { ok: true };
  } catch (err) {
    // Redis 掛掉時放行，避免整個服務停擺；每日總量上限仍由 Anthropic Console / Azure 的用量上限兜底
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
