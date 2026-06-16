import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { signIn, getSession, registerOffice } from "../lib/supabaseAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;

type Tab = "login" | "register";

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState<Tab>("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]       = useState("");
  const [office, setOffice]   = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getSession().then((u) => {
      if (u) navigate({ to: "/" });
      else setCheckingSession(false);
    });
  }, [navigate]);

  if (checkingSession) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const user = await signIn(email.trim().toLowerCase(), password);
    if (user) {
      navigate({ to: "/" });
    } else {
      setError("Fel e-post eller lösenord.");
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await registerOffice({
      officeName: office.trim(),
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
    });
    if (res.ok) {
      setError("");
      setTab("login");
      setPassword("");
      setLoading(false);
      setError("Konto skapat! Bekräfta din e-post och logga sedan in.");
    } else {
      setError(res.error ?? "Något gick fel.");
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="mb-1 text-3xl font-medium tracking-tight" style={serif}>
            Hajpex<span className="text-primary">·</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">CRM</div>
          <p className="mt-3 text-[12px] italic text-muted-foreground/60">Skapad av mäklare för mäklare</p>
        </div>

        {/* Tabs */}
        <div className="mb-1 flex rounded-xl border border-border bg-muted/30 p-1">
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "login" ? "Logga in" : "Nytt kontor"}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card px-8 py-8 shadow-sm">
          {tab === "login" ? (
            <>
              <h1 className="mb-1 text-lg font-medium text-foreground">Välkommen tillbaka</h1>
              <p className="mb-6 text-sm text-muted-foreground">Logga in på ditt konto.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">E-post</label>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="din@epost.se" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Lösenord</label>
                  <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••" required />
                </div>
                {error && <p className={`rounded-lg px-3 py-2 text-xs ${error.startsWith("Konto") ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/8 text-destructive"}`}>{error}</p>}
                <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                  {loading ? "Loggar in…" : "Logga in"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-lg font-medium text-foreground">Registrera kontor</h1>
              <p className="mb-6 text-sm text-muted-foreground">Skapa ett nytt konto åt ditt kontor.</p>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Kontorsnamn</label>
                  <input type="text" value={office} onChange={(e) => setOffice(e.target.value)} className={inputCls} placeholder="Hajpex Mäkleri AB" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Ditt namn</label>
                  <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Max Stendahl" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">E-post</label>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="din@epost.se" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Lösenord</label>
                  <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Minst 6 tecken" minLength={6} required />
                </div>
                {error && <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">{error}</p>}
                <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                  {loading ? "Skapar konto…" : "Skapa konto"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          Hajpex CRM · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
