import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

// ── AI-leverantör: Anthropic Claude (vision) ───────────────────────────────────
// Servernyckel ANTHROPIC_API_KEY krävs (ligger i .env, committas ALDRIG).
// Modell: Haiku 4.5 — billig, snabb, kan läsa bilder. Byt MODEL för mer kraft.
const MODEL = "claude-haiku-4-5";

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY saknas på servern. Lägg till den i .env.");
  return new Anthropic({ apiKey: key });
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };

// Anropa Claude och returnera ren text. Översätter fel till svenska.
async function callClaude(opts: {
  system?: string;
  content: string | ContentBlock[];
  maxTokens: number;
}): Promise<string> {
  const client = getClient();
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.content as never }],
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("AI-nyckeln (ANTHROPIC_API_KEY) är ogiltig.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("AI-tjänsten är överbelastad just nu. Försök igen om en stund.");
    if (e instanceof Anthropic.APIError) throw new Error(`AI-fel (${e.status ?? "?"}): ${String(e.message).slice(0, 200)}`);
    throw e;
  }
}

// dataUrl ("data:image/png;base64,AAAA") → Anthropic image source
function imageBlockFromDataUrl(dataUrl: string): ContentBlock {
  const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new Error("Ogiltigt bildformat (måste vara JPEG, PNG, GIF eller WebP).");
  const media_type = m[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return { type: "image", source: { type: "base64", media_type, data: m[2] } };
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

// ── Rumsbeskrivning från bilder (vision) ───────────────────────────────────────

const ImageInput = z.object({
  name: z.string(),
  dataUrl: z.string().startsWith("data:image/"),
});

const AnalyzeInput = z.object({
  roomName: z.string().min(1),
  floor: z.string().optional().default(""),
  propertyType: z.string().optional().default(""),
  existingNotes: z.string().optional().default(""),
  images: z.array(ImageInput).min(1).max(8),
});

export type RoomClarification = {
  id: string;
  question: string;
  options: string[];
};

export type RoomAnalysis = {
  description: string;
  clarifications: RoomClarification[];
  observed: string[];
};

const SYSTEM = `Du är en svensk mäklarassistent som skriver rumsbeskrivningar för fastighetsmäklare.
Du tittar på foton och beskriver BARA vad du faktiskt ser — inga antaganden, inga gissningar.

ABSOLUTA REGLER:
- Skriv aldrig "verklig", "äkta", "troligtvis", "förmodligen", "ser ut att vara"
- Om du är osäker på material (laminat vs trägolv vs klinker etc.) → ställ en fråga istället
- Använd svenska fastighetstermer: "parkettgolv", "klinker", "fiskbensparkett", "plankgolv", "kakel"
- Inga tomma fraser: "välkomnande", "inbjudande", "charmig", "fräsch", "modern känsla"
- Beskriv INTE möbler som finns i rummet — de tas med av säljaren
- Du FÅR nämna plats/möjlighet: "rymmer en stor soffa", "plats för matbord med 6 stolar", "utrymme för garderob"
- Beskriv konkret: storlek, material, ljusinsläpp, fasta detaljer, rumsform
- Naturalsvenska löptext, mäklarnivå, inga konstiga ordval

Svara ALLTID med giltig JSON. Inga kodblock runtom.`;

const SCHEMA_HINT = `Returnera JSON med exakt denna form:
{
  "description": "2-4 meningar, konkret mäklarsvenska, bara det som syns tydligt på bilderna",
  "observed": ["lista med konkreta iakttagelser, t.ex. 'fiskbensparkett', 'inbyggd garderob', 'fönster mot öst'"],
  "clarifications": [
    { "id": "golv", "question": "Vad är det för golvmaterial?", "options": ["Parkettgolv", "Laminatgolv", "Klinker", "Fiskbensparkett"] }
  ]
}
- clarifications: BARA när du genuint inte kan avgöra materialet från bilderna. Lämna [] om du ser tydligt.
- Sista alternativ i options ska alltid vara "Vet ej" om du lagt till "Vet ej" — annars specifika alternativ.
- Max 3 clarifications.`;

function parseRoomJson(content: string): RoomAnalysis {
  const obj = JSON.parse(stripFences(content));
  return {
    description: String(obj.description ?? "").trim(),
    observed: Array.isArray(obj.observed) ? obj.observed.map(String) : [],
    clarifications: Array.isArray(obj.clarifications)
      ? obj.clarifications.slice(0, 4).map((c: { id?: unknown; question?: unknown; options?: unknown }, i: number) => ({
          id: String(c.id ?? `q${i}`),
          question: String(c.question ?? ""),
          options: Array.isArray(c.options) ? c.options.map(String).slice(0, 5) : [],
        })).filter((c: RoomClarification) => c.question && c.options.length > 0)
      : [],
  };
}

export const analyzeRoomImages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<RoomAnalysis> => {
    const userText = [
      `Rum: ${data.roomName}${data.floor ? ` (${data.floor})` : ""}`,
      data.propertyType ? `Objekttyp: ${data.propertyType}` : "",
      data.existingNotes ? `Mäklarens anteckningar: ${data.existingNotes}` : "",
      "",
      SCHEMA_HINT,
    ].filter(Boolean).join("\n");

    const content: ContentBlock[] = [
      { type: "text", text: userText },
      ...data.images.map((img) => imageBlockFromDataUrl(img.dataUrl)),
    ];

    const text = await callClaude({ system: SYSTEM, content, maxTokens: 1500 });
    return parseRoomJson(text);
  });

// ── Annonstext ─────────────────────────────────────────────────────────────────

const MarketingInput = z.object({
  adress: z.string(),
  typ: z.string(),
  rum: z.number().optional(),
  boarea: z.number().optional(),
  pris: z.number().optional(),
  stad: z.string().optional(),
  postnr: z.string().optional(),
  byggAr: z.number().optional(),
  tomtyta: z.number().optional(),
  extraInfo: z.string().optional(),
});

export type MarketingTextResult = {
  rubrik: string;
  kort: string;
  lang: string;
};

const MARKETING_SYSTEM = `Du är en erfaren svensk fastighetsmäklare som skriver säljande annonstexter till Hemnet och Booli.
Texterna ska vara naturliga, konkreta och säljande utan att vara överdrivna.
Inga tomma superlativer. Framhäv det som faktiskt är bra.
Svara ENDAST med giltig JSON. Inga kodblock, ingen text utanför JSON.`;

export const generateMarketingText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MarketingInput.parse(input))
  .handler(async ({ data }): Promise<MarketingTextResult> => {
    const facts = [
      `Adress: ${data.adress}`,
      data.stad ? `Ort: ${data.stad}` : "",
      `Objekttyp: ${data.typ}`,
      data.rum ? `Rum: ${data.rum} rum` : "",
      data.boarea ? `Boarea: ${data.boarea} m²` : "",
      data.pris ? `Utropspris: ${data.pris.toLocaleString("sv-SE")} kr` : "",
      data.byggAr ? `Byggår: ${data.byggAr}` : "",
      data.tomtyta ? `Tomtyta: ${data.tomtyta} m²` : "",
      data.extraInfo ? `Övrigt: ${data.extraInfo}` : "",
    ].filter(Boolean).join("\n");

    const userText = `Skriv annonstexter för denna bostad:\n\n${facts}\n\nReturnera JSON med exakt dessa fält:
{
  "rubrik": "Kort lockande rubrik (max 80 tecken)",
  "kort": "Kort säljande beskrivning (max 300 tecken, 2-3 meningar)",
  "lang": "Lång säljande beskrivning (400-800 ord, 4-6 stycken, flytande text)"
}`;

    const text = await callClaude({ system: MARKETING_SYSTEM, content: userText, maxTokens: 2000 });
    const parsed = JSON.parse(stripFences(text));
    return {
      rubrik: String(parsed.rubrik ?? "").trim(),
      kort: String(parsed.kort ?? "").trim(),
      lang: String(parsed.lang ?? "").trim(),
    };
  });

