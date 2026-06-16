import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { OBJEKT } from "../data/objekt";
import { listObjekt } from "../lib/objektStore";
import { listKontakter } from "../lib/kontaktStore";
import { listBud, fmtBud } from "../lib/budgivningStore";
import { slugifyAddr, fmtKrShort } from "./objekt.$slug";
import { listIntagsmoten, type Intagsmote } from "../lib/intagsmoteStore";
import { listAllaVisningar, type Visning } from "../lib/visningarStore";
import type { Kontakt, NastaSteg } from "../lib/kontaktTypes";
import { generateMorningBrief } from "../lib/ai.functions";
import { listKontrakt } from "../lib/kontraktStore";

/* ═══════════════════════════════════════════════════════════
   WIDGET STORE
══════════════════════════════════════════════════════════════ */

const WIDGET_KEY = "hajpex.widgets.v2";

type QuickLink = { label: string; url: string };

type WidgetSettings = {
  /* toggles */
  idag: boolean;
  kommande: boolean;
  "aktiva-objekt": boolean;
  budgivning: boolean;
  "nasta-steg": boolean;
  "att-gora": boolean;
  vader: boolean;
  vaderOrt: string;
  "snabblänkar": boolean;
  links: QuickLink[];
  rantekollen: boolean;
  tilltraden: boolean;
  nyaSpekulanter: boolean;
  klisterlapp: boolean;
  /* order */
  leftOrder: string[];
  rightOrder: string[];
  /* post-it */
  klisterlappText: string;
  klisterlappX: number;
  klisterlappY: number;
};

const DEFAULT_LEFT_ORDER  = ["idag", "kommande", "aktiva-objekt", "vader", "rantekollen", "tilltraden"];
const DEFAULT_RIGHT_ORDER = ["snabblänkar", "budgivning", "nasta-steg", "att-gora", "nyaSpekulanter"];

const DEFAULT_WIDGETS: WidgetSettings = {
  idag: true, kommande: true, "aktiva-objekt": true,
  budgivning: true, "nasta-steg": true, "att-gora": true,
  vader: false, vaderOrt: "Stockholm",
  "snabblänkar": false, links: [
    { label: "Hemnet", url: "https://hemnet.se" },
    { label: "Lantmäteriet", url: "https://lantmateriet.se" },
    { label: "Vitec", url: "https://vitec.net" },
  ],
  rantekollen: false, tilltraden: false, nyaSpekulanter: false,
  klisterlapp: false,
  leftOrder: DEFAULT_LEFT_ORDER,
  rightOrder: DEFAULT_RIGHT_ORDER,
  klisterlappText: "", klisterlappX: 80, klisterlappY: 180,
};

/* ══════════════════════════════════════════════
   KLISTERLAPP STORE
══════════════════════════════════════════════ */

const KLISTRAR_KEY = "hajpex.klistrar.v1";

export type KlisterlappColor = "yellow" | "pink" | "blue" | "green" | "lavender";

export type Klisterlapp = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: KlisterlappColor;
  rotation: number;
};

const KLISTER_COLORS: Record<KlisterlappColor, { header: string; bg1: string; bg2: string; text: string; placeholder: string }> = {
  yellow:   { header: "#fbbf24", bg1: "#fef3c7", bg2: "#fde68a", text: "#78350f",  placeholder: "#d97706" },
  pink:     { header: "#f472b6", bg1: "#fce7f3", bg2: "#fbcfe8", text: "#831843",  placeholder: "#db2777" },
  blue:     { header: "#60a5fa", bg1: "#dbeafe", bg2: "#bfdbfe", text: "#1e3a5f",  placeholder: "#3b82f6" },
  green:    { header: "#34d399", bg1: "#d1fae5", bg2: "#a7f3d0", text: "#064e3b",  placeholder: "#059669" },
  lavender: { header: "#a78bfa", bg1: "#ede9fe", bg2: "#ddd6fe", text: "#4c1d95",  placeholder: "#7c3aed" },
};

