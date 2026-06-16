import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { supabase } from "../lib/supabase";
import { getSession, type AppUser } from "../lib/supabaseAuth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Kontor & personal · Hajpex CRM" }] }),
  component: AdminPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;

type Office = { id: string; name: string; org_nr: string | null; franchise_id: string | null; active: boolean };
type Member = { id: string; name: string; role: string; office_id: string | null; active: boolean };

function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<Office[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((u) => {
      // Endast super_admin, franchise_admin och kontorsadmin når hit
      if (!u || !(u.isSuperAdmin || u.role === "franchise_admin" || u.role === "admin")) {
        navigate({ to: "/" });
        return;
      }
      setUser(u);
      loadAll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function loadAll() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: offs }, { data: mem }] = await Promise.all([
      sb.from("offices").select("id, name, org_nr, franchise_id, active").order("name") as Promise<{ data: Office[] | null }>,
      sb.from("users").select("id, name, role, office_id, active").order("name") as Promise<{ data: Member[] | null }>,
    ]);
    setOffices(offs ?? []);
    setMembers(mem ?? []);
    setLoading(false);
  }

  async function toggleOffice(office: Office) {
    const next = !office.active;
    const verb = next ? "öppna" : "stänga";
    if (!confirm(`Vill du ${verb} kontoret "${office.name}"?${next ? "" : "\n\nAlla mäklare på kontoret inaktiveras och kan inte logga in."}`)) return;
    setBusy(office.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from("offices").update({ active: next }).eq("id", office.id);
    // Stänga kontor → inaktivera alla dess mäklare
    if (!next) {
      await sb.from("users").update({ active: false }).eq("office_id", office.id);
    }
    setBusy(null);
    loadAll();
  }

  async function toggleMember(m: Member) {
    const next = !m.active;
    const verb = next ? "aktivera" : "inaktivera";
    if (!confirm(`Vill du ${verb} ${m.name}?${next ? "" : "\n\nPersonen kan inte längre logga in."}`)) return;
    setBusy(m.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("users").update({ active: next }).eq("id", m.id);
    setBusy(null);
    loadAll();
  }

  if (loading || !user) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      </AppShell>
    );
  }

  const roleLabel = (r: string) =>
    r === "franchise_admin" ? "Huvudkontor" : r === "admin" ? "Kontorsadmin" : "Mäklare";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-10">
        <header className="mb-8">
          <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/70">Administration</p>
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl" style={serif}>
            Kontor &amp; personal<span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user.isSuperAdmin
              ? "Du ser alla kontor i systemet."
              : user.role === "franchise_admin"
                ? "Du administrerar alla kontor i din franchise."
                : "Du administrerar ditt kontor."}
          </p>
        </header>

        <div className="space-y-5">
          {offices.map((o) => {
            const officeMembers = members.filter((m) => m.office_id === o.id);
            return (
              <section key={o.id} className={`rounded-2xl border bg-card p-5 transition-opacity ${o.active ? "border-border" : "border-destructive/30 opacity-70"}`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-medium text-foreground">{o.name}</h2>
                      {!o.active && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Stängt</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {officeMembers.length} {officeMembers.length === 1 ? "person" : "personer"}
                      {o.org_nr ? ` · Org.nr ${o.org_nr}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleOffice(o)}
                    disabled={busy === o.id}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      o.active
                        ? "border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    }`}
                  >
                    {o.active ? "Stäng kontor" : "Öppna kontor"}
                  </button>
                </div>

                {officeMembers.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Inga personer på kontoret ännu.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {officeMembers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${m.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`truncate text-sm font-medium ${m.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{m.name}</span>
                              {m.id === user.id && <span className="text-[10px] text-muted-foreground">(du)</span>}
                            </div>
                            <span className="text-[11px] text-muted-foreground">{roleLabel(m.role)}{!m.active && " · inaktiverad"}</span>
                          </div>
                        </div>
                        {m.id !== user.id && (
                          <button
                            onClick={() => toggleMember(m)}
                            disabled={busy === m.id}
                            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              m.active
                                ? "border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            }`}
                          >
                            {m.active ? "Inaktivera" : "Aktivera"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {offices.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">Inga kontor att visa.</div>
          )}
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground/60">
          Inaktivering är reversibel — data och historik bevaras. Att skapa nya inloggningar
          för mäklare läggs till via en säker server-funktion.
        </p>
      </div>
    </AppShell>
  );
}
