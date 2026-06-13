const KEY = "hajpex.objektNotes.v1";

export type ObjektNote = { id: string; text: string; ts: number; av: string };
export type ObjektNoteData = { anteckningar: ObjektNote[]; beskrivning: string };

function read(): Record<string, ObjektNoteData> {
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

function write(data: Record<string, ObjektNoteData>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function getObjektNotes(slug: string): ObjektNoteData {
  return read()[slug] ?? { anteckningar: [], beskrivning: "" };
}

export function addObjektNote(slug: string, text: string, av = "Mäklare"): ObjektNote {
  const data = read();
  const existing = data[slug] ?? { anteckningar: [], beskrivning: "" };
  const note: ObjektNote = { id: crypto.randomUUID(), text, ts: Date.now(), av };
  data[slug] = { ...existing, anteckningar: [note, ...existing.anteckningar] };
  write(data);
  return note;
}

export function setObjektBeskrivning(slug: string, beskrivning: string) {
  const data = read();
  const existing = data[slug] ?? { anteckningar: [], beskrivning: "" };
  data[slug] = { ...existing, beskrivning };
  write(data);
}
