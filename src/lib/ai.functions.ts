import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const SYSTEM = `Du är en svensk mäklarassistent som hjälper Max Stendahl skriva korrekta rumsbeskrivningar.
Du tittar på foton från ett rum och beskriver vad du faktiskt ser.
Du gissar ALDRIG. Om du är osäker på material (t.ex. laminat vs plankgolv vs klinker) ställer du en fråga med 2–4 troliga alternativ.
Svara ENDAST med giltig JSON enligt schemat. Inga kodblock, ingen prosa runtom.`;

const SCHEMA_HINT = `Returnera JSON med exakt denna form:
{
  "description": "kort, naturlig svensk löptext, 2-4 meningar, beskriver bara det som syns",
  "observed": ["kort lista med konkreta drag, t.ex. 'stora fönster mot söder', 'vit köksinredning'"],
  "clarifications": [
    { "id": "kort_nyckel", "question": "Vad ser ut att vara på golvet?", "options": ["Laminatgolv", "Trägolv (plank)", "Klinker", "Vet ej"] }
  ]
}
- clarifications: ENDAST när du är osäker. Lämna tom array [] om du är säker.
- options ska vara konkreta materialalternativ, alltid med "Vet ej" som sista alternativ.
- max 4 clarifications.`;

async function callGateway(body: unknown): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY saknas på servern.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("AI-tjänsten är överbelastad just nu. Försök igen om en stund.");
  if (res.status === 402) throw new Error("AI-krediter slut. Lägg till krediter i Lovable-arbetsytan.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI-fel (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Oväntat AI-svar.");
  return content;
}

function parseJson(content: string): RoomAnalysis {
  let txt = content.trim();
  // Strip ```json fences if model adds them anyway
  txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const obj = JSON.parse(txt);
  return {
    description: String(obj.description ?? "").trim(),
    observed: Array.isArray(obj.observed) ? obj.observed.map(String) : [],
    clarifications: Array.isArray(obj.clarifications)
      ? obj.clarifications.slice(0, 4).map((c: any, i: number) => ({
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

    const content = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            ...data.images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: img.dataUrl },
            })),
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    return parseJson(content);
  });

// ── Marketing text generation ─────────────────────────────────────────────────

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
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY saknas på servern.");

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

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: MARKETING_SYSTEM },
          { role: "user", content: userText },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI-tjänsten är överbelastad just nu. Försök igen om en stund.");
    if (res.status === 402) throw new Error("AI-krediter slut. Lägg till krediter i Lovable-arbetsytan.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI-fel (${res.status}): ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = String(json?.choices?.[0]?.message?.content ?? "").trim()
      .replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    const parsed = JSON.parse(content);
    return {
      rubrik: String(parsed.rubrik ?? "").trim(),
      kort: String(parsed.kort ?? "").trim(),
      lang: String(parsed.lang ?? "").trim(),
    };
  });

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
  .handler(async ({ data }): Promise<{ text: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY saknas.");

    const userText = [
      `Skriv den slutgiltiga rumsbeskrivningen för ${data.roomName}${data.floor ? ` (${data.floor})` : ""}.`,
      "",
      "Ursprunglig beskrivning från bildanalysen:",
      data.baseDescription,
      "",
      data.observed.length ? `Observerat: ${data.observed.join(", ")}` : "",
      "",
      "Mäklarens svar på följdfrågor (använd dessa som fakta):",
      ...data.answers.map((a) => `- ${a.question} → ${a.answer}`),
      "",
      data.existingNotes ? `Mäklarens egna anteckningar: ${data.existingNotes}` : "",
      "",
      "Regler: Naturlig svenska, 3–5 meningar, löptext, inga floskler, inga påhittade detaljer. Returnera ENDAST själva texten.",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du skriver svenska mäklartexter — naturligt, korrekt, inga floskler." },
          { role: "user", content: userText },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI överbelastad. Försök igen strax.");
    if (res.status === 402) throw new Error("AI-krediter slut.");
    if (!res.ok) throw new Error(`AI-fel (${res.status}).`);
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return { text };
  });