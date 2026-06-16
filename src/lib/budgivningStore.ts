import { fmtSweNum } from "./formatters";
import { schedulePush } from "./cloudSync";

const KEY = "hajpex.budgivning.v1";

export type Bud = {
  id: string;
  tidpunkt: number;
  belopp: number;
  namn: string;
  kontaktId?: string;
  telefon: string;
  villkor: string;
  vinnare: boolean;
  tillbakadragen?: boolean;
};

type BudSettings = {
  godkannAllaBud: boolean;
};

const SETTINGS_KEY = "hajpex.budSettings.v1";

function read(): Record<string, Bud[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null ? p : {};
  } catch { return {}; }
}

function write(data: Record<string, Bud[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
  schedulePush(KEY);
}

export function listBud(slug: string): Bud[] {
  return (read()[slug] ?? []).sort((a, b) => b.belopp - a.belopp);
}

export function addBud(slug: string, bud: Omit<Bud, "id" | "tidpunkt" | "vinnare">): Bud {
  const data = read();
  const entry: Bud = { ...bud, id: crypto.randomUUID(), tidpunkt: Date.now(), vinnare: false };
  data[slug] = [entry, ...(data[slug] ?? [])];
  write(data);
  return entry;
}

export function markeraVinnare(slug: string, budId: string) {
  const data = read();
  const list = data[slug] ?? [];
  data[slug] = list.map((b) => ({ ...b, vinnare: b.id === budId }));
  write(data);
}

export function deleteBud(slug: string, budId: string) {
  const data = read();
  data[slug] = (data[slug] ?? []).filter((b) => b.id !== budId);
  write(data);
}

export function dragaTillbakaBud(slug: string, budId: string, tillbakadragen: boolean) {
  const data = read();
  data[slug] = (data[slug] ?? []).map((b) =>
    b.id === budId ? { ...b, tillbakadragen, vinnare: tillbakadragen ? false : b.vinnare } : b
  );
  write(data);
}

function readSettings(): Record<string, BudSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeSettings(s: Record<string, BudSettings>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  schedulePush(SETTINGS_KEY);
}

export function getBudSettings(slug: string): BudSettings {
  return readSettings()[slug] ?? { godkannAllaBud: false };
}

export function setBudSettings(slug: string, s: Partial<BudSettings>) {
  const all = readSettings();
  all[slug] = { ...getBudSettings(slug), ...s };
  writeSettings(all);
}

export function fmtBud(belopp: number): string {
  return fmtSweNum(String(belopp)) + " kr";
}
