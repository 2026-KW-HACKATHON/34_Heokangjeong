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

/** 새 체험에서만 호출한다. 실제 계정의 인증·데이터는 건드리지 않는다. */
export function clearDemoBrowserData() {
  for (const key of Object.keys(localStorage)) {
    if (/^wolgye-mock-v\d+$/.test(key) || key.startsWith("wolgye-demo-pf-edit:") || key.startsWith("wolgye-pf-edit:demo-") || key.startsWith("wolgye-chat-read-v1:mock:")) localStorage.removeItem(key);
  }
  sessionStorage.removeItem("wolgye-demo-tour");
}
