import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "../components/AppShell";
import { listIntagsmoten } from "../lib/intagsmoteStore";
import { getKontakt } from "../lib/kontaktStore";
import { searchLeads, type LeadColor } from "../lib/leadSearch";
import { seedFakeIntag, clearFakeIntag, countTestdata } from "../lib/seedTestdata";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Säljleads · Hajpex CRM" }] }),
  component: LeadsPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

const COLOR_STYLE: Record<LeadColor, { dot: string; label: string; badge: string }> = {
  green:  { dot: "bg-emerald-500", label: "Inom budget",  badge: "bg-emerald-500/12 text-emerald-600 border-emerald-500/30" },
  orange: { dot: "bg-amber-500",   label: "Nästan",       badge: "bg-amber-500/12 text-amber-600 border-amber-500/30" },
  red:    { dot: "bg-red-500",     label: "Långt ifrån",  badge: "bg-red-500/12 text-red-500 border-red-500/30" },
  none:   { dot: "bg-muted-foreground/40", label: "",      badge: "bg-muted text-muted-foreground border-border" },
};

function fmtKr(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("sv-SE") + " kr";
}

function LeadsPage() {
  const [q, setQ] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const moten = useMemo(() => listIntagsmoten(), [reloadKey]);
  const [testCount, setTestCount] = useState(0);
  useEffect(() => { setTestCount(countTestdata()); }, [reloadKey]);

  const { parsed, matches } = useMemo(() => searchLeads(moten, q), [moten, q]);
  const hasQuery = q.trim().length > 0;

  // Antal med säljlead-data (önskat pris eller värdering)
  const medData = moten.filter((m) => m.onskatPris != null || m.vardering != null).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/80">Matcha köpare mot säljare</div>
        <h1 className="mb-2 text-3xl font-medium" style={serif}>Säljleads<span className="text-primary">.</span></h1>
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          Sök fritt, t.ex. <em>"2a johanneshov 3mil"</em>. Systemet förstår rum, ort och pris och
          färgkodar träffarna: <span className="text-emerald-600">grönt</span> inom budget,
          {" "}<span className="text-amber-600">orange</span> nästan, <span className="text-red-500">rött</span> långt ifrån.
        </p>

        {/* Sökfält */}
        <div className="relative mb-4">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Sök säljleads — t.ex. "2a johanneshov 3mil"'
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          {hasQuery && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>

        {/* Tolkning */}
        {hasQuery && (parsed.rum != null || parsed.pris != null || parsed.ord.length > 0) && (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Tolkade sökningen som:</span>
            {parsed.rum != null && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-foreground">{parsed.rum} rum</span>}
            {parsed.ord.length > 0 && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-foreground">{parsed.ord.join(" ")}</span>}
            {parsed.pris != null && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-foreground">≈ {fmtKr(parsed.pris)}</span>}
          </div>
        )}

        {/* Resultat */}
        {!hasQuery ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <div className="mb-2 text-3xl opacity-30">🔎</div>
            <div className="text-sm text-muted-foreground">
              {medData} säljlead{medData === 1 ? "" : "s"} med pris­uppgift är sökbara.
            </div>
            <div className="mt-1 text-xs text-muted-foreground/60">Skriv en sökning ovan för att matcha.</div>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Inga säljleads matchar "{q}".
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{matches.length} träff{matches.length === 1 ? "" : "ar"}</div>
            {matches.map(({ mote: m, color, priceDiff }) => {
              const k = getKontakt(m.kontaktId);
              const cs = COLOR_STYLE[color];
              const sellerPris = m.onskatPris ?? m.vardering;
              return (
                <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-white/[0.14]">
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${cs.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground" style={serif}>{m.adress}</span>
                      {m.ort && <span className="text-xs text-muted-foreground">{m.ort}</span>}
                      {color !== "none" && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cs.badge}`}>
                          {cs.label}{priceDiff != null && priceDiff > 0 ? ` (+${Math.round(priceDiff * 100)}%)` : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                      {m.antalRum != null && <span>{m.antalRum} rum</span>}
                      {m.boarea != null && <span>{m.boarea} kvm</span>}
                      <span className="font-medium text-foreground">{fmtKr(sellerPris)}{m.onskatPris == null && m.vardering != null ? " (värdering)" : ""}</span>
                      {m.saljTidpunkt && <span>· Vill sälja: {m.saljTidpunkt}</span>}
                    </div>
                    {k && (
                      <div className="mt-1.5 text-[12px]">
                        <Link to="/kunder/$id" params={{ id: k.id }} className="text-primary hover:underline">
                          {k.fornamn} {k.efternamn}
                        </Link>
                        {k.telefon && <span className="text-muted-foreground"> · {k.telefon}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Testdata-verktyg */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5 text-xs">
          <span className="text-muted-foreground/70">Demo:</span>
          <button
            onClick={() => { seedFakeIntag(100); setReloadKey((k) => k + 1); }}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            + Skapa 100 testintag
          </button>
          {testCount > 0 && (
            <button
              onClick={() => { if (window.confirm(`Ta bort ${testCount} testintag (och deras kontakter)?`)) { clearFakeIntag(); setReloadKey((k) => k + 1); } }}
              className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:border-red-400/50 hover:text-red-400"
            >
              Rensa testdata ({testCount})
            </button>
          )}
          <span className="text-muted-foreground/50">Testdata är tydligt taggad och rör inte din riktiga data.</span>
        </div>
      </div>
    </AppShell>
  );
}
