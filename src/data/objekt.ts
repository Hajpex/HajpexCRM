export type Status = "Såld" | "Under intag" | "Till salu" | "Redo (Kommande)" | "Inget uppdrag" | "Vilande" | "Intaget" | "Arkiverad";
export type Typ = "Bostadsrätt" | "Villa" | "Radhus" | "Fritidshus" | "Tomt" | "Gård" | "Parhus" | "Kedjehus" | "Ägarlägenhet";

export type Objekt = {
  adress: string;
  postnr: string;
  stad: string;
  typ: Typ;
  rum: number;
  boarea: number;
  pris: number;
  saljare: string;
  ansvarig: string;
  status: Status;
  spek: [number, number, number, number];
  kalla: string;
  bild?: string;
};

export const OBJEKT: Objekt[] = [
  { adress: "Åkervägen 28", postnr: "14266", stad: "Stenkulla", typ: "Bostadsrätt", rum: 4, boarea: 99, pris: 4175000, saljare: "Linnea Vinter", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Hemnet kontaktförfrågan" },
  { adress: "Åkervägen 15", postnr: "14266", stad: "Stenkulla", typ: "Bostadsrätt", rum: 4, boarea: 90, pris: 3550000, saljare: "Erik Lindqvist", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Rekommendation" },
  { adress: "Kvarngården 3", postnr: "14235", stad: "Granvik", typ: "Bostadsrätt", rum: 0, boarea: 0, pris: 3200000, saljare: "Lisa Sandberg", ansvarig: "Erik Lindqvist", status: "Under intag", spek: [0,0,0,0], kalla: "Tidigare köpare" },
  { adress: "Ängsstigen 44", postnr: "14241", stad: "Granvik", typ: "Bostadsrätt", rum: 3, boarea: 76.8, pris: 2900000, saljare: "Klara Nyqvist", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Rekommendation" },
  { adress: "Lilla Åsen 3", postnr: "14261", stad: "Stenkulla", typ: "Bostadsrätt", rum: 4, boarea: 86.5, pris: 2800000, saljare: "Frida Holm", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Kundkontakt" },
  { adress: "Kyrkogårdsvägen 45", postnr: "12138", stad: "Solvik", typ: "Bostadsrätt", rum: 2, boarea: 37, pris: 2775000, saljare: "Oskar Berg", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Kundkontakt" },
  { adress: "Skogsvägen 55", postnr: "14262", stad: "Stenkulla", typ: "Bostadsrätt", rum: 4, boarea: 76, pris: 2500000, saljare: "Theo Lind", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Kundkontakt" },
  { adress: "Lilla Åsen 22", postnr: "14261", stad: "Stenkulla", typ: "Bostadsrätt", rum: 3, boarea: 70.5, pris: 2450000, saljare: "Maja Lundin", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Kundkontakt" },
  { adress: "Tallbacken 7", postnr: "14261", stad: "Stenkulla", typ: "Bostadsrätt", rum: 2, boarea: 57.2, pris: 2300000, saljare: "Julia Kvarn", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Kundkontakt" },
  { adress: "Stenkullatorget 1", postnr: "14260", stad: "Stenkulla", typ: "Bostadsrätt", rum: 1.5, boarea: 44, pris: 2000000, saljare: "Markus Dahl", ansvarig: "Erik Lindqvist", status: "Redo (Kommande)", spek: [4,0,0,4], kalla: "Kundkontakt" },
  { adress: "Bergssäter 14", postnr: "14232", stad: "Granvik", typ: "Bostadsrätt", rum: 3, boarea: 79, pris: 1995000, saljare: "Nora Sten", ansvarig: "Erik Lindqvist", status: "Inget uppdrag", spek: [3,0,2,35], kalla: "—" },
  { adress: "Lilla Åsen 19", postnr: "14261", stad: "Stenkulla", typ: "Bostadsrätt", rum: 3, boarea: 68, pris: 1995000, saljare: "Elsa Torp", ansvarig: "Erik Lindqvist", status: "Inget uppdrag", spek: [1,0,0,8], kalla: "Tidigare köpare" },
  { adress: "Tallbacken 7", postnr: "14261", stad: "Stenkulla", typ: "Bostadsrätt", rum: 1, boarea: 40, pris: 1895000, saljare: "Ludvig Moss", ansvarig: "Erik Lindqvist", status: "Inget uppdrag", spek: [1,1,2,14], kalla: "Fria värderingar" },
  { adress: "Bergssäter 16", postnr: "14232", stad: "Granvik", typ: "Bostadsrätt", rum: 3, boarea: 75, pris: 1795000, saljare: "Filip Norling", ansvarig: "Erik Lindqvist", status: "Till salu", spek: [1,6,0,14], kalla: "Övrig egenskapad" },
  { adress: "Lilla Åsen 30", postnr: "14261", stad: "Stenkulla", typ: "Bostadsrätt", rum: 1, boarea: 30, pris: 1750000, saljare: "Axel Sten", ansvarig: "Erik Lindqvist", status: "Vilande", spek: [2,0,1,3], kalla: "Kundkontakt" },
  { adress: "Skogsvägen 60", postnr: "14262", stad: "Stenkulla", typ: "Bostadsrätt", rum: 2, boarea: 47, pris: 1750000, saljare: "Ingrid Sol", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "Kundkontakt" },
  { adress: "Kvarngården 8", postnr: "14235", stad: "Granvik", typ: "Bostadsrätt", rum: 0, boarea: 83.4, pris: 1700000, saljare: "Nora Sten", ansvarig: "Erik Lindqvist", status: "Såld", spek: [0,0,0,0], kalla: "—" },
  { adress: "Södragården 9", postnr: "14252", stad: "Granvik", typ: "Villa", rum: 4, boarea: 69, pris: 4975000, saljare: "Anton Eklund", ansvarig: "Erik Lindqvist", status: "Under intag", spek: [2,1,0,0], kalla: "Tidigare köpare" },
];

export function slugifyAddr(addr: string): string {
  return addr.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}