function readKlistrar(): Klisterlapp[] {
  try {
    const raw = localStorage.getItem(KLISTRAR_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeKlistrar(list: Klisterlapp[]) {
  try { localStorage.setItem(KLISTRAR_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function addKlisterlapp(): Klisterlapp {
  const list = readKlistrar();
  const lapp: Klisterlapp = {
    id: crypto.randomUUID(),
    text: "",
    x: 80 + list.length * 24,
    y: 180 + list.length * 24,
    w: 220,
    h: 180,
    color: (["yellow", "pink", "blue", "green", "lavender"] as KlisterlappColor[])[list.length % 5],
    rotation: (Math.random() * 6 - 3),
  };
  writeKlistrar([...list, lapp]);
  return lapp;
}

function updateKlisterlapp(id: string, patch: Partial<Klisterlapp>) {
  writeKlistrar(readKlistrar().map((k) => k.id === id ? { ...k, ...patch } : k));
}

function deleteKlisterlapp(id: string) {
  writeKlistrar(readKlistrar().filter((k) => k.id !== id));
}

function readWidgets(): WidgetSettings {
  try {
    const raw = localStorage.getItem(WIDGET_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_WIDGETS,
      ...parsed,
      leftOrder: parsed.leftOrder?.length ? parsed.leftOrder : DEFAULT_LEFT_ORDER,
      rightOrder: parsed.rightOrder?.length ? parsed.rightOrder : DEFAULT_RIGHT_ORDER,
    };
  } catch { return DEFAULT_WIDGETS; }
}

function writeWidgets(w: WidgetSettings) {
  try { localStorage.setItem(WIDGET_KEY, JSON.stringify(w)); } catch { /* ignore */ }
}

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "God morgon";
  if (h < 17) return "God eftermiddag";
  return "God kväll";
}

function formatFullDate() {
  return new Date().toLocaleDateString("sv-SE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isSameDay(ts: number, ref: Date) {
  const d = new Date(ts);
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
}

function isTomorrow(ts: number, now: Date) {
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return isSameDay(ts, t);
}

function timeFmt(ts: number) {
  return new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function dayFmt(ts: number, now: Date) {
  if (isSameDay(ts, now)) return "Idag";
  if (isTomorrow(ts, now)) return "Imorgon";
  return new Date(ts).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Idag";
  if (d === 1) return "Igår";
  if (d < 7) return `${d} d sedan`;
  return new Date(ts).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

type BudMap = Record<string, ReturnType<typeof listBud>>;
type ObjRow = ReturnType<typeof allObjects>[number];

/* ═══════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════════ */

function DashboardPage() {
  const objs = allObjects();
  const activeObjs = objs.filter((o) => ACTIVE_STATUSES.has(o.status));

  const [kontakter, setKontakter] = useState<Kontakt[]>([]);
  const [budMap, setBudMap] = useState<BudMap>({});
  const [intagsmoten, setIntagsmoten] = useState<Intagsmote[]>([]);
  const [visningar, setVisningar] = useState<Visning[]>([]);
  const [savedObjCount, setSavedObjCount] = useState(0);
  const [now] = useState(() => new Date());
  const [briefText, setBriefText] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [widgets, setWidgets] = useState<WidgetSettings>(DEFAULT_WIDGETS);
  const [editingLayout, setEditingLayout] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [klistrar, setKlistrar] = useState<Klisterlapp[]>([]);

  useEffect(() => {
    setWidgets(readWidgets());
    setKlistrar(readKlistrar());
  }, []);

  const saveWidgets = useCallback((next: WidgetSettings) => {
    setWidgets(next);
    writeWidgets(next);
  }, []);

  function handleDragStart(id: string) { setDraggingId(id); }
  function handleDragOver(id: string)  { setDragOverId(id); }
  function handleDragEnd()             { setDraggingId(null); setDragOverId(null); }

  function handleDrop(targetId: string, column: "left" | "right") {
    if (!draggingId || draggingId === targetId) { handleDragEnd(); return; }
    const key = column === "left" ? "leftOrder" : "rightOrder";
    const order = [...widgets[key]];
    const fromIdx = order.indexOf(draggingId);
    const toIdx   = order.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return; }
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, draggingId);
    saveWidgets({ ...widgets, [key]: order });
    handleDragEnd();
  }

  useEffect(() => {
    const ks = listKontakter();
    const bm: BudMap = {};
    for (const o of objs) {
      const slug = slugifyAddr(o.adress);
      bm[slug] = listBud(slug);
    }
    setKontakter(ks);
    setBudMap(bm);
    setSavedObjCount(listObjekt().length);
    setIntagsmoten(
      listIntagsmoten()
        .filter((m) => m.status !== "Förlorad")
        .sort((a, b) => a.tidpunkt - b.tidpunkt)
    );
    setVisningar(listAllaVisningar());
  }, []);

  useEffect(() => {
    if (kontakter.length === 0 && visningar.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `hajpex.brief.${today}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setBriefText(cached); return; }
    } catch { /* ignore */ }

    const nowMs = Date.now();
    const overdueCount = kontakter.filter((k) => k.nastaSteg && k.nastaSteg.datum <= nowMs).length;
    const tf = (ts: number) => new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayStart.getDate() + 1);
    const visningarIdag = visningar
      .filter((v) => v.datum >= todayStart.getTime() && v.datum < todayEnd.getTime())
      .map((v) => ({
        tid: tf(v.datum),
        adress: v.slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      }));
    const silentCount = kontakter.filter((k) => {
      if (!k.aktiviteter?.length) return false;
      const last = Math.max(...k.aktiviteter.map((a: { tidpunkt: number }) => a.tidpunkt));
      return (nowMs - last) > 10 * 86_400_000;
    }).length;

    if (overdueCount === 0 && visningarIdag.length === 0 && silentCount === 0) return;

    setBriefLoading(true);
    generateMorningBrief({
      data: { overdueCount, visningarIdag, silentCount, activeObjCount: activeObjs.length },
    })
      .then((r) => {
        setBriefText(r.text);
        try { localStorage.setItem(cacheKey, r.text); } catch { /* ignore */ }
      })
      .catch(() => {})
      .finally(() => setBriefLoading(false));
  }, [kontakter, visningar]);

  /* derived */
  const totalSpek = kontakter.filter((k) =>
    k.objektKopplingar.some((kp) => kp.relation === "spekulant")
  ).length;

  const objsWithBids = objs
    .map((o) => ({ o, slug: slugifyAddr(o.adress), bids: budMap[slugifyAddr(o.adress)] ?? [] }))
    .filter(({ bids }) => bids.length > 0)
    .sort((a, b) => (b.bids[0]?.belopp ?? 0) - (a.bids[0]?.belopp ?? 0));

  const nowMs = now.getTime();
  const in7 = new Date(now); in7.setDate(now.getDate() + 7);

  const todayMoten = intagsmoten.filter(
    (m) => isSameDay(m.tidpunkt, now) && m.tidpunkt >= nowMs - 6 * 3_600_000
  );
  const pastPlannerMoten = intagsmoten.filter(
    (m) => m.status === "Planerat" && m.tidpunkt < nowMs - 6 * 3_600_000
  );
  const upcomingMoten = intagsmoten.filter(
    (m) => m.tidpunkt > nowMs && new Date(m.tidpunkt) <= in7
  );

  const overdueTasks: Array<{ k: Kontakt; ns: NastaSteg }> = kontakter
    .filter((k) => k.nastaSteg && k.nastaSteg.datum <= nowMs)
    .map((k) => ({ k, ns: k.nastaSteg! }))
    .sort((a, b) => a.ns.datum - b.ns.datum)
    .slice(0, 5);

  const upcomingTasks: Array<{ k: Kontakt; ns: NastaSteg }> = kontakter
    .filter((k) => k.nastaSteg && k.nastaSteg.datum > nowMs)
    .map((k) => ({ k, ns: k.nastaSteg! }))
    .sort((a, b) => a.ns.datum - b.ns.datum)
    .slice(0, 3);

  const todayVisningar = visningar.filter((v) => isSameDay(v.datum, now)).sort((a, b) => a.datum - b.datum);
  const upcomingVisningar = visningar
    .filter((v) => v.datum > nowMs && !isSameDay(v.datum, now) && v.datum <= in7.getTime())
    .sort((a, b) => a.datum - b.datum);

  const kpis = [
    { label: "Aktiva uppdrag", value: String(activeObjs.length), to: "/objekt" as const },
    { label: "Spekulanter", value: String(totalSpek), to: "/kunder" as const },
    { label: "Pågående bud", value: String(objsWithBids.length), to: "/objekt" as const },
    { label: "Visningar (7 dagar)", value: String(visningar.filter((v) => v.datum >= nowMs && v.datum <= in7.getTime()).length), to: "/objekt" as const },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">

        {/* ── Header ── */}
        <section className="mb-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">Översikt</p>
              <h1 className="text-4xl font-medium leading-tight md:text-[52px]" style={serif}>
                {getGreeting()}<span className="text-primary">.</span>
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {capitalize(formatFullDate())}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setEditingLayout(true)}
                className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                ⊞ Redigera layout
              </button>
              <Link
                to="/kunder"
                search={{ q: undefined, roll: undefined }}
                className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                + Ny kontakt
              </Link>
              <Link
                to="/objekt/nytt"
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                + Nytt objekt
              </Link>
            </div>
          </div>

          {/* AI Morning Brief */}
          {(briefLoading || briefText) && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="mt-0.5 text-base">✦</span>
              <div className="min-w-0 flex-1">
                {briefLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-primary/20" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-primary/15" />
                  </div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-foreground/80">{briefText}</p>
                )}
              </div>
            </div>
          )}

          {/* Onboarding — interaktiv checklista, döljer sig själv när klar/bortvald */}
          <OnboardingBanner
            progress={{
              hasObjekt: savedObjCount > 0,
              hasKontakt: kontakter.length > 0,
              hasVisning: visningar.length > 0,
              hasBud: objsWithBids.length > 0,
              hasKontrakt: listKontrakt().some((k) => k.data?.signerat),
            }}
          />

          {/* KPI strip */}
          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => (
              <Link key={k.label} to={k.to} className="group rounded-xl border border-border bg-card/70 px-4 py-3.5 transition-colors hover:border-primary/30">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k.label}</p>
                <p className="mt-1.5 text-2xl font-medium group-hover:text-primary transition-colors" style={serif}>{k.value}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

          {/* ── LEFT (2/3) ── */}
          <div className="md:col-span-2 space-y-6">
            {widgets.leftOrder.map((id) => {
              let card: ReactNode = null;
              if (id === "idag" && widgets.idag) card = (
                <DashCard title="Idag" eyebrow="Agenda" action={
                  <Link to="/kunder" search={{ q: undefined, roll: undefined }} className="rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20">+ Nytt möte</Link>
                }>
                  {pastPlannerMoten.length === 0 && todayMoten.length === 0 && todayVisningar.length === 0 ? (
                    <EmptySlot icon="📅" text="Inga möten eller visningar idag" hint="Skapa ett nytt möte från en kontakt" />
                  ) : (
                    <div className="divide-y divide-border">
                      {pastPlannerMoten.slice(0, 2).map((m) => <MoteRow key={m.id} mote={m} kontakter={kontakter} variant="overdue" now={now} />)}
                      {todayMoten.map((m) => <MoteRow key={m.id} mote={m} kontakter={kontakter} variant="today" now={now} />)}
                      {todayVisningar.map((v) => <VisningDashRow key={v.id} visning={v} />)}
                    </div>
                  )}
                </DashCard>
              );
              if (id === "kommande" && widgets.kommande && (upcomingMoten.length > 0 || upcomingVisningar.length > 0)) card = (
                <DashCard title="Kommande" eyebrow="Nästa 7 dagar">
                  <div className="divide-y divide-border">
                    {[...upcomingMoten.map((m) => ({ type: "mote" as const, ts: m.tidpunkt, item: m })), ...upcomingVisningar.map((v) => ({ type: "visning" as const, ts: v.datum, item: v }))]
                      .sort((a, b) => a.ts - b.ts).slice(0, 7)
                      .map((e) => e.type === "mote"
                        ? <MoteRow key={e.item.id} mote={e.item as Intagsmote} kontakter={kontakter} variant="upcoming" now={now} />
                        : <VisningDashRow key={e.item.id} visning={e.item as Visning} />)}
                  </div>
                </DashCard>
              );
              if (id === "aktiva-objekt" && widgets["aktiva-objekt"]) card = (
                <DashCard title="Aktiva objekt" eyebrow="Portfölj" action={<Link to="/objekt" className="text-[11px] text-primary hover:underline">Visa alla →</Link>}>
                  {activeObjs.length === 0 ? <EmptySlot icon="🏠" text="Inga aktiva uppdrag" hint="Lägg till ditt första objekt" /> : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          <th className="pb-3 pl-1 pr-4 font-normal">Adress</th>
                          <th className="pb-3 pr-4 font-normal hidden sm:table-cell">Typ</th>
                          <th className="pb-3 pr-4 font-normal">Utrop</th>
                          <th className="pb-3 pr-3 font-normal">Status</th>
                          <th className="pb-3 pr-3 text-right font-normal hidden md:table-cell">Spek</th>
                          <th className="pb-3 text-right font-normal">Bud</th>
                        </tr></thead>
                        <tbody>{activeObjs.map((o) => {
                          const slug = slugifyAddr(o.adress);
                          const spekCount = kontakter.filter((k) => k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "spekulant")).length;
                          const budCount = (budMap[slug] ?? []).length;
                          return (
                            <tr key={o.adress} className="group border-t border-border">
                              <td className="py-2.5 pl-1 pr-4"><Link to="/objekt/$slug" params={{ slug }} search={{ tab: undefined, q: undefined }} className="font-medium text-foreground hover:text-primary">{o.adress}</Link><div className="text-[10px] text-muted-foreground">{o.stad}</div></td>
                              <td className="py-2.5 pr-4 text-xs text-muted-foreground hidden sm:table-cell">{o.typ}</td>
                              <td className="py-2.5 pr-4 font-mono text-sm">{fmtKrShort(o.pris)}</td>
                              <td className="py-2.5 pr-3"><StatusBadge status={o.status} /></td>
                              <td className="py-2.5 pr-3 text-right font-mono text-sm hidden md:table-cell">{spekCount || <span className="text-muted-foreground">—</span>}</td>
                              <td className="py-2.5 text-right">{budCount > 0 ? <Link to="/objekt/$slug" params={{ slug }} search={{ tab: "Budgivning", q: undefined }} className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20">{budCount}</Link> : <span className="text-muted-foreground text-xs">—</span>}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  )}
                </DashCard>
              );
              if (id === "vader" && widgets.vader) card = <VaderWidget ort={widgets.vaderOrt} />;
              if (id === "rantekollen" && widgets.rantekollen) card = <RantekollenWidget />;
              if (id === "tilltraden" && widgets.tilltraden) card = <TilltrádenWidget />;
              if (!card) return null;
              return (
                <DraggableCard key={id} id={id} column="left" editMode={editingLayout}
                  draggingId={draggingId} dragOverId={dragOverId}
                  onDragStart={handleDragStart} onDragOver={handleDragOver}
                  onDrop={handleDrop} onDragEnd={handleDragEnd}>
                  {card}
                </DraggableCard>
              );
            })}
          </div>

          {/* ── RIGHT SIDEBAR (1/3) ── */}
          <div className="space-y-6">
            {widgets.rightOrder.map((id) => {
              let card: ReactNode = null;
              if (id === "snabblänkar" && widgets["snabblänkar"] && widgets.links.length > 0) card = <SnabblänkarWidget links={widgets.links} />;
              if (id === "budgivning" && widgets.budgivning) card = (
                <DashCard title="Aktiv budgivning" eyebrow="Live" action={objsWithBids.length > 0 ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-500">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{objsWithBids.length} aktiva
                  </span>) : undefined}>
                  {objsWithBids.length === 0 ? <EmptySlot icon="🔨" text="Inga pågående bud" /> : (
                    <div className="divide-y divide-border">
                      {objsWithBids.slice(0, 6).map(({ o, slug, bids }) => {
                        const highest = bids[0];
                        const hasWinner = bids.some((b) => b.vinnare);
                        return (
                          <Link key={slug} to="/objekt/$slug" params={{ slug }} search={{ tab: "Budgivning", q: undefined }} className="group block py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{o.adress}</p><p className="text-[10px] text-muted-foreground">{bids.length} bud · {relTime(highest.tidpunkt ?? Date.now())}</p></div>
                              <div className="flex-shrink-0 text-right"><p className="font-mono text-sm font-semibold text-primary">{fmtBud(highest.belopp)}</p>{hasWinner && <span className="text-[9px] font-medium text-emerald-500">✓ Klar</span>}</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </DashCard>
              );
              if (id === "nasta-steg" && widgets["nasta-steg"] && (overdueTasks.length > 0 || upcomingTasks.length > 0)) card = (
                <DashCard title="Att följa upp" eyebrow="Nästa steg" action={<Link to="/kunder" search={{ q: undefined, roll: undefined }} className="text-[11px] text-primary hover:underline">Alla →</Link>}>
                  <div className="divide-y divide-border">
                    {overdueTasks.map(({ k, ns }) => <NastaStegRow key={k.id} kontakt={k} ns={ns} overdue now={now} />)}
                    {upcomingTasks.map(({ k, ns }) => <NastaStegRow key={k.id} kontakt={k} ns={ns} now={now} />)}
                  </div>
                </DashCard>
              );
              if (id === "att-gora" && widgets["att-gora"]) card = <SmartAttGora objs={objs} kontakter={kontakter} budMap={budMap} />;
              if (id === "nyaSpekulanter" && widgets.nyaSpekulanter) card = <NyaSpekulanterWidget kontakter={kontakter} />;
              if (!card) return null;
              return (
                <DraggableCard key={id} id={id} column="right" editMode={editingLayout}
                  draggingId={draggingId} dragOverId={dragOverId}
                  onDragStart={handleDragStart} onDragOver={handleDragOver}
                  onDrop={handleDrop} onDragEnd={handleDragEnd}>
                  {card}
                </DraggableCard>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Klistrar ── */}
      {widgets.klisterlapp && klistrar.map((lapp) => (
        <KlisterlappFloat
          key={lapp.id}
          lapp={lapp}
          onUpdate={(patch) => { updateKlisterlapp(lapp.id, patch); setKlistrar(readKlistrar()); }}
          onDelete={() => { deleteKlisterlapp(lapp.id); setKlistrar(readKlistrar()); }}
        />
      ))}
      {/* Add-knapp */}
      {widgets.klisterlapp && (
        <button
          onClick={() => { addKlisterlapp(); setKlistrar(readKlistrar()); }}
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
          title="Ny klisterlapp"
        >
          +
        </button>
      )}

      {/* ── Layout editor panel ── */}
      {editingLayout && (
        <LayoutEditor widgets={widgets} onChange={saveWidgets} onClose={() => setEditingLayout(false)} />
      )}
    </AppShell>
  );
}

/* ── Mote row ── */

function MoteRow({
  mote, kontakter, variant, now,
}: {
  mote: Intagsmote;
  kontakter: Kontakt[];
  variant: "today" | "upcoming" | "overdue";
  now: Date;
}) {
  const kontakt = kontakter.find((k) => k.id === mote.kontaktId);
  const label = variant === "upcoming" ? dayFmt(mote.tidpunkt, now) : timeFmt(mote.tidpunkt);

  return (
    <Link
      to="/kunder/$id"
      params={{ id: mote.kontaktId }}
      className="group flex items-start gap-3.5 py-3"
    >
      <div className={[
        "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold leading-none",
        variant === "overdue"
          ? "bg-red-500/10 text-red-500"
          : variant === "today"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
      ].join(" ")}>
        {variant === "upcoming" ? (
          <span className="text-center">
            {new Date(mote.tidpunkt).getDate()}<br />
            {new Date(mote.tidpunkt).toLocaleString("sv-SE", { month: "short" })}
          </span>
        ) : (
          label
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {mote.adress}{mote.ort ? `, ${mote.ort}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {kontakt ? `${kontakt.fornamn} ${kontakt.efternamn}` : "Okänd kontakt"}
          {variant === "upcoming" && ` · ${timeFmt(mote.tidpunkt)}`}
        </p>
        {variant === "overdue" && (
          <p className="mt-0.5 text-[10px] text-red-400">Genomförd? Uppdatera status →</p>
        )}
      </div>
      <MoteStatusPill status={mote.status} />
    </Link>
  );
}

function MoteStatusPill({ status }: { status: string }) {
  const cls =
    status === "Planerat"   ? "bg-blue-500/10 text-blue-500"
    : status === "Genomfört" ? "bg-emerald-500/10 text-emerald-600"
    : status === "Vunnen"   ? "bg-primary/10 text-primary"
    : "bg-red-500/10 text-red-500";
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

/* ── Visning dash row ── */

function VisningDashRow({ visning }: { visning: Visning }) {
  const slug = visning.slug;
  const icon = visning.typ === "Öppen" ? "🏠" : visning.typ === "Privat" ? "🔑" : "⚖️";
  return (
    <Link
      to="/objekt/$slug"
      params={{ slug }}
      search={{ tab: "Visningar", q: undefined }}
      className="group flex items-start gap-3.5 py-3"
    >
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-sm text-amber-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Visning {visning.typ.toLowerCase()} · {timeFmt(visning.datum)}–{timeFmt(visning.sluttid)} · {visning.deltagare.length} anmälda
        </p>
      </div>
      <span className="flex-shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-500">
        Visning
      </span>
    </Link>
  );
}

/* ── Nästa steg row ── */

function NastaStegRow({
  kontakt, ns, overdue, now,
}: {
  kontakt: Kontakt;
  ns: NastaSteg;
  overdue?: boolean;
  now: Date;
}) {
  const icon = ns.typ === "samtal" ? "📞" : ns.typ === "möte" ? "🤝" : ns.typ === "mejl" ? "✉️" : "📌";
  return (
    <Link to="/kunder/$id" params={{ id: kontakt.id }} className="group flex items-start gap-3 py-3">
      <span className="mt-0.5 text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {kontakt.fornamn} {kontakt.efternamn}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{ns.text}</p>
        <p className={[
          "mt-0.5 text-[10px]",
          overdue ? "text-red-400 font-medium" : "text-muted-foreground",
        ].join(" ")}>
          {overdue ? `Förfallen — ${relTime(ns.datum)}` : dayFmt(ns.datum, now)}
        </p>
      </div>
    </Link>
  );
}

/* ── Smart att-göra ── */

function SmartAttGora({
  objs, kontakter, budMap,
}: {
  objs: ObjRow[];
  kontakter: Kontakt[];
  budMap: BudMap;
}) {
  type Task = { text: string; slug: string; search: Record<string, string | undefined>; urgent?: boolean };
  const tasks: Task[] = [];

  for (const o of objs) {
    const slug = slugifyAddr(o.adress);
    const bids = budMap[slug] ?? [];
    const linked = kontakter.filter((k) =>
      k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "säljare")
    );

    if (o.status === "Under intag" && linked.length === 0) {
      tasks.push({ text: `${o.adress} — lägg till säljare`, slug, search: { tab: "Kontakter", q: undefined }, urgent: true });
    }
    if (o.status === "Redo (Kommande)") {
      tasks.push({ text: `${o.adress} — redo att publiceras`, slug, search: { tab: undefined, q: undefined } });
    }
    if (o.status === "Intaget") {
      tasks.push({ text: `${o.adress} — inväntar annonsering`, slug, search: { tab: undefined, q: undefined } });
    }
    if (bids.length > 0 && !bids.some((b) => b.vinnare) && o.status === "Såld") {
      tasks.push({ text: `${o.adress} — markera vinnande bud`, slug, search: { tab: "Budgivning", q: undefined }, urgent: true });
    }
  }

  if (tasks.length === 0) return null;

  return (
    <DashCard title="Kräver åtgärd" eyebrow="System">
      <div className="space-y-2.5">
        {tasks.slice(0, 7).map((t, i) => (
          <Link
            key={i}
            to="/objekt/$slug"
            params={{ slug: t.slug }}
            search={t.search as any}
            className="group flex items-start gap-2.5"
          >
            <div className={[
              "mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
              t.urgent ? "bg-red-400" : "bg-amber-400",
            ].join(" ")} />
            <span className="text-xs text-foreground group-hover:text-primary">{t.text}</span>
          </Link>
        ))}
      </div>
    </DashCard>
  );
}

/* ── Draggable card wrapper ── */

function DraggableCard({ id, column, editMode, draggingId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd, children }: {
  id: string; column: "left" | "right"; editMode: boolean;
  draggingId: string | null; dragOverId: string | null;
  onDragStart: (id: string) => void; onDragOver: (id: string) => void;
  onDrop: (id: string, col: "left" | "right") => void; onDragEnd: () => void;
  children: ReactNode;
}) {
  const isBeingDragged = draggingId === id;
  const isDropTarget   = dragOverId === id && draggingId !== id;

  return (
    <div
      draggable={editMode}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(id); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(id, column); }}
      onDragEnd={onDragEnd}
      className={[
        "relative transition-all duration-150",
        editMode ? "cursor-grab select-none" : "",
        isBeingDragged ? "opacity-40 scale-[0.98]" : "",
      ].join(" ")}
    >
      {/* snap-line indicator */}
      {isDropTarget && (
        <div className="pointer-events-none absolute inset-x-0 -top-[3px] z-20 h-[3px] rounded-full bg-primary shadow-[0_0_8px_2px_oklch(var(--primary)/0.4)]" />
      )}
      {/* drag handle */}
      {editMode && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-card/80 px-1.5 py-1 text-[11px] text-muted-foreground/50 shadow-sm backdrop-blur-sm select-none hover:text-muted-foreground">
          <span className="text-base leading-none">⠿</span>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Räntekollen widget ── */

function RantekollenWidget() {
  const [rate, setRate] = useState<{ value: number; date: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cacheKey = `hajpex.ranta.${new Date().toISOString().slice(0, 10)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setRate(JSON.parse(cached)); return; }
    } catch { /* ignore */ }

    fetch("https://api.riksbank.se/swea/v1/Rates/Latest?seriesid=SECBREPO", {
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        const entry = Array.isArray(data) ? data[0] : data?.rates?.[0];
        if (!entry) throw new Error("no data");
        const result = { value: parseFloat(entry.value ?? entry.rata ?? entry.rate), date: entry.date };
        setRate(result);
        try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* ignore */ }
      })
      .catch(() => setError(true));
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">Mäklarsaker</p>
      <h2 className="mt-0.5 mb-3 text-base font-medium text-foreground" style={serif}>Räntekollen</h2>
      {error ? (
        <p className="text-xs text-muted-foreground">Riksbank-data ej tillgänglig just nu</p>
      ) : !rate ? (
        <div className="space-y-2"><div className="h-8 w-1/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-medium" style={serif}>{rate.value.toFixed(2)}<span className="text-lg">%</span></p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Riksbankens styrränta · per {rate.date}</p>
          <p className="mt-2 text-[10px] text-muted-foreground/60">Källa: Riksbanken SWEA API</p>
        </div>
      )}
    </section>
  );
}

/* ── Tillträden snart widget ── */

function TilltrádenWidget() {
  const [items, setItems] = useState<Array<{ slug: string; adress: string; datum: string; dagar: number }>>([]);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in60 = new Date(today); in60.setDate(today.getDate() + 60);
    const result: typeof items = [];
    for (const { slug, data } of listKontrakt()) {
      if (!data.tilltradesdatum) continue;
      const d = new Date(data.tilltradesdatum);
      if (isNaN(d.getTime()) || d < today || d > in60) continue;
      const dagar = Math.round((d.getTime() - today.getTime()) / 86400000);
      const adress = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      result.push({ slug, adress, datum: data.tilltradesdatum, dagar });
    }
    setItems(result.sort((a, b) => a.dagar - b.dagar));
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">Mäklarsaker</p>
      <h2 className="mt-0.5 mb-3 text-base font-medium text-foreground" style={serif}>Tillträden snart</h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga tillträden inom 60 dagar</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <Link key={it.slug} to="/objekt/$slug" params={{ slug: it.slug }} search={{ tab: "Kontrakt", q: undefined }} className="group flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{it.adress}</p>
                <p className="text-[10px] text-muted-foreground">{it.datum}</p>
              </div>
              <span className={["flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                it.dagar <= 7 ? "bg-red-500/10 text-red-500" : it.dagar <= 14 ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
              ].join(" ")}>
                {it.dagar === 0 ? "Idag" : `${it.dagar} d`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Nya spekulanter widget ── */

function NyaSpekulanterWidget({ kontakter }: { kontakter: Kontakt[] }) {
  const cutoff = Date.now() - 7 * 86_400_000;
  const nya = kontakter
    .filter((k) => k.skapadAt >= cutoff && k.objektKopplingar.some((kp) => kp.relation === "spekulant"))
    .sort((a, b) => b.skapadAt - a.skapadAt)
    .slice(0, 6);

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">CRM</p>
      <h2 className="mt-0.5 mb-3 text-base font-medium text-foreground" style={serif}>Nya spekulanter</h2>
      {nya.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga nya spekulanter senaste 7 dagarna</p>
      ) : (
        <div className="divide-y divide-border">
          {nya.map((k) => {
            const slug = k.objektKopplingar.find((kp) => kp.relation === "spekulant")?.slug ?? "";
            return (
              <Link key={k.id} to="/kunder/$id" params={{ id: k.id }} className="group flex items-center gap-3 py-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {k.fornamn[0]}{k.efternamn[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{k.fornamn} {k.efternamn}</p>
                  <p className="text-[10px] text-muted-foreground">{slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Klisterlapp (floating post-it) ── */

function KlisterlappFloat({ lapp, onUpdate, onDelete }: {
  lapp: Klisterlapp;
  onUpdate: (patch: Partial<Klisterlapp>) => void;
  onDelete: () => void;
}) {
  const divRef  = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const resRef  = useRef({ active: false, sx: 0, sy: 0, ow: 0, oh: 0 });
  const c = KLISTER_COLORS[lapp.color];

  /* ── Drag (move) ── */
  function startDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.preventDefault();
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: lapp.x, oy: lapp.y };
    function onMove(e: MouseEvent) {
      if (!dragRef.current.active || !divRef.current) return;
      const nx = Math.max(0, dragRef.current.ox + e.clientX - dragRef.current.sx);
      const ny = Math.max(0, dragRef.current.oy + e.clientY - dragRef.current.sy);
      divRef.current.style.left = `${nx}px`;
      divRef.current.style.top  = `${ny}px`;
    }
    function onUp(e: MouseEvent) {
      dragRef.current.active = false;
      const nx = Math.max(0, dragRef.current.ox + e.clientX - dragRef.current.sx);
      const ny = Math.max(0, dragRef.current.oy + e.clientY - dragRef.current.sy);
      onUpdate({ x: nx, y: ny });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /* ── Resize (bottom-right corner) ── */
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resRef.current = { active: true, sx: e.clientX, sy: e.clientY, ow: lapp.w, oh: lapp.h };
    function onMove(e: MouseEvent) {
      if (!resRef.current.active || !divRef.current) return;
      const nw = Math.max(160, resRef.current.ow + e.clientX - resRef.current.sx);
      const nh = Math.max(120, resRef.current.oh + e.clientY - resRef.current.sy);
      divRef.current.style.width  = `${nw}px`;
      divRef.current.style.height = `${nh}px`;
    }
    function onUp(e: MouseEvent) {
      resRef.current.active = false;
      const nw = Math.max(160, resRef.current.ow + e.clientX - resRef.current.sx);
      const nh = Math.max(120, resRef.current.oh + e.clientY - resRef.current.sy);
      onUpdate({ w: nw, h: nh });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      ref={divRef}
      onMouseDown={startDrag}
      className="fixed z-50 flex flex-col overflow-hidden rounded-sm select-none"
      style={{
        left: lapp.x, top: lapp.y,
        width: lapp.w, height: lapp.h,
        transform: `rotate(${lapp.rotation}deg)`,
        boxShadow: "0 6px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      {/* ── Header strip: pin + color swatches + delete ── */}
      <div
        className="flex flex-shrink-0 cursor-grab items-center gap-1.5 px-2.5 py-1.5 active:cursor-grabbing"
        style={{ background: c.header }}
      >
        <span className="text-sm leading-none">📌</span>

        {/* Color swatches */}
        <div className="flex gap-1" data-no-drag="1">
          {(Object.keys(KLISTER_COLORS) as KlisterlappColor[]).map((col) => (
            <button
              key={col}
              data-no-drag="1"
              onClick={(e) => { e.stopPropagation(); onUpdate({ color: col }); }}
              className="h-3 w-3 rounded-full border border-white/40 transition-transform hover:scale-110"
              style={{ background: KLISTER_COLORS[col].header }}
              title={col}
            />
          ))}
        </div>

        {/* Delete */}
        <button
          data-no-drag="1"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold opacity-60 transition-opacity hover:opacity-100"
          style={{ color: c.text }}
          title="Ta bort"
        >
          ×
        </button>
      </div>

      {/* ── Note body ── */}
      <div
        className="relative flex-1"
        style={{ background: `linear-gradient(160deg,${c.bg1} 0%,${c.bg2} 100%)` }}
      >
        <textarea
          value={lapp.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Skriv här…"
          className="absolute inset-0 w-full h-full resize-none bg-transparent px-3 py-2 text-[13px] leading-relaxed focus:outline-none"
          style={{
            color: c.text,
            fontFamily: "'Instrument Serif', Georgia, serif",
            caretColor: c.header,
          }}
        />

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 cursor-se-resize p-1.5"
          title="Dra för att ändra storlek"
          data-no-drag="1"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M9 1L1 9M9 5L5 9M9 9H9" stroke={c.header} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Väder widget ── */

type VaderData = { temp: number; feels: number; emoji: string; desc: string; ort: string };

function wmoEmoji(code: number): { emoji: string; desc: string } {
  if (code === 0)              return { emoji: "☀️",  desc: "Klar himmel" };
  if (code <= 2)               return { emoji: "🌤",  desc: "Mestadels klar" };
  if (code === 3)              return { emoji: "☁️",  desc: "Mulet" };
  if (code <= 48)              return { emoji: "🌫",  desc: "Dimma" };
  if (code <= 55)              return { emoji: "🌦",  desc: "Duggregn" };
  if (code <= 65)              return { emoji: "🌧",  desc: "Regn" };
  if (code <= 77)              return { emoji: "🌨",  desc: "Snö" };
  if (code <= 82)              return { emoji: "🌦",  desc: "Regnskurar" };
  if (code >= 95)              return { emoji: "⛈",  desc: "Åska" };
  return { emoji: "🌡", desc: "Okänt" };
}

function VaderWidget({ ort }: { ort: string }) {
  const [data, setData] = useState<VaderData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cacheKey = `hajpex.vader2.${ort}.${new Date().toISOString().slice(0, 13)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setData(JSON.parse(cached)); return; }
    } catch { /* ignore */ }

    // Step 1: geocode city name
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ort)}&count=1&language=sv&format=json`)
      .then((r) => r.json())
      .then((geo) => {
        const res = geo.results?.[0];
        if (!res) throw new Error("not found");
        const { latitude, longitude, name } = res;
        // Step 2: fetch weather
        return fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code`
        ).then((r) => r.json()).then((w) => {
          const cur = w.current;
          const { emoji, desc } = wmoEmoji(cur.weather_code);
          const d: VaderData = {
            temp: Math.round(cur.temperature_2m),
            feels: Math.round(cur.apparent_temperature),
            emoji, desc, ort: name,
          };
          setData(d);
          try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* ignore */ }
        });
      })
      .catch(() => setError(true));
  }, [ort]);

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">Mäklarsaker</p>
      <h2 className="mt-0.5 mb-3 text-base font-medium text-foreground" style={serif}>Väder</h2>
      {error ? (
        <p className="text-xs text-muted-foreground">Kunde inte hämta väder för "{ort}"</p>
      ) : !data ? (
        <div className="space-y-2">
          <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-3">
            <span className="text-4xl leading-none">{data.emoji}</span>
            <div>
              <p className="text-2xl font-medium leading-none" style={serif}>{data.temp}°C</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{data.desc} · Känns {data.feels}°C</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{data.ort}</p>
        </div>
      )}
    </section>
  );
}

