import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { OBJEKT, slugifyAddr } from "../data/objekt";

const SIDE_TABS = [
  "Start", "Intag", "Objektsinfo", "Marknad", "Visningar", "Budgivning",
  "Kontrakt", "Tillträde", "Säljare", "Köpare", "Dokument",
  "Mäklarräkenskap", "Objektsbeskrivning", "Tjänster",
] as const;
type SideTab = (typeof SIDE_TABS)[number];

// Map free-text keywords → object tab
const KEYWORDS: Array<{ words: string[]; tab: SideTab }> = [
  { words: ["besiktning", "besikt", "dokument", "kontrakt pdf", "bilaga", "bilagor", "filer"], tab: "Dokument" },
  { words: ["budgivning", "bud", "budgivare", "budhistorik"], tab: "Budgivning" },
  { words: ["visning", "visningar", "öppet hus", "oh"], tab: "Visningar" },
  { words: ["spek", "spekulant", "spekulanter", "intresse"], tab: "Spekulanter" as SideTab },
  { words: ["intag", "uppdragsavtal"], tab: "Intag" },
  { words: ["objektsinfo", "info", "fakta", "beskrivning"], tab: "Objektsinfo" },
  { words: ["marknad", "annons", "hemnet"], tab: "Marknad" },
  { words: ["tillträde", "tilltrade", "nyckel"], tab: "Tillträde" },
  { words: ["säljare", "saljare"], tab: "Säljare" },
  { words: ["köpare", "kopare"], tab: "Köpare" },
  { words: ["räkenskap", "rakenskap", "mäklarräkenskap", "ekonomi", "arvode"], tab: "Mäklarräkenskap" },
  { words: ["objektsbeskrivning", "objektsbesk", "trycksak", "pdf"], tab: "Objektsbeskrivning" },
  { words: ["tjänst", "tjanster", "tjänster"], tab: "Tjänster" },
  { words: ["kontrakt"], tab: "Kontrakt" },
];

type Action = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  navigate: () => void;
  score: number;
};

const SHORTCUTS = [
  { id: "new-obj", title: "Nytt objekt", subtitle: "Skapa ett nytt objekt", to: "/objekt/nytt", keys: ["nytt", "ny", "skapa", "objekt"] },
  { id: "objekt", title: "Alla objekt", subtitle: "Visa hela portföljen", to: "/objekt", keys: ["objekt", "lista", "portfölj"] },
  { id: "kunder", title: "Kontakter", subtitle: "Kontaktregister", to: "/kunder", keys: ["kund", "kunder", "kontakt", "kontakter"] },
  { id: "visningar", title: "Visningar", subtitle: "Kommande visningar", to: "/visningar", keys: ["visning", "visningar", "öppet hus"] },
  { id: "listor", title: "Listor", subtitle: "Sparade listor", to: "/listor", keys: ["listor", "lista"] },
  { id: "statistik", title: "Statistik", subtitle: "Försäljningsstatistik", to: "/statistik", keys: ["statistik", "stats", "siffror"] },
];

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o");
}

function tokenScore(haystack: string, token: string): number {
  const h = normalize(haystack);
  const t = normalize(token);
  if (!t) return 0;
  if (h === t) return 100;
  if (h.startsWith(t)) return 60;
  if (h.includes(t)) return 40;
  // Loose: all chars in order
  let i = 0;
  for (const c of h) if (c === t[i]) i++;
  if (i === t.length) return 15;
  return 0;
}

function buildActions(query: string, navigate: ReturnType<typeof useNavigate>): Action[] {
  const raw = query.trim();
  const tokens = raw.split(/\s+/).filter(Boolean);
  const actions: Action[] = [];

  // 1) Match objects against tokens (only address/city/seller words count)
  for (const o of OBJEKT) {
    const hay = `${o.adress} ${o.stad} ${o.postnr} ${o.saljare}`;
    let objScore = 0;
    const matchedTokens = new Set<number>();
    tokens.forEach((tok, idx) => {
      const s = Math.max(
        tokenScore(o.adress, tok),
        tokenScore(o.stad, tok) * 0.6,
        tokenScore(o.saljare, tok) * 0.7,
      );
      if (s > 0) {
        objScore += s;
        matchedTokens.add(idx);
      }
    });
    if (objScore === 0 && raw !== "") continue;

    // Detect tab keyword among remaining tokens
    const remaining = tokens.filter((_, i) => !matchedTokens.has(i));
    let tab: SideTab | undefined;
    let tabLabel = "";
    for (const tok of remaining) {
      const tk = normalize(tok);
      const kw = KEYWORDS.find((k) => k.words.some((w) => normalize(w).startsWith(tk) || tk.startsWith(normalize(w))));
      if (kw) { tab = kw.tab; tabLabel = kw.tab; break; }
    }
    // Detect person token among remaining for budgivare-like searches
    const personToken = remaining.find((t) => t.length >= 3 && !KEYWORDS.some((k) => k.words.some((w) => normalize(w).startsWith(normalize(t)))));

    const slug = slugifyAddr(o.adress);
    actions.push({
      id: `obj-${slug}-${tab ?? "start"}`,
      title: o.adress,
      subtitle: `${o.postnr} ${o.stad}${tab ? ` · ${tabLabel}` : ""}${personToken ? ` · "${personToken}"` : ""}`,
      badge: tab ? tabLabel : o.typ,
      score: objScore + (tab ? 25 : 0) + (raw === "" ? 0 : 10),
      navigate: () => navigate({
        to: "/objekt/$slug",
        params: { slug },
        search: { tab: tab as string | undefined, q: personToken },
      }),
    });
  }

  // 2) Shortcuts
  for (const s of SHORTCUTS) {
    let sc = 0;
    if (raw === "") sc = 5;
    else {
      tokens.forEach((tok) => {
        sc += Math.max(
          tokenScore(s.title, tok),
          ...s.keys.map((k) => tokenScore(k, tok)),
        );
      });
    }
    if (sc === 0) continue;
    actions.push({
      id: `s-${s.id}`,
      title: s.title,
      subtitle: s.subtitle,
      badge: "Genväg",
      score: sc,
      navigate: () => navigate({ to: s.to as never }),
    });
  }

  actions.sort((a, b) => b.score - a.score);
  return actions.slice(0, 12);
}

export function CommandPalette({
  open,
  onOpenChange,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQuery(initialQuery); setActive(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open, initialQuery]);

  const actions = useMemo(() => buildActions(query, navigate), [query, navigate]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const run = (a: Action) => { a.navigate(); onOpenChange(false); };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-background/60 backdrop-blur-sm pt-[12vh] px-4"
      onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, actions.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); const a = actions[active]; if (a) run(a); }
              else if (e.key === "Escape") { onOpenChange(false); }
            }}
            placeholder="Sök…"
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {actions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Inga träffar. Försök med en adress, ett namn eller en flik som "budgivning" eller "dokument".
            </div>
          ) : actions.map((a, i) => (
            <button
              key={a.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(a)}
              className={[
                "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                i === active ? "bg-foreground/5" : "hover:bg-foreground/[0.03]",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{a.title}</div>
                <div className="truncate text-xs text-muted-foreground">{a.subtitle}</div>
              </div>
              {a.badge && (
                <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {a.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ navigera · ↵ öppna</span>
          <span>⌘K / Ctrl+K var som helst</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSeed("");
        setOpen(true);
      } else if (e.key === "/" && !open) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSeed("");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => { setSeed(""); setOpen(true); }}
        className="group flex w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-card"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left truncate">Sök objekt, dokument, kunder…</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} initialQuery={seed} />
    </>
  );
}