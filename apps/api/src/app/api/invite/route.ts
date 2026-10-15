import type { ApiError } from "@aistory/shared";
import { corsHeaders, forbiddenOrigin, isAllowedOrigin, preflight } from "@/lib/cors";
import { isValidInvite } from "@/lib/invite";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// 封測邀請碼驗證：App 第一次拍照前確認碼對不對，不花 Claude 額度
function json(body: { ok: true } | ApiError, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return forbiddenOrigin();
  const limit = await checkRateLimit(clientIp(request), "invite");
  if (!limit.ok) return json({ error: "rate_limited" }, 429, origin);
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.slice(0, 64) : "";
  return isValidInvite(code) ? json({ ok: true }, 200, origin) : json({ error: "invalid_invite" }, 403, origin);
}
