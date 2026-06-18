import { schedulePush } from "./cloudSync";

const KEY = "hajpex.objektBilder.v1";
// Max ~40 images per property before localStorage pressure becomes a concern.
// Images are compressed to 1200px JPEG 82% in the UI before storing (~80-150KB each).
const MAX_PER_SLUG = 40;

export type ObjektBild = {
  id: string;
  name: string;
  dataUrl: string;
  addedAt: number;
};

function read(): Record<string, ObjektBild[]> {
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

function write(data: Record<string, ObjektBild[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    schedulePush(KEY);
  } catch {
    // localStorage full — silently ignore, images are non-critical
  }
}

export function listBilder(slug: string): ObjektBild[] {
  return read()[slug] ?? [];
}

export function addBilder(slug: string, images: { name: string; dataUrl: string }[]): ObjektBild[] {
  const data = read();
  const existing = data[slug] ?? [];
  const added: ObjektBild[] = images.map((img) => ({
    id: crypto.randomUUID(),
    name: img.name,
    dataUrl: img.dataUrl,
    addedAt: Date.now(),
  }));
  data[slug] = [...existing, ...added].slice(-MAX_PER_SLUG);
  write(data);
  return added;
}

export function removeBild(slug: string, id: string) {
  const data = read();
  data[slug] = (data[slug] ?? []).filter((b) => b.id !== id);
  write(data);
}
