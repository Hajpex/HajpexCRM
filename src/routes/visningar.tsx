import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "../components/AppShell";
import {
  listAllaVisningar,
  exportVisningToICS,
  toggleDeltog,
  addDeltagare,
  type Visning,
  type Deltagare,
} from "../lib/visningarStore";
import { slugifyAddr } from "./objekt.$slug";

export const Route = createFileRoute("/visningar")({
  head: () => ({ meta: [{ title: "Visningar · Hajpex CRM" }] }),
  component: VisningarPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

function prettyAddr(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function timeFmt(ts: number) {
  return new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts: number, now: Date) {
  const d = new Date(ts);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);

  if (dayStart.getTime() === today.getTime()) return "Idag";
  if (dayStart.getTime() === tomorrow.getTime()) return "Imorgon";
  return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(visningar: Visning[]): Array<{ label: string; date: Date; items: Visning[] }> {
  const map = new Map<string, { label: string; date: Date; items: Visning[] }>();
  const now = new Date();
  for (const v of visningar) {
    const d = new Date(v.datum);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { label: dayLabel(v.datum, now), date: d, items: [] });
    }
    map.get(key)!.items.push(v);
  }
  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function ShowingCompanion({ visning, onRefresh }: { visning: Visning; onRefresh: () => void }) {
  const [quickAdd, setQuickAdd] = useState(false);
  const [addNamn, setAddNamn] = useState("");
  const [addTel, setAddTel] = useState("");

  const adress = visning.slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const attended = visning.deltagare.filter((d) => d.deltog).length;
  const total = visning.deltagare.length;

  function handleToggle(d: Deltagare) {
    toggleDeltog(visning.slug, visning.id, d.id);
    onRefresh();
  }

  function handleAdd() {
    if (!addNamn.trim()) return;
    addDeltagare(visning.slug, visning.id, {
      namn: addNamn.trim(),
      telefon: addTel.trim(),
      anmald: false,
      deltog: true,
    });
    setAddNamn("");
    setAddTel("");
    setQuickAdd(false);
    onRefresh();
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-primary/30 bg-primary/10">
      {/* Header */}
      <div className="flex items-center gap-3 bg-primary/15 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-base">🏠</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">Pågående visning</p>
          <p className="truncate text-sm font-semibold text-foreground">{adress}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-semibold text-primary">
            {timeFmt(visning.datum)}–{timeFmt(visning.sluttid)}
          </p>
          <p className="text-[10px] text-muted-foreground">{visning.typ}</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-primary/15 px-4 py-2.5">
        <span className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-primary">{attended}</span> / {total} deltog
        </span>
        {visning.deltagare.filter((d) => !d.deltog && d.anmald).length > 0 && (
          <span className="text-[11px] text-amber-500/80">
            {visning.deltagare.filter((d) => !d.deltog && d.anmald).length} ej checkade
          </span>
        )}
        <Link
          to="/objekt/$slug"
          params={{ slug: visning.slug }}
          search={{ tab: "Visningar", q: undefined }}
          className="ml-auto text-[11px] text-primary hover:underline"
        >
          Hantera →
        </Link>
      </div>

      {/* Participant list */}
      <div className="divide-y divide-border/40 px-4">
        {visning.deltagare.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Inga anmälda deltagare</p>
        ) : (
          visning.deltagare.map((d) => (
            <button
              key={d.id}
              onClick={() => handleToggle(d)}
              className="flex w-full items-center gap-3 py-3.5 text-left transition-colors active:bg-primary/5"
            >
              <span
                className={[
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  d.deltog
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-border bg-card text-muted-foreground",
                ].join(" ")}
              >
                {d.deltog ? "✓" : d.namn.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className={["text-sm font-medium", d.deltog ? "text-foreground" : "text-muted-foreground"].join(" ")}>
                  {d.namn}
                </p>
                {d.telefon && (
                  <a
                    href={`tel:${d.telefon}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {d.telefon}
                  </a>
                )}
              </div>
              <span className={["flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium", d.deltog ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"].join(" ")}>
                {d.deltog ? "Deltog" : "Inte här"}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Quick add */}
      <div className="border-t border-primary/15 px-4 py-3">
        {!quickAdd ? (
          <button
            onClick={() => setQuickAdd(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/30 py-2.5 text-xs font-medium text-primary/70 hover:border-primary/60 hover:text-primary"
          >
            + Lägg till deltagare
          </button>
        ) : (
          <div className="space-y-2">
            <input
              autoFocus
              value={addNamn}
              onChange={(e) => setAddNamn(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Namn *"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={addTel}
              onChange={(e) => setAddTel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Telefon (valfritt)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Lägg till & markera deltog
              </button>
              <button
                onClick={() => { setQuickAdd(false); setAddNamn(""); setAddTel(""); }}
                className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VisningarPage() {
  const [visningar, setVisningar] = useState<Visning[]>([]);
  const [filter, setFilter] = useState<"kommande" | "alla">("kommande");

  const refresh = useCallback(() => setVisningar(listAllaVisningar()), []);

  useEffect(() => {
    refresh();
  }, []);

  const now = Date.now();
  const nowVisningar = visningar.filter((v) => v.datum <= now && v.sluttid >= now);

  const filtered = filter === "kommande"
    ? visningar.filter((v) => v.datum >= now - 3_600_000)
    : visningar;

  const groups = groupByDate(filtered);
  const today = new Date();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-10">

        {/* ── Showing companion — shown when a visning is happening right now ── */}
        {nowVisningar.length > 0 && (
          <div className="mb-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Pågår nu</p>
            </div>
            {nowVisningar.map((v) => (
              <ShowingCompanion key={v.id} visning={v} onRefresh={refresh} />
            ))}
          </div>
        )}

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">Kalender</p>
            <h1 className="text-4xl font-medium leading-tight md:text-[48px]" style={serif}>
              Visningar<span className="text-primary">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {(["kommande", "alla"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                ].join(" ")}
              >
                {f === "kommande" ? "Kommande" : "Alla"}
              </button>
            ))}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="text-5xl">🏠</span>
            <p className="text-base font-medium text-foreground">Inga visningar inplanerade</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Boka visningar direkt från objektssidan under fliken "Visningar".
            </p>
            <Link to="/objekt" className="mt-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary">
              Gå till objekt →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <div key={g.date.toISOString()}>
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">{g.label}</h2>
                  <span className="text-[11px] text-muted-foreground/60">
                    {g.date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" }) !== g.label &&
                      g.date.toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}
                  </span>
                </div>

                <div className="space-y-2">
                  {g.items.map((v) => {
                    const adress = prettyAddr(v.slug);
                    const isPast = v.sluttid < now;
                    const isNow = v.datum <= now && v.sluttid >= now;

                    return (
                      <div
                        key={v.id}
                        className={[
                          "flex items-center gap-4 rounded-xl border p-4 transition-colors",
                          isNow
                            ? "border-primary/40 bg-primary/5"
                            : isPast
                              ? "border-border/40 bg-card/30 opacity-60"
                              : "border-border bg-card/70 hover:border-primary/30",
                        ].join(" ")}
                      >
                        {/* Time badge */}
                        <div className={[
                          "flex w-16 flex-shrink-0 flex-col items-center justify-center rounded-lg py-2 text-center",
                          isNow ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground",
                        ].join(" ")}>
                          <span className="text-xs font-semibold">{timeFmt(v.datum)}</span>
                          <span className="text-[9px] opacity-70">–{timeFmt(v.sluttid)}</span>
                          {isNow && <span className="mt-0.5 text-[9px] font-semibold text-primary animate-pulse">NU</span>}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/objekt/$slug"
                            params={{ slug: v.slug }}
                            search={{ tab: "Visningar", q: undefined }}
                            className="block truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {adress}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{v.typ}</span>
                            {v.deltagare.length > 0 && (
                              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {v.deltagare.length} anmälda
                              </span>
                            )}
                            {v.anteckningar && (
                              <span className="truncate max-w-[200px] text-[11px] text-muted-foreground/60 italic">
                                {v.anteckningar}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {!isPast && (
                            <button
                              onClick={() => exportVisningToICS(v, adress)}
                              title="Exportera till kalender"
                              className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary"
                            >
                              → Kalender
                            </button>
                          )}
                          <Link
                            to="/objekt/$slug"
                            params={{ slug: v.slug }}
                            search={{ tab: "Visningar", q: undefined }}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary"
                          >
                            Hantera →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
