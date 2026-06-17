import { schedulePush } from "./cloudSync";

const KEY = "hajpex.objektRum.v1";

/**
 * Ett rum kopplat till ett objekt. Bilderna sparas INTE här — de är för stora
 * för localStorage och används bara transient under AI-analysen. Det är den
 * färdiga beskrivningen (text) som persisteras.
 */
export type SavedRum = {
  id: string;
  name: string;
  floor: string;
  description: string;
  createdAt: number;
};

function read(): Record<string, SavedRum[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function write(data: Record<string, SavedRum[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
  schedulePush(KEY);
}

export function listRum(slug: string): SavedRum[] {
  return read()[slug] ?? [];
}

export function addRum(slug: string, name: string, floor = "Entréplan"): SavedRum {
  const data = read();
  const rum: SavedRum = {
    id: crypto.randomUUID(),
    name,
    floor,
    description: "",
    createdAt: Date.now(),
  };
  data[slug] = [...(data[slug] ?? []), rum];
  write(data);
  return rum;
}

export function updateRum(slug: string, id: string, patch: Partial<Omit<SavedRum, "id">>) {
  const data = read();
  const list = data[slug] ?? [];
  data[slug] = list.map((r) => (r.id === id ? { ...r, ...patch } : r));
  write(data);
}

export function deleteRum(slug: string, id: string) {
  const data = read();
  const list = data[slug] ?? [];
  data[slug] = list.filter((r) => r.id !== id);
  write(data);
}
