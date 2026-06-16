import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getSession } from "../lib/supabaseAuth";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/superadmin")({
  component: SuperAdminPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;

type Office = { id: string; name: string; org_nr: string | null; created_at: string; user_count?: number };
type WaitlistItem = { id: string; kontor: string; namn: string; epost: string; telefon: string; meddelande: string; skapad_at: string; hanterad: boolean };

type Tab = "kontor" | "intressenter";

function SuperAdminPage() {
  const navigate = useNavigate();
  const [tab, setTab]           = useState<Tab>("kontor");
  const [loading, setLoading]   = useState(true);
  const [offices, setOffices]   = useState<Office[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [showNewOffice, setShowNewOffice] = useState(false);

  useEffect(() => {
    getSession().then((u) => {
      if (!u || !u.isSuperAdmin) { navigate({ to: "/" }); return; }
      loadAll();
    });
  }, [navigate]);

  async function loadAll() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: offs }, { data: wl }] = await Promise.all([
      sb.from("offices").select("*").order("created_at") as Promise<{ data: Office[] | null }>,
      sb.from("waitlist").select("*").order("skapad_at", { ascending: false }) as Promise<{ data: WaitlistItem[] | null }>,
    ]);
    setOffices(offs ?? []);
    setWaitlist(wl ?? []);
    setLoading(false);
  }

  async function markHandled(id: string, hanterad: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ((supabase as any).from("waitlist").update({ hanterad }).eq("id", id));
    setWaitlist((prev) => prev.map((w) => w.id === id ? { ...w, hanterad } : w));
  }

  const unhandled = waitlist.filter((w) => !w.hanterad).length;

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-medium" style={serif}>Hajpex<span className="text-primary">·</span></div>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">Super Admin</span>
          </div>
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">← Till CRM</a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-border">
          {([["kontor", "Kontor", offices.length], ["intressenter", "Intressenter", unhandled]] as [Tab, string, number][]).map(([t, label, count]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  tab === t ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* KONTOR */}
        {tab === "kontor" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-foreground">Aktiva kontor</h2>
                <p className="text-xs text-muted-foreground">{offices.length} kontor registrerade</p>
              </div>
              <button onClick={() => setShowNewOffice(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                + Nytt kontor
              </button>
            </div>

            <div className="space-y-2">
              {offices.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
                  <div>
                    <div className="font-medium text-foreground">{o.name}</div>
                    {o.org_nr && <div className="text-xs text-muted-foreground">Org.nr: {o.org_nr}</div>}
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Skapad {new Date(o.created_at).toLocaleDateString("sv")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono text-muted-foreground/40 select-all">{o.id}</div>
                  </div>
                </div>
              ))}
              {offices.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Inga kontor ännu. Skapa det första!
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/20 p-5">
              <div className="mb-2 text-xs font-medium text-foreground">Så här lägger du till en ny mäklare</div>
              <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                <li>Skapa kontoret ovan (eller välj ett befintligt)</li>
                <li>Gå till Supabase Dashboard → Authentication → Users → Invite user</li>
                <li>Ange mäklarens e-post — de får ett välkomstmail</li>
                <li>Kör sedan i SQL Editor: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">insert into public.users (id, office_id, name, role) values ('USER-ID', 'OFFICE-ID', 'Namn', 'maklare');</code></li>
              </ol>
            </div>
          </div>
        )}

        {/* INTRESSENTER */}
        {tab === "intressenter" && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-medium text-foreground">Intresseanmälningar</h2>
              <p className="text-xs text-muted-foreground">{unhandled} ohanterade av {waitlist.length} totalt</p>
            </div>

            <div className="space-y-2">
              {waitlist.map((w) => (
                <div key={w.id} className={`rounded-xl border bg-card px-5 py-4 transition-opacity ${w.hanterad ? "border-border opacity-50" : "border-primary/30"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{w.namn}</span>
                        <span className="text-xs text-muted-foreground">— {w.kontor}</span>
                        {!w.hanterad && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Ny</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {w.epost && <a href={`mailto:${w.epost}`} className="hover:text-foreground">{w.epost}</a>}
                        {w.telefon && <a href={`tel:${w.telefon}`} className="hover:text-foreground">{w.telefon}</a>}
                        <span>{new Date(w.skapad_at).toLocaleDateString("sv", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      {w.meddelande && (
                        <p className="mt-2 text-xs text-foreground/70 italic">"{w.meddelande}"</p>
                      )}
                    </div>
                    <button
                      onClick={() => markHandled(w.id, !w.hanterad)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        w.hanterad
                          ? "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {w.hanterad ? "Markera som ny" : "✓ Hanterad"}
                    </button>
                  </div>
                </div>
              ))}
              {waitlist.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Inga intresseanmälningar ännu.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showNewOffice && <NyttKontorModal onClose={() => setShowNewOffice(false)} onSaved={() => { loadAll(); setShowNewOffice(false); }} />}
    </div>
  );
}

function NyttKontorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName]     = useState("");
  const [orgNr, setOrgNr]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await ((supabase as any).from("offices").insert({ name: name.trim(), org_nr: orgNr.trim() || null }));
    if (err) { setError("Kunde inte spara kontoret."); setLoading(false); return; }
    onSaved();
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-card p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground" style={serif}>Nytt kontor</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Kontorsnamn</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Hajpex Mäkleri AB" required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Org.nr (valfritt)</label>
            <input value={orgNr} onChange={(e) => setOrgNr(e.target.value)} className={inputCls} placeholder="556123-4567" />
          </div>
          {error && <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50">Avbryt</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {loading ? "Sparar…" : "Skapa kontor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
