export type DemoRole = "student" | "merchant";
export type DemoTourState = { role: DemoRole; step: number };
const KEY = "wolgye-demo-tour";

export function startDemoTour(role: DemoRole) {
  sessionStorage.setItem(KEY, JSON.stringify({ role, step: 0 }));
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
