import type { ApiError, StoryRequest, StoryResponse } from "@aistory/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

const MESSAGES: Record<string, string> = {
  refused: "這張照片沒辦法編故事，換一張試試看。",
  busy: "現在太多人在用了，稍等一下再試。",
  invalid_request: "照片或設定有問題，請重新選擇。",
};

export class StoryApiError extends Error {}

export async function requestStory(req: StoryRequest): Promise<StoryResponse> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new StoryApiError("目前離線。編新故事需要網路，書櫃裡的故事可以照常閱讀。");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/story`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    throw new StoryApiError("連不上伺服器，請檢查網路。");
  }
  const body = (await res.json().catch(() => ({ error: "internal" }))) as StoryResponse | ApiError;
  if (!res.ok || "error" in body) {
    const code = "error" in body ? body.error : "internal";
    throw new StoryApiError(MESSAGES[code] ?? "出了點問題，請再試一次。");
  }
  return body;
}