/* ── Snabblänkar widget ── */

function SnabblänkarWidget({ links }: { links: QuickLink[] }) {
  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">Mäklarsaker</p>
      <h2 className="mt-0.5 mb-3 text-base font-medium text-foreground" style={serif}>Snabblänkar</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {l.label} ↗
          </a>
        ))}
      </div>
    </section>
  );
}

/* ── Layout editor panel ── */

const WIDGET_META: Array<{ id: string; label: string; desc: string; category: string }> = [
  { id: "idag",           label: "Idag",              desc: "Dagens möten och visningar",          category: "Dashboard" },
  { id: "kommande",       label: "Kommande",           desc: "Möten och visningar nästa 7 dagar",   category: "Dashboard" },
  { id: "aktiva-objekt",  label: "Aktiva objekt",      desc: "Portföljöversikt",                    category: "Dashboard" },
  { id: "budgivning",     label: "Aktiv budgivning",   desc: "Live budgivningsstatus",               category: "Dashboard" },
  { id: "nasta-steg",     label: "Att följa upp",      desc: "Förfallna och kommande nästa steg",   category: "Dashboard" },
  { id: "att-gora",       label: "Kräver åtgärd",     desc: "Automatiska påminnelser",             category: "Dashboard" },
  { id: "vader",          label: "Väder",              desc: "Aktuellt väder för din ort",          category: "Widgets" },
  { id: "rantekollen",    label: "Räntekollen",        desc: "Riksbankens styrränta live",          category: "Widgets" },
  { id: "tilltraden",     label: "Tillträden snart",   desc: "Objekt med tillträde inom 60 dagar",  category: "Widgets" },
  { id: "nyaSpekulanter", label: "Nya spekulanter",    desc: "Spekulanter tillagda senaste 7 dagar", category: "Widgets" },
  { id: "snabblänkar",    label: "Snabblänkar",        desc: "Hemnet, Lantmäteriet m.fl.",          category: "Widgets" },
  { id: "klisterlapp",    label: "Klisterlapp",        desc: "Fri anteckning, dra vart du vill",    category: "Widgets" },
];

