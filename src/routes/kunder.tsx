import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { listKontakter, saveKontakt, findByTelefon } from "../lib/kontaktStore";
import type { Kontakt, KontaktRelation } from "../lib/kontaktTypes";

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

type RollFilter = "alla" | KontaktRelation;

const ROLL_LABELS: Record<RollFilter, string> = {
  alla: "Alla",
  spekulant: "Spekulanter",
  säljare: "Säljare",
  köpare: "Köpare",
  kontakt: "Kontakter",
};

function hasRelation(k: Kontakt, roll: KontaktRelation) {
  return k.objektKopplingar.some((kp) => kp.relation === roll);
}

function rollColor(roll: KontaktRelation): string {
  switch (roll) {
    case "spekulant": return "text-blue-400/80 bg-blue-400/10";
    case "säljare":   return "text-amber-400/80 bg-amber-400/10";
    case "köpare":    return "text-emerald-400/80 bg-emerald-400/10";
    default:          return "text-muted-foreground bg-white/5";
  }
}

function topRelation(k: Kontakt): KontaktRelation | null {
  const priority: KontaktRelation[] = ["köpare", "säljare", "spekulant", "kontakt"];
  for (const r of priority) {
    if (k.objektKopplingar.some((kp) => kp.relation === r)) return r;
  }
  return null;
}

export const Route = createFileRoute("/kunder")({
  head: () => ({
    meta: [{ title: "Kontakter · Hajpex CRM" }],
  }),
  component: KunderLayout,
});

function KunderLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/kunder") return <KunderPage />;
  return <Outlet />;
}

