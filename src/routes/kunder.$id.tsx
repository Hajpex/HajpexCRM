import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { getKontakt, updateKontakt, addAktivitet, deleteKontakt } from "../lib/kontaktStore";
import { getObjektBySlug } from "./objekt.$slug";
import type { Kontakt, Aktivitet, AktivitetTyp } from "../lib/kontaktTypes";

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

export const Route = createFileRoute("/kunder/$id")({
  head: () => ({ meta: [{ title: "Kontakt · Stendahl CRM" }] }),
  component: KontaktDetailPage,
});

type Tab = "historik" | "objekt" | "anteckningar";

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
          <Link to="/kunder" className="hover:text-foreground">← Kunder</Link>
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
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={[
                "rounded-md border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
                editMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              ].join(" ")}
            >
              {editMode ? "✓ Klar" : "✎ Redigera"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md border border-white/10 px-4 py-2 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
            >
              Ta bort
            </button>
          </div>
        </section>

        {/* Body */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left sidebar */}
          <aside className="space-y-4">
            <InfoCard kontakt={kontakt} editMode={editMode} patch={patch} />
            <IntresseCard kontakt={kontakt} editMode={editMode} patch={patch} />
            <GdprCard kontakt={kontakt} patch={patch} />
          </aside>

          {/* Right main */}
          <div>
            <div className="mb-5 flex border-b border-white/[0.08]">
              {(["historik", "objekt", "anteckningar"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    "relative -mb-px px-4 py-2.5 text-sm transition-colors",
                    tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {t === "historik" && "Historik"}
                  {t === "objekt" && `Objekt (${kontakt.objektKopplingar.length})`}
                  {t === "anteckningar" && "Anteckningar"}
                  {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-primary" />}
                </button>
              ))}
            </div>

            {tab === "historik" && <HistorikTab kontakt={kontakt} onAdd={load} />}
            {tab === "objekt" && <ObjektTab kontakt={kontakt} />}
            {tab === "anteckningar" && <AnteckningarTab kontakt={kontakt} patch={patch} />}
          </div>
        </div>
      </div>
    </AppShell>
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
      <div className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] text-muted-foreground">
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
              <EditInput value={kontakt.budgetMin} onChange={(v) => patch({ budgetMin: v })} placeholder="Min" />
              <span className="text-muted-foreground">–</span>
              <EditInput value={kontakt.budgetMax} onChange={(v) => patch({ budgetMax: v })} placeholder="Max" />
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
                      on ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:border-primary/40",
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
                    <span key={t} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-foreground">{t}</span>
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
          className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
        >
          Markera som godkänd
        </button>
      )}
    </Card>
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
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          + Lägg till aktivitet
        </button>
      </div>

      {showForm && (
        <div className="mb-5 rounded-xl border border-white/[0.08] bg-card/60 p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["anteckning", "samtal", "visning", "bud", "mejl"] as AktivitetTyp[]).map((t) => (
              <button key={t} onClick={() => setTyp(t)}
                className={["rounded-full border px-3 py-1 text-xs transition-colors",
                  typ === t ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:border-primary/40"].join(" ")}>
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
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5">
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
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-card text-sm">
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
            className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-card/60 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-lg">
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
        className="w-full resize-y rounded-xl border border-white/[0.08] bg-card/60 px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
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

/* ─── Helpers ─── */
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card/60 p-5 backdrop-blur-sm">
      <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
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

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
