import { OBJEKT, type Objekt, type Status, type Typ } from "../data/objekt";

const KEY = "stendahl.objektLibrary.v1";

export type SavedObjekt = Objekt & { id: string; savedAt: number };

function read(): SavedObjekt[] {
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

function write(list: SavedObjekt[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function listObjekt(): SavedObjekt[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

export function allObjekt(): Objekt[] {
  return [...listObjekt(), ...OBJEKT];
}

export type NewObjektInput = {
  adress: string;
  postnr?: string;
  stad?: string;
  typ: Typ;
  rum?: number;
  boarea?: number;
  pris?: number;
  saljare?: string;
  ansvarig?: string;
  status?: Status;
  kalla?: string;
};

export function saveObjekt(input: NewObjektInput): SavedObjekt {
  const list = read();
  const entry: SavedObjekt = {
    id: crypto.randomUUID(),
    savedAt: Date.now(),
    adress: input.adress,
    postnr: input.postnr ?? "",
    stad: input.stad ?? "",
    typ: input.typ,
    rum: input.rum ?? 0,
    boarea: input.boarea ?? 0,
    pris: input.pris ?? 0,
    saljare: input.saljare ?? "",
    ansvarig: input.ansvarig ?? "Erik Lindqvist",
    status: input.status ?? "Under intag",
    spek: [0, 0, 0, 0],
    kalla: input.kalla ?? "Eget upplägg",
  };
  list.push(entry);
  write(list);
  return entry;
}

export function deleteObjekt(id: string) {
  write(read().filter((o) => o.id !== id));
}
