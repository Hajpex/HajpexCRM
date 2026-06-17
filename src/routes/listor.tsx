import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { listKontakter } from "../lib/kontaktStore";
import { listIntagsmoten } from "../lib/intagsmoteStore";
import type { Kontakt, KontaktRelation } from "../lib/kontaktTypes";
import { slugifyAddr } from "./objekt.$slug";
import { RingLage } from "./kunder";

export const Route = createFileRoute("/listor")({
  head: () => ({
    meta: [
      { title: "Listor · Hajpex CRM" },
      { name: "description", content: "Kontakter, intagsmöten, uppgifter och ringlistor." },
    ],
  }),
  component: ListorPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

type TabId = "ringlistor" | "kontakter" | "intag" | "uppgifter";

/* ── helpers ── */

const ROLL_PRIO: KontaktRelation[] = ["köpare", "säljare", "spekulant", "kontakt"];

function topRoll(k: Kontakt): KontaktRelation | null {
  for (const r of ROLL_PRIO) {
    if (k.objektKopplingar.some((kp) => kp.relation === r)) return r;
  }
  return null;
}

function rollLabel(r: KontaktRelation | null): string {
  return r === "spekulant" ? "Spekulant" : r === "säljare" ? "Säljare" : r === "köpare" ? "Köpare" : r === "kontakt" ? "Kontakt" : "—";
}

function lastActiveTs(k: Kontakt): number {
  return k.aktiviteter.length > 0 ? Math.max(...k.aktiviteter.map((a) => a.tidpunkt)) : k.skapadAt;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function relDays(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return "idag";
  if (d === 1) return "igår";
  if (d < 30) return `${d} d sedan`;
  if (d < 365) return `${Math.floor(d / 30)} mån sedan`;
  return `${Math.floor(d / 365)} år sedan`;
}

function ListorPage() {
  const [tab, setTab] = useState<TabId>("ringlistor");
  const [query, setQuery] = useState("");
  const [ringList, setRingList] = useState<{ label: string; kontakter: Kontakt[] } | null>(null);

  const kontakter = useMemo(() => listKontakter(), []);
  const intag = useMemo(() => listIntagsmoten(), []);

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: "ringlistor", label: "Ringlistor", count: kontakter.filter((k) => k.telefon.trim()).length },
    { id: "kontakter", label: "Kontakter", count: kontakter.length },
    { id: "intag", label: "Intagsmöten", count: intag.length },
    { id: "uppgifter", label: "Uppgifter", count: kontakter.filter((k) => k.nastaSteg).length },
  ];

  const placeholder =
    tab === "kontakter" ? "Sök namn, telefon, ort…"
    : tab === "intag" ? "Sök adress eller ort…"
    : tab === "uppgifter" ? "Sök uppgift eller kontakt…"
    : "Sök ringlista…";

  return (
    <>
      <AppShell>
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-10">
          {/* Header */}
          <section className="mb-8">
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Listor</div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serif}>
              Allt på ett ställe<span className="text-primary">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Riktiga kontakter, intagsmöten och uppgifter — plus ringlistor du kan beta av direkt.
            </p>
          </section>

          {/* Tabs */}
          <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setQuery(""); }}
                  className={[
                    "relative flex items-baseline gap-2 px-4 py-3 text-sm transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span>{t.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/80">{t.count.toLocaleString("sv-SE")}</span>
                  {active && <span className="absolute inset-x-3 -bottom-px h-px bg-primary" />}
                </button>
              );
            })}
          </div>

          {/* Search (ej för ringlistor) */}
          {tab !== "ringlistor" && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          )}

          {tab === "ringlistor" && <RinglistorTab kontakter={kontakter} onStart={(label, list) => setRingList({ label, kontakter: list })} />}
          {tab === "kontakter" && <Card><KontakterTable rows={kontakter} q={query} /></Card>}
          {tab === "intag" && <Card><IntagTable rows={intag} kontakter={kontakter} q={query} /></Card>}
          {tab === "uppgifter" && <Card><UppgifterTable rows={kontakter} q={query} /></Card>}
        </div>
      </AppShell>

      {ringList && (
        <RingLage kontakter={ringList.kontakter} onClose={() => setRingList(null)} />
      )}
    </>
  );
}

