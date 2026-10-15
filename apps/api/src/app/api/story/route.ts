import Anthropic from "@anthropic-ai/sdk";
import { StoryRequestSchema, type ApiError, type StoryResponse } from "@aistory/shared";
import { corsHeaders, forbiddenOrigin, isAllowedOrigin, preflight } from "@/lib/cors";
import { inviteFrom, isValidInvite } from "@/lib/invite";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { generateStory, StoryRefusedError } from "@/lib/story-engine";

// 10 分鐘的故事生成可能超過 60 秒
export const maxDuration = 120;

function json(body: StoryResponse | ApiError, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // 在讀 body 與計入速率限制之前就擋，不花 Claude 額度
  if (!isAllowedOrigin(origin)) return forbiddenOrigin();
  // 封測期間只有受邀的家庭能拍照編故事（INVITE_CODES 沒設就不檢查）
  if (!isValidInvite(inviteFrom(request))) return json({ error: "invite_required" }, 403, origin);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }

  const parsed = StoryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400, origin);
  }

  // 只計算會真正呼叫 Claude 的請求
  const limit = await checkRateLimit(clientIp(request), "story");
  if (!limit.ok) {
    return json({ error: limit.reason === "global" ? "daily_cap" : "rate_limited" }, 429, origin);
  }

  // 照片只存在這次請求的記憶體中，不寫入磁碟或資料庫，也不記錄 log。
  try {
    const story = await generateStory(parsed.data);
    return json({ story }, 200, origin);
  } catch (err) {
    if (err instanceof StoryRefusedError) {
      return json({ error: "refused" }, 422, origin);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "busy" }, 429, origin);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("anthropic error", err.status, err.message);
      return json({ error: "upstream" }, 502, origin);
    }
    console.error("story error", err instanceof Error ? err.message : err);
    return json({ error: "internal" }, 500, origin);
  }
}
