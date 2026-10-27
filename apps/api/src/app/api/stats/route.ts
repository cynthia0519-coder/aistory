import { StatsRequestSchema, type ApiError } from "@aistory/shared";
import { corsHeaders, forbiddenOrigin, isAllowedOrigin, preflight } from "@/lib/cors";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordStat } from "@/lib/stats";

// 不記名使用統計：只收安裝代號和事件類別，不存 IP（速率限制用的是雜湊過的位址）
function json(body: { ok: true } | ApiError, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return forbiddenOrigin();
  const parsed = StatsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request" }, 400, origin);
  const limit = await checkRateLimit(clientIp(request), "stats");
  if (!limit.ok) return json({ error: "rate_limited" }, 429, origin);
  try {
    await recordStat(parsed.data.id, parsed.data.event);
    return json({ ok: true }, 200, origin);
  } catch (err) {
    console.error("stats save error", err instanceof Error ? err.message : "unknown");
    return json({ error: "internal" }, 500, origin);
  }
}
