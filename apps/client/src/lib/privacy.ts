// 隱私：拍照前的家長同意與隱私權政策的版本。
// 政策內容改了（尤其是照片怎麼處理）就把 CONSENT_VERSION 加一，所有人下次拍照前會再確認一次。
export const POLICY_UPDATED = "2026 年 10 月 19 日";
export const CONSENT_VERSION = 3;
/** 提供服務的公司（隱私權政策上的資料管理者） */
export const PRIVACY_OPERATOR = "金星悅國際有限公司";
/** 隱私問題的聯絡信箱；空字串時政策頁不顯示聯絡方式 */
export const PRIVACY_CONTACT = "";

const KEY = "aistory.photoConsent";

/** 這台裝置是否已經同意目前版本的照片使用說明 */
export function hasPhotoConsent(): boolean {
  try {
    return Number(localStorage.getItem(KEY)) >= CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function savePhotoConsent(): void {
  try {
    localStorage.setItem(KEY, String(CONSENT_VERSION));
  } catch {
    // 存不了（無痕模式等）就每次都問，不影響使用
  }
}
