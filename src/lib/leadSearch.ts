import type { Intagsmote } from "./intagsmoteStore";

/**
 * Smart fritextsökning för säljleads. Tolkar en naturlig fråga som
 * "2a trångsund 2mil" → { rum: 2, ort: ["trångsund"], pris: 2_000_000 }
 * och matchar den mot intagsmöten med färgkodning på prisnärhet.
 */

export type ParsedLeadQuery = {
  rum: number | null;
  pris: number | null;
  ord: string[];        // kvarvarande ord → ort/adress
  raw: string;
};

const ROOM_WORDS: Record<string, number> = {
  etta: 1, tvåa: 2, trea: 3, fyra: 4, femma: 5, sexa: 6,
  tvaa: 2,
};

/** Tolka ett pristoken som "2mil", "2,5 mkr", "2500000", "850k". */
function parsePris(tokens: string[]): number | null {
  const joined = tokens.join(" ").toLowerCase();
  // Miljonsuffix: "2 mil", "1,8mil", "2,5 miljoner", "2 mkr", "1,8 msek", "3m"
  let m = joined.match(/(\d+(?:[.,]\d+)?)\s*(?:msek|mnkr|mkr|miljoner|miljon|milj|mil|m)\b/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1_000_000);
  // Tusensuffix: "850k", "850 tkr"
  m = joined.match(/(\d+(?:[.,]\d+)?)\s*(?:tkr|k)\b/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1_000);
  // Grupperade tusental: "1,800,000", "1 800 000" (ev. "kr"/"sek")
  m = joined.match(/\b(\d{1,3}(?:[ ,]\d{3})+)\s*(?:kr|sek|kronor)?\b/);
  if (m) { const n = Number(m[1].replace(/[ ,]/g, "")); if (n >= 100_000) return n; }
  // Rena stora tal: "1800000", "1800000 kr"
  m = joined.match(/\b(\d{6,})\s*(?:kr|sek|kronor)?\b/);
  if (m) return Number(m[1]);
  // Ensamt decimaltal tolkas som miljoner: "1,8", "2.5"
  m = joined.match(/(?:^|\s)(\d{1,2}[.,]\d{1,2})(?:\s|$)/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1_000_000);
  return null;
}

/** Tolka antal rum: "2a", "2:a", "2 rum", "2rok", "trea". */
function parseRum(tokens: string[]): number | null {
  for (const t of tokens) {
    const w = t.toLowerCase();
    if (ROOM_WORDS[w]) return ROOM_WORDS[w];
    // "2a" / "2:a" / "2or"
    const m = w.match(/^(\d)(?::?a|or)$/);
    if (m) return Number(m[1]);
    // "2rum" / "2rok"
    const m2 = w.match(/^(\d)(?:rum|rok|r)$/);
    if (m2) return Number(m2[1]);
  }
  // "2 rum" / "2 rok" (rum som separat token)
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^\d$/.test(tokens[i]) && /^(rum|rok|r)$/i.test(tokens[i + 1])) {
      return Number(tokens[i]);
    }
  }
  return null;
}

export function parseLeadQuery(raw: string): ParsedLeadQuery {
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pris = parsePris(tokens);
  const rum = parseRum(tokens);

  // Fyllnadsord som inte är ort/adress — ignoreras i sökningen.
  const STOPP = new Set([
    "max", "maximalt", "högst", "hogst", "runt", "ca", "cirka", "omkring",
    "under", "över", "over", "upp", "till", "för", "for", "pris", "kr",
    "kronor", "i", "en", "ett", "med", "på", "pa", "som", "har", "nån",
    "någon", "nagon", "rum", "rok", "rok,",
  ]);

  // Ord som varken är pris-, rums- eller enhetsord → ort/adress
  const ord = tokens.filter((t) => {
    if (STOPP.has(t)) return false;
    if (ROOM_WORDS[t]) return false;
    if (/\d/.test(t)) return false; // allt med siffror = rum/pris, inte ort
    if (/^(kr|sek|kronor|mil|milj|miljon|miljoner|mkr|mnkr|msek|tkr|k|m)$/i.test(t)) return false;
    return true;
  });

  return { rum, pris, ord, raw: raw.trim() };
}

export type LeadColor = "green" | "orange" | "red" | "none";

export type LeadMatch = {
  mote: Intagsmote;
  color: LeadColor;
  priceDiff: number | null;  // relativ skillnad mot sökt pris
  score: number;             // högre = bättre träff
  ortMatch: boolean;
  rumMatch: boolean | null;  // null = rum ej angivet i sökningen
  distanceKm: number | null; // avstånd till sökt område (null om ej närhetssökning)
};

// Ungefärliga koordinater för söderort-områdena (lat, lng)
const OMRADE_COORD: Record<string, { lat: number; lng: number }> = {
  "johanneshov":      { lat: 59.295, lng: 18.085 },
  "globen":           { lat: 59.293, lng: 18.083 },
  "gullmarsplan":     { lat: 59.298, lng: 18.080 },
  "hammarby sjöstad": { lat: 59.305, lng: 18.095 },
  "hammarby":         { lat: 59.305, lng: 18.095 },
  "enskede":          { lat: 59.282, lng: 18.078 },
  "gubbängen":        { lat: 59.262, lng: 18.080 },
  "bagarmossen":      { lat: 59.273, lng: 18.130 },
  "sköndal":          { lat: 59.252, lng: 18.110 },
  "farsta":           { lat: 59.243, lng: 18.095 },
  "trångsund":        { lat: 59.230, lng: 18.140 },
  "skogås":           { lat: 59.223, lng: 18.155 },
};

