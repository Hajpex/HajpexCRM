import { useState, useMemo, useEffect, useRef } from "react";
import { listKontakter, addAktivitet } from "../lib/kontaktStore";
import type { Kontakt } from "../lib/kontaktTypes";

function relDaysSince(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d === 0) return "Idag";
  if (d === 1) return "Igår";
  if (d < 7) return `${d} dagar sedan`;
  if (d < 30) return `${Math.floor(d / 7)} veckor sedan`;
  return `${Math.floor(d / 30)} månader sedan`;
}

interface Props {
  onClose: () => void;
  /** Optional filtered list. If omitted, all contacts with phone numbers are used. */
  kontakter?: Kontakt[];
}

export function RingLage({ onClose, kontakter }: Props) {
  const allKontakter = useMemo(() => {
    const source = kontakter ?? listKontakter();
    return source
      .filter((k) => k.telefon.trim())
      .sort((a, b) => {
        const la = a.aktiviteter.length > 0 ? Math.max(...a.aktiviteter.map((x) => x.tidpunkt)) : a.skapadAt;
        const lb = b.aktiviteter.length > 0 ? Math.max(...b.aktiviteter.map((x) => x.tidpunkt)) : b.skapadAt;
        return la - lb;
      });
  }, [kontakter]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ring" | "outcome">("ring");
  const [logged, setLogged] = useState<Record<number, string>>({});
  const ringRef = useRef<HTMLAnchorElement>(null);

  const current = allKontakter[index];
  const total = allKontakter.length;
  const doneCount = Object.keys(logged).length;
  const progress = total > 0 ? ((index) / total) * 100 : 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background" style={{ fontFamily: '"Work Sans", system-ui, sans-serif' }}>
        <div className="text-center">
          <div className="mb-4 text-5xl">✓</div>
          <p className="text-xl font-medium text-foreground">Ringlistan klar!</p>
          <p className="mt-1 text-sm text-muted-foreground">{doneCount} samtal loggade</p>
          <button onClick={onClose} className="mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Stäng</button>
        </div>
      </div>
    );
  }

  const lastTs = current.aktiviteter.length > 0
    ? Math.max(...current.aktiviteter.map((a) => a.tidpunkt))
    : current.skapadAt;

  const lastCall = current.aktiviteter.find((a) => a.typ === "samtal");

  function logAndNext(beskrivning: string) {
    addAktivitet(current.id, { typ: "samtal", tidpunkt: Date.now(), beskrivning });
    setLogged((prev) => ({ ...prev, [index]: beskrivning }));
    goNext();
  }

  function goNext() {
    setPhase("ring");
    if (index < total - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  }

  const topObj = current.objektKopplingar[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      style={{ fontFamily: '"Work Sans", system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Ring-läge</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {index + 1} / {total}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Avsluta ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Contact card */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">

          {/* Avatar */}
          <div className="mb-5 flex justify-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-medium text-primary"
              style={{ fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' }}
            >
              {[current.fornamn[0], current.efternamn[0]].filter(Boolean).join("").toUpperCase() || "?"}
            </div>
          </div>

          {/* Name & context */}
          <div className="mb-1 text-center text-2xl font-medium text-foreground" style={{ fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' }}>
            {current.fornamn} {current.efternamn}
          </div>
          {topObj && (
            <p className="mb-1 text-center text-xs text-muted-foreground">
              {topObj.relation.charAt(0).toUpperCase() + topObj.relation.slice(1)} · {topObj.slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            </p>
          )}
          <p className="mb-6 text-center text-xs text-muted-foreground/60">
            {lastCall ? `Senaste samtal: ${relDaysSince(lastCall.tidpunkt)}` : `Senast aktiv: ${relDaysSince(lastTs)}`}
          </p>

          {/* Phone number display */}
          <a
            ref={ringRef}
            href={`tel:${current.telefon.replace(/\s/g, "")}`}
            className="mb-4 flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-lg font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            onClick={() => setTimeout(() => setPhase("outcome"), 800)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            {current.telefon}
          </a>

          {phase === "ring" ? (
            <div className="space-y-2">
              <a
                href={`tel:${current.telefon.replace(/\s/g, "")}`}
                onClick={() => setTimeout(() => setPhase("outcome"), 800)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Ring {current.fornamn}
              </a>
              <button
                onClick={goNext}
                className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Hoppa över →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Vad hände?
              </p>
              <button
                onClick={() => logAndNext("Svarade")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3.5 text-sm font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20 active:scale-[0.98]"
              >
                ✓ Svarade
              </button>
              <button
                onClick={() => logAndNext("Svarade ej")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 active:scale-[0.98]"
              >
                ✗ Svarade ej
              </button>
              <button
                onClick={() => logAndNext("Lämnade meddelande")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3.5 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/20 active:scale-[0.98]"
              >
                💬 Lämnade meddelande
              </button>
              <button
                onClick={goNext}
                className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Hoppa över →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav dots */}
      <div className="flex justify-center gap-1.5 pb-6">
        {allKontakter.slice(Math.max(0, index - 3), index + 6).map((_, i) => {
          const realIdx = Math.max(0, index - 3) + i;
          return (
            <div
              key={realIdx}
              className={[
                "h-1.5 rounded-full transition-all",
                realIdx === index ? "w-5 bg-primary" : logged[realIdx] ? "w-1.5 bg-primary/30" : "w-1.5 bg-muted",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
