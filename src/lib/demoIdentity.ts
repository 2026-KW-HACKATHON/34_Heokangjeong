/** 데모 계정은 탭마다 다르게 유지하고, 데이터는 같은 브라우저의 탭끼리 공유한다. */
const KEY = "wolgye-demo-tab-user";
const ENABLED = "wolgye-demo-enabled";

export function isDemoEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(ENABLED) === "true"; }
  catch { return false; }
}

export function startDemoSession(id: string) {
  sessionStorage.setItem(ENABLED, "true");
  setDemoUserId(id);
}

export function endDemoSession() {
  sessionStorage.removeItem(ENABLED);
  sessionStorage.removeItem(KEY);
  localStorage.removeItem("wolgye-user");
}

export function getDemoUserId(): string | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem(KEY) ?? localStorage.getItem("wolgye-user"); }
  catch { return null; }
}

export function setDemoUserId(id: string) {
  try { sessionStorage.setItem(KEY, id); }
  catch { /* 저장소 접근이 막혀도 현재 탭 상태는 유지한다. */ }
}
