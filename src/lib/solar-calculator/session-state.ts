import type { CalculatorRequest, CustomerPlan } from "./recommendation-types";

export const CALCULATOR_SESSION_KEY = "picon-solar-calculator-session-v1";
const RETURN_KEY = "picon-solar-calculator-return-v1";

export type CalculatorDraft = { id: string; name: string; quantity: string; watts: string; hours: string; startingW: string };
export type CalculatorSession = {
  version: 1;
  step: 0 | 1 | 2;
  drafts: CalculatorDraft[];
  customName: string;
  customW: string;
  customH: string;
  settings: Record<string, string>;
  result: CustomerPlan;
  selectedId: string | null;
  manuallySelected: boolean;
  calculatedRequest: CalculatorRequest;
};

export function saveCalculatorSession(session: CalculatorSession) {
  try { window.sessionStorage.setItem(CALCULATOR_SESSION_KEY, JSON.stringify(session)); } catch { /* Storage is optional; the assessment URL remains available. */ }
}

export function readCalculatorSession(): CalculatorSession | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(CALCULATOR_SESSION_KEY) ?? "null");
    if (!value || value.version !== 1 || ![0,1,2].includes(value.step) || !Array.isArray(value.drafts) || !value.settings || typeof value.settings !== "object" ||
      typeof value.customName !== "string" || typeof value.customW !== "string" || typeof value.customH !== "string" ||
      !value.result?.energy || !Array.isArray(value.result.options) || !value.calculatedRequest?.assumptions ||
      !Array.isArray(value.calculatedRequest.loads) || typeof value.manuallySelected !== "boolean" ||
      value.selectedId !== null && typeof value.selectedId !== "string" ||
      value.drafts.some((d: unknown) => !d || typeof d !== "object" || ["id", "name", "quantity", "watts", "hours", "startingW"].some((k) => typeof (d as Record<string, unknown>)[k] !== "string")) ||
      Object.values(value.settings).some((v) => typeof v !== "string")) return null;
    return value as CalculatorSession;
  } catch { return null; }
}

export function armCalculatorReturn() {
  try { window.sessionStorage.setItem(RETURN_KEY, "1"); } catch { /* Direct navigation still works when storage is unavailable. */ }
}

export function consumeCalculatorReturn() {
  try {
    const pending = window.sessionStorage.getItem(RETURN_KEY) === "1";
    window.sessionStorage.removeItem(RETURN_KEY);
    return pending;
  } catch { return false; }
}

export function clearCalculatorSession() {
  try {
    window.sessionStorage.removeItem(CALCULATOR_SESSION_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch { /* Storage is optional. */ }
}
