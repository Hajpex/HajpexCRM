import type { Brf } from "./brfTypes";
import { schedulePush } from "./cloudSync";

const KEY = "stendahl.brfLibrary.v1";

export type SavedBrf = Brf & { id: string; savedAt: number };

function read(): SavedBrf[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: SavedBrf[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  schedulePush(KEY);
}

export function listBrfs(): SavedBrf[] {
  return read().sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
}

export function searchBrfs(query: string): SavedBrf[] {
  const q = query.trim().toLowerCase();
  const all = listBrfs();
  if (!q) return all;
  return all.filter((b) =>
    [b.namn, b.orgnr, b.hemsida].some((v) => (v || "").toLowerCase().includes(q)),
  );
}

export function saveBrf(brf: Brf): SavedBrf {
  const list = read();
  const orgnr = (brf.orgnr || "").trim();
  const namn = (brf.namn || "").trim();
  // Match on orgnr if present, otherwise name (case-insensitive)
  const idx = list.findIndex((b) =>
    orgnr ? (b.orgnr || "").trim() === orgnr : (b.namn || "").trim().toLowerCase() === namn.toLowerCase(),
  );
  const entry: SavedBrf = {
    ...brf,
    id: idx >= 0 ? list[idx].id : crypto.randomUUID(),
    savedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  write(list);
  return entry;
}

export function deleteBrf(id: string) {
  write(read().filter((b) => b.id !== id));
}