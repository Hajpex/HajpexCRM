import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { OBJEKT } from "../data/objekt";
import { listObjekt } from "../lib/objektStore";
import { listKontakter } from "../lib/kontaktStore";
import { listBud, fmtBud } from "../lib/budgivningStore";
import { slugifyAddr, fmtKrShort } from "./objekt.$slug";
import { listIntagsmoten, type Intagsmote } from "../lib/intagsmoteStore";
import { listAllaVisningar, type Visning } from "../lib/visningarStore";
import type { Kontakt, NastaSteg } from "../lib/kontaktTypes";

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
  const [now] = useState(() => new Date());

  useEffect(() => {
    const ks = listKontakter();
    const bm: BudMap = {};
    for (const o of objs) {
      const slug = slugifyAddr(o.adress);
      bm[slug] = listBud(slug);
    }
    setKontakter(ks);
    setBudMap(bm);
    setIntagsmoten(
      listIntagsmoten()
        .filter((m) => m.status !== "Förlorad")
        .sort((a, b) => a.tidpunkt - b.tidpunkt)
    );
    setVisningar(listAllaVisningar());
  }, []);

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

            {/* Kommande */}
            {upcomingMoten.filter((m) => !isSameDay(m.tidpunkt, now)).length > 0 && (
              <DashCard title="Kommande möten" eyebrow="Nästa 7 dagar">
                <div className="divide-y divide-border">
                  {upcomingMoten
                    .filter((m) => !isSameDay(m.tidpunkt, now))
                    .slice(0, 5)
                    .map((m) => (
                      <MoteRow key={m.id} mote={m} kontakter={kontakter} variant="upcoming" now={now} />
                    ))}
                </div>
              </DashCard>
            )}

            {/* Aktiva objekt */}
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
          </div>

          {/* ── RIGHT SIDEBAR (1/3) ── */}
          <div className="space-y-6">

            {/* Aktiv budgivning */}
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

            {/* Nästa steg — förfallna */}
            {(overdueTasks.length > 0 || upcomingTasks.length > 0) && (
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
            <SmartAttGora objs={objs} kontakter={kontakter} budMap={budMap} />
          </div>
        </div>
      </div>
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
