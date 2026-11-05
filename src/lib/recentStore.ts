import { schedulePush } from "./cloudSync";

const KEY = "hajpex.recent.v1";
const MAX = 12;

export type RecentKind = "kontakt" | "objekt";

export type RecentItem = {
  kind: RecentKind;
  id: string;        // kontaktId eller objekt-slug
  label: string;     // namn / adress
  sub?: string;      // t.ex. telefon eller typ/status
  ts: number;
};

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: RecentItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    schedulePush(KEY);
  } catch {
    /* ignore quota */
  }
}

/** Registrera ett besök. Flyttar posten överst och tar bort dubbletter. */
export function trackVisit(item: Omit<RecentItem, "ts">) {
  if (!item.id || !item.label) return;
  const now = Date.now();
  const existing = read().filter((r) => !(r.kind === item.kind && r.id === item.id));
  write([{ ...item, ts: now }, ...existing].slice(0, MAX));
}

export function listRecent(kind?: RecentKind, limit = MAX): RecentItem[] {
  const items = read().sort((a, b) => b.ts - a.ts);
  return (kind ? items.filter((r) => r.kind === kind) : items).slice(0, limit);
}

export function clearRecent() {
  write([]);
}
