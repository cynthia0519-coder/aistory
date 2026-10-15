import type { ApiError } from "@aistory/shared";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// 沒帶 Origin 也擋：瀏覽器與 Capacitor 的 POST 一定會帶，沒帶的只會是腳本。
// 腳本仍可偽造 Origin，這只是擋掉隨手呼叫；真正的防線是 rate-limit.ts。
export function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function forbiddenOrigin(): Response {
  return Response.json({ error: "forbidden_origin" } satisfies ApiError, {
    status: 403,
    headers: { Vary: "Origin" },
  });
}

export function preflight(request: Request): Response {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return forbiddenOrigin();
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
