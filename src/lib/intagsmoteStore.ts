import type { Kontakt } from "./kontaktTypes";
import { schedulePush } from "./cloudSync";

export type IntagsmoteStatus = "Planerat" | "Genomfört" | "Vunnen" | "Förlorad";

export type Intagsmote = {
  id: string;
  kontaktId: string;
  adress: string;
  postnr: string;
  ort: string;
  tidpunkt: number;   // ms timestamp, start
  sluttid: number;    // ms timestamp, end
  maklare: string;
  kalla: string;      // Hur fick du mötet?
  anteckningar: string;
  status: IntagsmoteStatus;
  vardering: number | null;
  varderingKommentar: string;
  // Säljlead-fält (valfria – fångas vid intaget för att kunna matcha mot köpare)
  boarea?: number | null;        // kvm
  antalRum?: number | null;
  vaning?: string | null;        // t.ex. "3 av 5" (lägenhet)
  boddSedan?: string | null;     // hur länge de bott där, t.ex. "2015" eller "8 år"
  inkopsPris?: number | null;    // vad de köpte bostaden för
  syfte?: IntagSyfte | null;     // situation vid intaget
  onskatPris?: number | null;    // vad säljaren vill ha (fylls i EFTER mötet)
  saljTidpunkt?: SaljTidpunkt | null;  // när de vill sälja (fylls i EFTER mötet)
  saljVillkor?: string | null;   // t.ex. "säljer vid 2 200 000" (EFTER mötet)
  // Skick & beskrivning (fylls i EFTER mötet)
  beskrivning?: string | null;   // mäklarens fria text, t.ex. "ljus 2:a, köket renoverat, söderläge"
  skick?: BostadSkick | null;
  antalSovrum?: number | null;
  antalBadrum?: number | null;
  kokRenoverat?: boolean;
  badrumRenoverat?: boolean;
  egenTvattstuga?: boolean;
  takRenoverat?: boolean;
  objektSlug: string | null;  // fylls i när bostad skapas
  objektTyp: string | null;   // "Bostadsrätt" | "Villa" | etc, sätts vid skapande av bostad
  skapad: number;
};

export type BostadSkick =
  | "Nyskick"
  | "Bra skick"
  | "Normalt"
  | "Renoveringsbehov";

export const BOSTAD_SKICK: BostadSkick[] = [
  "Nyskick",
  "Bra skick",
  "Normalt",
  "Renoveringsbehov",
];

export type IntagSyfte =
  | "Sälja nu"
  | "Värdering (t.ex. till banken)"
  | "Endast intresserad av värdet";

export const INTAG_SYFTEN: IntagSyfte[] = [
  "Sälja nu",
  "Värdering (t.ex. till banken)",
  "Endast intresserad av värdet",
];

export type SaljTidpunkt =
  | "Nu"
  | "Inom 3 månader"
  | "Inom 6 månader"
  | "Inom 1 år"
  | "Längre fram"
  | "Osäker";

export const SALJTIDPUNKTER: SaljTidpunkt[] = [
  "Nu",
  "Inom 3 månader",
  "Inom 6 månader",
  "Inom 1 år",
  "Längre fram",
  "Osäker",
];

const KEY = "hajpex.intagsmoten.v1";

function load(): Intagsmote[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Intagsmote[];
  } catch {
    return [];
  }
}

function save(items: Intagsmote[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  schedulePush(KEY);
}

export function listIntagsmoten(): Intagsmote[] {
  return load().sort((a, b) => b.tidpunkt - a.tidpunkt);
}

export function listIntagsmotenForKontakt(kontaktId: string): Intagsmote[] {
  return load()
    .filter((m) => m.kontaktId === kontaktId)
    .sort((a, b) => b.tidpunkt - a.tidpunkt);
}

export function getIntagsmote(id: string): Intagsmote | undefined {
  return load().find((m) => m.id === id);
}

export function saveIntagsmote(data: Omit<Intagsmote, "id" | "skapad">): Intagsmote {
  const all = load();
  const item: Intagsmote = { ...data, id: crypto.randomUUID(), skapad: Date.now() };
  save([...all, item]);
  return item;
}

export function updateIntagsmote(id: string, patch: Partial<Intagsmote>): void {
  const all = load();
  save(all.map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function deleteIntagsmote(id: string): void {
  save(load().filter((m) => m.id !== id));
}

// ── ICS (Outlook/Kalender) export ─────────────────────────────────────────────

function icsDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
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

export function exportToICS(mote: Intagsmote, kontakt: Kontakt): void {
  const summary = `Intagsmöte – ${mote.adress}`;
  const description = [
    `Kontakt: ${kontakt.fornamn} ${kontakt.efternamn}`,
    `Tel: ${kontakt.telefon || "–"}`,
    `E-post: ${kontakt.epost || "–"}`,
    mote.anteckningar ? `Anteckningar: ${mote.anteckningar}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HajpexCRM//Hajpex//SE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${mote.id}@hajpexcrm`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(mote.tidpunkt)}`,
    `DTEND:${icsDate(mote.sluttid)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${mote.adress}${mote.postnr ? ", " + mote.postnr : ""}${mote.ort ? " " + mote.ort : ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `intagsmote-${mote.adress.replace(/\s+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Källalternativ ─────────────────────────────────────────────────────────────

export const KALLOR = [
  "Tidigare köpare",
  "Tidigare säljare",
  "Granne till såldt objekt",
  "Rekommendation",
  "Social media",
  "Hemnet",
  "Annons",
  "Inkommande samtal",
  "Dörrknackning",
  "Övrigt",
] as const;
