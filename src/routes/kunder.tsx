import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { listKontakter, saveKontakt, findByTelefon } from "../lib/kontaktStore";
import type { Kontakt } from "../lib/kontaktTypes";

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

export const Route = createFileRoute("/kunder")({
  head: () => ({
    meta: [{ title: "Kunder · Stendahl CRM" }],
  }),
  component: KunderPage,
});

function initials(k: Kontakt) {
  return [k.fornamn[0], k.efternamn[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function KunderPage() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const kontakter = useMemo(() => {
    void tick;
    const all = listKontakter();
    if (!q.trim()) return all;
    const lq = q.toLowerCase();
    return all.filter((k) =>
      `${k.fornamn} ${k.efternamn}`.toLowerCase().includes(lq) ||
      k.telefon.includes(lq) ||
      k.epost.toLowerCase().includes(lq) ||
      k.ort.toLowerCase().includes(lq)
    );
  }, [q, tick]);

  function onSaved(id: string) {
    setDialogOpen(false);
    setTick((t) => t + 1);
    navigate({ to: "/kunder/$id", params: { id } });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <section className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">CRM</div>
            <h1 className="text-4xl font-medium md:text-5xl" style={serif}>
              Kunder<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {listKontakter().length} kontakter totalt
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-primary px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            + Ny kontakt
          </button>
        </section>

        <div className="mb-6">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök namn, telefon, e-post eller ort…"
            className="w-full max-w-sm rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />
        </div>

        {kontakter.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-2xl text-primary">
              👤
            </div>
            <div className="text-lg" style={serif}>
              {q ? `Inga träffar för "${q}"` : "Inga kontakter än"}
            </div>
            {!q && (
              <p className="mt-2 text-sm text-muted-foreground">
                Lägg till din första kontakt för att komma igång.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kontakter.map((k) => (
              <Link
                key={k.id}
                to="/kunder/$id"
                params={{ id: k.id }}
                className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-card/60 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80"
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary"
                  style={serif}
                >
                  {initials(k)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground" style={serif}>
                    {k.fornamn} {k.efternamn}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {k.telefon || k.epost || "—"}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {k.objektKopplingar.length > 0 && (
                      <span className="text-[10px] text-primary/70">
                        {k.objektKopplingar.length} {k.objektKopplingar.length === 1 ? "objekt" : "objekt"}
                      </span>
                    )}
                    {k.gdprGodkant && (
                      <span className="text-[10px] text-emerald-400/70">✓ GDPR</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {dialogOpen && (
        <NyKontaktDialog onClose={() => setDialogOpen(false)} onSaved={onSaved} />
      )}
    </AppShell>
  );
}

type FormState = {
  fornamn: string;
  efternamn: string;
  epost: string;
  ort: string;
  gdpr: boolean;
};

function NyKontaktDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [step, setStep] = useState<"telefon" | "info">("telefon");
  const [telefon, setTelefon] = useState("");
  const [duplikat, setDuplikat] = useState<Kontakt | null>(null);
  const [form, setForm] = useState<FormState>({
    fornamn: "",
    efternamn: "",
    epost: "",
    ort: "",
    gdpr: false,
  });

  function checkTelefon() {
    const found = findByTelefon(telefon);
    if (found) {
      setDuplikat(found);
    } else {
      setDuplikat(null);
      setStep("info");
    }
  }

  function handleSave() {
    const k = saveKontakt({
      fornamn: form.fornamn.trim(),
      efternamn: form.efternamn.trim(),
      telefon: telefon.trim(),
      epost: form.epost.trim(),
      adress: "",
      ort: form.ort.trim(),
      budgetMin: "",
      budgetMax: "",
      sokTyper: [],
      sokOmraden: [],
      anteckningar: "",
      gdprGodkant: form.gdpr ? Date.now() : null,
      objektKopplingar: [],
      aktiviteter: [
        {
          id: crypto.randomUUID(),
          typ: "kontakt_skapad",
          tidpunkt: Date.now(),
          beskrivning: "Kontakt skapad",
        },
      ],
    });
    onSaved(k.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-card p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-xl text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>

        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary/80">
            {step === "telefon" ? "Steg 1 av 2" : "Steg 2 av 2"}
          </div>
          <h2 className="mt-1 text-2xl font-medium" style={serif}>
            {step === "telefon" ? "Mobilnummer" : "Personuppgifter"}
            <span className="text-primary">.</span>
          </h2>
        </div>

        {step === "telefon" ? (
          <div>
            <p className="mb-5 text-sm text-muted-foreground">
              Ange mobilnummer — systemet kontrollerar om personen redan finns för att undvika dubletter.
            </p>
            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Mobilnummer
              </div>
              <input
                type="tel"
                value={telefon}
                onChange={(e) => {
                  setTelefon(e.target.value);
                  setDuplikat(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && telefon.length >= 6 && checkTelefon()}
                placeholder="070 000 00 00"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
            </label>

            {duplikat && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="text-sm font-medium text-amber-300">Kontakt finns redan</div>
                <div className="mt-1 text-xs text-amber-300/80">
                  {duplikat.fornamn} {duplikat.efternamn}
                  {duplikat.epost ? ` · ${duplikat.epost}` : ""}
                </div>
                <Link
                  to="/kunder/$id"
                  params={{ id: duplikat.id }}
                  onClick={onClose}
                  className="mt-2 block text-xs font-medium text-amber-300 underline"
                >
                  Öppna befintlig kontakt →
                </Link>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5"
              >
                Avbryt
              </button>
              <button
                onClick={checkTelefon}
                disabled={telefon.trim().length < 6}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Fortsätt →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Förnamn *
                </div>
                <input
                  type="text"
                  value={form.fornamn}
                  onChange={(e) => setForm((f) => ({ ...f, fornamn: e.target.value }))}
                  placeholder="Mikael"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  autoFocus
                />
              </label>
              <label className="block">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Efternamn
                </div>
                <input
                  type="text"
                  value={form.efternamn}
                  onChange={(e) => setForm((f) => ({ ...f, efternamn: e.target.value }))}
                  placeholder="Test"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </label>
            </div>

            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                E-post
              </div>
              <input
                type="email"
                value={form.epost}
                onChange={(e) => setForm((f) => ({ ...f, epost: e.target.value }))}
                placeholder="mikael@example.se"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Ort
              </div>
              <input
                type="text"
                value={form.ort}
                onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))}
                placeholder="Stockholm"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.gdpr}
                onChange={(e) => setForm((f) => ({ ...f, gdpr: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                Personen har gett samtycke till att vi lagrar och behandlar uppgifter enligt GDPR
              </span>
            </label>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep("telefon")}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5"
              >
                ← Tillbaka
              </button>
              <button
                onClick={handleSave}
                disabled={!form.fornamn.trim()}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Spara kontakt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
