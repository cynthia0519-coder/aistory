// 不記名使用統計：手機上隨機產生一個安裝代號，只送「做了哪一類事」，不含名字、照片、故事內容。
// 家長可以在隱私頁關掉；關掉後什麼都不送，代號也一併刪掉。送不出去就算了，不影響使用。
import type { StatsEvent } from "@aistory/shared";
import { API_BASE } from "./api";

const ID_KEY = "aistory.statsId";
const OFF_KEY = "aistory.statsOff";

export function statsEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== "1";
  } catch {
    return false;
  }
}

export function setStatsEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else {
      localStorage.setItem(OFF_KEY, "1");
      localStorage.removeItem(ID_KEY);
    }
  } catch {
    // 存不了就算了
  }
}

function installId(): string | null {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(event: StatsEvent): void {
  if (typeof window === "undefined" || !statsEnabled()) return;
  const id = installId();
  if (!id) return;
  fetch(`${API_BASE}/api/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, event }),
    keepalive: true,
  }).catch(() => {});
}