const MAX_NARHET_KM = 12;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Hitta vilket känt område som söks (stödjer flerordsnamn som "hammarby sjöstad"). */
function findSearchedArea(ord: string[]): { name: string; coord: { lat: number; lng: number } } | null {
  const joined = ord.join(" ");
  // Längsta namnet först så "hammarby sjöstad" matchar före "hammarby"
  const names = Object.keys(OMRADE_COORD).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (joined.includes(name)) return { name, coord: OMRADE_COORD[name] };
  }
  return null;
}

function leadCoord(m: Intagsmote): { lat: number; lng: number } | null {
  const ort = (m.ort || "").toLowerCase().trim();
  return OMRADE_COORD[ort] ?? null;
}


/** Pris säljaren förväntar sig – önskat pris, annars värdering. */
function leadPris(m: Intagsmote): number | null {
  return m.onskatPris ?? m.vardering ?? null;
}

function prisFarg(sellerPris: number | null, target: number | null): { color: LeadColor; diff: number | null } {
  if (target == null) return { color: "none", diff: null };
  if (sellerPris == null) return { color: "none", diff: null };
  const diff = (sellerPris - target) / target;
  // Under eller i nivå med budget → grönt. Nästan (≤8% över) → orange. Annars rött.
  if (diff <= 0.0) return { color: "green", diff };
  if (diff <= 0.08) return { color: "orange", diff };
  return { color: "red", diff };
}

/**
 * Matcha och ranka intagsmöten mot en fråga.
 * Returnerar bara träffar som matchar angivna hårda kriterier (ort/rum) om de anges,
 * sorterade med bästa pristräff först.
 */
export function searchLeads(moten: Intagsmote[], raw: string): { parsed: ParsedLeadQuery; matches: LeadMatch[]; area: string | null } {
  const parsed = parseLeadQuery(raw);
  const hasQuery = parsed.rum != null || parsed.pris != null || parsed.ord.length > 0;
  const searchedArea = findSearchedArea(parsed.ord);

  const matches: LeadMatch[] = moten.map((m) => {
    const hay = `${m.adress} ${m.ort} ${m.postnr}`.toLowerCase();
    const ortMatch = parsed.ord.length === 0 || parsed.ord.every((o) => hay.includes(o));
    const rumMatch = parsed.rum == null ? null : m.antalRum != null && m.antalRum === parsed.rum;
    const { color, diff } = prisFarg(leadPris(m), parsed.pris);

    // Avstånd till sökt område (om vi känner både sökt område och objektets ort)
    let distanceKm: number | null = null;
    if (searchedArea) {
      const lc = leadCoord(m);
      distanceKm = lc ? haversineKm(searchedArea.coord, lc) : null;
    }

    // Poäng: närhet/ortträff väger tungt, därefter rätt rum, därefter prisfärg.
    let score = 0;
    if (searchedArea && distanceKm != null) score += Math.max(0, 120 - distanceKm * 10);
    else if (ortMatch && parsed.ord.length > 0) score += 100;
    if (rumMatch) score += 50;
    if (color === "green") score += 30;
    else if (color === "orange") score += 15;
    else if (color === "red") score += 2;
    if (diff != null) score += Math.max(0, 10 - Math.abs(diff) * 50);

    return { mote: m, color, priceDiff: diff, score, ortMatch, rumMatch, distanceKm };
  });

  // Filtrera: rum/pris som förut; ort via närhet om känt område, annars via text.
  const filtered = matches.filter((x) => {
    if (!hasQuery) return true;
    if (searchedArea) {
      if (x.distanceKm == null || x.distanceKm > MAX_NARHET_KM) return false;
    } else if (parsed.ord.length > 0 && !x.ortMatch) {
      return false;
    }
    if (parsed.rum != null && x.rumMatch === false) return false;
    return true;
  });

  // Närhetssökning: närmast först. Annars efter poäng.
  if (searchedArea) {
    filtered.sort((a, b) =>
      (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || b.score - a.score || b.mote.tidpunkt - a.mote.tidpunkt
    );
  } else {
    filtered.sort((a, b) => b.score - a.score || b.mote.tidpunkt - a.mote.tidpunkt);
  }
  return { parsed, matches: filtered, area: searchedArea?.name ?? null };
}

/** Avståndsgrupp för UI-rubriker. */
export type NarhetBucket = "iomradet" | "narliggande" | "lite_langre" | "langre";

export function narhetBucket(distanceKm: number | null): NarhetBucket | null {
  if (distanceKm == null) return null;
  if (distanceKm <= 1.3) return "iomradet";
  if (distanceKm <= 3.5) return "narliggande";
  if (distanceKm <= 7) return "lite_langre";
  return "langre";
}

export const NARHET_LABEL: Record<NarhetBucket, string> = {
  iomradet: "I området",
  narliggande: "Närliggande (ca 2–3 km)",
  lite_langre: "Lite längre bort",
  langre: "Längre bort",
};