function initials(k: Kontakt) {
  return [k.fornamn[0], k.efternamn[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

type SortMode = "prioritet" | "az" | "senast";

function warmthLevel(k: Kontakt): "green" | "amber" | "red" | "none" {
  const ns = k.nastaSteg;
  const now = Date.now();
  if (ns && ns.datum < now) return "red";
  const lastTs = k.aktiviteter.length > 0
    ? Math.max(...k.aktiviteter.map((a) => a.tidpunkt))
    : k.skapadAt;
  const daysSince = (now - lastTs) / 86_400_000;
  if (daysSince > 21) return "red";
  if (ns && ns.datum <= now + 7 * 86_400_000) return "green";
  if (daysSince <= 7) return "green";
  if (daysSince <= 21) return "amber";
  return "none";
}

function priorityScore(k: Kontakt): number {
  const ns = k.nastaSteg;
  const now = Date.now();
  if (ns && ns.datum < now) return 0;
  if (ns && ns.datum <= now + 86_400_000) return 1;
  if (ns && ns.datum <= now + 7 * 86_400_000) return 2;
  const lastTs = k.aktiviteter.length > 0
    ? Math.max(...k.aktiviteter.map((a) => a.tidpunkt))
    : k.skapadAt;
  const daysSince = (now - lastTs) / 86_400_000;
  if (daysSince > 21) return 3;
  if (ns) return 4;
  return 5;
}

function nastaStegBadge(k: Kontakt) {
  const ns = k.nastaSteg;
  if (!ns) return null;
  const now = Date.now();
  const in7 = now + 7 * 86400_000;
  if (ns.datum < now) {
    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">Förfallen</span>;
  }
  if (ns.datum <= now + 86400_000) {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">Idag</span>;
  }
  if (ns.datum <= in7) {
    return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      {new Date(ns.datum).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })}
    </span>;
  }
  return null;
}

function KunderPage() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [roll, setRoll] = useState<RollFilter>("alla");
  const [sort, setSort] = useState<SortMode>("prioritet");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { kontakter, counts } = useMemo(() => {
    void tick;
    const all = listKontakter();
    const counts: Record<RollFilter, number> = {
      alla: all.length,
      spekulant: all.filter((k) => hasRelation(k, "spekulant")).length,
      säljare: all.filter((k) => hasRelation(k, "säljare")).length,
      köpare: all.filter((k) => hasRelation(k, "köpare")).length,
      kontakt: all.filter((k) => hasRelation(k, "kontakt")).length,
    };

    let filtered = roll === "alla" ? all : all.filter((k) => hasRelation(k, roll as KontaktRelation));

    if (q.trim()) {
      const lq = q.toLowerCase();
      filtered = filtered.filter((k) =>
        `${k.fornamn} ${k.efternamn}`.toLowerCase().includes(lq) ||
        k.telefon.includes(lq) ||
        k.epost.toLowerCase().includes(lq) ||
        k.ort.toLowerCase().includes(lq)
      );
    }

    if (sort === "prioritet") {
      filtered = [...filtered].sort((a, b) => {
        const diff = priorityScore(a) - priorityScore(b);
        if (diff !== 0) return diff;
        return (a.nastaSteg?.datum ?? a.skapadAt) - (b.nastaSteg?.datum ?? b.skapadAt);
      });
    } else if (sort === "az") {
      filtered = [...filtered].sort((a, b) =>
        `${a.fornamn} ${a.efternamn}`.localeCompare(`${b.fornamn} ${b.efternamn}`, "sv")
      );
    } else {
      filtered = [...filtered].sort((a, b) => {
        const la = a.aktiviteter.length > 0 ? Math.max(...a.aktiviteter.map((x) => x.tidpunkt)) : a.skapadAt;
        const lb = b.aktiviteter.length > 0 ? Math.max(...b.aktiviteter.map((x) => x.tidpunkt)) : b.skapadAt;
        return lb - la;
      });
    }

    return { kontakter: filtered, counts };
  }, [q, roll, sort, tick]);

  function onSaved(id: string) {
    setDialogOpen(false);
    setTick((t) => t + 1);
    navigate({ to: "/kunder/$id", params: { id } });
  }

  const ROLLS: RollFilter[] = ["alla", "spekulant", "säljare", "köpare", "kontakt"];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <section className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">CRM</div>
            <h1 className="text-4xl font-medium md:text-5xl" style={serif}>
              Kontakter<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {counts.alla} kontakter totalt
            </p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-primary px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            + Ny kontakt
          </button>
        </section>

        {/* Rollfilter */}
        <div className="mb-5 flex flex-wrap gap-2">
          {ROLLS.map((r) => (
            <button
              key={r}
              onClick={() => setRoll(r)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                roll === r
                  ? "bg-primary text-primary-foreground"
                  : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {ROLL_LABELS[r]}
              <span className={`ml-1.5 text-[10px] opacity-70`}>{counts[r]}</span>
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök namn, telefon, e-post eller ort…"
            className="w-full max-w-sm rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />
          <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            {(["prioritet", "az", "senast"] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={["rounded-md px-3 py-1 text-[11px] transition-colors", sort === s ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}
              >
                {s === "prioritet" ? "Prioritet" : s === "az" ? "A–Ö" : "Senast aktiv"}
              </button>
            ))}
          </div>
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
            {kontakter.map((k) => {
              const topRoll = topRelation(k);
              return (
                <Link
                  key={k.id}
                  to="/kunder/$id"
                  params={{ id: k.id }}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-card/60 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80"
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary"
                      style={serif}
                    >
                      {initials(k)}
                    </div>
                    {(() => {
                      const w = warmthLevel(k);
                      if (w === "none") return null;
                      const dot = w === "green" ? "bg-emerald-400" : w === "amber" ? "bg-amber-400" : "bg-red-400";
                      return <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${dot}`} />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground" style={serif}>
                      {k.fornamn} {k.efternamn}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {k.ort ? k.ort : (k.telefon || k.epost || "—")}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {topRoll && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${rollColor(topRoll)}`}>
                          {ROLL_LABELS[topRoll].replace(/er$/, "").replace(/are$/, "are")}
                        </span>
                      )}
                      {nastaStegBadge(k)}
                      {k.objektKopplingar.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {k.objektKopplingar.length} obj.
                        </span>
                      )}
                      {k.gdprGodkant && (
                        <span className="text-[10px] text-emerald-400/60">✓ GDPR</span>
                      )}
                    </div>
                  </div>
                  {k.telefon && (
                    <a
                      href={`tel:${k.telefon.replace(/\s/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                      title={`Ring ${k.fornamn}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </a>
                  )}
                </Link>
              );
            })}
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
  const [telefon, setTelefon] = useState("");
  const [duplikat, setDuplikat] = useState<Kontakt | null>(null);
  const [form, setForm] = useState<FormState>({
    fornamn: "",
    efternamn: "",
    epost: "",
    ort: "",
    gdpr: false,
  });

  function handleTelefonBlur() {
    if (telefon.trim().length >= 6) {
      const found = findByTelefon(telefon);
      setDuplikat(found ?? null);
    } else {
      setDuplikat(null);
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

  const canSave = form.fornamn.trim().length > 0 && !duplikat;

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
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary/80">Ny kontakt</div>
          <h2 className="mt-1 text-2xl font-medium" style={serif}>
            Personuppgifter<span className="text-primary">.</span>
          </h2>
        </div>

        <div className="space-y-4">
          {/* Telefon — valfritt, dedup-check on blur */}
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Mobilnummer</span>
              <span className="normal-case tracking-normal text-muted-foreground/60">valfritt</span>
            </div>
            <input
              type="tel"
              value={telefon}
              onChange={(e) => { setTelefon(e.target.value); setDuplikat(null); }}
              onBlur={handleTelefonBlur}
              placeholder="070 000 00 00"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
          </label>

          {duplikat && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Förnamn *</div>
              <input
                type="text"
                value={form.fornamn}
                onChange={(e) => setForm((f) => ({ ...f, fornamn: e.target.value }))}
                placeholder="Mikael"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Efternamn</div>
              <input
                type="text"
                value={form.efternamn}
                onChange={(e) => setForm((f) => ({ ...f, efternamn: e.target.value }))}
                placeholder="Svensson"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">E-post</div>
            <input
              type="email"
              value={form.epost}
              onChange={(e) => setForm((f) => ({ ...f, epost: e.target.value }))}
              placeholder="mikael@example.se"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </label>

          <label className="block">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ort</div>
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
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5"
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Spara kontakt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
