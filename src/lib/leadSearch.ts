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
  const joined = tokens.join(" ");
  // t.ex. "2 mil", "2,5mil", "2.5 miljoner", "2 mkr", "3m"
  const milj = joined.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|milj|miljoner|mkr|mnkr|m)\b/i);
  if (milj) return Math.round(parseFloat(milj[1].replace(",", ".")) * 1_000_000);
  // t.ex. "850k", "850 tkr"
  const tusen = joined.match(/(\d+(?:[.,]\d+)?)\s*(?:k|tkr)\b/i);
  if (tusen) return Math.round(parseFloat(tusen[1].replace(",", ".")) * 1_000);
  // Rena stora tal: "2500000", "2 500 000"
  const spaced = joined.match(/\b(\d[\d\s]{5,})\b/);
  if (spaced) {
    const n = Number(spaced[1].replace(/\s/g, ""));
    if (n >= 100_000) return n;
  }
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

  // Ord som varken är pris- eller rumstermer → ort/adress
  const ord = tokens.filter((t) => {
    if (STOPP.has(t)) return false;
    if (ROOM_WORDS[t]) return false;
    if (/^(\d)(?::?a|or|rum|rok|r)$/.test(t)) return false;
    if (/^\d+(?:[.,]\d+)?(?:mil|milj|miljoner|mkr|mnkr|m|k|tkr)$/i.test(t)) return false;
    if (/^(rum|rok|mil|mkr|miljoner|milj)$/i.test(t)) return false;
    if (/^\d[\d\s]*$/.test(t)) return false; // rena siffror (pris)
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
};

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
export function searchLeads(moten: Intagsmote[], raw: string): { parsed: ParsedLeadQuery; matches: LeadMatch[] } {
  const parsed = parseLeadQuery(raw);
  const hasQuery = parsed.rum != null || parsed.pris != null || parsed.ord.length > 0;

  const matches: LeadMatch[] = moten.map((m) => {
    const hay = `${m.adress} ${m.ort} ${m.postnr}`.toLowerCase();
    const ortMatch = parsed.ord.length === 0 || parsed.ord.every((o) => hay.includes(o));
    const rumMatch = parsed.rum == null ? null : m.antalRum != null && m.antalRum === parsed.rum;
    const { color, diff } = prisFarg(leadPris(m), parsed.pris);

    // Poäng: ortträff väger tungt, därefter rätt rum, därefter prisfärg.
    let score = 0;
    if (ortMatch && parsed.ord.length > 0) score += 100;
    if (rumMatch) score += 50;
    if (color === "green") score += 30;
    else if (color === "orange") score += 15;
    else if (color === "red") score += 2;
    // Närmare pris → lite högre
    if (diff != null) score += Math.max(0, 10 - Math.abs(diff) * 50);

    return { mote: m, color, priceDiff: diff, score, ortMatch, rumMatch };
  });

  // Filtrera bort poster som inte matchar angiven ort, och rum-mismatch om rum angavs.
  const filtered = matches.filter((x) => {
    if (!hasQuery) return true;
    if (parsed.ord.length > 0 && !x.ortMatch) return false;
    if (parsed.rum != null && x.rumMatch === false) return false;
    return true;
  });

  filtered.sort((a, b) => b.score - a.score || b.mote.tidpunkt - a.mote.tidpunkt);
  return { parsed, matches: filtered };
}
