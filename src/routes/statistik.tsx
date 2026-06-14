import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { listObjekt } from "../lib/objektStore";
import { OBJEKT } from "../data/objekt";
import { listKontakter } from "../lib/kontaktStore";
import { listIntagsmoten, type Intagsmote } from "../lib/intagsmoteStore";
import type { Kontakt } from "../lib/kontaktTypes";
import { listAllaVisningar } from "../lib/visningarStore";

export const Route = createFileRoute("/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik · Stendahl CRM" },
      { name: "description", content: "KPI:er, budget, leads, NPS och topplistor." },
    ],
  }),
  component: StatistikPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

type TabId =
  | "start"
  | "leads"
  | "intag"
  | "kpi"
  | "tips"
  | "topplistor"
  | "nps"
  | "tillvaxt"
  | "budget"
  | "vardebevakare"
  | "utskick";

const TABS: { id: TabId; label: string }[] = [
  { id: "start", label: "Översikt" },
  { id: "leads", label: "Leads" },
  { id: "intag", label: "Intagsmöten" },
  { id: "kpi", label: "KPI" },
  { id: "tips", label: "Skickade tips" },
  { id: "topplistor", label: "Topplistor" },
  { id: "nps", label: "NPS" },
  { id: "tillvaxt", label: "Tillväxt" },
  { id: "budget", label: "Budget" },
  { id: "vardebevakare", label: "Värdebevakare" },
  { id: "utskick", label: "Utskick" },
];

const fmtKr = (n: number) => new Intl.NumberFormat("sv-SE").format(n);

function StatistikPage() {
  const [tab, setTab] = useState<TabId>("start");
  const [office, setOffice] = useState("Havsbyn/Stenkulla");
  const [period, setPeriod] = useState("Juni 2026");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] px-6 pt-10 pb-24">
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Statistik</div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="text-4xl font-medium md:text-5xl" style={serif}>
            Resultat &amp; insikter<span className="text-primary">.</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={office} onChange={setOffice} options={["Havsbyn/Stenkulla", "Stenkulla/Granvik/Tallvik", "Hela kedjan"]} label="Kontor" />
            <Select value={period} onChange={setPeriod} options={["Idag", "Denna vecka", "Juni 2026", "Maj 2026", "Q2 2026", "I år", "I fjol"]} label="Period" />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 -mx-6 overflow-x-auto border-b border-border/60 px-6">
          <div className="flex min-w-max gap-1">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative px-4 py-3 text-sm transition ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                  {active && <span className="absolute inset-x-3 -bottom-px h-px bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          {tab === "start" && <StartTab />}
          {tab === "leads" && <LeadsTab />}
          {tab === "intag" && <IntagTab />}
          {tab === "kpi" && <KpiTab />}
          {tab === "tips" && <TipsTab />}
          {tab === "topplistor" && <TopplistorTab />}
          {tab === "nps" && <NpsTab />}
          {tab === "tillvaxt" && <TillvaxtTab />}
          {tab === "budget" && <BudgetTab />}
          {tab === "vardebevakare" && <VardebevakareTab />}
          {tab === "utskick" && <UtskickTab />}
        </div>
      </div>
    </AppShell>
  );
}

// ---------- Shared UI ----------
function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs">
      {label && <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-sm text-foreground focus:outline-none">
        {options.map((o) => (
          <option key={o} value={o} className="bg-background text-foreground">{o}</option>
        ))}
      </select>
    </label>
  );
}

