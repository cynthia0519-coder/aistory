import { INVITE_HEADER, type ApiError, type ReportRequest, type StoryRequest, type StoryResponse } from "@aistory/shared";
import { clearInvite, getInvite } from "./invite";

/** API 服務網址；故事與朗讀（lib/tts.ts）共用 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

const MESSAGES: Record<string, string> = {
  refused: "這張照片沒辦法編故事，換一張試試看。",
  busy: "現在太多人在用了，稍等一下再試。",
  invalid_request: "照片或設定有問題，請重新選擇。",
  rate_limited: "故事編得太快了，休息一下再來。",
  daily_cap: "今天的故事額度用完了，明天再來。",
  invite_required: "需要封測邀請碼才能拍照編故事。",
};

export class StoryApiError extends Error {}

/** 邀請碼缺少或失效（已從裝置清掉），畫面要請家長重新輸入 */
export class InviteRequiredError extends StoryApiError {}

export async function requestStory(req: StoryRequest): Promise<StoryResponse> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new StoryApiError("目前離線。編新故事需要網路，書櫃裡的故事可以照常閱讀。");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/story`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...inviteHeader() },
      body: JSON.stringify(req),
    });
  } catch {
    throw new StoryApiError("連不上伺服器，請檢查網路。");
  }
  const body = (await res.json().catch(() => ({ error: "internal" }))) as StoryResponse | ApiError;
  if (!res.ok || "error" in body) {
    const code = "error" in body ? body.error : "internal";
    if (code === "invite_required") {
      clearInvite();
      throw new InviteRequiredError(MESSAGES[code]);
    }
    throw new StoryApiError(MESSAGES[code] ?? "出了點問題，請再試一次。");
  }
  return body;
}

function inviteHeader(): Record<string, string> {
  const code = getInvite();
  return code ? { [INVITE_HEADER]: code } : {};
}

/** 確認邀請碼；true = 可以用（伺服器沒設邀請碼時任何碼都算對） */
export async function verifyInvite(code: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.status === 429) throw new StoryApiError("試太多次了，休息一下再試。");
  return res.ok;
}

/** 回報一則故事；呼叫端要先把主角名字換成 {name} */
export async function reportStory(report: ReportRequest): Promise<void> {
  const res = await fetch(`${API_BASE}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  if (!res.ok) throw new StoryApiError(res.status === 429 ? "回報太多次了，晚一點再試。" : "回報沒有送出，請再試一次。");
}