// ── Slutgiltig rumstext (efter följdfrågor) ─────────────────────────────────────

const FinalizeInput = z.object({
  roomName: z.string(),
  floor: z.string().optional().default(""),
  baseDescription: z.string(),
  observed: z.array(z.string()).optional().default([]),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
  existingNotes: z.string().optional().default(""),
});

export const finalizeRoomText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizeInput.parse(input))
  .handler(async ({ data }): Promise<{ variants: [string, string, string] }> => {
    const facts = [
      `Rum: ${data.roomName}${data.floor ? ` (${data.floor})` : ""}`,
      data.baseDescription ? `Bildanalys: ${data.baseDescription}` : "",
      data.observed.length ? `Observerat: ${data.observed.join(", ")}` : "",
      ...data.answers.map((a) => `- ${a.question} → ${a.answer}`),
      data.existingNotes ? `Mäklarens anteckningar: ${data.existingNotes}` : "",
    ].filter(Boolean).join("\n");

    const userText = `Skriv 3 olika rumsbeskrivningar för ${data.roomName} baserat på dessa fakta:\n\n${facts}\n\nReturnera JSON med exakt dessa fält:\n{\n  "kort": "2–3 meningar, rak och faktabaserad",\n  "standard": "3–5 meningar, lätt säljande ton",\n  "utforlig": "5–7 meningar, detaljrik och inbjudande"\n}\nIngen annan text utanför JSON. Inga påhittade detaljer.`;

    const raw = await callClaude({
      system: `Du skriver svenska mäklartexter för fastighetsmäklare.
Regler: Använd korrekta fastighetstermer. Inga vaga ord ("verklig", "äkta", "troligtvis", "välkomnande", "inbjudande"). Bara fakta som bekräftats. Naturlig löptext.
Svara ALLTID med giltig JSON, inget annat.`,
      content: userText,
      maxTokens: 1200,
    });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      variants: [
        String(parsed.kort ?? "").trim(),
        String(parsed.standard ?? "").trim(),
        String(parsed.utforlig ?? "").trim(),
      ],
    };
  });

