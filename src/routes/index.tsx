import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, type ReactNode } from "react";
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

/* ═══════════════════════════════════════════════════════════
   WIDGET STORE
══════════════════════════════════════════════════════════════ */

const WIDGET_KEY = "hajpex.widgets.v1";

type WidgetId =
  | "idag"
  | "kommande"
  | "aktiva-objekt"
  | "budgivning"
  | "nasta-steg"
  | "att-gora"
  | "vader"
  | "snabblänkar";

type QuickLink = { label: string; url: string };

type WidgetSettings = {
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
};

const DEFAULT_WIDGETS: WidgetSettings = {
  idag: true,
  kommande: true,
  "aktiva-objekt": true,
  budgivning: true,
  "nasta-steg": true,
  "att-gora": true,
  vader: false,
  vaderOrt: "Stockholm",
  "snabblänkar": false,
  links: [
    { label: "Hemnet", url: "https://hemnet.se" },
    { label: "Lantmäteriet", url: "https://lantmateriet.se" },
    { label: "Vitec", url: "https://vitec.net" },
  ],
};

function readWidgets(): WidgetSettings {
  try {
    const raw = localStorage.getItem(WIDGET_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    return { ...DEFAULT_WIDGETS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WIDGETS;
  }
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

  useEffect(() => {
    setWidgets(readWidgets());
  }, []);

  const saveWidgets = useCallback((next: WidgetSettings) => {
    setWidgets(next);
    writeWidgets(next);
  }, []);

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

          {/* Onboarding — only when no real data yet */}
          {savedObjCount === 0 && kontakter.length === 0 && (
            <OnboardingBanner />
          )}

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

            {/* Idag */}
            {widgets.idag && (
              <DashCard
                title="Idag"
                eyebrow="Agenda"
                action={
                  <Link
                    to="/kunder"
                    search={{ q: undefined, roll: undefined }}
                    className="rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    + Nytt möte
                  </Link>
                }
              >
                {pastPlannerMoten.length === 0 && todayMoten.length === 0 && todayVisningar.length === 0 ? (
                  <EmptySlot icon="📅" text="Inga möten eller visningar idag" hint="Skapa ett nytt möte från en kontakt" />
                ) : (
                  <div className="divide-y divide-border">
                    {pastPlannerMoten.slice(0, 2).map((m) => (
                      <MoteRow key={m.id} mote={m} kontakter={kontakter} variant="overdue" now={now} />
                    ))}
                    {todayMoten.map((m) => (
                      <MoteRow key={m.id} mote={m} kontakter={kontakter} variant="today" now={now} />
                    ))}
                    {todayVisningar.map((v) => (
                      <VisningDashRow key={v.id} visning={v} />
                    ))}
                  </div>
                )}
              </DashCard>
            )}

            {/* Kommande */}
            {widgets.kommande && (upcomingMoten.length > 0 || upcomingVisningar.length > 0) && (
              <DashCard title="Kommande" eyebrow="Nästa 7 dagar">
                <div className="divide-y divide-border">
                  {[
                    ...upcomingMoten.map((m) => ({ type: "mote" as const, ts: m.tidpunkt, item: m })),
                    ...upcomingVisningar.map((v) => ({ type: "visning" as const, ts: v.datum, item: v })),
                  ]
                    .sort((a, b) => a.ts - b.ts)
                    .slice(0, 7)
                    .map((e) =>
                      e.type === "mote"
                        ? <MoteRow key={e.item.id} mote={e.item as Intagsmote} kontakter={kontakter} variant="upcoming" now={now} />
                        : <VisningDashRow key={e.item.id} visning={e.item as Visning} />
                    )}
                </div>
              </DashCard>
            )}

            {/* Aktiva objekt */}
            {widgets["aktiva-objekt"] && (
              <DashCard
                title="Aktiva objekt"
                eyebrow="Portfölj"
                action={
                  <Link to="/objekt" className="text-[11px] text-primary hover:underline">
                    Visa alla →
                  </Link>
                }
              >
                {activeObjs.length === 0 ? (
                  <EmptySlot icon="🏠" text="Inga aktiva uppdrag" hint="Lägg till ditt första objekt" />
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          <th className="pb-3 pl-1 pr-4 font-normal">Adress</th>
                          <th className="pb-3 pr-4 font-normal hidden sm:table-cell">Typ</th>
                          <th className="pb-3 pr-4 font-normal">Utrop</th>
                          <th className="pb-3 pr-3 font-normal">Status</th>
                          <th className="pb-3 pr-3 text-right font-normal hidden md:table-cell">Spek</th>
                          <th className="pb-3 text-right font-normal">Bud</th>
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
                            <tr key={o.adress} className="group border-t border-border">
                              <td className="py-2.5 pl-1 pr-4">
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
                              <td className="py-2.5 pr-4 text-xs text-muted-foreground hidden sm:table-cell">
                                {o.typ}
                              </td>
                              <td className="py-2.5 pr-4 font-mono text-sm">{fmtKrShort(o.pris)}</td>
                              <td className="py-2.5 pr-3">
                                <StatusBadge status={o.status} />
                              </td>
                              <td className="py-2.5 pr-3 text-right font-mono text-sm hidden md:table-cell">
                                {spekCount || <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2.5 text-right">
                                {budCount > 0 ? (
                                  <Link
                                    to="/objekt/$slug"
                                    params={{ slug }}
                                    search={{ tab: "Budgivning", q: undefined }}
                                    className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20"
                                  >
                                    {budCount}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
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
            )}

            {/* Väder widget */}
            {widgets.vader && <VaderWidget ort={widgets.vaderOrt} />}
          </div>

          {/* ── RIGHT SIDEBAR (1/3) ── */}
          <div className="space-y-6">

            {/* Snabblänkar widget */}
            {widgets["snabblänkar"] && widgets.links.length > 0 && (
              <SnabblänkarWidget links={widgets.links} />
            )}

            {/* Aktiv budgivning */}
            {widgets.budgivning && (
              <DashCard
                title="Aktiv budgivning"
                eyebrow="Live"
                action={
                  objsWithBids.length > 0 ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-500">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {objsWithBids.length} aktiva
                    </span>
                  ) : undefined
                }
              >
                {objsWithBids.length === 0 ? (
                  <EmptySlot icon="🔨" text="Inga pågående bud" />
                ) : (
                  <div className="divide-y divide-border">
                    {objsWithBids.slice(0, 6).map(({ o, slug, bids }) => {
                      const highest = bids[0];
                      const hasWinner = bids.some((b) => b.vinnare);
                      const latestBidAge = relTime(highest.tidpunkt ?? Date.now());
                      return (
                        <Link
                          key={slug}
                          to="/objekt/$slug"
                          params={{ slug }}
                          search={{ tab: "Budgivning", q: undefined }}
                          className="group block py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                                {o.adress}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {bids.length} bud · {latestBidAge}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="font-mono text-sm font-semibold text-primary">
                                {fmtBud(highest.belopp)}
                              </p>
                              {hasWinner && (
                                <span className="text-[9px] font-medium text-emerald-500">✓ Klar</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </DashCard>
            )}

            {/* Nästa steg — förfallna */}
            {widgets["nasta-steg"] && (overdueTasks.length > 0 || upcomingTasks.length > 0) && (
              <DashCard
                title="Att följa upp"
                eyebrow="Nästa steg"
                action={
                  <Link to="/kunder" search={{ q: undefined, roll: undefined }} className="text-[11px] text-primary hover:underline">
                    Alla →
                  </Link>
                }
              >
                <div className="divide-y divide-border">
                  {overdueTasks.map(({ k, ns }) => (
                    <NastaStegRow key={k.id} kontakt={k} ns={ns} overdue now={now} />
                  ))}
                  {upcomingTasks.map(({ k, ns }) => (
                    <NastaStegRow key={k.id} kontakt={k} ns={ns} now={now} />
                  ))}
                </div>
              </DashCard>
            )}

            {/* Smart att-göra */}
            {widgets["att-gora"] && <SmartAttGora objs={objs} kontakter={kontakter} budMap={budMap} />}
          </div>
        </div>
      </div>

      {/* ── Layout editor panel ── */}
      {editingLayout && (
        <LayoutEditor
          widgets={widgets}
          onChange={saveWidgets}
          onClose={() => setEditingLayout(false)}
        />
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

const WIDGET_META: Array<{ id: WidgetId; label: string; desc: string; category: string }> = [
  { id: "idag",          label: "Idag",            desc: "Dagens möten och visningar",         category: "Dashboard" },
  { id: "kommande",      label: "Kommande",         desc: "Möten och visningar nästa 7 dagar",  category: "Dashboard" },
  { id: "aktiva-objekt", label: "Aktiva objekt",    desc: "Portföljöversikt",                   category: "Dashboard" },
  { id: "budgivning",    label: "Aktiv budgivning", desc: "Live budgivningsstatus",              category: "Dashboard" },
  { id: "nasta-steg",    label: "Att följa upp",    desc: "Förfallna och kommande nästa steg",  category: "Dashboard" },
  { id: "att-gora",      label: "Kräver åtgärd",   desc: "Automatiska påminnelser",            category: "Dashboard" },
  { id: "vader",         label: "Väder",            desc: "Aktuellt väder för din ort",         category: "Widgets" },
  { id: "snabblänkar",   label: "Snabblänkar",      desc: "Hemnet, Lantmäteriet m.fl.",         category: "Widgets" },
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

  function toggle(id: WidgetId) {
    setLocal((prev) => ({ ...prev, [id]: !prev[id] }));
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
                    <div className={[
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded",
                      local[meta.id] ? "bg-primary text-primary-foreground" : "border border-border bg-background",
                    ].join(" ")}>
                      {local[meta.id] && <span className="text-[10px] font-bold">✓</span>}
                    </div>
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

function OnboardingBanner() {
  const steps = [
    { icon: "🏠", label: "Lägg till ditt första objekt", to: "/objekt/nytt", cta: "Nytt objekt →" },
    { icon: "👤", label: "Lägg till din första kontakt", to: "/kunder", cta: "Ny kontakt →" },
    { icon: "📅", label: "Boka ett intagningsmöte", to: "/kunder", cta: "Gå till kontakter →" },
  ] as const;

  return (
    <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
      <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">Kom igång</p>
      <h2 className="mb-4 text-lg font-medium text-foreground" style={{ fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' }}>
        Välkommen till HajpexCRM<span className="text-primary">.</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Link
            key={s.to + i}
            to={s.to}
            className="group flex items-start gap-3 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-card/80"
          >
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-base">
              {s.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{s.label}</p>
              <p className="mt-1 text-[11px] text-primary group-hover:underline">{s.cta}</p>
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
