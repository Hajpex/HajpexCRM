import { OBJEKT } from "../data/objekt";
import { listKontakter, saveKontakt, addObjektKoppling, findByTelefon } from "./kontaktStore";

const SEED_KEY = "hajpex.demo.seeded.v3";

function slugify(addr: string): string {
  return addr.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function rndDigits(seed: number, n: number): string {
  let s = "";
  let h = seed;
  for (let i = 0; i < n; i++) { h = (h * 1664525 + 1013904223) >>> 0; s += h % 10; }
  return s;
}

const FORNAMN_M = ["Anders", "Björn", "Daniel", "Erik", "Fredrik", "Gustav", "Henrik", "Johan", "Karl", "Lars", "Markus", "Mikael", "Niklas", "Oskar", "Per", "Robert", "Stefan", "Thomas", "Viktor", "Patrik"];
const FORNAMN_F = ["Anna", "Britta", "Camilla", "Emma", "Elin", "Frida", "Helena", "Ida", "Johanna", "Julia", "Karin", "Linda", "Maria", "Maja", "Nina", "Sara", "Sofia", "Susanne", "Theresa", "Åsa"];
const EFTERNAMN = ["Andersson", "Bergström", "Björk", "Dahl", "Eklund", "Eriksson", "Gustafsson", "Hansson", "Johansson", "Karlsson", "Larsson", "Lindberg", "Lindgren", "Lindqvist", "Lundgren", "Magnusson", "Nilsson", "Olsson", "Persson", "Svensson", "Strand", "Borg", "Lund", "Holm", "Norling", "Sten", "Torp"];
const ORTER = ["Stockholm", "Solna", "Nacka", "Huddinge", "Sollentuna", "Täby", "Järfälla", "Lidingö", "Sundbyberg", "Tyresö"];
const GATOR = ["Storgatan", "Parkvägen", "Bergsgatan", "Kyrkogatan", "Lillgatan", "Skogsvägen", "Ängsgatan", "Björkvägen", "Granvägen", "Tallbacken"];

export type DemoPerson = {
  fornamn: string;
  efternamn: string;
  namn: string;
  telefon: string;
  email: string;
  pnr: string;
  adress: string;
};

export function genPerson(slug: string, idx: number): DemoPerson {
  const h = hash(slug + ":" + idx);
  const isFemale = (h >> 3) % 2 === 0;
  const fornamn = pick(isFemale ? FORNAMN_F : FORNAMN_M, h >> 5);
  const efternamn = pick(EFTERNAMN, (h >> 9) ^ 0xabcd);
  const ort = pick(ORTER, h >> 13);
  const gata = pick(GATOR, h >> 17);
  const gatnr = 1 + ((h >> 21) % 80);
  const postnr = `${100 + ((h >> 7) % 900)} ${rndDigits(h >> 15, 2)}`;
  const telPrefix = pick(["070", "072", "073", "076"], h >> 11);
  const tel = `${telPrefix}-${rndDigits(h >> 4, 3)} ${rndDigits(h >> 7, 2)} ${rndDigits(h >> 10, 2)}`;
  const year = 1958 + ((h >> 6) % 40);
  const month = String(1 + ((h >> 14) % 12)).padStart(2, "0");
  const day = String(1 + ((h >> 18) % 28)).padStart(2, "0");
  const pnrSuffix = rndDigits(h >> 20, 4);
  const pnr = `${year}${month}${day}-${pnrSuffix}`;
  const email = `${fornamn.toLowerCase().replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")}.${efternamn.toLowerCase().replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")}@gmail.com`;
  const adress = `${gata} ${gatnr}, ${postnr} ${ort}`;
  return { fornamn, efternamn, namn: `${fornamn} ${efternamn}`, telefon: tel, email, pnr, adress };
}

export function getDemoSaljare(slug: string): DemoPerson[] {
  const o = OBJEKT.find((obj) => slugify(obj.adress) === slug);
  if (!o) return [genPerson(slug, 0)];
  const parts = o.saljare.trim().split(" ");
  const fornamn = parts[0] ?? "Säljare";
  const efternamn = parts.slice(1).join(" ") || "Okänd";
  const h = hash(slug + "saljare");
  const telPrefix = pick(["070", "072", "073", "076"], h);
  const tel = `${telPrefix}-${rndDigits(h >> 4, 3)} ${rndDigits(h >> 7, 2)} ${rndDigits(h >> 10, 2)}`;
  const year = 1968 + ((h >> 6) % 30);
  const month = String(1 + ((h >> 14) % 12)).padStart(2, "0");
  const day = String(1 + ((h >> 18) % 28)).padStart(2, "0");
  const pnrSuffix = rndDigits(h >> 20, 4);
  const pnr = `${year}${month}${day}-${pnrSuffix}`;
  const emailName = `${fornamn}.${efternamn}`.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/\s+/g, ".");
  const gata = pick(GATOR, h >> 17);
  const gatnr = 1 + ((h >> 21) % 80);
  const ort = pick(ORTER, h >> 13);
  const postnr = o.postnr || `${100 + ((h >> 7) % 900)} ${rndDigits(h >> 15, 2)}`;
  const saljare: DemoPerson = {
    fornamn, efternamn, namn: `${fornamn} ${efternamn}`,
    telefon: tel, email: `${emailName}@gmail.com`, pnr,
    adress: `${gata} ${gatnr}, ${postnr} ${ort}`,
  };
  const h2 = hash(slug + "medsaljare");
  if ((h2 % 3) === 0) {
    const p2 = genPerson(slug, 99);
    return [saljare, p2];
  }
  return [saljare];
}

export function getDemoSpekulanter(slug: string): DemoPerson[] {
  const h = hash(slug);
  const count = 3 + (h % 6);
  return Array.from({ length: count }, (_, i) => genPerson(slug, i));
}

export function seedDemoKontakter() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_KEY)) return;

  for (const obj of OBJEKT) {
    const slug = slugify(obj.adress);

    const saljare = getDemoSaljare(slug);
    for (const s of saljare) {
      let k = findByTelefon(s.telefon);
      if (!k) {
        k = saveKontakt({
          fornamn: s.fornamn, efternamn: s.efternamn,
          telefon: s.telefon, epost: s.email,
          adress: s.adress, ort: "",
          budgetMin: "", budgetMax: "", sokTyper: [], sokOmraden: [],
          anteckningar: "", gdprGodkant: null,
          objektKopplingar: [], aktiviteter: [],
        });
      }
      addObjektKoppling(k.id, { slug, relation: "säljare", addedAt: Date.now() - 86400000 * 30, anteckning: "" });
    }

    const spekulanter = getDemoSpekulanter(slug);
    for (const sp of spekulanter) {
      let k = findByTelefon(sp.telefon);
      if (!k) {
        k = saveKontakt({
          fornamn: sp.fornamn, efternamn: sp.efternamn,
          telefon: sp.telefon, epost: sp.email,
          adress: sp.adress, ort: "",
          budgetMin: "", budgetMax: "", sokTyper: [], sokOmraden: [],
          anteckningar: "", gdprGodkant: null,
          objektKopplingar: [], aktiviteter: [],
        });
      }
      addObjektKoppling(k.id, { slug, relation: "spekulant", addedAt: Date.now() - 86400000 * (1 + (hash(sp.namn + slug) % 20)), anteckning: "" });
    }
  }

  window.localStorage.setItem(SEED_KEY, "1");
}

export function clearDemoSeed() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SEED_KEY);
}
