import type { Kontakt, ObjektKoppling, Aktivitet } from "./kontaktTypes";

const KEY = "hajpex.kontakter.v1";

function read(): Kontakt[] {
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

function write(list: Kontakt[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function listKontakter(): Kontakt[] {
  return read().sort((a, b) =>
    `${a.fornamn} ${a.efternamn}`.localeCompare(`${b.fornamn} ${b.efternamn}`, "sv")
  );
}

export function getKontakt(id: string): Kontakt | undefined {
  return read().find((k) => k.id === id);
}

export function findByTelefon(telefon: string): Kontakt | undefined {
  const norm = telefon.replace(/[\s\-()]/g, "");
  if (norm.length < 5) return undefined;
  return read().find((k) => k.telefon.replace(/[\s\-()]/g, "") === norm);
}

export function saveKontakt(data: Omit<Kontakt, "id" | "skapadAt">): Kontakt {
  const list = read();
  const kontakt: Kontakt = { nastaSteg: null, ...data, id: crypto.randomUUID(), skapadAt: Date.now() };
  list.push(kontakt);
  write(list);
  return kontakt;
}

export function setNastaSteg(id: string, ns: import("./kontaktTypes").NastaSteg | null) {
  const list = read();
  const idx = list.findIndex((k) => k.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], nastaSteg: ns };
  write(list);
}

export function updateKontakt(id: string, patch: Partial<Omit<Kontakt, "id" | "skapadAt">>): Kontakt {
  const list = read();
  const idx = list.findIndex((k) => k.id === id);
  if (idx < 0) throw new Error("Kontakt saknas");
  list[idx] = { ...list[idx], ...patch };
  write(list);
  return list[idx];
}

export function deleteKontakt(id: string) {
  write(read().filter((k) => k.id !== id));
}

export function addAktivitet(kontaktId: string, a: Omit<Aktivitet, "id">) {
  const list = read();
  const idx = list.findIndex((k) => k.id === kontaktId);
  if (idx < 0) return;
  list[idx].aktiviteter = [{ ...a, id: crypto.randomUUID() }, ...list[idx].aktiviteter];
  write(list);
}

export function addObjektKoppling(kontaktId: string, koppling: ObjektKoppling) {
  const list = read();
  const idx = list.findIndex((k) => k.id === kontaktId);
  if (idx < 0) return;
  const exists = list[idx].objektKopplingar.some(
    (k) => k.slug === koppling.slug && k.relation === koppling.relation
  );
  if (!exists) {
    list[idx].objektKopplingar = [koppling, ...list[idx].objektKopplingar];
  }
  write(list);
}
