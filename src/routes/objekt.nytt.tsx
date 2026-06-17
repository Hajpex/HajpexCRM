import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { saveObjekt } from "../lib/objektStore";
import { slugifyAddr, type Typ } from "../data/objekt";
import { saveKontakt, addObjektKoppling } from "../lib/kontaktStore";
import { AddressInput } from "../components/AddressInput";

export const Route = createFileRoute("/objekt/nytt")({
  head: () => ({
    meta: [
      { title: "Nytt objekt · Hajpex CRM" },
      { name: "description", content: "Skapa ett nytt objekt snabbt — fyll i resten senare." },
    ],
  }),
  component: NyttObjektPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

// Primära typer (de mäklaren oftast skapar) + sekundära
const MAIN_TYPES: { value: Typ; label: string; icon: string }[] = [
  { value: "Bostadsrätt", label: "Bostadsrätt", icon: "🏢" },
  { value: "Villa", label: "Villa", icon: "🏡" },
  { value: "Radhus", label: "Radhus", icon: "🏘️" },
  { value: "Parhus", label: "Parhus", icon: "🏠" },
];
const MORE_TYPES: Typ[] = ["Kedjehus", "Fritidshus", "Ägarlägenhet", "Tomt", "Gård"];

// Typer som har en fastighetsbeteckning (allt utom bostadsrätt/ägarlägenhet)
const HAS_FASTIGHET = new Set<Typ>(["Villa", "Radhus", "Parhus", "Kedjehus", "Fritidshus", "Tomt", "Gård"]);

function NyttObjektPage() {
  const navigate = useNavigate();
  const [typ, setTyp] = useState<Typ | null>(null);
  const [showMore, setShowMore] = useState(false);

  const [gata, setGata] = useState("");
  const [postnr, setPostnr] = useState("");
  const [stad, setStad] = useState("");
  const [fastighet, setFastighet] = useState("");

  const [saljNamn, setSaljNamn] = useState("");
  const [saljTel, setSaljTel] = useState("");

  const [lmInfo, setLmInfo] = useState(false);

  const canCreate = !!typ && gata.trim().length > 1;

  function handleCreate() {
    if (!typ || !canCreate) return;
    const adress = gata.trim();
    const slug = slugifyAddr(adress);

    saveObjekt({
      adress,
      postnr: postnr.trim(),
      stad: stad.trim(),
      typ,
      status: "Under intag",
      saljare: saljNamn.trim() || undefined,
    });

    // Om säljare angetts: skapa en riktig kontakt + koppla som säljare
    // (så den syns konsekvent i säljare-fliken).
    if (saljNamn.trim()) {
      const parts = saljNamn.trim().split(/\s+/);
      const k = saveKontakt({
        fornamn: parts[0] ?? saljNamn.trim(),
        efternamn: parts.slice(1).join(" "),
        telefon: saljTel.trim(),
        epost: "",
        adress: "",
        ort: stad.trim(),
        budgetMin: "",
        budgetMax: "",
        sokTyper: [],
        sokOmraden: [],
        anteckningar: "",
        gdprGodkant: null,
        objektKopplingar: [],
        aktiviteter: [{
          id: crypto.randomUUID(),
          typ: "kontakt_skapad",
          tidpunkt: Date.now(),
          beskrivning: "Tillagd som säljare vid objektregistrering",
        }],
      });
      addObjektKoppling(k.id, { slug, relation: "säljare", addedAt: Date.now(), anteckning: "" });
    }

    navigate({ to: "/objekt/$slug", params: { slug }, search: { tab: undefined, q: undefined } });
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-10">
        <header className="mb-8">
          <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">Nytt objekt</p>
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl" style={serif}>
            Skapa snabbt<span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Välj typ och adress — lägg till säljare om du har den. Allt annat
            (utgångspris, ytor, rum…) fyller du i på objektet sen.
          </p>
        </header>

        {/* 1. Typ */}
        <section className="mb-7">
          <SectionLabel n="1" title="Typ av objekt" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MAIN_TYPES.map((t) => (
              <TypCard key={t.value} active={typ === t.value} icon={t.icon} label={t.label} onClick={() => setTyp(t.value)} />
            ))}
          </div>
          <div className="mt-3">
            {!showMore ? (
              <button onClick={() => setShowMore(true)} className="text-xs text-primary hover:underline">
                + Fler typer
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {MORE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTyp(t)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      typ === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 2. Adress */}
        <section className="mb-7">
          <SectionLabel n="2" title="Adress" />
          <div className="space-y-3">
            <AddressInput
              value={gata}
              onChange={setGata}
              onSelect={(road, postcode, city) => { setGata(road); if (postcode) setPostnr(postcode); if (city) setStad(city); }}
              placeholder="Gata och nummer, t.ex. Storgatan 12"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3">
              <input value={postnr} onChange={(e) => setPostnr(e.target.value)} placeholder="Postnummer" className={inputCls} />
              <input value={stad} onChange={(e) => setStad(e.target.value)} placeholder="Ort" className={inputCls} />
            </div>

            {/* Lantmäteriet — för hustyper (kommande integration) */}
            {typ && HAS_FASTIGHET.has(typ) && (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Fastighetsbeteckning <span className="normal-case tracking-normal text-muted-foreground/60">(valfritt)</span>
                </label>
                <div className="flex gap-2">
                  <input value={fastighet} onChange={(e) => setFastighet(e.target.value)} placeholder="t.ex. Granvik 1:23" className={inputCls} />
                  <button
                    onClick={() => setLmInfo(true)}
                    className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
                  >
                    Hämta från Lantmäteriet
                  </button>
                </div>
                {lmInfo && (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-600">
                    Automatisk hämtning från Lantmäteriet är inte aktiverad ännu (kräver en
                    datakälla med API-nyckel). Skriv in adressen manuellt så länge — vi kopplar
                    på den automatiska hämtningen snart.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 3. Säljare (valfritt) */}
        <section className="mb-8">
          <SectionLabel n="3" title="Säljare" optional />
          <div className="grid grid-cols-2 gap-3">
            <input value={saljNamn} onChange={(e) => setSaljNamn(e.target.value)} placeholder="Namn" className={inputCls} />
            <input value={saljTel} onChange={(e) => setSaljTel(e.target.value)} placeholder="Telefon" className={inputCls} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Anges en säljare skapas en kontakt som kopplas till objektet. Hoppa över om du inte har infon än.
          </p>
        </section>

        {/* Skapa */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Skapa objekt →
          </button>
          <span className="text-xs text-muted-foreground">
            {canCreate ? "Du tas till objektet för att fylla i resten." : "Välj typ och fyll i adress för att fortsätta."}
          </span>
        </div>
      </div>
    </AppShell>
  );
}

function SectionLabel({ n, title, optional }: { n: string; title: string; optional?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{n}</span>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {optional && <span className="text-[11px] text-muted-foreground/60">valfritt</span>}
    </div>
  );
}

function TypCard({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
        active
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-card/80"
      }`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
