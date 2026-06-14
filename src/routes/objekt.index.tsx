import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { OBJEKT, slugifyAddr, type Objekt, type Status, type Typ } from "../data/objekt";
import { facadeFor } from "../data/images";
import { listObjekt } from "../lib/objektStore";

// Statuses that should always show a thumbnail (placeholder if no upload yet)
const STATUS_HAS_PHOTO: Status[] = ["Såld", "Redo (Kommande)", "Till salu", "Vilande"];

function thumbFor(o: Objekt): string | null {
  if (o.bild) return o.bild;
  if (STATUS_HAS_PHOTO.includes(o.status)) {
    return facadeFor(slugifyAddr(o.adress), o.typ, o.boarea);
  }
  return null;
}

export const Route = createFileRoute("/objekt/")({
  head: () => ({
    meta: [
      { title: "Objekt · Stendahl CRM" },
      { name: "description", content: "Alla objekt i portföljen." },
    ],
  }),
  component: ObjektListPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;


const TYPER: Typ[] = ["Bostadsrätt", "Villa", "Radhus", "Fritidshus", "Tomt", "Gård", "Parhus", "Kedjehus", "Ägarlägenhet"];

const SAVED_VIEWS = [
  { id: "alla", label: "Alla", filter: (_o: Objekt) => true },
  { id: "tillsalu", label: "Till salu", filter: (o: Objekt) => o.status === "Till salu" || o.status === "Redo (Kommande)" },
  { id: "underintag", label: "Under intag", filter: (o: Objekt) => o.status === "Under intag" },
  { id: "varma", label: "Heta spekulanter", filter: (o: Objekt) => o.spek[0] >= 1 },
  { id: "sald", label: "Sålda i år", filter: (o: Objekt) => o.status === "Såld" },
  { id: "vardering", label: "Värderingar", filter: (o: Objekt) => o.status === "Inget uppdrag" },
];

type ViewMode = "lista" | "pipeline";

const PIPELINE_COLS: { id: string; label: string; statuses: Status[]; accent: string }[] = [
  { id: "intag",    label: "Intag",     statuses: ["Under intag", "Intaget", "Inget uppdrag"], accent: "text-blue-400 border-blue-400/25 bg-blue-400/[0.06]" },
  { id: "kommande", label: "Kommande",  statuses: ["Redo (Kommande)"],                         accent: "text-primary border-primary/25 bg-primary/[0.06]" },
  { id: "tillsalu", label: "Till salu", statuses: ["Till salu"],                               accent: "text-emerald-400 border-emerald-400/25 bg-emerald-400/[0.06]" },
  { id: "vilande",  label: "Vilande",   statuses: ["Vilande"],                                 accent: "text-amber-400 border-amber-400/25 bg-amber-400/[0.06]" },
  { id: "sald",     label: "Såld",      statuses: ["Såld", "Arkiverad"],                       accent: "text-muted-foreground border-white/10 bg-white/[0.02]" },
];

function ObjektListPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("alla");
  const [typFilter, setTypFilter] = useState<Typ | "Alla">("Alla");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [saved, setSaved] = useState<Objekt[]>([]);
  useEffect(() => {
    setSaved(listObjekt());
  }, []);
  const all = useMemo<Objekt[]>(() => [...saved, ...OBJEKT], [saved]);

  const filtered = useMemo(() => {
    const v = SAVED_VIEWS.find((x) => x.id === view) ?? SAVED_VIEWS[0];
    const q = query.trim().toLowerCase();
    return all.filter(v.filter)
      .filter((o) => typFilter === "Alla" || o.typ === typFilter)
      .filter((o) =>
        !q || `${o.adress} ${o.postnr} ${o.stad} ${o.saljare} ${o.kalla} ${o.status}`.toLowerCase().includes(q),
      );
  }, [query, view, typFilter, all]);

  const totalValue = filtered.reduce((sum, o) => sum + o.pris, 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-6 pb-24 pt-10">
        <section className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Objekt</div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serif}>
              Hela portföljen<span className="text-primary">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {filtered.length} objekt · Totalt värde {fmtKr(totalValue)}
            </p>
          </div>
          <Link to="/objekt/nytt"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]">
            <span className="text-base leading-none">+</span> Nytt objekt
          </Link>
        </section>

        {/* Smart search */}
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-card/60 px-4 py-3 backdrop-blur-sm">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Sök t.ex. "Granvik under intag" eller "Stenkulla såld"'
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            + Spara vy
          </button>
        </div>

        {/* Saved view chips + view mode toggle */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {SAVED_VIEWS.map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            <button
              onClick={() => setViewMode("lista")}
              title="Lista"
              className={["rounded-md px-2.5 py-1 text-xs transition-colors", viewMode === "lista" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("pipeline")}
              title="Pipeline"
              className={["rounded-md px-2.5 py-1 text-xs transition-colors", viewMode === "pipeline" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><rect x="17" y="3" width="5" height="18" rx="1"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Type chips */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          <TypeChip label="Alla typer" active={typFilter === "Alla"} onClick={() => setTypFilter("Alla")} />
          {TYPER.map((t) => (
            <TypeChip key={t} label={t} active={typFilter === t} onClick={() => setTypFilter(t)} />
          ))}
        </div>

        {viewMode === "pipeline" && <PipelineView objects={filtered} />}

        {/* Table */}
        {viewMode === "lista" && (
        <section className="rounded-xl border border-white/[0.07] bg-card/60 p-6 backdrop-blur-sm shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{filtered.length} träffar</div>
            <div className="flex gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <button className="rounded px-2 py-1 hover:bg-white/[0.04] hover:text-foreground">Exportera</button>
              <button className="rounded px-2 py-1 hover:bg-white/[0.04] hover:text-foreground">Kolumner</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="pb-3 pr-3 font-normal">Adress</th>
                  <th className="pb-3 pr-3 font-normal">Typ</th>
                  <th className="pb-3 pr-3 text-right font-normal">Rum</th>
                  <th className="pb-3 pr-3 text-right font-normal">Boarea</th>
                  <th className="pb-3 pr-3 text-right font-normal">Pris</th>
                  <th className="pb-3 pr-3 font-normal">Säljare</th>
                  <th className="pb-3 pr-3 font-normal">Status</th>
                  <th className="pb-3 pr-3 font-normal">Spekulanter</th>
                  <th className="pb-3 font-normal">Källa</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={i} className="border-t border-white/[0.05] hover:bg-white/[0.015]">
                    <td className="py-3 pr-3">
                      <Link
                        to="/objekt/$slug"
                        params={{ slug: slugifyAddr(o.adress) }}
                        search={{ tab: undefined, q: undefined }}
                        className="flex items-center gap-3"
                      >
                        <Thumb src={thumbFor(o)} alt={o.adress} />
                        <div className="min-w-0">
                          <div className="font-medium text-foreground hover:text-primary truncate">{o.adress}</div>
                          <div className="text-xs text-muted-foreground truncate">{o.postnr} {o.stad}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">{o.typ}</td>
                    <td className="py-3 pr-3 text-right font-mono text-xs">{o.rum || "—"}</td>
                    <td className="py-3 pr-3 text-right font-mono text-xs">{o.boarea || "—"}</td>
                    <td className="py-3 pr-3 text-right font-mono text-foreground">{fmtKr(o.pris)}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{o.saljare}</td>
                    <td className="py-3 pr-3"><StatusPill status={o.status} /></td>
                    <td className="py-3 pr-3"><SpekDots dots={o.spek} /></td>
                    <td className="py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={o.kalla}>{o.kalla}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </AppShell>
  );
}

/* ─── Pipeline view ─── */
function PipelineView({ objects }: { objects: Objekt[] }) {
  return (
    <div className="-mx-2 overflow-x-auto pb-6 px-2">
      <div className="flex gap-3" style={{ minWidth: `${PIPELINE_COLS.length * 268}px` }}>
        {PIPELINE_COLS.map((col) => {
          const colObjs = objects.filter((o) => col.statuses.includes(o.status));
          return (
            <div key={col.id} className="w-64 flex-shrink-0">
              <div className={`mb-3 flex items-center justify-between rounded-lg border px-3 py-2 ${col.accent}`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{col.label}</span>
                <span className="text-[11px] opacity-50 font-mono">{colObjs.length}</span>
              </div>
              <div className="space-y-2.5">
                {colObjs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.05] py-8 text-center text-xs text-muted-foreground/30">
                    Inga objekt
                  </div>
                ) : (
                  colObjs.map((o, i) => <PipelineCard key={i} o={o} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({ o }: { o: Objekt }) {
  const thumb = thumbFor(o);
  const totalSpek = o.spek.reduce((a, b) => a + b, 0);
  const hotSpek = o.spek[0];
  return (
    <Link
      to="/objekt/$slug"
      params={{ slug: slugifyAddr(o.adress) }}
      search={{ tab: undefined, q: undefined }}
      className="group block rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 transition-all hover:border-primary/30 hover:bg-white/[0.045] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
    >
      {thumb ? (
        <img
          src={thumb} alt={o.adress} loading="lazy"
          className="mb-2.5 h-28 w-full rounded-lg border border-white/[0.06] object-cover group-hover:brightness-110 transition-all"
        />
      ) : (
        <div className="mb-2.5 flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-white/[0.07] bg-white/[0.015] text-muted-foreground/25">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      )}
      <div className="truncate text-sm font-medium text-foreground">{o.adress}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{o.stad || o.postnr}</div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-mono text-sm text-foreground">{fmtKrShort(o.pris)}</span>
        {totalSpek > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${hotSpek > 0 ? "bg-rose-500/10 text-rose-400" : "bg-primary/10 text-primary"}`}>
            {totalSpek} spek{hotSpek > 0 ? ` · ${hotSpek} heta` : ""}
          </span>
        )}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground/40">{o.typ}</div>
    </Link>
  );
}

function fmtKrShort(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace(".", ",") + " mkr";
  if (n >= 1_000) return Math.round(n / 1_000) + " tkr";
  return n.toLocaleString("sv-SE") + " kr";
}

function TypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-white/[0.06] bg-white/[0.015] text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground/50">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="1.5" /><path d="m21 17-5-5-9 9" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-12 w-16 shrink-0 rounded-md border border-white/10 object-cover"
    />
  );
}

function StatusPill({ status }: { status: Status }) {
  const tone =
    status === "Till salu" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : status === "Under intag" ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
    : status === "Redo (Kommande)" ? "border-primary/40 bg-primary/10 text-primary"
    : status === "Såld" ? "border-white/15 bg-white/[0.04] text-muted-foreground"
    : status === "Vilande" ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
    : status === "Inget uppdrag" ? "border-white/10 bg-white/[0.025] text-muted-foreground/80"
    : "border-white/15 bg-white/[0.04] text-muted-foreground";
  return (
    <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${tone}`}>
      {status}
    </span>
  );
}

function SpekDots({ dots }: { dots: [number, number, number, number] }) {
  // varma, ljumna, kalla, övriga
  const colors = ["bg-rose-400/20 text-rose-300", "bg-amber-400/20 text-amber-300", "bg-sky-400/20 text-sky-300", "bg-white/[0.04] text-muted-foreground"];
  const labels = ["Heta", "Ljumna", "Kalla", "Övriga"];
  return (
    <div className="flex gap-1">
      {dots.map((n, i) => (
        <span
          key={i}
          title={labels[i]}
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-mono ${colors[i]}`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function fmtKr(n: number): string {
  return n.toLocaleString("sv-SE") + " kr";
}