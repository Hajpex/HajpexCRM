import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { slugifyAddr } from "./objekt.$slug";

export const Route = createFileRoute("/listor")({
  head: () => ({
    meta: [
      { title: "Listor · Stendahl CRM" },
      { name: "description", content: "Intagsmöten, uppgifter, kontakter och leads." },
    ],
  }),
  component: ListorPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

type TabId = "intag" | "uppgifter" | "kontakter" | "leads";

const TABS: { id: TabId; label: string; count: number }[] = [
  { id: "intag", label: "Intagsmöten", count: 18 },
  { id: "uppgifter", label: "Uppgifter", count: 86 },
  { id: "kontakter", label: "Kontakter", count: 7387 },
  { id: "leads", label: "Leads", count: 36 },
];

// --- Mock data ---
const intagsmoten = [
  { adress: "Björkvägen 12", omr: "12345 Granvik", status: "Under intag", saljare: "Erik Lindqvist", motesstatus: "Vunnen", bokades: "2026-06-11", tid: "15:00", kalla: "Övrig egenskapare" },
  { adress: "Kyrkogårdsvägen 33", omr: "98765 Solvik", status: "Värdering", saljare: "Sara Holmgren", motesstatus: "Avbokad", bokades: "2026-06-04", tid: "17:00", kalla: "Kundkontakt" },
  { adress: "Ängsstigen 5", omr: "45678 Granvik", status: "Under intag", saljare: "Leo Bergqvist", motesstatus: "Inväntar svar", bokades: "2026-06-04", tid: "11:30", kalla: "Köpt intag" },
  { adress: "Lilla Åsen 14", omr: "22233 Stenkulla", status: "Värdering", saljare: "Emma Falk", motesstatus: "Värdering", bokades: "2026-06-03", tid: "17:15", kalla: "Tidigare köpare" },
  { adress: "Tallbacken 7", omr: "22233 Stenkulla", status: "Under intag", saljare: "Lisa Sandberg", motesstatus: "Vunnen", bokades: "2026-06-03", tid: "12:00", kalla: "Tidigare köpare" },
  { adress: "Strandvägen 42", omr: "33344 Granvik", status: "Värdering", saljare: "Oscar Dahl", motesstatus: "Värdering", bokades: "2026-06-02", tid: "11:00", kalla: "Spekulant" },
  { adress: "Ekgatan 19", omr: "44455 Solvik", status: "Värdering", saljare: "Tilda Holm", motesstatus: "Värdering", bokades: "2026-05-28", tid: "13:00", kalla: "Fria värderingar" },
  { adress: "Kvarngården 3", omr: "55566 Granvik", status: "Till salu", saljare: "Adam Sjöberg", motesstatus: "Vunnen", bokades: "2026-05-26", tid: "12:30", kalla: "Tidigare säljare" },
  { adress: "Bergsgatan 15A", omr: "77788 Havsbyn", status: "Värdering", saljare: "Elias Fors", motesstatus: "Värdering", bokades: "2026-05-26", tid: "13:00", kalla: "Fria värderingar" },
  { adress: "Södragården 9", omr: "88899 Granvik", status: "Under intag", saljare: "Anton Eklund", motesstatus: "Vunnen", bokades: "2026-05-26", tid: "10:00", kalla: "Tidigare köpare" },
];

const uppgifter = [
  { rubrik: "Följ upp intagsmöte för Norrbyvägen 6", kontakt: "Viktor Strand", kalla: "Följ upp intagsmöte", skapad: "2025-08-15", forfaller: "2028-08-31" },
  { rubrik: "Uppföljning av Alice Ryd", kontakt: "Alice Ryd", kalla: "Kunduppföljning", skapad: "2026-02-02", forfaller: "2028-04-03" },
  { rubrik: "Följ upp intagsmöte för Västergården 2", kontakt: "Anna Bergman", kalla: "Följ upp intagsmöte", skapad: "2026-03-24", forfaller: "2027-05-03" },
  { rubrik: "Följ upp intagsmöte för Österbacken 44", kontakt: "Johan Ekström", kalla: "Följ upp intagsmöte", skapad: "2026-05-28", forfaller: "2027-04-05" },
  { rubrik: "Uppföljning av Klara Nyqvist", kontakt: "Klara Nyqvist", kalla: "Kunduppföljning", skapad: "2026-03-26", forfaller: "2027-03-22" },
  { rubrik: "Uppföljning av Adam Sjöberg", kontakt: "Adam Sjöberg", kalla: "Kunduppföljning", skapad: "2026-01-12", forfaller: "2026-12-21" },
  { rubrik: "Följ upp intagsmöte för Lilla Åsen 14", kontakt: "Emma Falk", kalla: "Följ upp intagsmöte", skapad: "2026-06-11", forfaller: "2026-12-11" },
  { rubrik: "Följ upp intagsmöte för Ekgatan 19", kontakt: "Tilda Holm", kalla: "Följ upp intagsmöte", skapad: "2026-06-04", forfaller: "2026-12-04" },
];

const kontakter = [
  { fornamn: "Oliver", efternamn: "Aydin Claesson", gata: "—", skapad: "2026-06-12", kalla: "CRM" },
  { fornamn: "Johannes", efternamn: "Broman", gata: "—", skapad: "2026-06-09", kalla: "CRM" },
  { fornamn: "Lovisa", efternamn: "Eneroth", gata: "Skogsvägen 101, 22244 Tallvik", skapad: "2026-06-09", kalla: "CRM" },
  { fornamn: "Natasha", efternamn: "Karimi", gata: "Mossvägen 8, 33355 Mossby", skapad: "2026-06-09", kalla: "CRM" },
  { fornamn: "Anders", efternamn: "Blad", gata: "Stenstigen 22, 44466 Stenbrott", skapad: "2026-06-08", kalla: "CRM" },
  { fornamn: "Gary", efternamn: "Cartagena Fuentes", gata: "Lövvägen 17, 55577 Löväng", skapad: "2026-06-08", kalla: "CRM" },
  { fornamn: "Andreas", efternamn: "Stensåsen", gata: "—", skapad: "2026-06-07", kalla: "CRM" },
  { fornamn: "Fredrika", efternamn: "Skogquist", gata: "—", skapad: "2026-06-08", kalla: "CRM" },
];

const leads = [
  { rubrik: "Johan Ekström vill ha värdebevakare", kontakt: "Johan Ekström", kalla: "Värdebevakaren", status: "Ohanterat", skapad: "2026-06-03", forfaller: "2026-06-05" },
  { rubrik: "Mikael vill bli matchad mot spekulantregistret", kontakt: "Elias Fors", kalla: "Spekulantregistret", status: "Ohanterat", skapad: "2026-05-06", forfaller: "2026-05-08" },
  { rubrik: "Alice Ryd vill ha värdebevakare", kontakt: "Alice Ryd", kalla: "Värdebevakaren", status: "Ohanterat", skapad: "2026-05-05", forfaller: "2026-05-07" },
  { rubrik: "Frida Holm", kontakt: "Frida Holm", kalla: "Boneo", status: "Ohanterat", skapad: "2026-04-27", forfaller: "2026-04-27" },
  { rubrik: "eric vill ha värdering", kontakt: "—", kalla: "Fria värderingar", status: "Ohanterat", skapad: "2026-04-22", forfaller: "2026-04-24" },
  { rubrik: "Sara vill bli matchad mot spekulantregistret", kontakt: "—", kalla: "Spekulantregistret", status: "Ohanterat", skapad: "2026-04-21", forfaller: "2026-04-23" },
  { rubrik: "Axel Sten vill ha värdebevakare", kontakt: "Axel Sten", kalla: "Värdebevakaren", status: "Ohanterat", skapad: "2026-03-29", forfaller: "2026-03-31" },
  { rubrik: "Ingrid Sol (visningsanmälan)", kontakt: "Ingrid Sol", kalla: "Fria värderingar - Visningsanmälan", status: "Ohanterat", skapad: "2026-03-14", forfaller: "2026-03-17" },
];

// Saved views per tab
const SAVED_VIEWS: Record<TabId, { id: string; label: string; query: string }[]> = {
  intag: [
    { id: "all", label: "Alla", query: "" },
    { id: "vunna", label: "Vunna senaste 7 dagarna", query: "status:vunnen" },
    { id: "kommande", label: "Kommande", query: "status:inväntar" },
    { id: "vardering", label: "Värderingar", query: "status:värdering" },
  ],
  uppgifter: [
    { id: "all", label: "Alla", query: "" },
    { id: "ohant", label: "Ohanterade", query: "" },
    { id: "denna", label: "Förfaller denna vecka", query: "" },
    { id: "intag", label: "Intagsuppföljning", query: "kalla:intag" },
  ],
  kontakter: [
    { id: "all", label: "Alla", query: "" },
    { id: "nya", label: "Nya denna vecka", query: "" },
    { id: "saljare", label: "Tidigare säljare", query: "" },
  ],
  leads: [
    { id: "all", label: "Alla", query: "" },
    { id: "ohant", label: "Ohanterade", query: "status:ohanterat" },
    { id: "vardebev", label: "Värdebevakare", query: "kalla:värdebevakare" },
    { id: "speculant", label: "Spekulanter", query: "kalla:spekulant" },
  ],
};

function ListorPage() {
  const [tab, setTab] = useState<TabId>("intag");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");

  const placeholder = useMemo(() => {
    switch (tab) {
      case "intag": return "Sök t.ex. \"Granvik under intag\" eller \"vunna denna vecka\"";
      case "uppgifter": return "Sök t.ex. \"intagsuppföljning Stefan\"";
      case "kontakter": return "Sök namn, adress eller källa";
      case "leads": return "Sök t.ex. \"värdebevakare ohanterat\"";
    }
  }, [tab]);

  const views = SAVED_VIEWS[tab];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10">
        {/* Header */}
        <section className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Listor</div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serif}>
              Allt på ett ställe<span className="text-primary">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Sök fritt eller spara dina vyer. Ingen mer hopp mellan filter.
            </p>
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setView("all"); setQuery(""); }}
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

        {/* Smart search */}
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 ">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button className="hidden rounded-md border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground md:inline-block">
            ⌘K
          </button>
          <button className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            + Spara vy
          </button>
        </div>

        {/* Saved view chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {views.map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => { setView(v.id); setQuery(v.query); }}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <Card>
          {tab === "intag" && <IntagTable rows={intagsmoten} q={query} />}
          {tab === "uppgifter" && <UppgifterTable rows={uppgifter} q={query} />}
          {tab === "kontakter" && <KontakterTable rows={kontakter} q={query} />}
          {tab === "leads" && <LeadsTable rows={leads} q={query} />}
        </Card>
      </div>
    </AppShell>
  );
}

function filterRows<T extends Record<string, unknown>>(rows: T[], q: string): T[] {
  if (!q.trim()) return rows;
  const needle = q.toLowerCase();
  return rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(needle)));
}

function IntagTable({ rows, q }: { rows: typeof intagsmoten; q: string }) {
  const data = filterRows(rows, q);
  return (
    <TableShell head={["Adress", "Objektsstatus", "Säljare", "Mötesstatus", "Bokades", "Tid", "Källa"]} count={data.length}>
      {data.map((r, i) => (
        <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
          <td className="py-3 pr-4">
            <Link
              to="/objekt/$slug"
              params={{ slug: slugifyAddr(r.adress) }}
              search={{ tab: undefined, q: undefined }}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {r.adress}
            </Link>
            <div className="text-xs text-muted-foreground">{r.omr}</div>
          </td>
          <td className="py-3 pr-4"><StatusPill label={r.status} /></td>
          <td className="py-3 pr-4 text-muted-foreground">{r.saljare}</td>
          <td className="py-3 pr-4">
            <span className={r.motesstatus === "Vunnen" ? "text-primary" : "text-muted-foreground"}>{r.motesstatus}</span>
          </td>
          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{r.bokades}</td>
          <td className="py-3 pr-4 font-mono text-xs">{r.tid}</td>
          <td className="py-3 text-xs text-muted-foreground">{r.kalla}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function UppgifterTable({ rows, q }: { rows: typeof uppgifter; q: string }) {
  const data = filterRows(rows, q);
  return (
    <TableShell head={["", "Rubrik", "Kontakt", "Källa", "Skapad", "Förfaller"]} count={data.length}>
      {data.map((r, i) => (
        <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
          <td className="py-3 pr-3"><input type="checkbox" className="h-3.5 w-3.5 rounded border-border bg-transparent accent-primary" /></td>
          <td className="py-3 pr-4 text-foreground">{r.rubrik}</td>
          <td className="py-3 pr-4 text-muted-foreground">{r.kontakt}</td>
          <td className="py-3 pr-4 text-xs text-muted-foreground">{r.kalla}</td>
          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{r.skapad}</td>
          <td className="py-3 font-mono text-xs text-foreground">{r.forfaller}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function KontakterTable({ rows, q }: { rows: typeof kontakter; q: string }) {
  const data = filterRows(rows, q);
  return (
    <TableShell head={["Förnamn", "Efternamn", "Gata", "Skapad", "Källa"]} count={data.length}>
      {data.map((r, i) => (
        <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
          <td className="py-3 pr-4 font-medium text-foreground">{r.fornamn}</td>
          <td className="py-3 pr-4 text-foreground">{r.efternamn}</td>
          <td className="py-3 pr-4 text-xs text-muted-foreground">{r.gata}</td>
          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{r.skapad}</td>
          <td className="py-3 text-xs text-muted-foreground">{r.kalla}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function LeadsTable({ rows, q }: { rows: typeof leads; q: string }) {
  const data = filterRows(rows, q);
  return (
    <TableShell head={["Rubrik", "Kontakt", "Källa", "Status", "Skapad", "Förfaller"]} count={data.length}>
      {data.map((r, i) => (
        <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
          <td className="py-3 pr-4 text-foreground">{r.rubrik}</td>
          <td className="py-3 pr-4 text-muted-foreground">{r.kontakt}</td>
          <td className="py-3 pr-4 text-xs text-muted-foreground">{r.kalla}</td>
          <td className="py-3 pr-4">
            <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {r.status}
            </span>
          </td>
          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{r.skapad}</td>
          <td className="py-3 font-mono text-xs text-foreground">{r.forfaller}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function TableShell({ head, count, children }: { head: string[]; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{count} träffar</div>
        <div className="flex gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <button className="rounded px-2 py-1 hover:bg-muted/50 hover:text-foreground">Exportera</button>
          <button className="rounded px-2 py-1 hover:bg-muted/50 hover:text-foreground">Kolumner</button>
        </div>
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
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6  shadow-sm">
      {children}
    </section>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone =
    label === "Till salu" ? "border-primary/40 bg-primary/10 text-primary"
    : label === "Under intag" ? "border-blue-400/30 bg-blue-400/10 text-blue-700"
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