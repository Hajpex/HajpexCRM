import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { login, getAuth } from "../lib/authStore";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const serifStyle = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;
const sansStyle = { fontFamily: '"Work Sans", system-ui, sans-serif' } as const;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("max@test.se");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAuth()) navigate({ to: "/" });
  }, [navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const user = login(email.trim().toLowerCase(), password);
      if (user) {
        navigate({ to: "/" });
      } else {
        setError("Fel e-post eller lösenord.");
        setLoading(false);
      }
    }, 300);
  }

  return (
    <div
      className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center px-4"
      style={sansStyle}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="mb-1 text-3xl font-medium tracking-tight" style={serifStyle}>
            Hajpex<span className="text-primary">·</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">CRM</div>
          <p className="mt-3 text-[12px] text-muted-foreground/60 italic">Skapad av mäklare för mäklare</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card px-8 py-8 shadow-sm">
          <h1 className="mb-1 text-lg font-medium text-foreground">Logga in</h1>
          <p className="mb-6 text-sm text-muted-foreground">Välkommen tillbaka.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                E-post
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors"
                placeholder="din@epost.se"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Lösenord
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors"
                placeholder="••••••"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Loggar in…" : "Logga in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          Hajpex CRM · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
