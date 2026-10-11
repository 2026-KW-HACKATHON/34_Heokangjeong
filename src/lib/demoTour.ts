export type DemoRole = "student" | "merchant";
/** picks: 방문객이 체험 중에 고른 것 (마지막 결과 카드에 보여 준다) */
export type DemoPicks = { startedAt?: number; studentName?: string; category?: string; title?: string };
export type DemoTourState = { role: DemoRole; step: number; picks?: DemoPicks };
const KEY = "wolgye-demo-tour";

export function startDemoTour(role: DemoRole) {
  sessionStorage.setItem(KEY, JSON.stringify({ role, step: 0, picks: { startedAt: Date.now() } }));
}

export function getDemoTour(): DemoTourState | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return (value?.role === "student" || value?.role === "merchant") && Number.isInteger(value.step) ? value : null;
  } catch { return null; }
}

export function saveDemoTour(state: DemoTourState | null) {
  if (state) sessionStorage.setItem(KEY, JSON.stringify(state));
  else sessionStorage.removeItem(KEY);
}

/** 체험 중 고른 것을 기억한다 (튜토리얼 단계는 그대로) */
export function rememberDemoPick(picks: DemoPicks) {
  const tour = getDemoTour();
  if (tour) saveDemoTour({ ...tour, picks: { ...tour.picks, ...picks } });
}

/** 상인 체험 중인지 (단계와 상관없이). 화면이 그려진 직후 튜토리얼이 다음 단계로 넘어가도 어긋나지 않는다 */
export const inMerchantTour = (tour: DemoTourState | null) => tour?.role === "merchant";

