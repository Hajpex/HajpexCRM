import { schedulePush } from "./cloudSync";

const KEY = "hajpex.visningar.v1";

export type VisningTyp = "Öppen" | "Privat" | "Budvisning";

export type Deltagare = {
  id: string;
  namn: string;
  telefon: string;
  kontaktId?: string;
  anmald: boolean;
  deltog: boolean;
};

export type Visning = {
  id: string;
  slug: string;
  datum: number;
  sluttid: number;
  typ: VisningTyp;
  anteckningar: string;
  deltagare: Deltagare[];
  skapad: number;
};

function read(): Record<string, Visning[]> {
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

function write(data: Record<string, Visning[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
  schedulePush(KEY);
}

export function listVisningar(slug: string): Visning[] {
  return (read()[slug] ?? []).sort((a, b) => a.datum - b.datum);
}

export function listAllaVisningar(): Visning[] {
  const all = read();
  return Object.values(all)
    .flat()
    .sort((a, b) => a.datum - b.datum);
}

export function saveVisning(data: Omit<Visning, "id" | "skapad">): Visning {
  const all = read();
  const v: Visning = { ...data, id: crypto.randomUUID(), skapad: Date.now() };
  all[data.slug] = [...(all[data.slug] ?? []), v];
  write(all);
  return v;
}

export function updateVisning(slug: string, id: string, patch: Partial<Visning>): void {
  const all = read();
  all[slug] = (all[slug] ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v));
  write(all);
}

export function deleteVisning(slug: string, id: string): void {
  const all = read();
  all[slug] = (all[slug] ?? []).filter((v) => v.id !== id);
  write(all);
}

export function addDeltagare(slug: string, visningId: string, d: Omit<Deltagare, "id">): void {
  const all = read();
  all[slug] = (all[slug] ?? []).map((v) => {
    if (v.id !== visningId) return v;
    const exists = v.deltagare.some((p) =>
      p.kontaktId ? p.kontaktId === d.kontaktId : p.telefon === d.telefon
    );
    if (exists) return v;
    return { ...v, deltagare: [...v.deltagare, { ...d, id: crypto.randomUUID() }] };
  });
  write(all);
}

export function toggleDeltog(slug: string, visningId: string, deltagarId: string): void {
  const all = read();
  all[slug] = (all[slug] ?? []).map((v) => {
    if (v.id !== visningId) return v;
    return {
      ...v,
      deltagare: v.deltagare.map((d) =>
        d.id === deltagarId ? { ...d, deltog: !d.deltog } : d
      ),
    };
  });
  write(all);
}

export function exportVisningToICS(v: Visning, adress: string): void {
  const pad = (n: number) => String(n).padStart(2, "0");
  function icsDate(ts: number) {
    const d = new Date(ts);
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      "00"
    );
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HajpexCRM//Hajpex//SE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${v.id}@hajpexcrm`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(v.datum)}`,
    `DTEND:${icsDate(v.sluttid)}`,
    `SUMMARY:${v.typ} – ${adress}`,
    `DESCRIPTION:${v.typ}\\n${v.deltagare.length} anmälda\\n${v.anteckningar}`,
    `LOCATION:${adress}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visning-${adress.toLowerCase().replace(/\s+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
