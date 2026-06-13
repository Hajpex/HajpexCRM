import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { OBJEKT } from "../data/objekt";
import { listObjekt } from "../lib/objektStore";
import { listKontakter } from "../lib/kontaktStore";
import { listBud, fmtBud } from "../lib/budgivningStore";
import { slugifyAddr, fmtKrShort } from "./objekt.$slug";
import {
  getDashboardWidgets, saveDashboardWidgets,
  WIDGET_DEFS, type WidgetId, type WidgetState,
} from "../lib/dashboardStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Översikt · Hajpex CRM" },
      { name: "description", content: "Ditt dagliga mäklaröversikt." },
    ],
  }),
  component: DashboardPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

/* ── helpers ── */

function allObjects() {
  const saved = listObjekt();
  const savedAddrs = new Set(saved.map((o) => o.adress));
  return [...saved, ...OBJEKT.filter((o) => !savedAddrs.has(o.adress))];
}

const ACTIVE_STATUSES = new Set(["Till salu", "Redo (Kommande)", "Under intag", "Intaget"]);

/* ═══════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════════ */

function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetState[]>(getDashboardWidgets);
  const [editMode, setEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const objs = allObjects();
  const activeObjs = objs.filter((o) => ACTIVE_STATUSES.has(o.status));
  const soldCount = objs.filter((o) => o.status === "Såld").length;

  /* Client-side only data (localStorage not available during SSR) */
  const [kontakter, setKontakter] = useState<ReturnType<typeof listKontakter>>([]);
  const [budMap, setBudMap] = useState<BudMap>({});
  const [totalSpek, setTotalSpek] = useState(0);
  const [totalBud, setTotalBud] = useState(0);

  useEffect(() => {
    const ks = listKontakter();
    const bm: BudMap = {};
    for (const o of objs) {
      const slug = slugifyAddr(o.adress);
      bm[slug] = listBud(slug);
    }
    setKontakter(ks);
    setBudMap(bm);
    setTotalSpek(ks.filter((k) =>
      k.objektKopplingar.some((kp) => kp.relation === "spekulant")
    ).length);
    setTotalBud(Object.values(bm).reduce((acc, bids) => acc + bids.length, 0));
  }, []);

  const kpis = [
    { label: "Aktiva uppdrag", value: String(activeObjs.length), sub: "pågående objekt" },
    { label: "Spekulanter", value: String(totalSpek), sub: "registrerade" },
    { label: "Registrerade bud", value: String(totalBud), sub: "i systemet" },
    { label: "Sålda objekt", value: String(soldCount), sub: "i portföljen" },
  ];

  /* widget order helpers */
  function setVisible(id: WidgetId, visible: boolean) {
    const next = widgets.map((w) => (w.id === id ? { ...w, visible } : w));
    setWidgets(next);
    saveDashboardWidgets(next);
  }

  function moveWidget(idx: number, dir: -1 | 1) {
    const next = [...widgets];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setWidgets(next);
    saveDashboardWidgets(next);
  }

  /* drag-and-drop reorder */
  function onDragStart(idx: number, node: HTMLDivElement) {
    setDragIdx(idx);
    dragNode.current = node;
    node.style.opacity = "0.4";
  }
  function onDragEnter(idx: number) { setDropIdx(idx); }
  function onDragEnd() {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      const next = [...widgets];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      setWidgets(next);
      saveDashboardWidgets(next);
    }
    setDragIdx(null);
    setDropIdx(null);
    dragNode.current = null;
  }

  /* grid layout: full-width widgets span 2 cols, half span 1 */
  const visibleWidgets = widgets.filter((w) => w.visible);
  const hiddenWidgets = widgets.filter((w) => !w.visible);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">

        {/* ── Header ── */}
        <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.22em] text-primary/80">Översikt</div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serif}>
              God morgon, Erik<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeObjs.length} aktiva uppdrag · {totalSpek} spekulanter · {totalBud} bud registrerade
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={[
                "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                editMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary",
              ].join(" ")}
            >
              {editMode ? "✓ Klar" : "✎ Anpassa"}
            </button>
            <Link
              to="/objekt/nytt"
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              + Nytt objekt
            </Link>
          </div>
        </section>

        {/* ── Anpassa-banner ── */}
        {editMode && (
          <div className="mb-4 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-xs text-primary">
            Anpassningsläge — dra widgets för att flytta, klicka ✕ för att dölja, + för att visa igen.
          </div>
        )}

        {/* ── KPI strip ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card/80 p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)] backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{k.label}</div>
              <div className="mt-2 text-3xl font-medium text-foreground" style={serif}>{k.value}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Widget grid ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {visibleWidgets.map((w, idx) => {
            const def = WIDGET_DEFS.find((d) => d.id === w.id)!;
            const isDragging = dragIdx === idx;
            const isDropTarget = dropIdx === idx && dragIdx !== idx;
            return (
              <div
                key={w.id}
                className={[
                  "transition-all",
                  def.width === "full" ? "md:col-span-2" : "",
                  isDropTarget ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background rounded-xl" : "",
                  isDragging ? "scale-[0.98]" : "",
                ].join(" ")}
                draggable={editMode}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(idx, e.currentTarget as HTMLDivElement); }}
                onDragEnter={() => onDragEnter(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={onDragEnd}
              >
                <WidgetShell
                  id={w.id}
                  editMode={editMode}
                  isFirst={idx === 0}
                  isLast={idx === visibleWidgets.length - 1}
                  onHide={() => setVisible(w.id, false)}
                  onMoveUp={() => moveWidget(idx, -1)}
                  onMoveDown={() => moveWidget(idx, 1)}
                >
                  <WidgetContent id={w.id} objs={objs} activeObjs={activeObjs} kontakter={kontakter} budMap={budMap} />
                </WidgetShell>
              </div>
            );
          })}
        </div>

        {/* ── Hidden widgets (restore in edit mode) ── */}
        {editMode && hiddenWidgets.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Dolda widgets</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {hiddenWidgets.map((w) => {
                const def = WIDGET_DEFS.find((d) => d.id === w.id)!;
                return (
                  <button
                    key={w.id}
                    onClick={() => setVisible(w.id, true)}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-5 py-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm text-muted-foreground">+</span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{def.label}</div>
                      <div className="text-[11px] text-muted-foreground">{def.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── Widget shell (edit controls) ── */

function WidgetShell({
  id, editMode, isFirst, isLast, onHide, onMoveUp, onMoveDown, children,
}: {
  id: WidgetId; editMode: boolean;
  isFirst: boolean; isLast: boolean;
  onHide: () => void; onMoveUp: () => void; onMoveDown: () => void;
  children: ReactNode;
}) {
  void id;
  return (
    <div className={["relative rounded-xl transition-all", editMode ? "ring-1 ring-primary/30" : ""].join(" ")}>
      {editMode && (
        <div className="absolute -top-3 right-3 z-10 flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5 shadow-md">
            <span className="cursor-grab px-1 text-sm text-muted-foreground active:cursor-grabbing">⠿</span>
            <button
              onClick={onMoveUp} disabled={isFirst}
              className="rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >▲</button>
            <button
              onClick={onMoveDown} disabled={isLast}
              className="rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >▼</button>
            <button
              onClick={onHide}
              className="rounded px-1.5 text-xs text-muted-foreground hover:text-red-400"
            >✕</button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Widget router ── */

type ObjRow = (typeof OBJEKT)[number];

type BudMap = Record<string, ReturnType<typeof listBud>>;

function WidgetContent({
  id, objs, activeObjs, kontakter, budMap,
}: {
  id: WidgetId;
  objs: ObjRow[];
  activeObjs: ObjRow[];
  kontakter: ReturnType<typeof listKontakter>;
  budMap: BudMap;
}) {
  if (id === "aktiva-objekt") return <AktivaObjektWidget activeObjs={activeObjs} kontakter={kontakter} budMap={budMap} />;
  if (id === "pipeline") return <PipelineWidget objs={objs} />;
  if (id === "spekulanter") return <SpekulanterWidget kontakter={kontakter} />;
  if (id === "budgivning") return <BudgivningWidget budMap={budMap} objs={objs} />;
  if (id === "att-gora") return <AttGoraWidget objs={objs} kontakter={kontakter} budMap={budMap} />;
  return null;
}

/* ═══════════════════════════════════════════════════════════
   WIDGET: AKTIVA OBJEKT
══════════════════════════════════════════════════════════════ */

function AktivaObjektWidget({ activeObjs, kontakter, budMap }: { activeObjs: ObjRow[]; kontakter: ReturnType<typeof listKontakter>; budMap: BudMap }) {
  return (
    <DashCard title="Aktiva objekt" eyebrow="Portfölj" action={
      <Link to="/objekt" className="text-[11px] text-primary hover:underline">Visa alla →</Link>
    }>
      {activeObjs.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Inga aktiva uppdrag</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-3 pr-4 font-normal">Adress</th>
                <th className="pb-3 pr-4 font-normal">Typ</th>
                <th className="pb-3 pr-4 font-normal">Pris</th>
                <th className="pb-3 pr-4 font-normal">Status</th>
                <th className="pb-3 pr-4 font-normal text-right">Spek.</th>
                <th className="pb-3 font-normal text-right">Bud</th>
              </tr>
            </thead>
            <tbody>
              {activeObjs.map((o) => {
                const slug = slugifyAddr(o.adress);
                const spekCount = kontakter.filter((k) =>
                  k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "spekulant")
                ).length;
                const budCount = (budMap[slug] ?? []).length;
                return (
                  <tr key={o.adress} className="border-t border-border">
                    <td className="py-2.5 pr-4">
                      <Link
                        to="/objekt/$slug"
                        params={{ slug }}
                        search={{ tab: undefined, q: undefined }}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {o.adress}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">{o.stad}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{o.typ}</td>
                    <td className="py-2.5 pr-4 font-mono text-foreground">{fmtKrShort(o.pris)}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-foreground">{spekCount}</td>
                    <td className="py-2.5 text-right">
                      {budCount > 0 ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{budCount}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   WIDGET: PIPELINE
══════════════════════════════════════════════════════════════ */

const PIPELINE_STATUSES = [
  "Under intag", "Intaget", "Redo (Kommande)", "Till salu", "Såld",
] as const;

function PipelineWidget({ objs }: { objs: ObjRow[] }) {
  const counts = PIPELINE_STATUSES.map((s) => ({
    label: s, count: objs.filter((o) => o.status === s).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <DashCard title="Pipeline" eyebrow="Objektsflöde">
      <div className="space-y-3">
        {counts.map((c) => (
          <div key={c.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="font-mono font-medium text-foreground">{c.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                style={{ width: `${(c.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </DashCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   WIDGET: SENASTE SPEKULANTER
══════════════════════════════════════════════════════════════ */

function SpekulanterWidget({ kontakter }: { kontakter: ReturnType<typeof listKontakter> }) {
  type Entry = { namn: string; id: string; slug: string; addedAt: number };
  const entries: Entry[] = [];

  for (const k of kontakter) {
    for (const kp of k.objektKopplingar) {
      if (kp.relation === "spekulant") {
        entries.push({
          namn: `${k.fornamn} ${k.efternamn}`,
          id: k.id,
          slug: kp.slug,
          addedAt: kp.addedAt,
        });
      }
    }
  }
  entries.sort((a, b) => b.addedAt - a.addedAt);
  const recent = entries.slice(0, 7);

  function prettySlug(s: string) {
    return s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  function relTime(ts: number) {
    const diff = Date.now() - ts;
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "Idag";
    if (d === 1) return "Igår";
    return `${d} d sedan`;
  }

  return (
    <DashCard title="Senaste spekulanter" eyebrow="Aktivitet" action={
      <Link to="/kunder" className="text-[11px] text-primary hover:underline">Alla kunder →</Link>
    }>
      {recent.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Inga spekulanter ännu</div>
      ) : (
        <div className="divide-y divide-border">
          {recent.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                  {e.namn.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link to="/kunder/$id" params={{ id: e.id }} className="truncate text-sm font-medium text-foreground hover:text-primary">
                    {e.namn}
                  </Link>
                  <div className="truncate text-[10px] text-muted-foreground">{prettySlug(e.slug)}</div>
                </div>
              </div>
              <div className="flex-shrink-0 text-[10px] text-muted-foreground">{relTime(e.addedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   WIDGET: PÅGÅENDE BUDGIVNING
══════════════════════════════════════════════════════════════ */

function BudgivningWidget({ objs, budMap }: { objs: ObjRow[]; budMap: BudMap }) {
  const withBids = objs
    .map((o) => ({ o, slug: slugifyAddr(o.adress), bids: budMap[slugifyAddr(o.adress)] ?? [] }))
    .filter(({ bids }) => bids.length > 0)
    .sort((a, b) => (b.bids[0]?.belopp ?? 0) - (a.bids[0]?.belopp ?? 0));

  return (
    <DashCard title="Pågående budgivning" eyebrow="Bud">
      {withBids.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Inga registrerade bud ännu</div>
      ) : (
        <div className="divide-y divide-border">
          {withBids.map(({ o, slug, bids }) => {
            const highest = bids[0];
            const hasWinner = bids.some((b) => b.vinnare);
            return (
              <div key={slug} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to="/objekt/$slug"
                      params={{ slug }}
                      search={{ tab: "Budgivning", q: undefined }}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {o.adress}
                    </Link>
                    <div className="text-[10px] text-muted-foreground">{bids.length} bud</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium text-primary">{fmtBud(highest.belopp)}</div>
                    {hasWinner && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium text-emerald-500">✓ Vinnare markerad</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   WIDGET: ATT GÖRA
══════════════════════════════════════════════════════════════ */

function AttGoraWidget({
  objs, kontakter, budMap,
}: {
  objs: ObjRow[];
  kontakter: ReturnType<typeof listKontakter>;
  budMap: BudMap;
}) {
  type Task = { text: string; slug?: string; addr?: string; urgent?: boolean };
  const tasks: Task[] = [];

  for (const o of objs) {
    const slug = slugifyAddr(o.adress);
    const linked = kontakter.filter((k) =>
      k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "säljare")
    );

    if (o.status === "Under intag" && linked.length === 0) {
      tasks.push({ text: `${o.adress} — ingen säljare kopplad`, slug, addr: o.adress, urgent: true });
    }
    if (o.status === "Redo (Kommande)") {
      tasks.push({ text: `${o.adress} — klar att publiceras`, slug, addr: o.adress });
    }
    if (o.status === "Intaget") {
      tasks.push({ text: `${o.adress} — inväntar annonsering`, slug, addr: o.adress });
    }
    const bids = budMap[slug] ?? [];
    if (bids.length > 0 && !bids.some((b) => b.vinnare) && o.status === "Såld") {
      tasks.push({ text: `${o.adress} — markera vinnande bud`, slug, addr: o.adress, urgent: true });
    }
  }

  return (
    <DashCard title="Att göra" eyebrow="Åtgärder">
      {tasks.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Allt ser bra ut ✓</div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.slice(0, 8).map((t, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5">
              <span className={[
                "mt-0.5 h-2 w-2 flex-shrink-0 rounded-full",
                t.urgent ? "bg-red-400" : "bg-orange-400",
              ].join(" ")} />
              {t.slug ? (
                <Link
                  to="/objekt/$slug"
                  params={{ slug: t.slug }}
                  search={{ tab: undefined, q: undefined }}
                  className="text-sm text-foreground hover:text-primary"
                >
                  {t.text}
                </Link>
              ) : (
                <span className="text-sm text-foreground">{t.text}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED UI
══════════════════════════════════════════════════════════════ */

function DashCard({
  title, eyebrow, action, children,
}: {
  title: string; eyebrow: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="h-full rounded-xl border border-border bg-card/80 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.2)] backdrop-blur-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary/70">{eyebrow}</div>
          <h2 className="mt-0.5 text-base font-medium text-foreground" style={serif}>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Till salu" ? "border-primary/40 bg-primary/10 text-primary"
    : status === "Redo (Kommande)" ? "border-orange-400/40 bg-orange-400/10 text-orange-500"
    : status === "Såld" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-600"
    : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${cls}`}>
      {status}
    </span>
  );
}
