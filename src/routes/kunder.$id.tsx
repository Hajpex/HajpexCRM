import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { getKontakt, updateKontakt, addAktivitet, deleteKontakt, setNastaSteg } from "../lib/kontaktStore";
import { getObjektBySlug, slugifyAddr } from "./objekt.$slug";
import type { Kontakt, Aktivitet, AktivitetTyp, NastaSteg, NastaStegTyp } from "../lib/kontaktTypes";
import { fmtSweNum, handleNumberInput } from "../lib/formatters";
import {
  listIntagsmotenForKontakt, saveIntagsmote, updateIntagsmote, deleteIntagsmote,
  exportToICS, KALLOR,
  type Intagsmote, type IntagsmoteStatus,
} from "../lib/intagsmoteStore";
import { saveObjekt } from "../lib/objektStore";
import type { Typ } from "../data/objekt";
import { AddressInput } from "../components/AddressInput";

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

export const Route = createFileRoute("/kunder/$id")({
  head: () => ({ meta: [{ title: "Kontakt · Stendahl CRM" }] }),
  component: KontaktDetailPage,
});

type Tab = "historik" | "intagsmoten" | "objekt" | "anteckningar";

const AKTIVITET_LABELS: Record<AktivitetTyp, string> = {
  visning: "Deltog på visning",
  bud: "Lade bud",
  samtal: "Samtal",
  kontakt_skapad: "Kontakt skapad",
  anteckning: "Anteckning",
  mejl: "Mejl skickat",
};

const AKTIVITET_ICONS: Record<AktivitetTyp, string> = {
  visning: "🏠",
  bud: "🔨",
  samtal: "📞",
  kontakt_skapad: "✅",
  anteckning: "📝",
  mejl: "✉️",
};

