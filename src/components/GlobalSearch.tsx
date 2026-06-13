import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { allObjekt } from "@/lib/objektStore";
import { slugifyAddr } from "@/data/objekt";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Home,
  MapPin,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Gavel,
  ClipboardCheck,
  Camera,
  Building2,
  Layers,
  ArrowRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

type ObjektRow = { addr: string; area: string; status: string; slug: string };

function buildObjectList(): ObjektRow[] {
  return allObjekt().map((o) => ({
    addr: o.adress,
    area: o.stad || "",
    status: o.status,
    slug: slugifyAddr(o.adress),
  }));
}

const ALL_CONTACTS = [
  { name: "Margaretha Lindqvist", role: "Spekulant", objSlug: "stationsgatan-8b" },
  { name: "Erik Svensson",        role: "Säljare",   objSlug: "sodragarden-9" },
  { name: "Anna Karlsson",        role: "Köpare",    objSlug: "granstigen-18" },
  { name: "Lars Bergström",       role: "Spekulant", objSlug: "granstigen-18" },
];

type SectionInfo = { label: string; icon: React.ReactNode; tab: string };

const SECTION_MAP: Record<string, SectionInfo> = {
  besiktning:         { label: "Besiktning",         icon: <ClipboardCheck size={14} />, tab: "Dokument" },
  budgivning:         { label: "Budgivning",         icon: <Gavel size={14} />,          tab: "Budgivning" },
  bud:                { label: "Budgivning",         icon: <Gavel size={14} />,          tab: "Budgivning" },
  budgivningslista:   { label: "Budgivningslista",   icon: <Gavel size={14} />,          tab: "Budgivning" },
  kontrakt:           { label: "Kontrakt",           icon: <FileText size={14} />,       tab: "Kontrakt" },
  visning:            { label: "Visningar",          icon: <Calendar size={14} />,       tab: "Visningar" },
  visningar:          { label: "Visningar",          icon: <Calendar size={14} />,       tab: "Visningar" },
  spekulant:          { label: "Spekulanter",        icon: <Users size={14} />,          tab: "Spekulanter" },
  spekulanter:        { label: "Spekulanter",        icon: <Users size={14} />,          tab: "Spekulanter" },
  annons:             { label: "Annons / Hemnet",    icon: <Home size={14} />,           tab: "Objektsinfo" },
  hemnet:             { label: "Hemnet-annons",      icon: <Home size={14} />,           tab: "Objektsinfo" },
  bilder:             { label: "Bilder",             icon: <Camera size={14} />,         tab: "Objektsinfo" },
  bild:               { label: "Bilder",             icon: <Camera size={14} />,         tab: "Objektsinfo" },
  dokument:           { label: "Dokument",           icon: <FileText size={14} />,       tab: "Dokument" },
  värdering:          { label: "Värdering",          icon: <BarChart3 size={14} />,      tab: "Intag" },
  vardering:          { label: "Värdering",          icon: <BarChart3 size={14} />,      tab: "Intag" },
  statistik:          { label: "Statistik",          icon: <BarChart3 size={14} />,      tab: "Statistik" },
  säljare:            { label: "Säljare",            icon: <Users size={14} />,          tab: "Säljare" },
  saljare:            { label: "Säljare",            icon: <Users size={14} />,          tab: "Säljare" },
  köpare:             { label: "Köpare",             icon: <Users size={14} />,          tab: "Köpare" },
  kopare:             { label: "Köpare",             icon: <Users size={14} />,          tab: "Köpare" },
  marknad:            { label: "Marknad",            icon: <MapPin size={14} />,         tab: "Marknad" },
  intag:              { label: "Intag",              icon: <Building2 size={14} />,      tab: "Intag" },
  tillträde:          { label: "Tillträde",          icon: <FileText size={14} />,       tab: "Tillträde" },
  tilltrade:          { label: "Tillträde",          icon: <FileText size={14} />,       tab: "Tillträde" },
  tjänster:           { label: "Tjänster",           icon: <Building2 size={14} />,      tab: "Tjänster" },
  tjanster:           { label: "Tjänster",           icon: <Building2 size={14} />,      tab: "Tjänster" },
  objektsbeskrivning: { label: "Objektsbeskrivning", icon: <FileText size={14} />,       tab: "Objektsbeskrivning" },
  beskrivning:        { label: "Objektsbeskrivning", icon: <FileText size={14} />,       tab: "Objektsbeskrivning" },
  rum:                { label: "Objektsbeskrivning", icon: <FileText size={14} />,       tab: "Objektsbeskrivning" },
  mäklarräkenskap:    { label: "Mäklarräkenskap",    icon: <FileText size={14} />,       tab: "Mäklarräkenskap" },
  räkenskap:          { label: "Mäklarräkenskap",    icon: <FileText size={14} />,       tab: "Mäklarräkenskap" },
};

