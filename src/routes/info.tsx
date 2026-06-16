import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/info")({
  component: InfoPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;

function InfoPage() {
  const [kontor, setKontor]       = useState("");
  const [namn, setNamn]           = useState("");
  const [epost, setEpost]         = useState("");
  const [telefon, setTelefon]     = useState("");
  const [meddelande, setMeddelande] = useState("");
  const [loading, setLoading]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error: err } = await (supabase.from("waitlist" as never).insert({
      kontor: kontor.trim(),
      namn: namn.trim(),
      epost: epost.trim().toLowerCase(),
      telefon: telefon.trim(),
      meddelande: meddelande.trim(),
    } as never));
    if (err) { setError("Något gick fel. Försök igen eller ring oss."); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  }

  const inputCls = "w-full rounded-xl border border-border bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="text-xl font-medium" style={serif}>Hajpex<span className="text-primary">·</span><span className="ml-1.5 text-sm font-normal text-muted-foreground">CRM</span></div>
        <a href="/login" className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Logga in</a>
      </nav>

      {/* Hero */}
      <div className="mx-auto max-w-2xl px-8 pb-8 pt-16 text-center">
        <div className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
          Skapad av mäklare för mäklare
        </div>
        <h1 className="text-4xl font-medium tracking-tight text-foreground" style={serif}>
          Det CRM-system som<br />mäklare faktiskt förstår<span className="text-primary">.</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Allt på ett ställe — kontakter, visningar, budgivning, kontrakt och uppföljning. Kom igång på 5 minuter.
        </p>

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-left">
          {[
            ["📞", "Ring & logga", "Samtalslogg med ett klick"],
            ["🏠", "Visningar", "Boka och hantera spekulanter"],
            ["⚡", "Budgivning", "Realtid med automatiska notiser"],
            ["📄", "Kontrakt", "Alla datum och villkor samlade"],
            ["🤖", "AI-texter", "Marknadstext på sekunder"],
            ["📊", "Statistik", "Din provision och försäljning"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="mb-1.5 text-lg">{icon}</div>
              <div className="text-sm font-medium text-foreground">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-lg px-8 pb-24 pt-8">
        <div className="rounded-2xl border border-border bg-card p-8">
          {sent ? (
            <div className="py-8 text-center">
              <div className="mb-3 text-3xl">✓</div>
              <h2 className="mb-2 text-lg font-medium text-foreground" style={serif}>Tack, {namn.split(" ")[0]}!</h2>
              <p className="text-sm text-muted-foreground">Vi hör av oss till <strong>{epost}</strong> inom kort.</p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-medium text-foreground" style={serif}>Intresseanmälan</h2>
              <p className="mb-6 text-sm text-muted-foreground">Fyll i formuläret så hör vi av oss med mer info och priser.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Kontor / bolag</label>
                  <input value={kontor} onChange={(e) => setKontor(e.target.value)} className={inputCls} placeholder="Hajpex Mäkleri AB" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Ditt namn</label>
                  <input value={namn} onChange={(e) => setNamn(e.target.value)} className={inputCls} placeholder="Max Stendahl" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">E-post</label>
                    <input type="email" value={epost} onChange={(e) => setEpost(e.target.value)} className={inputCls} placeholder="din@epost.se" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">Telefon</label>
                    <input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} className={inputCls} placeholder="070-000 00 00" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Meddelande (valfritt)</label>
                  <textarea value={meddelande} onChange={(e) => setMeddelande(e.target.value)} className={`${inputCls} resize-none`} rows={3} placeholder="Hur många mäklare är ni? Några specifika frågor?" />
                </div>
                {error && <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                  {loading ? "Skickar…" : "Skicka intresseanmälan"}
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