// ── Visnings-fusklapp ────────────────────────────────────────────────────────

const VisningsFusklappInput = z.object({
  adress: z.string(),
  stad: z.string(),
  postnr: z.string(),
  typ: z.string(),
  rum: z.number().optional(),
  boarea: z.number().optional(),
  pris: z.number().optional(),
  extra: z.string().optional(),
});

export type VisningsFusklappResult = {
  omradet: string;
  fragaTips: string[];
};

export const generateVisningsFusklapp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VisningsFusklappInput.parse(input))
  .handler(async ({ data }): Promise<VisningsFusklappResult> => {
    const facts = [
      `Adress: ${data.adress}, ${data.postnr} ${data.stad}`,
      `Typ: ${data.typ}`,
      data.rum ? `Rum: ${data.rum}` : "",
      data.boarea ? `Boarea: ${data.boarea} m²` : "",
      data.pris ? `Utropspris: ${data.pris.toLocaleString("sv-SE")} kr` : "",
      data.extra ? `Mäklarens anteckningar: ${data.extra}` : "",
    ].filter(Boolean).join("\n");

    const userText = `Du är assistent åt en svensk fastighetsmäklare som ska ha visning.

Objektet:
${facts}

Ge en kort beskrivning av OMRÅDET (2-3 meningar om kommunikationer, karaktär och vad som generellt finns i närheten baserat på stad och postnummer — nämn INTE specifika skolnamn eller busstider, bara den allmänna bilden).

Ge också 5 vanliga frågor som spekulanter brukar ställa på visningar av denna bostadstyp (kortfattade, som en checklista).

Returnera ENDAST giltig JSON:
{
  "omradet": "...",
  "fragaTips": ["...", "...", "...", "...", "..."]
}`;

    const text = await callClaude({ content: userText, maxTokens: 1000 });
    const parsed = JSON.parse(stripFences(text));
    return {
      omradet: String(parsed.omradet ?? "").trim(),
      fragaTips: Array.isArray(parsed.fragaTips) ? parsed.fragaTips.map(String) : [],
    };
  });

// ── Morning Brief ─────────────────────────────────────────────────────────────

const MorningBriefInput = z.object({
  overdueCount: z.number(),
  visningarIdag: z.array(z.object({ tid: z.string(), adress: z.string() })),
  silentCount: z.number(),
  activeObjCount: z.number(),
});

export type MorningBriefResult = { text: string };

export const generateMorningBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MorningBriefInput.parse(input))
  .handler(async ({ data }): Promise<MorningBriefResult> => {
    const parts: string[] = [];
    if (data.overdueCount > 0)
      parts.push(`${data.overdueCount} förfalln${data.overdueCount === 1 ? "et" : "a"} nästa steg`);
    if (data.visningarIdag.length > 0) {
      const v = data.visningarIdag[0];
      const extra = data.visningarIdag.length > 1 ? ` och ${data.visningarIdag.length - 1} till` : "";
      parts.push(`visning på ${v.adress} kl ${v.tid}${extra}`);
    }
    if (data.silentCount > 0)
      parts.push(`${data.silentCount} kontakt${data.silentCount > 1 ? "er" : ""} som inte hörts av på 10+ dagar`);

    const facts = parts.length > 0 ? parts.join(", ") : "inga akuta prioriteringar";

    const userText = `Du är en assistent för en svensk fastighetsmäklare. Skriv en kort daglig sammanfattning.

Fakta idag: ${data.activeObjCount} aktiva uppdrag, ${facts}.

Regler: Exakt 1-2 meningar. Naturlig svenska. Lyft fram siffror och tider om de finns. Börja INTE med "Hej" eller hälsningsfras — börja direkt med innehållet. Ingen formatering. Returnera ENBART texten.`;

    const text = await callClaude({ content: userText, maxTokens: 300 });
    return { text };
  });
