// 封測邀請碼：INVITE_CODES（逗號分隔）有設時，拍照編故事要帶有效的邀請碼；沒設就不檢查（本機開發）。
// 一個家庭一組碼，要停掉某個家庭就從清單拿掉那組碼。碼不分大小寫。
import { INVITE_HEADER } from "@aistory/shared";

const codes = () =>
  new Set(
    (process.env.INVITE_CODES ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );

export function inviteRequired(): boolean {
  return codes().size > 0;
}

export function isValidInvite(code: string | null | undefined): boolean {
  const set = codes();
  if (set.size === 0) return true;
  return !!code && set.has(code.trim().toUpperCase());
}

export function inviteFrom(request: Request): string | null {
  return request.headers.get(INVITE_HEADER);
}
