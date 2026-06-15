import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  listAllaVisningar,
  toggleDeltog,
  addDeltagare,
  updateVisning,
  type Visning,
} from "../lib/visningarStore";
import { listObjekt } from "../lib/objektStore";
import { OBJEKT, slugifyAddr, type Objekt } from "../data/objekt";
import { generateVisningsFusklapp, type VisningsFusklappResult } from "../lib/ai.functions";

export const Route = createFileRoute("/visning/$id")({
  component: VisningsassistentPage,
});

/* ── helpers ── */

function allObjects(): Objekt[] {
  const saved = listObjekt();
  const savedAddrs = new Set(saved.map((o) => o.adress));
  return [...saved, ...OBJEKT.filter((o) => !savedAddrs.has(o.adress))];
}

function fmtPris(n: number) {
  return n.toLocaleString("sv-SE") + " kr";
}

function timeFmt(ts: number) {
  return new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function dateFmt(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Extra info store (per visning) ── */
const EXTRA_KEY = "hajpex.visning.extra.v1";

function readExtra(id: string): string {
  try { return JSON.parse(localStorage.getItem(EXTRA_KEY) ?? "{}")[id] ?? ""; } catch { return ""; }
}

function writeExtra(id: string, text: string) {
  try {
    const all = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? "{}");
    localStorage.setItem(EXTRA_KEY, JSON.stringify({ ...all, [id]: text }));
  } catch { /* ignore */ }
}

/* ── AI fusklapp cache (per visning, per dag) ── */
function readAiCache(visningId: string): VisningsFusklappResult | null {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(`hajpex.fusklapp.${visningId}.${today}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeAiCache(visningId: string, data: VisningsFusklappResult) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`hajpex.fusklapp.${visningId}.${today}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

/* ══════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════ */

function VisningsassistentPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [visning, setVisning] = useState<Visning | null>(null);
  const [objekt, setObjekt] = useState<Objekt | null>(null);
  const [tab, setTab] = useState<"fusklapp" | "deltagare">("fusklapp");
  const [extra, setExtra] = useState("");
  const [aiData, setAiData] = useState<VisningsFusklappResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [nyttNamn, setNyttNamn] = useState("");
  const [nyttTel, setNyttTel] = useState("");
  const navRef = useRef<HTMLDivElement>(null);

  function load() {
    const all = listAllaVisningar();
    const v = all.find((x) => x.id === id) ?? null;
    setVisning(v);
    if (v) {
      const o = allObjects().find((x) => slugifyAddr(x.adress) === v.slug) ?? null;
      setObjekt(o);
      setExtra(readExtra(id));
      setAiData(readAiCache(id));
    }
  }

  useEffect(() => { load(); }, [id]);

  /* ── Keep screen awake on iOS/Android via NoSleep-like trick ── */
  useEffect(() => {
    const doc = document as Document & { mozHidden?: boolean };
    if ("wakeLock" in navigator) {
      (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } })
        .wakeLock.request("screen").catch(() => {});
    }
  }, []);

  if (!visning || !objekt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="text-muted-foreground">Visning hittades inte.</p>
          <Link to="/" className="mt-4 block text-sm text-primary hover:underline">← Till översikten</Link>
        </div>
      </div>
    );
  }

  const deltogCount = visning.deltagare.filter((d) => d.deltog).length;
  const totalCount  = visning.deltagare.length;

  /* ── AI generate ── */
  async function handleGenerateAi() {
    if (aiLoading) return;
    setAiError("");
    setAiLoading(true);
    try {
      const result = await generateVisningsFusklapp({
        data: {
          adress: objekt!.adress,
          stad: objekt!.stad,
          postnr: objekt!.postnr,
          typ: objekt!.typ,
          rum: objekt!.rum || undefined,
          boarea: objekt!.boarea || undefined,
          pris: objekt!.pris || undefined,
          extra: extra || undefined,
        },
      });
      setAiData(result);
      writeAiCache(id, result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Okänt fel");
    } finally {
      setAiLoading(false);
    }
  }

  /* ── Toggle deltog ── */
  function handleToggleDeltog(deltagarId: string) {
    toggleDeltog(visning!.slug, visning!.id, deltagarId);
    load();
  }

  /* ── Add deltagare ── */
  function handleAddDeltagare(e: React.FormEvent) {
    e.preventDefault();
    if (!nyttNamn.trim()) return;
    addDeltagare(visning!.slug, visning!.id, {
      namn: nyttNamn.trim(),
      telefon: nyttTel.trim(),
      anmald: true,
      deltog: true,
    });
    setNyttNamn("");
    setNyttTel("");
    load();
  }

  /* ── Save extra ── */
  function handleExtraChange(val: string) {
    setExtra(val);
    writeExtra(id, val);
  }

  const serifStyle = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;
  const sansStyle  = { fontFamily: '"Work Sans", system-ui, sans-serif' } as const;

  /* ── Fact rows ── */
  const fakta: Array<{ label: string; value: string }> = [
    { label: "Utropspris", value: objekt.pris ? fmtPris(objekt.pris) : "—" },
    { label: "Boarea",     value: objekt.boarea ? `${objekt.boarea} m²` : "—" },
    { label: "Rum",        value: objekt.rum ? `${objekt.rum} rum` : "—" },
    { label: "Typ",        value: objekt.typ },
    { label: "Adress",     value: `${objekt.adress}, ${objekt.stad}` },
    { label: "Postnr",     value: objekt.postnr || "—" },
    { label: "Säljare",    value: objekt.saljare || "—" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={sansStyle}>

      {/* ══ Header ══ */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/objekt/$slug"
              params={{ slug: visning.slug }}
              search={{ tab: "Visningar", q: undefined }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              ←
            </Link>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight" style={serifStyle}>
                {objekt.adress}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {capitalize(dateFmt(visning.datum))} · {timeFmt(visning.datum)}–{timeFmt(visning.sluttid)} · {visning.typ}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:block text-[11px] text-muted-foreground">
              {deltogCount} / {totalCount} deltog
            </span>
            <Link
              to="/objekt/$slug"
              params={{ slug: visning.slug }}
              search={{ tab: "Visningar", q: undefined }}
              className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
            >
              Avsluta ×
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-border" ref={navRef}>
          {(["fusklapp", "deltagare"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "flex-1 py-3 text-sm font-medium transition-colors",
                tab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t === "fusklapp" ? "Fusklapp" : `Deltagare (${totalCount})`}
            </button>
          ))}
        </div>
      </header>

      {/* ══ Content ══ */}
      <main className="flex-1 px-4 pb-16 pt-6 md:mx-auto md:w-full md:max-w-2xl">

        {tab === "fusklapp" && (
          <div className="space-y-6">

            {/* Objektfakta */}
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Objektfakta</p>
              <div className="overflow-hidden rounded-xl border border-border">
                {fakta.map((f, i) => (
                  <div
                    key={f.label}
                    className={[
                      "flex items-center justify-between gap-4 px-4 py-3.5",
                      i > 0 ? "border-t border-border" : "",
                    ].join(" ")}
                  >
                    <span className="text-[12px] text-muted-foreground">{f.label}</span>
                    <span className="text-right text-sm font-medium text-foreground">{f.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Extra anteckningar */}
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Extra info &amp; anteckningar
              </p>
              <textarea
                value={extra}
                onChange={(e) => handleExtraChange(e.target.value)}
                rows={4}
                placeholder="Avgift: 3 500 kr/mån · Pantbrev: 1 500 000 kr · Nytt badrum 2021 · ..."
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none"
              />
            </section>

            {/* AI-insikt */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  ✦ AI-insikt om objektet
                </p>
                <button
                  onClick={handleGenerateAi}
                  disabled={aiLoading}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {aiLoading ? "Genererar…" : aiData ? "Uppdatera" : "Generera"}
                </button>
              </div>

              {aiError && (
                <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive mb-3">{aiError}</p>
              )}

              {aiLoading && (
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              )}

              {!aiLoading && aiData && (
                <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/4 p-4">
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-primary/70">Området</p>
                    <p className="text-sm leading-relaxed text-foreground/90">{aiData.omradet}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-primary/70">Vanliga spekulantfrågor</p>
                    <ul className="space-y-1.5">
                      {aiData.fragaTips.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-0.5 flex-shrink-0 text-primary">·</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {!aiLoading && !aiData && !aiError && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
                  <p className="text-sm text-muted-foreground">Tryck "Generera" för att få AI-insikt om området och vanliga spekulantfrågor</p>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "deltagare" && (
          <div className="space-y-5">

            {/* Counter */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex-1">
                <p className="text-2xl font-semibold" style={serifStyle}>
                  {deltogCount} <span className="text-muted-foreground text-lg">/ {totalCount}</span>
                </p>
                <p className="text-xs text-muted-foreground">deltog på visningen</p>
              </div>
              <div className="h-12 w-12 flex-shrink-0">
                <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
                  <circle
                    cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${totalCount > 0 ? (deltogCount / totalCount) * 125.7 : 0} 125.7`}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-300"
                  />
                </svg>
              </div>
            </div>

            {/* Deltagarlista */}
            {visning.deltagare.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">Inga deltagare än</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Lägg till via formuläret nedan</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                {visning.deltagare.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => handleToggleDeltog(d.id)}
                    className={[
                      "w-full flex items-center gap-3.5 px-4 py-4 text-left transition-colors active:bg-muted/50",
                      i > 0 ? "border-t border-border" : "",
                      d.deltog ? "bg-primary/3" : "",
                    ].join(" ")}
                  >
                    <div className={[
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      d.deltog
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background",
                    ].join(" ")}>
                      {d.deltog && <span className="text-xs font-bold">✓</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{d.namn}</p>
                      {d.telefon && (
                        <p className="text-[11px] text-muted-foreground">{d.telefon}</p>
                      )}
                    </div>
                    {d.telefon && (
                      <a
                        href={`tel:${d.telefon}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/80"
                      >
                        Ring
                      </a>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Lägg till deltagare */}
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Lägg till deltagare</p>
              <form onSubmit={handleAddDeltagare} className="space-y-2">
                <input
                  type="text"
                  value={nyttNamn}
                  onChange={(e) => setNyttNamn(e.target.value)}
                  placeholder="Namn"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  required
                />
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={nyttTel}
                    onChange={(e) => setNyttTel(e.target.value)}
                    placeholder="Telefon (valfritt)"
                    className="flex-1 rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="submit"
                    className="flex-shrink-0 rounded-xl bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    + Lägg till
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
