import { useState, useEffect, useRef } from "react";

type Suggestion = {
  road: string;
  postcode: string;
  city: string;
};

function parseItem(item: Record<string, unknown>): Suggestion | null {
  const a = (item.address ?? {}) as Record<string, string>;
  const road = a.road ?? a.pedestrian ?? a.path ?? a.square ?? "";
  if (!road) return null;
  const house = a.house_number ?? "";
  const raw = (a.postcode ?? "").replace(/\s/g, "");
  const postcode = raw.length === 5 ? raw.slice(0, 3) + " " + raw.slice(3) : raw;
  const city =
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
  const suburb = a.suburb ?? a.neighbourhood ?? a.quarter ?? "";
  return {
    road: road + (house ? " " + house : ""),
    postcode,
    city: suburb && suburb !== city ? suburb + ", " + city : city,
  };
}

export function AddressInput({
  value,
  onChange,
  onSelect,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Called when user picks a suggestion. Fill your postnr/ort fields here. */
  onSelect?: (road: string, postcode: string, city: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 3) { setSuggestions([]); setOpen(false); return; }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?" +
          new URLSearchParams({
            q: value,
            countrycodes: "se",
            format: "json",
            addressdetails: "1",
            limit: "8",
          });
        const res = await fetch(url, {
          headers: { "Accept-Language": "sv", "User-Agent": "HajpexCRM/1.0" },
        });
        const data = (await res.json()) as Record<string, unknown>[];
        const seen = new Set<string>();
        const parsed: Suggestion[] = [];
        for (const item of data) {
          const s = parseItem(item);
          if (!s) continue;
          const key = s.road + "|" + s.city;
          if (seen.has(key)) continue;
          seen.add(key);
          parsed.push(s);
          if (parsed.length === 6) break;
        }
        setSuggestions(parsed);
        setOpen(parsed.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(s: Suggestion) {
    onChange(s.road);
    onSelect?.(s.road, s.postcode, s.city);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={
          className ??
          "w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background focus:outline-none"
        }
      />

      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <svg
                className="mt-0.5 shrink-0 text-primary/50"
                width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{s.road}</div>
                {(s.postcode || s.city) && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[s.postcode, s.city].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div className="border-t border-border/50 px-4 py-1.5 text-[10px] text-muted-foreground/30">
            © OpenStreetMap-bidragsgivare
          </div>
        </div>
      )}
    </div>
  );
}
