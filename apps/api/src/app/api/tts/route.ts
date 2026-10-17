import { TtsRequestSchema, type ApiError } from "@aistory/shared";
import { corsHeaders, forbiddenOrigin, isAllowedOrigin, preflight } from "@/lib/cors";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isTtsConfigured, synthesize, TtsError, TtsUnavailableError } from "@/lib/tts";

function json(body: ApiError, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}

// 朗讀文字含小孩的名字：不記錄 log、不落地，只在這次請求的記憶體中轉給 Azure
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // 在讀 body 與計入速率限制之前就擋，不花 Azure 額度
  if (!isAllowedOrigin(origin)) return forbiddenOrigin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }

  const parsed = TtsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400, origin);
  }

  // 沒設定金鑰時不計入速率限制，前端看到 503 就整個 session 改用裝置語音
  if (!isTtsConfigured()) {
    return json({ error: "tts_unavailable" }, 503, origin);
  }

  const limit = await checkRateLimit(clientIp(request), "tts");
  if (!limit.ok) {
    return json({ error: limit.reason === "global" ? "daily_cap" : "rate_limited" }, 429, origin);
  }

  try {
    const audio = await synthesize(parsed.data);
    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "audio/mpeg",
        // 同一段文字與聲音的結果不會變；前端另外存在 IndexedDB，這裡只是讓瀏覽器也能快取
        "Cache-Control": "private, max-age=31536000",
      },
    });
  } catch (err) {
    if (err instanceof TtsUnavailableError) {
      return json({ error: "tts_unavailable" }, 503, origin);
    }
    if (err instanceof TtsError) {
      console.error("tts upstream error", err.status ?? err.message);
      return json({ error: "upstream" }, 502, origin);
    }
    console.error("tts error", err instanceof Error ? err.name : "unknown");
    return json({ error: "internal" }, 500, origin);
  }
}
