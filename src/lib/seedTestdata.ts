import { saveKontakt, deleteKontakt } from "./kontaktStore";
import { saveIntagsmote, deleteIntagsmote, type IntagSyfte, type SaljTidpunkt } from "./intagsmoteStore";

/**
 * Genererar fejkade intagsmöten (med tillhörande kontakter) för att kunna
 * testa Säljleads-sökningen utan att skapa 100 intag för hand. Allt som skapas
 * taggas i en egen nyckel så att det kan rensas exakt — din riktiga data rörs ej.
 */

const TAG_KEY = "hajpex.testdata.v1";

type TestdataIds = { kontaktIds: string[]; intagIds: string[] };

function readTags(): TestdataIds {
  try {
    const raw = localStorage.getItem(TAG_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && Array.isArray(p.kontaktIds) && Array.isArray(p.intagIds)) return p;
  } catch { /* ignore */ }
  return { kontaktIds: [], intagIds: [] };
}
function writeTags(t: TestdataIds) {
  try { localStorage.setItem(TAG_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

export function countTestdata(): number {
  return readTags().intagIds.length;
}

// Område → postnr + ungefärligt kr/kvm (söderort Stockholm)
const OMRADEN: { ort: string; postnr: string; krKvm: number }[] = [
  { ort: "Johanneshov",       postnr: "121 31", krKvm: 92000 },
  { ort: "Globen",            postnr: "121 26", krKvm: 95000 },
  { ort: "Gullmarsplan",      postnr: "120 40", krKvm: 90000 },
  { ort: "Hammarby Sjöstad",  postnr: "120 66", krKvm: 98000 },
  { ort: "Enskede",           postnr: "122 47", krKvm: 72000 },
  { ort: "Gubbängen",         postnr: "122 63", krKvm: 63000 },
  { ort: "Bagarmossen",       postnr: "128 64", krKvm: 66000 },
  { ort: "Sköndal",           postnr: "128 66", krKvm: 64000 },
  { ort: "Farsta",            postnr: "123 47", krKvm: 60000 },
  { ort: "Trångsund",         postnr: "142 60", krKvm: 48000 },
  { ort: "Skogås",            postnr: "142 32", krKvm: 46000 },
];

const GATOR = [
  "Lingvägen", "Nynäsvägen", "Sofielundsvägen", "Palmfeltsvägen", "Hammarbyterrassen",
  "Ljusnevägen", "Pepparvägen", "Larsbodavägen", "Munstycksvägen", "Perstorpsvägen",
  "Bjursätragatan", "Örbyvägen", "Grycksbovägen", "Sköndalsvägen", "Skebokvarnsvägen",
  "Herrhagsvägen", "Trångsundsvägen", "Länna allé", "Stortorpsvägen", "Bagarmossens torg",
  "Enskedevägen", "Gamla Tyresövägen", "Sofielundsplan", "Kvicksundsvägen", "Byälvsvägen",
];

const FORNAMN = [
  "Erik", "Anna", "Johan", "Maria", "Anders", "Eva", "Per", "Karin", "Lars", "Sara",
  "Mikael", "Lena", "Daniel", "Emma", "Fredrik", "Jenny", "Mattias", "Sofia", "Niklas",
  "Linda", "Oscar", "Ida", "Henrik", "Elin", "Jonas", "Hanna", "Andreas", "Josefin",
  "Robert", "Camilla", "Patrik", "Malin", "Stefan", "Åsa", "Thomas", "Frida",
];
const EFTERNAMN = [
  "Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson",
  "Persson", "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Jansson", "Hansson",
  "Bengtsson", "Lindberg", "Lindqvist", "Lindström", "Berg", "Holm", "Sandberg",
  "Nyström", "Ek", "Lund", "Berglund", "Forsberg", "Sjöberg", "Wallin", "Ström",
];

const SYFTEN: IntagSyfte[] = ["Sälja nu", "Värdering (t.ex. till banken)", "Endast intresserad av värdet"];
const TIDPUNKTER: SaljTidpunkt[] = ["Nu", "Inom 3 månader", "Inom 6 månader", "Inom 1 år", "Längre fram", "Osäker"];
const STATUSAR = ["Genomfört", "Vunnen", "Planerat"] as const;

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function roundTo(n: number, step: number) { return Math.round(n / step) * step; }

/** Skapa n fejkade intag. Returnerar antal skapade. */
export function seedFakeIntag(n = 100): number {
  const tags = readTags();
  for (let i = 0; i < n; i++) {
    const omr = pick(OMRADEN);
    const fornamn = pick(FORNAMN);
    const efternamn = pick(EFTERNAMN);
    const rum = randInt(1, 5);
    // Boarea korrelerad med antal rum
    const boarea = roundTo(rum * randInt(20, 28) + randInt(-6, 8), 1);
    const krKvm = omr.krKvm * (0.9 + Math.random() * 0.2);
    const vardering = roundTo(boarea * krKvm, 25000);
    const syfte = pick(SYFTEN);
    // Önskat pris fylls bara i efter mötet, och mest för riktiga säljare
    const harOnskat = syfte === "Sälja nu" ? Math.random() < 0.9 : Math.random() < 0.4;
    const onskatPris = harOnskat ? roundTo(vardering * (1 + Math.random() * 0.12), 25000) : null;
    const tel = `07${randInt(0, 9)}-${randInt(100, 999)} ${randInt(10, 99)} ${randInt(10, 99)}`;
    const gata = pick(GATOR);
    const nr = randInt(1, 89);
    const dagarSedan = randInt(1, 120);
    const tidpunkt = Date.now() - dagarSedan * 86_400_000;

    const kontakt = saveKontakt({
      fornamn, efternamn,
      telefon: tel,
      epost: `${fornamn}.${efternamn}@exempel.se`.toLowerCase().replace(/å|ä/g, "a").replace(/ö/g, "o"),
      adress: `${gata} ${nr}`,
      ort: omr.ort,
      budgetMin: "", budgetMax: "",
      sokTyper: [], sokOmraden: [],
      anteckningar: "[TESTDATA] Genererat intag för demo/sökning.",
      gdprGodkant: null,
      objektKopplingar: [],
      aktiviteter: [],
    });

    const intag = saveIntagsmote({
      kontaktId: kontakt.id,
      adress: `${gata} ${nr}`,
      postnr: omr.postnr,
      ort: omr.ort,
      tidpunkt,
      sluttid: tidpunkt + 3_600_000,
      maklare: "Max Stendahl",
      kalla: "Testdata",
      anteckningar: "",
      status: pick(STATUSAR),
      vardering,
      varderingKommentar: "",
      boarea,
      antalRum: rum,
      vaning: Math.random() < 0.6 ? `${randInt(1, 6)} av ${randInt(6, 8)}` : null,
      boddSedan: String(randInt(2005, 2022)),
      inkopsPris: roundTo(vardering * (0.6 + Math.random() * 0.25), 25000),
      syfte,
      onskatPris,
      saljTidpunkt: syfte === "Sälja nu" ? pick(TIDPUNKTER.slice(0, 3)) : pick(TIDPUNKTER),
      saljVillkor: onskatPris ? `Säljer vid ${onskatPris.toLocaleString("sv-SE")} kr` : null,
      objektSlug: null,
      objektTyp: null,
    });

    tags.kontaktIds.push(kontakt.id);
    tags.intagIds.push(intag.id);
  }
  writeTags(tags);
  return n;
}

/** Rensa allt genererat testdata (intag + kontakter). Returnerar antal borttagna intag. */
export function clearFakeIntag(): number {
  const tags = readTags();
  const n = tags.intagIds.length;
  tags.intagIds.forEach((id) => deleteIntagsmote(id));
  tags.kontaktIds.forEach((id) => deleteKontakt(id));
  writeTags({ kontaktIds: [], intagIds: [] });
  return n;
}