function Card({ title, hint, right, children, className = "" }: { title?: string; hint?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/60 bg-card/40 p-6 ${className}`}>
      {(title || right) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-medium text-foreground">{title}</h3>}
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

function KpiTile({ label, value, sub, tone = "default", progress }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" | "bad"; progress?: number }) {
  const toneClass = tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-rose-400" : "text-foreground";
  const barClass = tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-rose-500" : "bg-primary";
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-medium ${toneClass}`} style={serif}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
          <div className={`h-full ${barClass}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

function Bar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Live status card ----------
function LiveStatusCard() {
  const [stats, setStats] = useState<{
    aktiva: number; kontakter: number; visningar: number; moten: number;
    saldaThisMonth: number; spek: number;
  } | null>(null);

  useEffect(() => {
    const saved = listObjekt();
    const savedAddrs = new Set(saved.map((o) => o.adress));
    const all = [...saved, ...OBJEKT.filter((o) => !savedAddrs.has(o.adress))];
    const ks = listKontakter();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    setStats({
      aktiva: all.filter((o) => ["Till salu", "Redo (Kommande)", "Under intag", "Intaget"].includes(o.status)).length,
      kontakter: ks.length,
      spek: ks.filter((k) => k.objektKopplingar.some((kp) => kp.relation === "spekulant")).length,
      visningar: listAllaVisningar().filter((v) => v.datum >= Date.now()).length,
      moten: listIntagsmoten().filter((m) => m.status !== "Förlorad" && m.tidpunkt >= Date.now()).length,
      saldaThisMonth: all.filter((o) => o.status === "Såld").length,
    });
  }, []);

  if (!stats) return null;

  return (
    <Card title="Din portfölj just nu" hint="Realtidsdata från systemet">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiTile label="Aktiva objekt" value={String(stats.aktiva)} />
        <KpiTile label="Kontakter" value={String(stats.kontakter)} />
        <KpiTile label="Spekulanter" value={String(stats.spek)} tone={stats.spek > 0 ? "good" : "default"} />
        <KpiTile label="Kommande visningar" value={String(stats.visningar)} tone={stats.visningar > 0 ? "good" : "default"} />
        <KpiTile label="Kommande möten" value={String(stats.moten)} tone={stats.moten > 0 ? "good" : "default"} />
        <KpiTile label="Sålda objekt" value={String(stats.saldaThisMonth)} tone={stats.saldaThisMonth > 0 ? "good" : "default"} />
      </div>
    </Card>
  );
}

// ---------- Start / Översikt ----------
function StartTab() {
  return (
    <div className="space-y-6">
      {/* Live data */}
      <LiveStatusCard />

      {/* Säljmål */}
      <Card title="Resultat vs säljmål" hint="Juni 2026 · Erik Lindqvist">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <KpiTile label="Uppnådda säljmål" value="51%" tone="warn" progress={51} />
          <KpiTile label="Bokade intag" value="5" sub="/ 18" tone="bad" progress={28} />
          <KpiTile label="Vunna intag" value="3" sub="säljmål saknas" />
          <KpiTile label="Sålda objekt" value="4" sub="/ 6" tone="good" progress={67} />
          <KpiTile label="Omsättning" value="176 000" sub="/ 300 000" tone="warn" progress={59} />
          <KpiTile label="Publicerade Redo" value="2" sub="/ 4" tone="warn" progress={50} />
          <KpiTile label="NPS" value="100" sub="4 / 100 svar" tone="good" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Sammanfattning" hint="Denna månad" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-3 font-normal"></th>
                <th className="pb-3 font-normal">Aktuell period</th>
                <th className="pb-3 font-normal">I fjol</th>
                <th className="pb-3 font-normal">Budget juni 2026</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                ["Omsättning", "176 000", "0 (0%)", "300 000 (59%)"],
                ["Sålda objekt", "4", "0 (0%)", "6 (67%)"],
                ["Vunna intagsmöten", "3", "5 (60%)", ""],
                ["Antal intagsmöten", "9", "10 (90%)", "18 (50%)"],
              ].map((r) => (
                <tr key={r[0]} className="text-foreground/90">
                  <td className="py-3 text-muted-foreground">{r[0]}</td>
                  <td className="py-3">{r[1]}</td>
                  <td className="py-3">{r[2]}</td>
                  <td className="py-3">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="NPS" hint="Denna månad">
          <div className="flex flex-col items-center justify-center py-6">
            <div className="text-6xl font-medium text-emerald-400" style={serif}>100</div>
            <div className="mt-2 text-xs text-muted-foreground">baserat på 4 svar</div>
          </div>
        </Card>
      </div>

      <Card title="Medarbetare utfall" hint="Mot budget · denna månad">
        <div className="space-y-4">
          {[
            { name: "Erik Lindqvist", oms: 59, salda: 67, intag: 50, vunna: 30 },
          ].map((m) => (
            <div key={m.name} className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="text-sm font-medium">{m.name}</div>
              <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Omsättning</div><Bar value={m.oms} max={100} color="bg-amber-500" /><div className="mt-1 text-xs text-muted-foreground">176 000 ({m.oms}%)</div></div>
              <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sålda</div><Bar value={m.salda} max={100} color="bg-amber-500" /><div className="mt-1 text-xs text-muted-foreground">4 ({m.salda}%)</div></div>
              <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Intag</div><Bar value={m.intag} max={100} color="bg-amber-500" /><div className="mt-1 text-xs text-muted-foreground">9 ({m.intag}%)</div></div>
              <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Vunna</div><Bar value={m.vunna} max={100} color="bg-rose-500" /><div className="mt-1 text-xs text-muted-foreground">3</div></div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Leadsstatistik">
          <div className="text-center py-6">
            <div className="text-5xl font-medium text-rose-400" style={serif}>0%</div>
            <div className="mt-2 text-sm text-muted-foreground">0 inkomna leads</div>
            <div className="text-xs text-muted-foreground">0% blivit möte</div>
          </div>
        </Card>

        <Card title="Nyckel objektstatusar" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-3 font-normal">Status</th>
                <th className="pb-3 font-normal">Antal</th>
                <th className="pb-3 font-normal">Hastighet</th>
                <th className="pb-3 font-normal">Säljgrad</th>
                <th className="pb-3 font-normal">Senaste 7d</th>
                <th className="pb-3 font-normal">Est. omsättning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr><td className="py-3">Redo (kommande)</td><td>23</td><td>35</td><td>53%</td><td>0</td><td>612 011</td></tr>
              <tr><td className="py-3">Till salu</td><td>9</td><td>18</td><td>72%</td><td>1</td><td>325 335</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Omsättning senaste 365 dagar">
          <div className="text-3xl font-medium" style={serif}>2 209 026 kr</div>
          <div className="mt-1 text-sm text-rose-400">▼ -43 040</div>
        </Card>
        <Card title="Sålda objekt senaste 365 dagar">
          <div className="text-3xl font-medium" style={serif}>44</div>
          <div className="mt-1 text-sm text-rose-400">▼ -1</div>
        </Card>
        <Card title="Resultat / Budget" hint="43% / 17 dagar kvar">
          <div className="space-y-3">
            <div><div className="mb-1 flex justify-between text-xs"><span>Sålda objekt</span><span className="text-rose-400">59%</span></div><Bar value={59} max={100} color="bg-rose-500" /></div>
            <div><div className="mb-1 flex justify-between text-xs"><span>Omsättning</span><span className="text-rose-400">59%</span></div><Bar value={59} max={100} color="bg-rose-500" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- Leads ----------
function LeadsTab() {
  const [data, setData] = useState<{
    total: number; thisMonth: number; thisWeek: number;
    spek: number; hasMote: number; recent: Kontakt[];
  } | null>(null);

  useEffect(() => {
    const ks = listKontakter();
    const now = Date.now();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const intagIds = new Set(listIntagsmoten().map((m) => m.kontaktId));
    setData({
      total: ks.length,
      thisMonth: ks.filter((k) => k.skapadAt >= monthStart).length,
      thisWeek: ks.filter((k) => k.skapadAt >= weekStart).length,
      spek: ks.filter((k) => k.objektKopplingar.some((kp) => kp.relation === "spekulant")).length,
      hasMote: ks.filter((k) => intagIds.has(k.id)).length,
      recent: [...ks].sort((a, b) => b.skapadAt - a.skapadAt).slice(0, 15),
    });
  }, []);

  if (!data) return null;

  const moteRate = data.total > 0 ? Math.round((data.hasMote / data.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiTile label="Totalt" value={String(data.total)} />
        <KpiTile label="Denna månad" value={String(data.thisMonth)} tone={data.thisMonth > 0 ? "good" : "default"} />
        <KpiTile label="Senaste 7 dagar" value={String(data.thisWeek)} tone={data.thisWeek > 0 ? "good" : "default"} />
        <KpiTile label="Spekulanter" value={String(data.spek)} tone={data.spek > 0 ? "good" : "default"} />
        <KpiTile label="Blivit möte" value={`${moteRate}%`} sub={`${data.hasMote} av ${data.total}`} tone={moteRate >= 30 ? "good" : moteRate > 0 ? "warn" : "default"} />
      </div>

      <Card title="Senaste kontakter" hint={data.recent.length === data.total ? "Alla" : `Senaste ${data.recent.length}`}>
        {data.recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Inga kontakter ännu.{" "}
            <a href="/kunder" className="text-primary hover:underline">Lägg till din första →</a>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-3 font-normal">Namn</th>
                <th className="pb-3 font-normal">Telefon</th>
                <th className="pb-3 font-normal">Ort</th>
                <th className="pb-3 font-normal">Skapad</th>
                <th className="pb-3 font-normal">Roll</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.recent.map((k) => {
                const isSpek = k.objektKopplingar.some((kp) => kp.relation === "spekulant");
                const isSaljare = k.objektKopplingar.some((kp) => kp.relation === "säljare");
                return (
                  <tr key={k.id} className="text-foreground/90">
                    <td className="py-2.5 font-medium">{k.fornamn} {k.efternamn}</td>
                    <td className="py-2.5 text-muted-foreground">{k.telefon || "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{k.ort || "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{new Date(k.skapadAt).toLocaleDateString("sv-SE")}</td>
                    <td className="py-2.5">
                      {isSpek ? <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-400">Spekulant</span>
                        : isSaljare ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">Säljare</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------- Intagsmöten ----------
const INTAG_STATUS_COLORS: Record<string, string> = {
  Vunnen: "bg-emerald-500",
  Planerat: "bg-sky-400",
  Genomfört: "bg-primary",
  Förlorad: "bg-rose-500",
};

function IntagTab() {
  const [data, setData] = useState<{
    moten: Intagsmote[];
    byStatus: { label: string; value: number; color: string }[];
    vinnRate: number;
    avgVardering: number | null;
    byKalla: { kalla: string; total: number; vunna: number }[];
  } | null>(null);

  useEffect(() => {
    const moten = listIntagsmoten();
    const statusMap: Record<string, number> = {};
    for (const m of moten) statusMap[m.status] = (statusMap[m.status] ?? 0) + 1;
    const byStatus = Object.entries(statusMap).map(([label, value]) => ({
      label, value, color: INTAG_STATUS_COLORS[label] ?? "bg-muted",
    }));

    const vunna = moten.filter((m) => m.status === "Vunnen");
    const vinnRate = moten.length > 0 ? Math.round((vunna.length / moten.length) * 100) : 0;
    const valuations = vunna.map((m) => m.vardering).filter((v): v is number => v !== null);
    const avgVardering = valuations.length > 0 ? Math.round(valuations.reduce((s, v) => s + v, 0) / valuations.length) : null;

    const kallaMap = new Map<string, { total: number; vunna: number }>();
    for (const m of moten) {
      const k = m.kalla || "Okänd";
      const prev = kallaMap.get(k) ?? { total: 0, vunna: 0 };
      kallaMap.set(k, { total: prev.total + 1, vunna: prev.vunna + (m.status === "Vunnen" ? 1 : 0) });
    }
    const byKalla = [...kallaMap.entries()]
      .map(([kalla, v]) => ({ kalla, ...v }))
      .sort((a, b) => b.total - a.total);

    setData({ moten, byStatus, vinnRate, avgVardering, byKalla });
  }, []);

  if (!data) return null;

  const total = data.moten.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Intagsmöten — status" hint={`${total} totalt`}>
          {total === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Inga intagsmöten ännu. Skapa ett via en kontaktsida.
            </p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {data.byStatus.map((s) => (
                  <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {data.byStatus.map((s) => (
                  <li key={s.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />{s.label}
                    </span>
                    <span className="text-muted-foreground">{s.value} ({Math.round(s.value / total * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-4 content-start">
          <KpiTile label="Vinnrat" value={`${data.vinnRate}%`} tone={data.vinnRate >= 50 ? "good" : data.vinnRate > 0 ? "warn" : "default"} />
          <KpiTile label="Totalt möten" value={String(total)} />
          <KpiTile label="Snitt värdering" value={data.avgVardering ? `${fmtKr(Math.round(data.avgVardering / 1000))} k` : "—"} />
          <KpiTile label="Vunna" value={String(data.byStatus.find((s) => s.label === "Vunnen")?.value ?? 0)} tone="good" />
        </div>
      </div>

      <Card title="Per källa" hint="Baserat på dina intagsmöten">
        {data.byKalla.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga käll-uppgifter registrerade ännu.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-3 font-normal">Källa</th>
                <th className="pb-3 font-normal">Bokade</th>
                <th className="pb-3 font-normal">Vunna</th>
                <th className="pb-3 font-normal">Vinnrat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.byKalla.map((k) => (
                <tr key={k.kalla} className="text-foreground/90">
                  <td className="py-2.5">{k.kalla}</td>
                  <td className="py-2.5">{k.total}</td>
                  <td className="py-2.5">{k.vunna}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {k.total > 0 ? `${Math.round((k.vunna / k.total) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Alla intagsmöten" hint="Senaste visas först">
        {data.moten.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga intagsmöten ännu.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-3 font-normal">Adress</th>
                <th className="pb-3 font-normal">Datum</th>
                <th className="pb-3 font-normal">Källa</th>
                <th className="pb-3 font-normal">Värdering</th>
                <th className="pb-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[...data.moten].sort((a, b) => b.tidpunkt - a.tidpunkt).map((m) => (
                <tr key={m.id} className="text-foreground/90">
                  <td className="py-2.5">{m.adress || "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{new Date(m.tidpunkt).toLocaleDateString("sv-SE")}</td>
                  <td className="py-2.5 text-muted-foreground">{m.kalla || "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{m.vardering ? `${fmtKr(m.vardering)} kr` : "—"}</td>
                  <td className="py-2.5">
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      m.status === "Vunnen" ? "bg-emerald-500/15 text-emerald-400"
                        : m.status === "Förlorad" ? "bg-rose-500/15 text-rose-400"
                        : m.status === "Planerat" ? "bg-sky-500/15 text-sky-400"
                        : "bg-primary/15 text-primary",
                    ].join(" ")}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------- KPI ----------
function KpiTab() {
  const [kpi, setKpi] = useState("Arvode/provision");
  const months = ["Jun '25","Jul '25","Aug '25","Sep '25","Okt '25","Nov '25","Dec '25","Jan '26","Feb '26","Mar '26","Apr '26","Maj '26","Jun '26"];
  const data = [85, 155, 90, 395, 5, 445, 60, 45, 130, 410, 165, 70, 175];
  const max = Math.max(...data);
  return (
    <Card
      title={kpi}
      hint="Juni 2025 – Juni 2026 · Erik Lindqvist"
      right={<Select value={kpi} onChange={setKpi} options={["Arvode/provision","Antal sålda objekt","Bokade intag","Vunna intag","Snittarvode"]} />}
    >
      <div className="relative h-80 w-full">
        <svg viewBox="0 0 700 280" className="h-full w-full">
          {[0, 70, 140, 210, 280].map((y) => (
            <line key={y} x1="40" x2="690" y1={y} y2={y} stroke="currentColor" className="text-border/40" />
          ))}
          {[0,100,200,300,400,500].map((v,i)=> (
            <text key={v} x="0" y={280-(v/500)*280+4} className="fill-current text-[10px] text-muted-foreground">{v}k</text>
          ))}
          <polyline
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            points={data.map((d, i) => `${40 + (i * (650 / (data.length - 1)))},${280 - (d / max) * 250}`).join(" ")}
          />
          {data.map((d, i) => (
            <circle key={i} cx={40 + (i * (650 / (data.length - 1)))} cy={280 - (d / max) * 250} r="3" fill="hsl(var(--primary))" />
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {months.map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
    </Card>
  );
}

// ---------- Skickade tips ----------
function TipsTab() {
  return (
    <Card title="Skickade tips" hint="Per kontor · 266 skickade · 46 till intag · 37 till sålt">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="pb-3 font-normal">Kontor</th>
            <th className="pb-3 font-normal">Antal tips</th>
            <th className="pb-3 font-normal">→ Intag</th>
            <th className="pb-3 font-normal">→ Sålt objekt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          <tr><td className="py-3">Stenkulla/Granvik/Tallvik</td><td>202</td><td>38 (19%)</td><td>31 (15%)</td></tr>
          <tr><td className="py-3">Havsbyn/Stenkulla</td><td>64</td><td>8 (13%)</td><td>6 (9%)</td></tr>
        </tbody>
      </table>
    </Card>
  );
}

// ---------- Topplistor ----------
function TopplistorTab() {
  const lists: { title: string; rows: { name: string; value: number; me?: boolean; rank: number }[] }[] = [
    { title: "Sålda objekt", rows: [
      { rank: 1, name: "Erik Lindqvist", value: 10 },
      { rank: 2, name: "Sara Holmgren", value: 9 },
      { rank: 3, name: "Anna Bergman", value: 9 },
      { rank: 29, name: "Erik Lindqvist", value: 4, me: true },
    ]},
    { title: "Arvode (SEK)", rows: [
      { rank: 1, name: "Anna Bergman", value: 784200 },
      { rank: 2, name: "Oskar Berg", value: 767520 },
      { rank: 3, name: "Alma Lund", value: 580190 },
      { rank: 61, name: "Erik Lindqvist", value: 176000, me: true },
    ]},
    { title: "Bokade intagsmöten", rows: [
      { rank: 1, name: "Johan Ekström", value: 22 },
      { rank: 2, name: "Vera Nyman", value: 19 },
      { rank: 3, name: "Oscar Dahl", value: 18 },
      { rank: 82, name: "Erik Lindqvist", value: 5, me: true },
    ]},
    { title: "Vunna intagsmöten", rows: [
      { rank: 1, name: "Anna Bergman", value: 12 },
      { rank: 2, name: "Filip Norling", value: 10 },
      { rank: 3, name: "Markus Dahl", value: 9 },
      { rank: 79, name: "Erik Lindqvist", value: 3, me: true },
    ]},
    { title: "Ringda säljsamtal", rows: [
      { rank: 1, name: "Erik Lindqvist", value: 95 },
      { rank: 2, name: "Klara Nyqvist", value: 26 },
      { rank: 3, name: "Emma Falk", value: 15 },
      { rank: 12, name: "Erik Lindqvist", value: 7, me: true },
    ]},
    { title: "Skickade tips", rows: [
      { rank: 1, name: "Theo Lind", value: 13 },
      { rank: 2, name: "Ludvig Moss", value: 8 },
      { rank: 3, name: "Filip Norling", value: 4 },
    ]},
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lists.map((l) => (
        <Card key={l.title} title={l.title}>
          <ul className="divide-y divide-border/40 text-sm">
            {l.rows.map((r) => (
              <li key={r.rank} className={`flex items-center justify-between py-2.5 ${r.me ? "font-medium text-primary" : ""}`}>
                <span className="flex items-center gap-3"><span className="w-8 text-xs text-muted-foreground">{r.rank}.</span>{r.name}</span>
                <span>{fmtKr(r.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ---------- NPS ----------
function NpsTab() {
  const local = { kritiker: 40, passiva: 282, amb: 765, nps: 67 };
  const chain = { kritiker: 3396, passiva: 16831, amb: 61047, nps: 71 };
  const ring = (d: { kritiker: number; passiva: number; amb: number }) => {
    const total = d.kritiker + d.passiva + d.amb;
    return [
      { label: "Ambassadörer", value: d.amb, color: "bg-emerald-500" },
      { label: "Passiva", value: d.passiva, color: "bg-muted-foreground/40" },
      { label: "Kritiker", value: d.kritiker, color: "bg-rose-500" },
    ].map((s) => ({ ...s, pct: (s.value / total) * 100 }));
  };
  const renderRing = (title: string, d: any, score: number) => (
    <Card title={title}>
      <div className="flex items-center gap-6">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            {(() => { let off = 0; return ring(d).map((s) => { const c = 100; const dash = (s.pct / 100) * c; const el = (<circle key={s.label} cx="18" cy="18" r="15.915" fill="transparent" stroke={s.color === "bg-emerald-500" ? "#10b981" : s.color === "bg-rose-500" ? "#f43f5e" : "#71717a"} strokeWidth="4" strokeDasharray={`${dash} ${c-dash}`} strokeDashoffset={-off} />); off += dash; return el; }); })()}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-medium" style={serif}>{score}</div>
        </div>
        <ul className="flex-1 space-y-2 text-sm">
          {ring(d).map((s) => (
            <li key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />{s.label}</span>
              <span className="text-muted-foreground">{fmtKr(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {renderRing("Havsbyn/Stenkulla", local, local.nps)}
        {renderRing("Hela kedjan", chain, chain.nps)}
      </div>
      <Card title="NPS per mäklare">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="pb-3 font-normal">Namn</th>
              <th className="pb-3 font-normal">NPS-värde</th>
              <th className="pb-3 font-normal">Svar</th>
              <th className="pb-3 font-normal">Ambassadörer</th>
              <th className="pb-3 font-normal">Passiva</th>
              <th className="pb-3 font-normal">Kritiker</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            <tr className="font-medium"><td className="py-3">Total</td><td>67</td><td>1087</td><td>765</td><td>282</td><td>40</td></tr>
            <tr className="text-primary"><td className="py-3">Erik Lindqvist</td><td>73,3</td><td>374</td><td>285</td><td>78</td><td>11</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Tillväxt ----------
function TillvaxtTab() {
  return (
    <Card title="Tillväxtrapport" hint="2026-06-01 → 2026-06-13 · Havsbyn/Stenkulla">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="pb-3 font-normal">Namn</th>
              <th className="pb-3 font-normal">Omsättning</th>
              <th className="pb-3 font-normal">Sålda</th>
              <th className="pb-3 font-normal">Snittprov.</th>
              <th className="pb-3 font-normal">Snittarvode</th>
              <th className="pb-3 font-normal">NPS</th>
              <th className="pb-3 font-normal">Intag</th>
              <th className="pb-3 font-normal">Hitrate</th>
              <th className="pb-3 font-normal">Tips</th>
              <th className="pb-3 font-normal">Publ.</th>
              <th className="pb-3 font-normal">Snitt spek.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            <tr className="font-medium"><td className="py-3">Totalt</td><td>176 000</td><td>4</td><td>2,07%</td><td>44 000</td><td>100</td><td>9</td><td>33</td><td>1</td><td>3</td><td>9</td></tr>
            <tr className="text-primary"><td className="py-3">Erik Lindqvist</td><td>176 000</td><td>4</td><td>2,07%</td><td>44 000</td><td>100</td><td>9</td><td>33</td><td>1</td><td>3</td><td>9</td></tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- Budget ----------
function BudgetTab() {
  const months = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  const resultat = [40000,132000,405270,167000,68000,176000,0,0,0,0,0,0];
  const budget = [200000,300000,300000,300000,300000,300000,50000,200000,300000,300000,300000,150000];
  return (
    <Card title="Budget 2026" hint="Resultat vs budget per månad">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="pb-3 font-normal">Månad</th>
              <th className="pb-3 font-normal">Resultat</th>
              <th className="pb-3 font-normal">Budget</th>
              <th className="pb-3 font-normal">Utfall</th>
              <th className="pb-3 w-1/3 font-normal"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {months.map((m, i) => {
              const r = resultat[i]; const b = budget[i];
              const pct = b ? Math.round(((r - b) / b) * 100) : 0;
              const ok = r >= b;
              return (
                <tr key={m}>
                  <td className="py-3">{m} '26</td>
                  <td className="py-3">{fmtKr(r)} kr</td>
                  <td className="py-3 text-muted-foreground">{fmtKr(b)} kr</td>
                  <td className={`py-3 ${ok ? "text-emerald-400" : "text-rose-400"}`}>{pct > 0 ? "+" : ""}{pct}%</td>
                  <td className="py-3"><Bar value={r} max={b} color={ok ? "bg-emerald-500" : "bg-rose-500"} /></td>
                </tr>
              );
            })}
            <tr className="font-medium border-t border-border">
              <td className="py-3">Totalt</td>
              <td className="py-3">{fmtKr(resultat.reduce((s,n)=>s+n,0))} kr</td>
              <td className="py-3 text-muted-foreground">{fmtKr(budget.reduce((s,n)=>s+n,0))} kr</td>
              <td className="py-3 text-rose-400">-67%</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- Värdebevakare ----------
function VardebevakareTab() {
  return (
    <Card title="Aktiva värdebevakare" hint="Havsbyn/Stenkulla">
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-6">
        <div>
          <div className="text-sm text-muted-foreground">SkandiaMäklarna Havsbyn/Stenkulla</div>
          <div className="mt-1 text-xs text-muted-foreground">Köpare · grupperat per kontor</div>
        </div>
        <div className="text-4xl font-medium" style={serif}>20</div>
      </div>
    </Card>
  );
}

// ---------- Utskick ----------
function UtskickTab() {
  const rows = [
    ["Totalt", 51, 32, 62, 11, 9, 0, 0],
    ["Efter kontraktsmöte (köpare)", 6, 2, 33, 0, 0, 0, 0],
    ["Efter kontraktsmöte (säljare)", 4, 3, 75, 1, 1, 0, 0],
    ["Enkät efter tillträde (köpare)", 4, 3, 75, 0, 0, 0, 0],
    ["Hemnet slutpris autosvar", 4, 4, 100, 0, 0, 0, 0],
    ["Inför första visning (säljare)", 8, 8, 100, 8, 6, 0, 0],
    ["Inför tillträde (köpare)", 4, 4, 100, 0, 0, 0, 0],
    ["Köpare 12 mån efter tillträde", 3, 3, 100, 0, 0, 0, 0],
    ["Påminnelse enkät (köpare)", 3, 2, 67, 1, 1, 0, 0],
    ["Påminnelse enkät (säljare)", 2, 1, 50, 1, 1, 0, 0],
    ["Påminnelse intagsmöte", 8, 0, 0, 0, 0, 0, 0],
    ["Säljare 12 mån efter tillträde", 2, 1, 50, 0, 0, 0, 0],
    ["Visningspåminnelse email", 3, 1, 33, 0, 0, 0, 0],
  ] as const;
  return (
    <Card title="Automatiska utskick" hint="2026-06-01 → 2026-06-13">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="pb-3 font-normal">Namn</th>
              <th className="pb-3 font-normal">Skickade</th>
              <th className="pb-3 font-normal">Öppnade</th>
              <th className="pb-3 font-normal">Öppnade %</th>
              <th className="pb-3 font-normal">Klick</th>
              <th className="pb-3 font-normal">Unika klick</th>
              <th className="pb-3 font-normal">Avanm.</th>
              <th className="pb-3 font-normal">Ej lev.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r, i) => (
              <tr key={r[0]} className={i === 0 ? "font-medium" : ""}>
                <td className="py-3">{r[0]}</td>
                <td>{r[1]}</td>
                <td>{r[2]}</td>
                <td>{r[3]} %</td>
                <td>{r[4]}</td>
                <td>{r[5]}</td>
                <td>{r[6]}</td>
                <td>{r[7]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}