const NAV_ITEMS = [
  { label: "Översikt",  to: "/",           icon: <Home size={14} /> },
  { label: "Objekt",    to: "/objekt",     icon: <MapPin size={14} /> },
  { label: "Listor",    to: "/listor",     icon: <Layers size={14} /> },
  { label: "Visningar", to: "/visningar",  icon: <Calendar size={14} /> },
  { label: "Kunder",    to: "/kunder",     icon: <Users size={14} /> },
  { label: "Statistik", to: "/statistik",  icon: <BarChart3 size={14} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}

interface ParseResult {
  matchedSection: SectionInfo | null;
  matchedObjects: ObjektRow[];
  matchedContacts: typeof ALL_CONTACTS;
  matchedNav: typeof NAV_ITEMS;
  sectionKey: string | null;
}

function parseQuery(raw: string, objects: ObjektRow[]): ParseResult {
  const q = raw.trim();
  if (!q) {
    return { matchedSection: null, matchedObjects: objects, matchedContacts: [], matchedNav: NAV_ITEMS, sectionKey: null };
  }

  const tokens = normalize(q).split(/\s+/);

  // Find section keyword
  let matchedSection: SectionInfo | null = null;
  let sectionKey: string | null = null;
  for (const token of tokens) {
    if (SECTION_MAP[token]) {
      matchedSection = SECTION_MAP[token];
      sectionKey = token;
      break;
    }
  }

  // Tokens that aren't section keywords → used for address/name matching
  const searchTokens = tokens.filter((t) => !SECTION_MAP[t] && t.length > 1);

  // Match objects: all search tokens must appear somewhere in addr or area
  const matchedObjects =
    searchTokens.length === 0
      ? objects
      : objects.filter((o) => {
          const hay = normalize(o.addr + " " + o.area);
          return searchTokens.every((t) => hay.includes(t));
        });

  // Match contacts: any token (≥3 chars) matches name
  const matchedContacts =
    searchTokens.length === 0
      ? []
      : ALL_CONTACTS.filter((c) => {
          const hay = normalize(c.name);
          return searchTokens.some((t) => t.length >= 3 && hay.includes(t));
        });

  // Nav items
  const matchedNav = NAV_ITEMS.filter((n) =>
    tokens.some((t) => normalize(n.label).includes(t))
  );

  return { matchedSection, matchedObjects, matchedContacts, matchedNav, sectionKey };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Build object list fresh each time dialog opens so new objects appear
  const objects = useMemo(() => buildObjectList(), [open]);

  const parsed = useMemo(() => parseQuery(query, objects), [query, objects]);

  function go(to: string) {
    onOpenChange(false);
    // Small delay so dialog closes smoothly before navigation
    setTimeout(() => navigate({ to } as Parameters<typeof navigate>[0]), 50);
  }

  const hasResults =
    parsed.matchedObjects.length > 0 ||
    parsed.matchedContacts.length > 0 ||
    parsed.matchedNav.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sök objekt, adress, person, budgivning..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        {!hasResults && query.length > 1 && (
          <CommandEmpty>
            <span className="text-muted-foreground">Inga träffar för "{query}"</span>
          </CommandEmpty>
        )}

        {/* ── Objekt ─────────────────────────────────────────────────────── */}
        {parsed.matchedObjects.length > 0 && (
          <CommandGroup heading={parsed.matchedSection ? `Objekt → ${parsed.matchedSection.label}` : "Objekt"}>
            {parsed.matchedObjects.map((o) => {
              const dest = parsed.matchedSection
                ? `/objekt/${o.slug}?tab=${parsed.matchedSection.tab}`
                : `/objekt/${o.slug}`;
              return (
                <CommandItem
                  key={o.slug}
                  value={`${o.addr} ${o.area} ${parsed.sectionKey ?? ""}`}
                  onSelect={() => go(dest)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground">
                      {parsed.matchedSection ? parsed.matchedSection.icon : <MapPin size={14} />}
                    </span>
                    <div className="leading-tight">
                      <div className="text-sm text-foreground">{o.addr}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {o.area}
                        {parsed.matchedSection && (
                          <> · <span className="text-primary">{parsed.matchedSection.label}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={[
                      "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                      o.status === "Budgivning" ? "border-primary/40 bg-primary/10 text-primary"
                        : o.status === "Till salu" ? "border-border bg-foreground/[0.04] text-foreground"
                        : "border-border bg-foreground/[0.02] text-muted-foreground",
                    ].join(" ")}>{o.status}</span>
                    <ArrowRight size={13} className="text-muted-foreground/40" />
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* ── Kontakter ──────────────────────────────────────────────────── */}
        {parsed.matchedContacts.length > 0 && (
          <CommandGroup heading="Kunder & kontakter">
            {parsed.matchedContacts.map((c) => {
              const obj = ALL_OBJECTS.find((o) => o.slug === c.objSlug);
              const dest = obj
                ? `/objekt/${c.objSlug}?tab=${parsed.matchedSection?.tab ?? "Spekulanter"}`
                : "/kunder";
              return (
                <CommandItem
                  key={c.name}
                  value={`kontakt ${c.name}`}
                  onSelect={() => go(dest)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground">
                      <Users size={14} />
                    </span>
                    <div className="leading-tight">
                      <div className="text-sm text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.role}{obj && <> · {obj.addr}</>}
                        {parsed.matchedSection && (
                          <> · <span className="text-primary">{parsed.matchedSection.label}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-muted-foreground/40" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        {parsed.matchedNav.length > 0 && query.length > 0 && (
          <CommandGroup heading="Navigera till">
            {parsed.matchedNav.map((n) => (
              <CommandItem
                key={n.to}
                value={`nav ${n.label}`}
                onSelect={() => go(n.to)}
                className="flex items-center gap-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground">
                  {n.icon}
                </span>
                <span className="text-sm">{n.label}</span>
                <ArrowRight size={13} className="ml-auto text-muted-foreground/40" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ── Snabbnavigation (tomt sökfält) ────────────────────────────── */}
        {query.length === 0 && (
          <CommandGroup heading="Snabbnavigation">
            {NAV_ITEMS.map((n) => (
              <CommandItem
                key={n.to}
                value={`nav-quick ${n.label}`}
                onSelect={() => go(n.to)}
                className="flex items-center gap-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground">
                  {n.icon}
                </span>
                <span className="text-sm">{n.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground/50 flex items-center gap-3">
        <span>Skriv adress + nyckelord t.ex. <em>"Södragården budgivning"</em></span>
        <span className="ml-auto">↩ välj · Esc stäng</span>
      </div>
    </CommandDialog>
  );
}
