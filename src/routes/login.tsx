import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { signInDetailed, getSession } from "../lib/supabaseAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSession().then((u) => {
      if (u) navigate({ to: "/" });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await signInDetailed(email.trim().toLowerCase(), password);
    if (res.ok) {
      navigate({ to: "/" });
    } else {
      setError(
        res.reason === "auth"
          ? `Inloggning misslyckades: ${res.message}`
          : `Inloggad, men profilen kunde inte hämtas (RLS): ${res.message}`
      );
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-1 text-3xl font-medium tracking-tight" style={serif}>
            Hajpex<span className="text-primary">·</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">CRM</div>
          <p className="mt-3 text-[12px] italic text-muted-foreground/60">Skapad av mäklare för mäklare</p>
        </div>

        <div className="rounded-2xl border border-border bg-card px-8 py-8 shadow-sm">
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
            {error && <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading ? "Loggar in…" : "Logga in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          Hajpex CRM · {new Date().getFullYear()} ·{" "}
          <a href="/info" className="hover:text-muted-foreground">Intresseanmälan</a>
        </p>
      </div>
    </div>
  );
}