/* ══════════════════════════ RINGLISTOR ══════════════════════════ */

function RinglistorTab({ kontakter, onStart }: { kontakter: Kontakt[]; onStart: (label: string, list: Kontakt[]) => void }) {
  const now = Date.now();
  const withTel = kontakter.filter((k) => k.telefon.trim());

  const lists: { id: string; label: string; desc: string; icon: string; list: Kontakt[] }[] = [
    {
      id: "alla",
      label: "Alla med telefon",
      desc: "Hela kontaktregistret med nummer, äldst kontaktade först.",
      icon: "📇",
      list: withTel,
    },
    {
      id: "forfallna",
      label: "Förfallna uppföljningar",
      desc: "Kontakter där nästa steg har passerat datum.",
      icon: "🔴",
      list: withTel.filter((k) => k.nastaSteg && k.nastaSteg.datum < now),
    },
    {
      id: "spekulanter",
      label: "Spekulanter",
      desc: "Alla som är kopplade som spekulant på något objekt.",
      icon: "🔍",
      list: withTel.filter((k) => k.objektKopplingar.some((kp) => kp.relation === "spekulant")),
    },
    {
      id: "saljare",
      label: "Säljare",
      desc: "Kopplade säljare — bra för avstämningssamtal.",
      icon: "🏷️",
      list: withTel.filter((k) => k.objektKopplingar.some((kp) => kp.relation === "säljare")),
    },
    {
      id: "kalla",
      label: "Ej kontaktade på 30+ dagar",
      desc: "Kontakter som inte hört av sig på ett tag — värm upp dem.",
      icon: "❄️",
      list: withTel.filter((k) => (now - lastActiveTs(k)) > 30 * 86_400_000),
    },
    {
      id: "nya",
      label: "Nya senaste 7 dagarna",
      desc: "Färska kontakter att följa upp medan de är heta.",
      icon: "✨",
      list: withTel.filter((k) => (now - k.skapadAt) < 7 * 86_400_000),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((l) => (
        <div key={l.id} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">{l.icon}</span>
            <h3 className="text-sm font-medium text-foreground">{l.label}</h3>
          </div>
          <p className="mb-4 flex-1 text-xs leading-relaxed text-muted-foreground">{l.desc}</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-medium" style={serif}>{l.list.length}</span>
            <button
              onClick={() => l.list.length > 0 && onStart(l.label, l.list)}
              disabled={l.list.length === 0}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              📞 Starta ringläge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════ TABELLER ══════════════════════════ */

function KontakterTable({ rows, q }: { rows: Kontakt[]; q: string }) {
  const lq = q.trim().toLowerCase();
  const data = rows.filter((k) =>
    !lq || `${k.fornamn} ${k.efternamn} ${k.telefon} ${k.ort} ${k.epost}`.toLowerCase().includes(lq)
  );
  return (
    <TableShell head={["Namn", "Telefon", "Ort", "Roll", "Senast aktiv"]} count={data.length}>
      {data.map((k) => (
        <tr key={k.id} className="border-t border-border/50 hover:bg-muted/20">
          <td className="py-3 pr-4">
            <Link to="/kunder/$id" params={{ id: k.id }} className="font-medium text-foreground hover:text-primary hover:underline">
              {k.fornamn} {k.efternamn}
            </Link>
          </td>
          <td className="py-3 pr-4 text-muted-foreground">
            {k.telefon ? <a href={`tel:${k.telefon.replace(/\s/g, "")}`} className="hover:text-primary">{k.telefon}</a> : "—"}
          </td>
          <td className="py-3 pr-4 text-muted-foreground">{k.ort || "—"}</td>
          <td className="py-3 pr-4"><RollPill roll={topRoll(k)} /></td>
          <td className="py-3 text-xs text-muted-foreground">{relDays(lastActiveTs(k))}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function IntagTable({ rows, kontakter, q }: { rows: ReturnType<typeof listIntagsmoten>; kontakter: Kontakt[]; q: string }) {
  const lq = q.trim().toLowerCase();
  const byId = new Map(kontakter.map((k) => [k.id, k]));
  const data = rows.filter((m) => !lq || `${m.adress} ${m.ort}`.toLowerCase().includes(lq));
  return (
    <TableShell head={["Adress", "Kontakt", "Tidpunkt", "Status"]} count={data.length}>
      {data.map((m) => {
        const k = byId.get(m.kontaktId);
        return (
          <tr key={m.id} className="border-t border-border/50 hover:bg-muted/20">
            <td className="py-3 pr-4">
              <Link to="/objekt/$slug" params={{ slug: slugifyAddr(m.adress) }} search={{ tab: undefined, q: undefined }} className="font-medium text-foreground hover:text-primary hover:underline">
                {m.adress || "—"}
              </Link>
              {m.ort && <div className="text-xs text-muted-foreground">{m.ort}</div>}
            </td>
            <td className="py-3 pr-4 text-muted-foreground">
              {k ? <Link to="/kunder/$id" params={{ id: k.id }} className="hover:text-primary">{k.fornamn} {k.efternamn}</Link> : "—"}
            </td>
            <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{fmtDateTime(m.tidpunkt)}</td>
            <td className="py-3"><StatusPill label={m.status} /></td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function UppgifterTable({ rows, q }: { rows: Kontakt[]; q: string }) {
  const now = Date.now();
  const lq = q.trim().toLowerCase();
  const data = rows
    .filter((k) => k.nastaSteg)
    .filter((k) => !lq || `${k.fornamn} ${k.efternamn} ${k.nastaSteg?.text ?? ""}`.toLowerCase().includes(lq))
    .sort((a, b) => (a.nastaSteg!.datum) - (b.nastaSteg!.datum));
  return (
    <TableShell head={["Uppgift", "Kontakt", "Typ", "Datum"]} count={data.length}>
      {data.map((k) => {
        const ns = k.nastaSteg!;
        const overdue = ns.datum < now;
        return (
          <tr key={k.id} className="border-t border-border/50 hover:bg-muted/20">
            <td className="py-3 pr-4 text-foreground">{ns.text || "—"}</td>
            <td className="py-3 pr-4 text-muted-foreground">
              <Link to="/kunder/$id" params={{ id: k.id }} className="hover:text-primary">{k.fornamn} {k.efternamn}</Link>
            </td>
            <td className="py-3 pr-4 text-xs capitalize text-muted-foreground">{ns.typ}</td>
            <td className="py-3">
              <span className={overdue ? "text-xs font-medium text-red-500" : "text-xs text-muted-foreground"}>
                {overdue ? `Förfallen · ${fmtDate(ns.datum)}` : fmtDate(ns.datum)}
              </span>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

/* ══════════════════════════ UI-delar ══════════════════════════ */

function RollPill({ roll }: { roll: KontaktRelation | null }) {
  if (!roll) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    roll === "spekulant" ? "text-blue-500 bg-blue-500/10"
    : roll === "säljare" ? "text-amber-600 bg-amber-500/10"
    : roll === "köpare" ? "text-emerald-600 bg-emerald-500/10"
    : "text-muted-foreground bg-muted/50";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${tone}`}>{rollLabel(roll)}</span>;
}

function TableShell({ head, count, children }: { head: string[]; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{count} träffar</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {head.map((h) => (
                <th key={h} className="pb-3 pr-4 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {count === 0 ? (
              <tr><td colSpan={head.length} className="py-10 text-center text-sm text-muted-foreground">Inget att visa ännu.</td></tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</section>;
}

function StatusPill({ label }: { label: string }) {
  const tone =
    label === "Vunnen" ? "border-primary/40 bg-primary/10 text-primary"
    : label === "Genomfört" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-600"
    : label === "Planerat" ? "border-blue-400/30 bg-blue-400/10 text-blue-600"
    : label === "Förlorad" ? "border-red-400/30 bg-red-400/10 text-red-500"
    : "border-border bg-muted/50 text-muted-foreground";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${tone}`}>
      {label}
    </span>
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