function LayoutEditor({
  widgets, onChange, onClose,
}: {
  widgets: WidgetSettings;
  onChange: (w: WidgetSettings) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<WidgetSettings>({ ...widgets });
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  function toggle(id: string) {
    setLocal((prev) => ({ ...prev, [id]: !(prev as Record<string, unknown>)[id] }));
  }

  function addLink() {
    const label = newLinkLabel.trim();
    let url = newLinkUrl.trim();
    if (!label || !url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    setLocal((prev) => ({ ...prev, links: [...prev.links, { label, url }] }));
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function removeLink(i: number) {
    setLocal((prev) => ({ ...prev, links: prev.links.filter((_, j) => j !== i) }));
  }

  function save() {
    onChange(local);
    onClose();
  }

  const categories = ["Dashboard", "Widgets"];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto border-l border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">Anpassa</p>
            <h2 className="text-base font-medium text-foreground" style={serif}>Redigera layout</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{cat}</p>
              <div className="space-y-2">
                {WIDGET_META.filter((w) => w.category === cat).map((meta) => (
                  <button
                    key={meta.id}
                    onClick={() => toggle(meta.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-background/50 p-3 text-left transition-colors hover:border-primary/30"
                  >
                    {(() => {
                      const on = !!(local as Record<string, unknown>)[meta.id];
                      return (
                        <div className={["flex h-5 w-5 flex-shrink-0 items-center justify-center rounded", on ? "bg-primary text-primary-foreground" : "border border-border bg-background"].join(" ")}>
                          {on && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Weather location setting */}
          {local.vader && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Väderort</p>
              <input
                type="text"
                value={local.vaderOrt}
                onChange={(e) => setLocal((prev) => ({ ...prev, vaderOrt: e.target.value }))}
                placeholder="t.ex. Stockholm"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
            </div>
          )}

          {/* Quick links manager */}
          {local["snabblänkar"] && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Snabblänkar</p>
              <div className="space-y-1.5 mb-3">
                {local.links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
                    <span className="flex-1 truncate text-xs text-foreground">{l.label}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{l.url}</span>
                    <button
                      onClick={() => removeLink(i)}
                      className="text-[11px] text-muted-foreground hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="Namn"
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                />
                <input
                  type="text"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="URL"
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                />
                <button
                  onClick={addLink}
                  className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Spara layout
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Shared UI ── */

function DashCard({
  title, eyebrow, action, children,
}: {
  title: string;
  eyebrow: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-sm">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60">{eyebrow}</p>
          <h2 className="mt-0.5 text-base font-medium text-foreground" style={serif}>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptySlot({ icon, text, hint }: { icon?: string; text: string; hint?: string }) {
  return (
    <div className="py-6 text-center">
      {icon && <p className="mb-2 text-2xl">{icon}</p>}
      <p className="text-sm text-muted-foreground">{text}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

const ONBOARDING_DISMISS_KEY = "hajpex.onboarding.dismissed.v1";

type OnboardingProgress = {
  hasObjekt: boolean;
  hasKontakt: boolean;
  hasVisning: boolean;
  hasBud: boolean;
  hasKontrakt: boolean;
};

function OnboardingBanner({ progress }: { progress: OnboardingProgress }) {
  const [dismissed, setDismissed] = useState(true); // dölj tills vi läst localStorage (undvik flimmer)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1"); }
    catch { setDismissed(false); }
  }, []);

  function dismiss() {
    try { localStorage.setItem(ONBOARDING_DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  const steps = [
    { icon: "🏠", label: "Lägg till ditt första objekt", hint: "Starta ett nytt uppdrag", to: "/objekt/nytt" as const, search: undefined, done: progress.hasObjekt },
    { icon: "👤", label: "Lägg till din första kontakt", hint: "Säljare eller spekulant", to: "/kunder" as const, search: { q: undefined, roll: undefined }, done: progress.hasKontakt },
    { icon: "📅", label: "Boka en visning", hint: "Bjud in spekulanter", to: "/visningar" as const, search: undefined, done: progress.hasVisning },
    { icon: "🔨", label: "Registrera ett bud", hint: "Följ budgivningen live", to: "/objekt" as const, search: undefined, done: progress.hasBud },
    { icon: "📄", label: "Signera ett kontrakt", hint: "Slutför affären", to: "/objekt" as const, search: undefined, done: progress.hasKontrakt },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;

  // Dölj om bortvald eller om allt är klart
  if (dismissed || doneCount === total) return null;

  return (
    <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">Kom igång på 5 minuter</p>
          <h2 className="text-lg font-medium text-foreground" style={{ fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' }}>
            Välkommen till Hajpex<span className="text-primary">.</span>
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          title="Dölj guiden"
        >
          ✕
        </button>
      </div>

      {/* Progress */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{doneCount} av {total} klart</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => s.done ? (
          <div
            key={s.label + i}
            className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"
          >
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm text-emerald-500">✓</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground line-through decoration-muted-foreground/40">{s.label}</p>
              <p className="mt-1 text-[11px] text-emerald-600/80">Klart</p>
            </div>
          </div>
        ) : (
          <Link
            key={s.label + i}
            to={s.to}
            search={s.search as never}
            className="group flex items-start gap-3 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-card/80"
          >
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-base">
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{s.label}</p>
              <p className="mt-1 text-[11px] text-primary group-hover:underline">{s.hint} →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Till salu"       ? "bg-primary/10 text-primary border-primary/20"
    : status === "Redo (Kommande)" ? "bg-amber-500/10 text-amber-600 border-amber-400/20"
    : status === "Såld"           ? "bg-emerald-500/10 text-emerald-600 border-emerald-400/20"
    : status === "Under intag"    ? "bg-blue-500/10 text-blue-600 border-blue-400/20"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}