function fmtTs(ts: number) {
  return new Date(ts).toLocaleString("sv-SE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
}

function fmtKr(s: string) {
  const n = Number(s.replace(/\D/g, ""));
  return n ? n.toLocaleString("sv-SE") + " kr" : s;
}

function initials(k: Kontakt) {
  return [k.fornamn[0], k.efternamn[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function KontaktDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [kontakt, setKontakt] = useState<Kontakt | null>(null);
  const [tab, setTab] = useState<Tab>("historik");
  const [editMode, setEditMode] = useState(false);
  const [logSamtalOpen, setLogSamtalOpen] = useState(false);

  function load() {
    const k = getKontakt(id);
    if (!k) navigate({ to: "/kunder" });
    else setKontakt(k);
  }

  useEffect(() => { load(); }, [id]);

  if (!kontakt) return null;

  function patch(p: Partial<Kontakt>) {
    updateKontakt(id, p);
    load();
  }

  function handleDelete() {
    if (!window.confirm(`Ta bort ${kontakt!.fornamn} ${kontakt!.efternamn}? Detta går inte att ångra.`)) return;
    deleteKontakt(id);
    navigate({ to: "/kunder" });
  }

  const namn = `${kontakt.fornamn} ${kontakt.efternamn}`.trim() || "Namnlös";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        {/* Breadcrumb */}
        <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/kunder" className="hover:text-foreground">← Kontakter</Link>
          <span className="opacity-40">/</span>
          <span className="text-foreground">{namn}</span>
        </div>

        {/* Header */}
        <section className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xl font-medium text-primary"
              style={serif}
            >
              {initials(kontakt)}
            </div>
            <div>
              <h1 className="text-3xl font-medium md:text-4xl" style={serif}>
                {namn}<span className="text-primary">.</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {kontakt.telefon || "Inget nummer"}
                {kontakt.ort ? ` · ${kontakt.ort}` : ""}
              </p>
              {/* Quick actions — extra handy on mobile */}
              <div className="mt-2 flex flex-wrap gap-2">
                {kontakt.telefon && (
                  <a
                    href={`tel:${kontakt.telefon.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/20"
                  >
                    📞 Ring
                  </a>
                )}
                {kontakt.epost && (
                  <a
                    href={`mailto:${kontakt.epost}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                  >
                    ✉️ Mejl
                  </a>
                )}
                <button
                  onClick={() => setLogSamtalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-foreground/[0.06] px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-foreground/[0.10] hover:text-foreground"
                >
                  📋 Logg samtal
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={[
                "rounded-md border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
                editMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              ].join(" ")}
            >
              {editMode ? "✓ Klar" : "✎ Redigera"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
            >
              Ta bort
            </button>
          </div>
        </section>

        {/* Body */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left sidebar — second on mobile, first on desktop */}
          <aside className="order-last space-y-4 lg:order-first">
            <InfoCard kontakt={kontakt} editMode={editMode} patch={patch} />
            <NastaStegCard kontakt={kontakt} onUpdate={load} />
            <IntresseCard kontakt={kontakt} editMode={editMode} patch={patch} />
            <GdprCard kontakt={kontakt} patch={patch} />
          </aside>

          {/* Right main — first on mobile, second on desktop */}
          <div className="order-first lg:order-last">
            <div className="mb-5 flex border-b border-border">
              {(["intagsmoten", "historik", "objekt", "anteckningar"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    "relative -mb-px px-4 py-2.5 text-sm transition-colors",
                    tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {t === "intagsmoten" && "Intagsmöten"}
                  {t === "historik" && "Historik"}
                  {t === "objekt" && `Objekt (${kontakt.objektKopplingar.length})`}
                  {t === "anteckningar" && "Anteckningar"}
                  {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-primary" />}
                </button>
              ))}
            </div>

            {tab === "intagsmoten" && <IntagsmotenTab kontakt={kontakt} />}
            {tab === "historik" && <HistorikTab kontakt={kontakt} onAdd={load} />}
            {tab === "objekt" && <ObjektTab kontakt={kontakt} />}
            {tab === "anteckningar" && <AnteckningarTab kontakt={kontakt} patch={patch} />}
          </div>
        </div>
      </div>
      {logSamtalOpen && (
        <LoggaSamtalModal
          kontaktId={kontakt.id}
          namn={`${kontakt.fornamn} ${kontakt.efternamn}`}
          onClose={() => setLogSamtalOpen(false)}
          onSaved={() => { load(); setLogSamtalOpen(false); setTab("historik"); }}
        />
      )}
    </AppShell>
  );
}

/* ─── Logg samtal modal ─── */
function LoggaSamtalModal({ kontaktId, namn, onClose, onSaved }: {
  kontaktId: string; namn: string; onClose: () => void; onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<"intresserad" | "ej_intresserad" | "boka_mote" | "annat">("intresserad");
  const outcomes = [
    { id: "intresserad" as const, label: "Intresserad" },
    { id: "ej_intresserad" as const, label: "Ej intresserad nu" },
    { id: "boka_mote" as const, label: "Boka möte" },
    { id: "annat" as const, label: "Annat" },
  ];

  function handleSave() {
    const outcomeLabel = outcomes.find((o) => o.id === outcome)?.label ?? "";
    addAktivitet(kontaktId, {
      typ: "samtal",
      tidpunkt: Date.now(),
      beskrivning: [outcomeLabel, text.trim()].filter(Boolean).join(" — "),
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Logg samtal — {namn}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Utfall</p>
          <div className="grid grid-cols-2 gap-2">
            {outcomes.map((o) => (
              <button
                key={o.id}
                onClick={() => setOutcome(o.id)}
                className={[
                  "rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left",
                  outcome === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50",
                ].join(" ")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anteckning (valfritt)…"
          rows={3}
          autoFocus
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            Avbryt
          </button>
          <button onClick={handleSave} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Spara samtal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Klar med logg modal ─── */
function KlarMedLoggModal({ ns, kontaktId, namn, onClose, onSaved }: {
  ns: NastaSteg; kontaktId: string; namn: string; onClose: () => void; onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [sattNytt, setSattNytt] = useState(false);
  const [nyttTyp, setNyttTyp] = useState<NastaStegTyp>("samtal");
  const [nyttText, setNyttText] = useState("");
  const [nyttDatum, setNyttDatum] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  const nsIcon = NASTA_STEG_TYPER.find((t) => t.typ === ns.typ)?.icon ?? "📌";
  const aktTyp: AktivitetTyp = ns.typ === "mejl" ? "mejl" : ns.typ === "annat" ? "anteckning" : "samtal";

  function handleSave() {
    const parts = ["Avslutat: " + ns.text, note.trim()].filter(Boolean);
    addAktivitet(kontaktId, { typ: aktTyp, tidpunkt: Date.now(), beskrivning: parts.join(" — ") });
    if (sattNytt && nyttText.trim()) {
      setNastaSteg(kontaktId, { typ: nyttTyp, text: nyttText.trim(), datum: new Date(nyttDatum + "T09:00:00").getTime() });
    } else {
      setNastaSteg(kontaktId, null);
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Klart! — {namn}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {/* Completed task preview */}
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
          <span className="text-base">{nsIcon}</span>
          <p className="text-sm text-foreground">{ns.text}</p>
          <span className="ml-auto text-emerald-400 text-xs font-medium">✓</span>
        </div>

        {/* Optional note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vad hände? (valfritt)"
          rows={2}
          autoFocus
          className="mb-4 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />

        {/* Set next step toggle */}
        <button
          onClick={() => setSattNytt((v) => !v)}
          className={[
            "mb-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            sattNytt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30",
          ].join(" ")}
        >
          <span className={["flex h-4 w-4 items-center justify-center rounded border text-[10px] transition-colors",
            sattNytt ? "border-primary bg-primary text-primary-foreground" : "border-current"].join(" ")}>
            {sattNytt && "✓"}
          </span>
          Sätt nytt nästa steg
        </button>

        {sattNytt && (
          <div className="mb-4 space-y-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex gap-1.5 flex-wrap">
              {NASTA_STEG_TYPER.map((t) => (
                <button
                  key={t.typ}
                  onClick={() => setNyttTyp(t.typ)}
                  className={[
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    nyttTyp === t.typ ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40",
                  ].join(" ")}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={nyttText}
              onChange={(e) => setNyttText(e.target.value)}
              placeholder="Vad ska du göra?"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
            <input
              type="date"
              value={nyttDatum}
              onChange={(e) => setNyttDatum(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            Avbryt
          </button>
          <button onClick={handleSave} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            {sattNytt ? "Spara & sätt nästa" : "Spara & stäng"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Info card ─── */
function InfoCard({ kontakt, editMode, patch }: { kontakt: Kontakt; editMode: boolean; patch: (p: Partial<Kontakt>) => void }) {
  return (
    <Card title="Kontaktinfo">
      <InfoRow label="Telefon" icon="📞">
        {editMode
          ? <EditInput value={kontakt.telefon} onChange={(v) => patch({ telefon: v })} placeholder="070 000 00 00" />
          : <span>{kontakt.telefon || <Muted>—</Muted>}</span>}
      </InfoRow>
      <InfoRow label="E-post" icon="✉️">
        {editMode
          ? <EditInput value={kontakt.epost} onChange={(v) => patch({ epost: v })} placeholder="namn@example.se" type="email" />
          : <span className="break-all">{kontakt.epost || <Muted>—</Muted>}</span>}
      </InfoRow>
      <InfoRow label="Adress" icon="📍">
        {editMode
          ? <EditInput value={kontakt.adress} onChange={(v) => patch({ adress: v })} placeholder="Gatuadress" />
          : <span>{kontakt.adress || <Muted>—</Muted>}</span>}
      </InfoRow>
      <InfoRow label="Ort" icon="🏙️">
        {editMode
          ? <EditInput value={kontakt.ort} onChange={(v) => patch({ ort: v })} placeholder="Stockholm" />
          : <span>{kontakt.ort || <Muted>—</Muted>}</span>}
      </InfoRow>
      <div className="mt-3 border-t border-border/50 pt-3 text-[10px] text-muted-foreground">
        Kontakt sedan {fmtDate(kontakt.skapadAt)}
      </div>
    </Card>
  );
}

/* ─── Intresse card ─── */
const TYPER = ["Bostadsrätt", "Villa", "Radhus", "Fritidshus", "Tomt"];

function IntresseCard({ kontakt, editMode, patch }: { kontakt: Kontakt; editMode: boolean; patch: (p: Partial<Kontakt>) => void }) {
  function toggleTyp(typ: string) {
    const has = kontakt.sokTyper.includes(typ);
    patch({ sokTyper: has ? kontakt.sokTyper.filter((t) => t !== typ) : [...kontakt.sokTyper, typ] });
  }

  return (
    <Card title="Intresse & budget">
      <div className="space-y-3 text-sm">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Budget</div>
          {editMode ? (
            <div className="flex items-center gap-2">
              <NumberInput value={kontakt.budgetMin} onChange={(v) => patch({ budgetMin: v })} placeholder="Min kr" />
              <span className="flex-shrink-0 text-muted-foreground">–</span>
              <NumberInput value={kontakt.budgetMax} onChange={(v) => patch({ budgetMax: v })} placeholder="Max kr" />
            </div>
          ) : (
            <div className="text-foreground">
              {kontakt.budgetMin || kontakt.budgetMax
                ? `${kontakt.budgetMin ? fmtKr(kontakt.budgetMin) : "?"} – ${kontakt.budgetMax ? fmtKr(kontakt.budgetMax) : "?"}`
                : <Muted>Ej angiven</Muted>}
            </div>
          )}
        </div>
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Söker</div>
          {editMode ? (
            <div className="flex flex-wrap gap-1.5">
              {TYPER.map((t) => {
                const on = kontakt.sokTyper.includes(t);
                return (
                  <button key={t} onClick={() => toggleTyp(t)}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40",
                    ].join(" ")}>
                    {t}
                  </button>
                );
              })}
            </div>
          ) : (
            kontakt.sokTyper.length > 0
              ? <div className="flex flex-wrap gap-1.5">
                  {kontakt.sokTyper.map((t) => (
                    <span key={t} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-foreground">{t}</span>
                  ))}
                </div>
              : <Muted>Ej angett</Muted>
          )}
        </div>
        {editMode && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Önskat område</div>
            <EditInput
              value={kontakt.sokOmraden.join(", ")}
              onChange={(v) => patch({ sokOmraden: v.split(",").map((s) => s.trim()).filter(Boolean) })}
              placeholder="Stenkulla, Granvik…"
            />
          </div>
        )}
        {!editMode && kontakt.sokOmraden.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Område</div>
            <div className="text-sm text-foreground">{kontakt.sokOmraden.join(", ")}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── GDPR card ─── */
function GdprCard({ kontakt, patch }: { kontakt: Kontakt; patch: (p: Partial<Kontakt>) => void }) {
  const ok = !!kontakt.gdprGodkant;
  return (
    <Card title="GDPR">
      <div className="flex items-center gap-3">
        <div className={["flex h-8 w-8 items-center justify-center rounded-full text-sm",
          ok ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-muted-foreground"].join(" ")}>
          {ok ? "✓" : "?"}
        </div>
        <div>
          <div className={["text-sm font-medium", ok ? "text-emerald-400" : "text-muted-foreground"].join(" ")}>
            {ok ? "Samtycke givet" : "Inget samtycke"}
          </div>
          {ok && <div className="text-[10px] text-muted-foreground">{fmtDate(kontakt.gdprGodkant!)}</div>}
        </div>
      </div>
      {!ok && (
        <button
          onClick={() => patch({ gdprGodkant: Date.now() })}
          className="mt-3 w-full rounded-lg border border-border py-2 text-xs text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
        >
          Markera som godkänd
        </button>
      )}
    </Card>
  );
}

/* ─── Nästa steg card ─── */

const NASTA_STEG_TYPER: { typ: NastaStegTyp; label: string; icon: string }[] = [
  { typ: "samtal", label: "Ring", icon: "📞" },
  { typ: "mejl",   label: "Mejla", icon: "✉️" },
  { typ: "möte",   label: "Möte", icon: "🤝" },
  { typ: "annat",  label: "Annat", icon: "📌" },
];

function NastaStegCard({ kontakt, onUpdate }: { kontakt: Kontakt; onUpdate: () => void }) {
  const ns = kontakt.nastaSteg ?? null;
  const [adding, setAdding] = useState(false);
  const [klarOpen, setKlarOpen] = useState(false);
  const [typ, setTyp] = useState<NastaStegTyp>("samtal");
  const [text, setText] = useState("");
  const [datum, setDatum] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  function save() {
    if (!text.trim()) return;
    setNastaSteg(kontakt.id, {
      typ,
      text: text.trim(),
      datum: new Date(datum + "T09:00:00").getTime(),
    });
    setAdding(false);
    setText("");
    onUpdate();
  }

  const isOverdue = ns && ns.datum < Date.now();
  const icon = NASTA_STEG_TYPER.find((t) => t.typ === (ns?.typ ?? "annat"))?.icon ?? "📌";

  return (
  <>
    <Card title="Nästa steg">
      {ns ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <span className="text-base">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{ns.text}</p>
              <p className={["mt-0.5 text-[10px] font-medium", isOverdue ? "text-red-400" : "text-muted-foreground"].join(" ")}>
                {isOverdue ? "Förfallen — " : ""}
                {new Date(ns.datum).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setKlarOpen(true)}
              className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
            >
              ✓ Klar
            </button>
            <button
              onClick={() => { setAdding(true); setTyp(ns.typ); setText(ns.text); }}
              className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              Ändra
            </button>
          </div>
        </div>
      ) : adding ? (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {NASTA_STEG_TYPER.map((t) => (
              <button
                key={t.typ}
                onClick={() => setTyp(t.typ)}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  typ === t.typ
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                ].join(" ")}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Vad ska du göra?"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!text.trim()}
              className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Spara
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:border-primary/40"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          + Sätt nästa steg
        </button>
      )}
    </Card>
    {klarOpen && ns && (
      <KlarMedLoggModal
        ns={ns}
        kontaktId={kontakt.id}
        namn={`${kontakt.fornamn} ${kontakt.efternamn}`}
        onClose={() => setKlarOpen(false)}
        onSaved={() => { setKlarOpen(false); onUpdate(); }}
      />
    )}
  </>
  );
}

/* ─── Historik tab ─── */
function HistorikTab({ kontakt, onAdd }: { kontakt: Kontakt; onAdd: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [typ, setTyp] = useState<AktivitetTyp>("anteckning");
  const [text, setText] = useState("");
  const [objSlug, setObjSlug] = useState("");

  function handleAdd() {
    if (!text.trim()) return;
    addAktivitet(kontakt.id, {
      typ,
      tidpunkt: Date.now(),
      beskrivning: text.trim(),
      objektSlug: objSlug.trim() || undefined,
    });
    setText("");
    setObjSlug("");
    setShowForm(false);
    onAdd();
  }

  const aktiviteter = [...kontakt.aktiviteter].sort((a, b) => b.tidpunkt - a.tidpunkt);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          + Lägg till aktivitet
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["anteckning", "samtal", "visning", "bud", "mejl"] as AktivitetTyp[]).map((t) => (
              <button key={t} onClick={() => setTyp(t)}
                className={["rounded-full border px-3 py-1 text-xs transition-colors",
                  typ === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40"].join(" ")}>
                {AKTIVITET_ICONS[t]} {AKTIVITET_LABELS[t]}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Beskrivning…"
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5">
              Avbryt
            </button>
            <button onClick={handleAdd} disabled={!text.trim()} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40">
              Spara
            </button>
          </div>
        </div>
      )}

      {aktiviteter.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Ingen historik ännu.</div>
      ) : (
        <div className="space-y-0">
          {aktiviteter.map((a, i) => {
            const obj = a.objektSlug ? getObjektBySlug(a.objektSlug) : null;
            return (
              <div key={a.id} className="flex gap-4 pb-5">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm">
                    {AKTIVITET_ICONS[a.typ]}
                  </div>
                  {i < aktiviteter.length - 1 && (
                    <div className="mt-1 w-px flex-1 bg-white/[0.06]" />
                  )}
                </div>
                <div className="min-w-0 pb-1 pt-1">
                  <div className="text-sm text-foreground">{a.beskrivning}</div>
                  {obj && (
                    <Link
                      to="/objekt/$slug"
                      params={{ slug: a.objektSlug! }}
                      search={{ tab: undefined, q: undefined }}
                      className="mt-0.5 block text-[11px] text-primary/80 hover:text-primary"
                      style={serif}
                    >
                      {obj.adress}
                    </Link>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">{fmtTs(a.tidpunkt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Objekt tab ─── */
function ObjektTab({ kontakt }: { kontakt: Kontakt }) {
  if (kontakt.objektKopplingar.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Inga kopplade objekt ännu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {kontakt.objektKopplingar.map((kp) => {
        const obj = getObjektBySlug(kp.slug);
        return (
          <div key={`${kp.slug}-${kp.relation}`}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/40 text-lg">
              🏠
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to="/objekt/$slug"
                params={{ slug: kp.slug }}
                search={{ tab: undefined, q: undefined }}
                className="block truncate font-medium text-foreground hover:text-primary"
                style={serif}
              >
                {obj?.adress ?? kp.slug}
              </Link>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{kp.relation}</span>
                {obj?.status && <span>· {obj.status}</span>}
                <span>· {fmtDate(kp.addedAt)}</span>
              </div>
              {kp.anteckning && (
                <div className="mt-1 text-xs text-muted-foreground">{kp.anteckning}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Anteckningar tab ─── */
function AnteckningarTab({ kontakt, patch }: { kontakt: Kontakt; patch: (p: Partial<Kontakt>) => void }) {
  const [text, setText] = useState(kontakt.anteckningar);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    patch({ anteckningar: text });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Fria anteckningar om kontakten — behov, preferenser, bakgrund…"
        className="w-full resize-y rounded-xl border border-border bg-card px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          Spara
        </button>
        {saved && <span className="text-xs text-primary">✓ Sparat</span>}
      </div>
    </div>
  );
}

/* ─── Intagsmöten tab ─── */

const OBJEKT_TYPER: Typ[] = ["Bostadsrätt", "Villa", "Radhus", "Fritidshus", "Tomt", "Parhus", "Kedjehus", "Ägarlägenhet"];

const STATUS_COLORS: Record<IntagsmoteStatus, string> = {
  Planerat:   "text-blue-400 bg-blue-400/10",
  Genomfört:  "text-amber-400 bg-amber-400/10",
  Vunnen:     "text-emerald-400 bg-emerald-400/10",
  Förlorad:   "text-red-400 bg-red-400/10",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function defaultSluttid(start: string) {
  const [h, m] = start.split(":").map(Number);
  const end = new Date(0);
  end.setHours(h + 1, m);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}
function dateTimeToMs(date: string, time: string): number {
  return new Date(`${date}T${time || "00:00"}`).getTime();
}
function msFmt(ts: number) {
  return new Date(ts).toLocaleString("sv-SE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function msDateFmt(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
}
function msTimeFmt(ts: number) {
  return new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function IntagsmotenTab({ kontakt }: { kontakt: Kontakt }) {
  const [moten, setMoten] = useState<Intagsmote[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSkapaBostad, setShowSkapaBostad] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState<string | null>(null);

  function reload() {
    setMoten(listIntagsmotenForKontakt(kontakt.id));
  }
  useEffect(() => { reload(); }, [kontakt.id]);

  const selectedMote = moten.find((m) => m.id === selected) ?? null;

  function handleDelete(id: string) {
    if (!window.confirm("Ta bort intagsmötet?")) return;
    deleteIntagsmote(id);
    if (selected === id) setSelected(null);
    reload();
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setShowForm(true); setSelected(null); }}
          className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground hover:opacity-90"
        >
          + Nytt intagsmöte
        </button>
      </div>

      {moten.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 text-3xl opacity-30">🏠</div>
          <div className="text-sm text-muted-foreground">Inga intagsmöten ännu.</div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-xs text-primary hover:underline"
          >
            Skapa det första
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {moten.map((m) => {
            const obj = m.objektSlug ? getObjektBySlug(m.objektSlug) : null;
            const isOpen = selected === m.id;
            return (
              <div key={m.id} className={[
                "overflow-hidden rounded-xl border transition-colors",
                isOpen ? "border-primary/30 bg-card/80" : "border-border bg-card/50 hover:border-white/[0.14]",
              ].join(" ")}>
                {/* Summary row */}
                <button
                  onClick={() => setSelected(isOpen ? null : m.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">🏠</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground" style={serif}>{m.adress}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {msDateFmt(m.tidpunkt)} kl {msTimeFmt(m.tidpunkt)}
                      {m.kalla ? ` · ${m.kalla}` : ""}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[m.status]}`}>
                    {m.status}
                  </span>
                  <span className="text-muted-foreground/40">{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-border/50 px-5 py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <DetailRow label="Adress" value={`${m.adress}${m.postnr ? ", " + m.postnr : ""}${m.ort ? " " + m.ort : ""}`} />
                        <DetailRow label="Datum" value={msFmt(m.tidpunkt)} />
                        <DetailRow label="Sluttid" value={msTimeFmt(m.sluttid)} />
                        <DetailRow label="Status">
                          <select
                            value={m.status}
                            onChange={(e) => { updateIntagsmote(m.id, { status: e.target.value as IntagsmoteStatus }); reload(); }}
                            className="rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
                          >
                            {(["Planerat","Genomfört","Vunnen","Förlorad"] as IntagsmoteStatus[]).map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </DetailRow>
                        <DetailRow label="Källa" value={m.kalla || "—"} />
                        {m.vardering != null && (
                          <DetailRow label="Värdering" value={`${m.vardering.toLocaleString("sv-SE")} kr`} />
                        )}
                        {m.anteckningar && (
                          <DetailRow label="Anteckningar" value={m.anteckningar} />
                        )}
                      </div>
                      <div className="space-y-2">
                        {obj ? (
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <div className="mb-1 text-[10px] uppercase tracking-widest text-emerald-400/70">Kopplat objekt</div>
                            <Link
                              to="/objekt/$slug"
                              params={{ slug: m.objektSlug! }}
                              search={{ tab: undefined, q: undefined }}
                              className="text-sm font-medium text-emerald-700 hover:underline"
                            >
                              {obj.adress} →
                            </Link>
                            <div className="mt-0.5 text-xs text-muted-foreground">{obj.typ} · {obj.status}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowSkapaBostad(m.id)}
                            className="w-full rounded-lg border border-primary/30 bg-primary/5 py-3 text-sm font-medium text-primary hover:bg-primary/10"
                          >
                            🏗 Skapa bostad från mötet
                          </button>
                        )}

                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => exportToICS(m, kontakt)}
                            className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs text-muted-foreground hover:border-blue-400/40 hover:text-blue-700"
                          >
                            📅 Exportera till Outlook / Kalender
                          </button>
                          <button
                            onClick={() => setShowPrint(m.id)}
                            className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs text-muted-foreground hover:border-amber-400/40 hover:text-amber-700"
                          >
                            🖨 Skriv ut intag-blankett
                          </button>
                          {obj?.typ && ["Villa", "Radhus", "Fritidshus"].includes(obj.typ) && (
                            <button
                              onClick={() => printFastighetsutdrag(m, kontakt)}
                              className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs text-muted-foreground hover:border-amber-400/40 hover:text-amber-700"
                            >
                              📄 Fastighetsutdrag
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs text-destructive/60 hover:border-destructive/40 hover:text-destructive"
                          >
                            Ta bort mötet
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New meeting form */}
      {showForm && (
        <NyttIntagsmoteModal
          kontakt={kontakt}
          onSave={(data) => {
            const m = saveIntagsmote(data);
            reload();
            setSelected(m.id);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Skapa bostad modal */}
      {showSkapaBostad && (
        <SkapaBostadModal
          mote={moten.find((m) => m.id === showSkapaBostad)!}
          kontakt={kontakt}
          onCreated={(slug) => {
            updateIntagsmote(showSkapaBostad, { objektSlug: slug });
            reload();
            setShowSkapaBostad(null);
          }}
          onClose={() => setShowSkapaBostad(null)}
        />
      )}

      {/* Print modal */}
      {showPrint && (
        <PrintIntagModal
          mote={moten.find((m) => m.id === showPrint)!}
          kontakt={kontakt}
          onClose={() => setShowPrint(null)}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 flex-shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{children ?? value ?? "—"}</span>
    </div>
  );
}

/* ─── Nytt intagsmöte modal ─── */
function NyttIntagsmoteModal({
  kontakt, onSave, onClose,
}: {
  kontakt: Kontakt;
  onSave: (data: Omit<Intagsmote, "id" | "skapad">) => void;
  onClose: () => void;
}) {
  const [adress, setAdress] = useState(kontakt.adress || "");
  const [postnr, setPostnr] = useState("");
  const [ort, setOrt] = useState(kontakt.ort || "");
  const [datum, setDatum] = useState(todayStr());
  const [startTid, setStartTid] = useState("10:00");
  const [sluttid, setSluttid] = useState("11:00");
  const [kalla, setKalla] = useState<string>(KALLOR[0]);
  const [anteckningar, setAnteckningar] = useState("");
  const [vardering, setVardering] = useState("");

  const canSave = adress.trim().length > 2 && datum;

  function handleSave() {
    onSave({
      kontaktId: kontakt.id,
      adress: adress.trim(),
      postnr: postnr.trim(),
      ort: ort.trim(),
      tidpunkt: dateTimeToMs(datum, startTid),
      sluttid: dateTimeToMs(datum, sluttid || defaultSluttid(startTid)),
      maklare: "Max Stendahl",
      kalla,
      anteckningar: anteckningar.trim(),
      status: "Planerat",
      vardering: vardering ? Number(vardering.replace(/\D/g, "")) : null,
      varderingKommentar: "",
      objektSlug: null,
      objektTyp: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-card p-8 shadow-2xl">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary/80">Nytt möte</div>
          <h2 className="mt-1 text-2xl font-medium" style={serif}>
            Intagsmöte<span className="text-primary">.</span>
          </h2>
          <div className="mt-1 text-xs text-muted-foreground">{kontakt.fornamn} {kontakt.efternamn}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Adress *
            </label>
            <AddressInput
              value={adress}
              onChange={setAdress}
              onSelect={(road, postcode, city) => {
                setAdress(road);
                setPostnr(postcode);
                setOrt(city);
              }}
              autoFocus
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Postnummer</label>
              <input
                value={postnr}
                onChange={(e) => setPostnr(e.target.value)}
                placeholder=""
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ort</label>
              <input
                value={ort}
                onChange={(e) => setOrt(e.target.value)}
                placeholder="Stockholm"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Datum *</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Starttid</label>
              <input
                type="time"
                value={startTid}
                onChange={(e) => { setStartTid(e.target.value); setSluttid(defaultSluttid(e.target.value)); }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sluttid</label>
              <input
                type="time"
                value={sluttid}
                onChange={(e) => setSluttid(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Hur fick du mötet?</label>
            <select
              value={kalla}
              onChange={(e) => setKalla(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              {KALLOR.map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Värdering (kr)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={vardering}
              onChange={(e) => setVardering(e.target.value)}
              placeholder=""
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Anteckningar</label>
            <textarea
              value={anteckningar}
              onChange={(e) => setAnteckningar(e.target.value)}
              rows={3}
              placeholder="Säljaren vill flytta till sommaren…"
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5">
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Spara möte
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Skapa bostad modal ─── */
function SkapaBostadModal({
  mote, kontakt, onCreated, onClose,
}: {
  mote: Intagsmote;
  kontakt: Kontakt;
  onCreated: (slug: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [typ, setTyp] = useState<Typ>("Bostadsrätt");

  function handleCreate() {
    const obj = saveObjekt({
      adress: mote.adress,
      postnr: mote.postnr,
      stad: mote.ort,
      typ,
      saljare: `${kontakt.fornamn} ${kontakt.efternamn}`,
      ansvarig: mote.maklare,
      status: "Under intag",
      kalla: mote.kalla,
    });
    const slug = slugifyAddr(obj.adress);
    onCreated(slug);
    navigate({ to: "/objekt/$slug", params: { slug }, search: { tab: "Intag", q: undefined } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70  p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-card p-8 shadow-2xl">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary/80">Nytt objekt</div>
          <h2 className="mt-1 text-2xl font-medium" style={serif}>
            Skapa bostad<span className="text-primary">.</span>
          </h2>
          <div className="mt-1 text-sm text-muted-foreground">{mote.adress}</div>
        </div>

        <div className="mb-6">
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Typ av bostad</div>
          <div className="grid grid-cols-2 gap-2">
            {OBJEKT_TYPER.map((t) => (
              <button
                key={t}
                onClick={() => setTyp(t)}
                className={[
                  "rounded-lg border py-3 text-sm font-medium transition-colors",
                  typ === t
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                ].join(" ")}
              >
                {t === "Bostadsrätt" && "🏢 "}
                {t === "Villa" && "🏡 "}
                {t === "Radhus" && "🏘 "}
                {t === "Fritidshus" && "⛺ "}
                {t === "Tomt" && "🌿 "}
                {(t === "Parhus" || t === "Kedjehus" || t === "Ägarlägenhet") && "🏘 "}
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5">
            Avbryt
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Skapa &amp; gå till intag →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Print intag blankett ─── */
function PrintIntagModal({
  mote, kontakt, onClose,
}: {
  mote: Intagsmote;
  kontakt: Kontakt;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w || !printRef.current) return;
    w.document.write(`
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="UTF-8">
        <title>Intag – ${mote.adress}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Georgia, serif; font-size: 12pt; color: #111; padding: 32px 40px; }
          h1 { font-size: 22pt; font-weight: normal; letter-spacing: -0.02em; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 20px; }
          h2 { font-size: 13pt; font-weight: bold; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.08em; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 10pt; margin-bottom: 20px; }
          .meta .label { font-weight: bold; color: #555; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }
          .meta .value { font-size: 11pt; }
          .line { border-bottom: 1px solid #ccc; margin: 14px 0; height: 28px; }
          .lines { margin: 8px 0; }
          .lines .line { margin: 8px 0; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; }
          .section { break-inside: avoid; margin-bottom: 24px; }
          .logo { font-size: 16pt; letter-spacing: 0.15em; font-weight: bold; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
          .date-box { text-align: right; font-size: 10pt; color: #555; }
          .sign { height: 60px; border-bottom: 1px solid #999; margin-top: 8px; }
          @media print { body { padding: 16px 24px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">SkandiaMäklarna</div>
          <div class="date-box">
            <div><strong>${msDateFmt(mote.tidpunkt)}</strong></div>
            <div>kl ${msTimeFmt(mote.tidpunkt)}–${msTimeFmt(mote.sluttid)}</div>
          </div>
        </div>

        <h1>Intag – ${mote.adress}</h1>

        <div class="meta">
          <div>
            <div class="label">Säljare</div>
            <div class="value">${kontakt.fornamn} ${kontakt.efternamn}</div>
          </div>
          <div>
            <div class="label">Mobiltelefon</div>
            <div class="value">${kontakt.telefon || "—"}</div>
          </div>
          <div>
            <div class="label">E-post</div>
            <div class="value">${kontakt.epost || "—"}</div>
          </div>
          <div>
            <div class="label">Källa</div>
            <div class="value">${mote.kalla || "—"}</div>
          </div>
          <div>
            <div class="label">Mäklare</div>
            <div class="value">${mote.maklare}</div>
          </div>
          <div>
            <div class="label">Värdering</div>
            <div class="value">${mote.vardering ? mote.vardering.toLocaleString("sv-SE") + " kr" : "—"}</div>
          </div>
        </div>

        <div class="section">
          <h2>Fastighetsinformation</h2>
          <div class="grid2">
            <div>
              <div class="label">Typ</div><div class="line"></div>
              <div class="label">Byggnadsår</div><div class="line"></div>
              <div class="label">Boarea (m²)</div><div class="line"></div>
              <div class="label">Biarea / garage (m²)</div><div class="line"></div>
              <div class="label">Antal rum</div><div class="line"></div>
              <div class="label">Våning / hiss</div><div class="line"></div>
            </div>
            <div>
              <div class="label">Föreningsnamn / fastighetsbeteckning</div><div class="line"></div>
              <div class="label">Månadsavgift / fastighetsskatt</div><div class="line"></div>
              <div class="label">Lån i föreningen</div><div class="line"></div>
              <div class="label">Driftkostnader</div><div class="line"></div>
              <div class="label">Uppvärmning</div><div class="line"></div>
              <div class="label">Energiklass</div><div class="line"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Skick &amp; renoveringar</h2>
          <div class="lines">
            <div class="line"></div><div class="line"></div>
            <div class="line"></div><div class="line"></div>
            <div class="line"></div><div class="line"></div>
          </div>
        </div>

        <div class="section">
          <h2>Säljarens önskemål</h2>
          <div class="grid2">
            <div>
              <div class="label">Önskat pris</div><div class="line"></div>
              <div class="label">Önskat tillträde</div><div class="line"></div>
            </div>
            <div>
              <div class="label">Tidplan för försäljning</div><div class="line"></div>
              <div class="label">Övrigt</div><div class="line"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Mäklarens bedömning</h2>
          <div class="lines">
            <div class="line"></div><div class="line"></div>
            <div class="line"></div><div class="line"></div>
          </div>
          <div class="grid2" style="margin-top:24px">
            <div>
              <div class="label">Arvode (%)</div><div class="line"></div>
              <div class="label">Arvode (kr)</div><div class="line"></div>
            </div>
            <div>
              <div class="label">Uppdragstid (månader)</div><div class="line"></div>
              <div class="label">Annonsering</div><div class="line"></div>
            </div>
          </div>
        </div>

        <div class="section" style="margin-top:32px">
          <div class="grid2">
            <div>
              <div class="label">Säljarens underskrift</div>
              <div class="sign"></div>
              <div style="font-size:9pt;color:#888;margin-top:4px">${kontakt.fornamn} ${kontakt.efternamn}</div>
            </div>
            <div>
              <div class="label">Mäklarens underskrift</div>
              <div class="sign"></div>
              <div style="font-size:9pt;color:#888;margin-top:4px">${mote.maklare}</div>
            </div>
          </div>
        </div>

        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70  p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={printRef} className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-card p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">🖨</div>
        <h2 className="text-xl font-medium" style={serif}>Intag-blankett<span className="text-primary">.</span></h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Öppnar en utskriftsvänlig blankett för {mote.adress}.<br />
          Fyll i under mötet och skriv ut eller spara som PDF.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5">
            Avbryt
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Öppna &amp; skriv ut
          </button>
        </div>
      </div>
    </div>
  );
}

function printFastighetsutdrag(mote: Intagsmote, kontakt: Kontakt) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8">
      <title>Fastighetsutdrag – ${mote.adress}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 32px 40px; }
        h1 { font-size: 18pt; margin-bottom: 6px; }
        .sub { color: #555; font-size: 10pt; margin-bottom: 24px; }
        h2 { font-size: 11pt; font-weight: bold; background: #eee; padding: 6px 10px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
        table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
        td:first-child { font-weight: bold; color: #555; width: 40%; }
        .notice { margin-top: 24px; border: 1px solid #ccc; padding: 10px; font-size: 9pt; color: #555; }
        @media print { body { padding: 16px 24px; } }
      </style>
    </head>
    <body>
      <h1>Fastighetsutdrag</h1>
      <div class="sub">Lantmäteriets fastighetsregister · Utskrift ${new Date().toLocaleDateString("sv-SE")}</div>

      <h2>Fastighetsidentitet</h2>
      <table>
        <tr><td>Fastighetsbeteckning</td><td>(hämtas från Lantmäteriet)</td></tr>
        <tr><td>Beteckningshistorik</td><td>—</td></tr>
        <tr><td>Typkod</td><td>—</td></tr>
        <tr><td>Taxeringsenhet</td><td>—</td></tr>
      </table>

      <h2>Adress</h2>
      <table>
        <tr><td>Adress</td><td>${mote.adress}${mote.postnr ? ", " + mote.postnr : ""}${mote.ort ? " " + mote.ort : ""}</td></tr>
        <tr><td>Adresshistorik</td><td>—</td></tr>
      </table>

      <h2>Ägare</h2>
      <table>
        <tr><td>Lagfaren ägare</td><td>${kontakt.fornamn} ${kontakt.efternamn}</td></tr>
        <tr><td>Inskrivningsdag</td><td>—</td></tr>
        <tr><td>Köpeskillingen</td><td>—</td></tr>
        <tr><td>Andel</td><td>—</td></tr>
      </table>

      <h2>Inteckningar</h2>
      <table>
        <tr><td>Antal inteckningar</td><td>—</td></tr>
        <tr><td>Totalt intecknat belopp</td><td>—</td></tr>
      </table>

      <h2>Areal</h2>
      <table>
        <tr><td>Totalareal</td><td>—</td></tr>
        <tr><td>Varav landareaal</td><td>—</td></tr>
      </table>

      <h2>Belastningar</h2>
      <table>
        <tr><td>Servitut</td><td>—</td></tr>
        <tr><td>Ledningsrätt</td><td>—</td></tr>
        <tr><td>Gemensamhetsanläggning</td><td>—</td></tr>
      </table>

      <div class="notice">
        Detta är ett placeholderdokument. I produktionsmiljö hämtas fastighetsutdraget direkt
        från Lantmäteriets fastighetsinformationstjänst (FDS/Metria) via API-integration.
        <br><br>
        Handläggare: ${mote.maklare} &nbsp;|&nbsp; Intagsdatum: ${msDateFmt(mote.tidpunkt)}
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  w.document.close();
}

/* ─── Helpers ─── */
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-5 ">
      <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <span className="mt-px text-sm opacity-60">{icon}</span>
      <div className="min-w-0 flex-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function EditInput({
  value, onChange, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
    />
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={fmtSweNum(value)}
      onChange={(e) => handleNumberInput(e, onChange)}
      placeholder={placeholder}
      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
    />
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
