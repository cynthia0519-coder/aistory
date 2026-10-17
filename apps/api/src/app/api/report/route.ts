import { ReportRequestSchema, type ApiError } from "@aistory/shared";
import { corsHeaders, forbiddenOrigin, isAllowedOrigin, preflight } from "@/lib/cors";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { saveReport } from "@/lib/reports";

// 家長回報故事（內容不對勁時）：只存故事文字，主角名字已在手機上換掉，沒有照片
function json(body: { ok: true } | ApiError, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return forbiddenOrigin();
  const parsed = ReportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request" }, 400, origin);
  const limit = await checkRateLimit(clientIp(request), "report");
  if (!limit.ok) return json({ error: "rate_limited" }, 429, origin);
  try {
    await saveReport(parsed.data);
    return json({ ok: true }, 200, origin);
  } catch (err) {
    console.error("report save error", err instanceof Error ? err.message : "unknown");
    return json({ error: "internal" }, 500, origin);
  }
}
