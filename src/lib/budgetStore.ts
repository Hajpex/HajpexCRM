import { schedulePush } from "./cloudSync";

const KEY = "hajpex.budget.v1";

export type BudgetGoals = {
  omsattning: number;
  salda: number;
  intag: number;
  redo: number;
  provisionPct: number;
};

const DEFAULTS: BudgetGoals = {
  omsattning: 300_000,
  salda: 6,
  intag: 18,
  redo: 4,
  provisionPct: 0.015,
};

function read(): BudgetGoals {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null ? { ...DEFAULTS, ...p } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function write(data: BudgetGoals) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
  schedulePush(KEY);
}

export function getBudget(): BudgetGoals {
  return read();
}

export function saveBudget(patch: Partial<BudgetGoals>) {
  write({ ...read(), ...patch });
}
