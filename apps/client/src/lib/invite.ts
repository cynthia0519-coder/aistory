// 封測邀請碼：存在這台裝置上，拍照編故事時放在 header 帶給 API（伺服器沒設邀請碼時不檢查）。
const KEY = "aistory.invite";

export function getInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveInvite(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    // 存不了就每次都要輸入，不影響使用
  }
}

export function clearInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}
