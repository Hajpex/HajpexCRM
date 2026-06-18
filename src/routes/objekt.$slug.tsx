import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { OBJEKT, type Objekt } from "../data/objekt";
import { listObjekt } from "../lib/objektStore";
import { listBilder, addBilder, removeBild } from "../lib/objektBilderStore";
import { getObjektNotes, addObjektNote, setObjektBeskrivning, setObjektStatus, setObjektMarknadText, setManadsavgift } from "../lib/objektNotesStore";
import { generateMarketingText } from "../lib/ai.functions";
import { listBud, addBud, markeraVinnare, deleteBud, dragaTillbakaBud, getBudSettings, setBudSettings, fmtBud, type Bud } from "../lib/budgivningStore";
import { getKontrakt, saveKontrakt, type KontraktData } from "../lib/kontraktStore";
import { fmtSweNum, handleNumberInput } from "../lib/formatters";
import { getBudget } from "../lib/budgetStore";
import { getDemoSaljare } from "../lib/demoKontakter";
import { listKontakter, addObjektKoppling, saveKontakt, removeObjektKoppling, setObjektKopplingIntresse, setMedspekulanter } from "../lib/kontaktStore";
import type { SpekulantIntresse, Medspekulant } from "../lib/kontaktTypes";
import type { KontaktRelation, Kontakt } from "../lib/kontaktTypes";
import {
  listVisningar, saveVisning, deleteVisning, toggleDeltog, addDeltagare,
  exportVisningToICS, type Visning, type VisningTyp,
} from "../lib/visningarStore";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";

export const Route = createFileRoute("/objekt/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${prettyAddr(params.slug)} · Hajpex CRM` },
      { name: "description", content: "Objektsöversikt." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? (s.tab as string) : undefined,
    q: typeof s.q === "string" ? (s.q as string) : undefined,
  }),
  component: ObjektDetailPage,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

function buildMailto(to: string[], subject: string, body: string): string {
  const toStr = to.filter(Boolean).join(",");
  return `mailto:${toStr}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function getPartyEmails(slug: string, roles: Array<"säljare" | "köpare"> = ["säljare", "köpare"]): string[] {
  return listKontakter()
    .filter((k) => k.objektKopplingar.some((kp) => kp.slug === slug && roles.includes(kp.relation as "säljare" | "köpare")))
    .map((k) => k.epost)
    .filter((e): e is string => Boolean(e));
}

const SIDE_TABS = [
  "Start", "Intag", "Objektsinfo", "Marknad", "Visningar", "Budgivning",
  "Kontrakt", "Tillträde", "Säljare", "Köpare", "Dokument",
  "Mäklarräkenskap", "Objektsbeskrivning", "Tjänster",
] as const;
type SideTab = (typeof SIDE_TABS)[number];
type SavedSizes = [number, number];

const TOP_TABS = ["Översikt", "Spekulanter"] as const;


function readPanelSizes(layout: Record<string, number>, firstId: string, secondId: string): SavedSizes {
  return [layout[firstId] ?? 50, layout[secondId] ?? 50];
}

const pct = (n: number) => `${n}%`;

import { pickImages } from "../data/images";
import { RumSektion } from "../components/RumSektion";

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function ObjektDetailPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const initialTab = (SIDE_TABS as readonly string[]).includes(search.tab ?? "")
    ? (search.tab as SideTab)
    : "Start";
  const [tab, setTab] = useState<SideTab>(initialTab);
  const [top, setTop] = useState<(typeof TOP_TABS)[number]>("Översikt");
  const [editLayout, setEditLayout] = useState(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const [outerSizes, setOuterSizes] = useState<SavedSizes | null>(null);
  const [innerSizes, setInnerSizes] = useState<SavedSizes | null>(null);
  const [koppla, setKoppla] = useState<KontaktRelation | null>(null);

  const adress = prettyAddr(slug);
  const o = getObjektBySlug(slug);
  const [statusOverride, setStatusOverrideState] = useState<string | undefined>(
    () => getObjektNotes(slug).statusOverride
  );
  const currentStatus = statusOverride ?? o?.status;
  const showSavedLayout = editLayout || outerSizes !== null || innerSizes !== null;

  function handleStatusChange(s: string) {
    setObjektStatus(slug, s);
    setStatusOverrideState(s);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] px-6 pb-24 pt-8">
        {/* Breadcrumb / header */}
        <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
          <Link to="/objekt" className="hover:text-foreground">← Objekt</Link>
          <span className="opacity-40">/</span>
          <span className="text-foreground">{adress}</span>
        </div>

        {/* Top tabs */}
        <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-border">
          {TOP_TABS.map((t) => {
            const active = top === t;
            return (
              <button
                key={t}
                onClick={() => setTop(t)}
                className={[
                  "relative px-4 py-2.5 text-sm transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t}
                {active && <span className="absolute inset-x-2 -bottom-px h-px bg-primary" />}
              </button>
            );
          })}
        </div>

        {/* Object title bar */}
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-primary/80">Objekt</div>
              {currentStatus && (
                <StatusPicker value={currentStatus} onChange={handleStatusChange} />
              )}
            </div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serif}>
              {adress}<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{propertyLocality(slug).postal} {propertyLocality(slug).city}{o?.typ ? ` · ${o.typ}` : ""}{o?.boarea ? ` · ${o.boarea} m²` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PillBtn onClick={() => setKoppla("säljare")}>+ Koppla säljare</PillBtn>
            <PillBtn onClick={() => setKoppla("köpare")}>+ Koppla köpare</PillBtn>
            <PillBtn onClick={() => setTab("Marknad")}>Marknad</PillBtn>
            {editLayout && (
              <button
                onClick={() => {
                  setOuterSizes(null);
                  setInnerSizes(null);
                  setLayoutKey((k) => k + 1);
                }}
                title="Återställ originallayout"
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary"
              >
                ↺ Nollställ
              </button>
            )}
            <button
              onClick={() => setEditLayout((v) => !v)}
              title="Anpassa layout"
              className={[
                "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                editLayout
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary",
              ].join(" ")}
            >
              {editLayout ? "✓ Klar" : "✎ Redigera layout"}
            </button>
          </div>
        </section>

        {editLayout && (
          <div className="mb-3 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
            Redigeringsläge aktivt — dra i handtagen för att anpassa storleken på panelerna.
          </div>
        )}

        {/* Body: spekulanter top-view OR sidebar + content */}
        {top === "Spekulanter" ? (
          <SpekulanterTopView slug={slug} />
        ) : showSavedLayout ? (
          <ResizablePanelGroup
            key={`outer-${layoutKey}`}
            orientation="horizontal"
            className="min-h-[600px] gap-0"
            disabled={!editLayout}
            onLayoutChanged={(layout) => setOuterSizes(readPanelSizes(layout, "outer-menu", "outer-content"))}
          >
            <ResizablePanel id="outer-menu" defaultSize={pct(outerSizes?.[0] ?? 16)} minSize="10%" maxSize="35%">
              <Sidebar tab={tab} setTab={setTab} />
            </ResizablePanel>
            <ResizableHandle withHandle={editLayout} className={editLayout ? "mx-2" : "mx-0 opacity-0"} />
            <ResizablePanel id="outer-content" defaultSize={pct(outerSizes?.[1] ?? 84)} minSize="40%">
              {tab === "Start" ? (
                <StartView adress={adress} slug={slug} editLayout={editLayout} layoutKey={layoutKey} innerSizes={innerSizes} onInnerLayout={setInnerSizes} />
              ) : tab === "Intag" ? (
                <IntagView adress={adress} />
              ) : tab === "Objektsinfo" ? (
                <ObjektsinfoView adress={adress} slug={slug} />
              ) : tab === "Marknad" ? (
                <MarknadView />
              ) : tab === "Visningar" ? (
                <VisningarView />
              ) : tab === "Budgivning" ? (
                <BudgivningView slug={slug} />
              ) : tab === "Kontrakt" ? (
                <KontraktView slug={slug} onTabChange={setTab} />
              ) : tab === "Tillträde" ? (
                <TilltradeView />
              ) : tab === "Säljare" ? (
                <SaljareView onTabChange={setTab} />
              ) : tab === "Köpare" ? (
                <KopareView onTabChange={setTab} />
              ) : tab === "Dokument" ? (
                <DokumentView slug={slug} onTabChange={setTab} />
              ) : tab === "Mäklarräkenskap" ? (
                <MaklarrakenskapView onTabChange={setTab} />
              ) : tab === "Objektsbeskrivning" ? (
                <ObjektsbeskrivningView adress={adress} slug={slug} />
              ) : (
                <Placeholder tab={tab} />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] lg:gap-6">
            <Sidebar tab={tab} setTab={setTab} />
            <div>
              {tab === "Start" ? (
                <StartView adress={adress} slug={slug} editLayout={editLayout} layoutKey={layoutKey} innerSizes={innerSizes} onInnerLayout={setInnerSizes} />
              ) : tab === "Intag" ? (
                <IntagView adress={adress} />
              ) : tab === "Objektsinfo" ? (
                <ObjektsinfoView adress={adress} slug={slug} />
              ) : tab === "Marknad" ? (
                <MarknadView />
              ) : tab === "Visningar" ? (
                <VisningarView />
              ) : tab === "Budgivning" ? (
                <BudgivningView slug={slug} />
              ) : tab === "Kontrakt" ? (
                <KontraktView slug={slug} onTabChange={setTab} />
              ) : tab === "Tillträde" ? (
                <TilltradeView />
              ) : tab === "Säljare" ? (
                <SaljareView onTabChange={setTab} />
              ) : tab === "Köpare" ? (
                <KopareView onTabChange={setTab} />
              ) : tab === "Dokument" ? (
                <DokumentView slug={slug} onTabChange={setTab} />
              ) : tab === "Mäklarräkenskap" ? (
                <MaklarrakenskapView onTabChange={setTab} />
              ) : tab === "Objektsbeskrivning" ? (
                <ObjektsbeskrivningView adress={adress} slug={slug} />
              ) : (
                <Placeholder tab={tab} />
              )}
            </div>
          </div>
        )}
      </div>
      {koppla && (
        <KontaktVäljarDialog
          slug={slug}
          relation={koppla}
          onClose={() => setKoppla(null)}
          onLinked={() => setKoppla(null)}
        />
      )}
    </AppShell>
  );
}

const PRIMARY_TABS: SideTab[] = [
  "Start", "Intag", "Visningar", "Budgivning", "Marknad", "Dokument",
];

const SECONDARY_TABS: SideTab[] = [
  "Objektsinfo", "Objektsbeskrivning", "Kontrakt", "Tillträde",
  "Säljare", "Köpare", "Mäklarräkenskap",
];

const ALL_TABS: SideTab[] = [...PRIMARY_TABS, ...SECONDARY_TABS];

function Sidebar({ tab, setTab }: { tab: SideTab; setTab: (t: SideTab) => void }) {
  function TabBtn({ t, mobile }: { t: SideTab; mobile?: boolean }) {
    const active = tab === t;
    if (mobile) {
      return (
        <button
          onClick={() => setTab(t)}
          className={[
            "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors",
            active ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t}
        </button>
      );
    }
    return (
      <button
        onClick={() => setTab(t)}
        className={[
          "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
          active
            ? "bg-foreground text-background font-medium"
            : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        ].join(" ")}
      >
        {t}
      </button>
    );
  }

  return (
    <>
      {/* Mobile: horizontal scrollable strip */}
      <div className="lg:hidden -mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex gap-1.5 pb-1">
          {ALL_TABS.map((t) => <TabBtn key={t} t={t} mobile />)}
        </div>
      </div>

      {/* Desktop: vertical sidebar */}
      <aside className="hidden h-full space-y-0.5 overflow-y-auto pr-2 lg:block">
        {ALL_TABS.map((t) => <TabBtn key={t} t={t} />)}
      </aside>
    </>
  );
}

function StartView({
  adress,
  slug,
  editLayout,
  layoutKey,
  innerSizes,
  onInnerLayout,
}: {
  adress: string;
  slug: string;
  editLayout: boolean;
  layoutKey: number;
  innerSizes: SavedSizes | null;
  onInnerLayout: (sizes: SavedSizes) => void;
}) {
  const showSavedLayout = editLayout || innerSizes !== null;

  if (showSavedLayout) {
    return (
      <ResizablePanelGroup
        key={`inner-${layoutKey}`}
        orientation="horizontal"
        className="min-h-[800px] gap-0 pl-2"
        disabled={!editLayout}
        onLayoutChanged={(layout) => onInnerLayout(readPanelSizes(layout, "inner-left", "inner-right"))}
      >
        <ResizablePanel id="inner-left" defaultSize={pct(innerSizes?.[0] ?? 50)} minSize="25%">
          <div className="flex h-full flex-col gap-5 overflow-y-auto pr-2">
            <BilderCard adress={adress} slug={slug} />
            <AnteckningarCard />
            <VisningarCard />
            <ParterCard slug={slug} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle={editLayout} className={editLayout ? "mx-2" : "mx-0 opacity-0"} />
        <ResizablePanel id="inner-right" defaultSize={pct(innerSizes?.[1] ?? 50)} minSize="25%">
          <div className="flex h-full flex-col gap-5 overflow-y-auto pl-2">
            <AktivitetCard />
            <TrafikCard />
            <DetaljerCard slug={slug} />
            <BeskrivningCard />
            <VardebevakareCard />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <BilderCard adress={adress} slug={slug} />
      <AktivitetCard />
      <AnteckningarCard />
      <TrafikCard />
      <VisningarCard />
      <DetaljerCard slug={slug} />
        <ParterCard slug={slug} />
      <BeskrivningCard />
      <VardebevakareCard className="xl:col-span-2" />
    </div>
  );
}

function BilderCard({ adress, slug }: { adress: string; slug: string }) {
  const o = getObjektBySlug(slug);
  const blank = isUserCreatedSlug(slug);
  const [uploadedBilder, setUploadedBilder] = useState(() => listBilder(slug));
  const [idx, setIdx] = useState(0);

  function handleUpload(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      compressImageCard(file).then((dataUrl) => {
        const added = addBilder(slug, [{ name: file.name, dataUrl }]);
        setUploadedBilder((prev) => [...prev, ...added]);
      });
    });
  }

  function handleRemove(id: string) {
    removeBild(slug, id);
    setUploadedBilder((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (idx >= next.length) setIdx(Math.max(0, next.length - 1));
      return next;
    });
  }

  if (blank) {
    if (uploadedBilder.length === 0) {
      return (
        <Card title="Bilder" icon="📷">
          <label className="flex cursor-pointer aspect-[16/10] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 text-center hover:border-primary/50 hover:bg-primary/[0.03] transition-colors">
            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <div className="text-3xl opacity-60">📷</div>
            <div className="text-sm text-muted-foreground">Klicka för att ladda upp bilder</div>
            <div className="text-xs text-muted-foreground/60">JPG, PNG · Flera bilder samtidigt</div>
          </label>
        </Card>
      );
    }
    const total = uploadedBilder.length;
    const cur = uploadedBilder[Math.min(idx, total - 1)];
    return (
      <Card title="Bilder" icon="📷">
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
          <img src={cur.dataUrl} alt={cur.name} className="h-full w-full object-cover" />
          <button onClick={() => handleRemove(cur.id)}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white hover:bg-destructive/80">
            Ta bort
          </button>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {total > 1 && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
              <button onClick={() => setIdx((i) => (i - 1 + total) % total)} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1 backdrop-blur hover:bg-black/60">←</button>
              <span className="rounded-full bg-black/40 px-3 py-1 backdrop-blur">{Math.min(idx, total - 1) + 1} / {total}</span>
              <button onClick={() => setIdx((i) => (i + 1) % total)} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1 backdrop-blur hover:bg-black/60">→</button>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {uploadedBilder.map((b, i) => (
            <button key={b.id} onClick={() => setIdx(i)}
              className={["aspect-[4/3] overflow-hidden rounded-md border transition", i === idx ? "border-primary ring-1 ring-primary/40" : "border-border opacity-70 hover:opacity-100"].join(" ")}>
              <img src={b.dataUrl} alt={b.name} className="h-full w-full object-cover" />
            </button>
          ))}
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <span className="text-lg leading-none">+</span>
          </label>
        </div>
      </Card>
    );
  }

  const images = pickImages(slug, o?.typ, o?.boarea);
  const total = images.length;
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);
  return (
    <Card title="Bilder" icon="📷">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        <img src={images[idx]} alt={`Bild ${idx + 1} av ${adress}`} className="h-full w-full object-cover" loading="lazy" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
          <button onClick={prev} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1 backdrop-blur hover:bg-black/60">←</button>
          <span className="rounded-full bg-black/40 px-3 py-1 backdrop-blur">{idx + 1} / {total}</span>
          <button onClick={next} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1 backdrop-blur hover:bg-black/60">→</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {images.map((src, i) => (
          <button key={src} onClick={() => setIdx(i)}
            className={["aspect-[4/3] overflow-hidden rounded-md border transition", i === idx ? "border-primary ring-1 ring-primary/40" : "border-border opacity-70 hover:opacity-100"].join(" ")}>
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </Card>
  );
}

function compressImageCard(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); const r = new FileReader(); r.onload = (e) => resolve(String(e.target?.result ?? "")); r.readAsDataURL(file); };
    img.src = url;
  });
}

function AktivitetCard() {
  const { slug } = Route.useParams();
  const bids = listBud(slug);
  const spekulanter = listKontakter().filter((k) =>
    k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "spekulant")
  );
  const highestBid = bids[0]?.belopp;
  return (
    <Card title="Aktivitet" icon="📈">
      <div className="divide-y divide-border text-sm">
        <div className="flex items-center justify-between py-3">
          <span className="text-muted-foreground">Spekulanter</span>
          <span className="font-medium text-foreground">{spekulanter.length}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-muted-foreground">Antal bud</span>
          <span className="font-medium text-foreground">{bids.length}</span>
        </div>
        {highestBid ? (
          <div className="flex items-center justify-between py-3">
            <span className="text-muted-foreground">Högsta bud</span>
            <span className="font-medium text-primary">{fmtBud(highestBid)}</span>
          </div>
        ) : (
          <div className="py-3 text-center text-xs text-muted-foreground">Inga bud registrerade</div>
        )}
      </div>
    </Card>
  );
}

function AnteckningarCard() {
  const { slug } = Route.useParams();
  const [notes, setNotes] = useState(() => getObjektNotes(slug).anteckningar);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  function handleAdd() {
    if (!text.trim()) return;
    addObjektNote(slug, text.trim());
    setNotes(getObjektNotes(slug).anteckningar);
    setText("");
    setAdding(false);
  }

  return (
    <Card title="Anteckningar" icon="📝" action="+" onAction={() => setAdding((v) => !v)}>
      {adding && (
        <div className="mb-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv anteckning…"
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setAdding(false)} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-foreground/5">Avbryt</button>
            <button onClick={handleAdd} disabled={!text.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40">Spara</button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Inga anteckningar ännu</div>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-3 py-3">
              <span className="mt-0.5 text-muted-foreground">📄</span>
              <div>
                <div className="text-foreground">{n.text}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(n.ts).toLocaleString("sv-SE", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })} · {n.av}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TrafikCard() {
  return (
    <Card title="Trafik bostadssida" icon="📊">
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
        <span className="text-3xl">📡</span>
        <span className="text-sm text-muted-foreground">Visas när annonsen är publicerad</span>
        <span className="text-xs text-muted-foreground/60">Trafik mäts från Hemnet, Booli m.fl.</span>
      </div>
    </Card>
  );
}

function toLocalDT(d: Date) {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function BokaNyVisningModal({ slug, adress, onClose, onSaved }: { slug: string; adress: string; onClose: () => void; onSaved: () => void }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(12, 0, 0, 0);

  const [datum, setDatum] = useState(toLocalDT(tomorrow));
  const [sluttid, setSluttid] = useState(toLocalDT(tomorrowEnd));
  const [typ, setTyp] = useState<VisningTyp>("Öppen");
  const [anteckningar, setAnteckningar] = useState("");

  function handleDatumChange(val: string) {
    setDatum(val);
    const newStart = new Date(val).getTime();
    const currentEnd = new Date(sluttid).getTime();
    if (!isNaN(newStart) && !isNaN(currentEnd) && currentEnd <= newStart) {
      setSluttid(toLocalDT(new Date(newStart + 2 * 60 * 60 * 1000)));
    }
  }

  function handleSave() {
    const datumTs = new Date(datum).getTime();
    const sluttidTs = new Date(sluttid).getTime();
    if (isNaN(datumTs) || isNaN(sluttidTs)) return;
    saveVisning({ slug, datum: datumTs, sluttid: sluttidTs, typ, anteckningar, deltagare: [] });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Boka visning — {adress}</h2>
          <button onClick={onClose} className="text-lg text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Typ</p>
            <div className="flex gap-2">
              {(["Öppen", "Privat", "Budvisning"] as VisningTyp[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTyp(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    typ === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Start</label>
              <input
                type="datetime-local"
                value={datum}
                onChange={(e) => handleDatumChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Slut</label>
              <input
                type="datetime-local"
                value={sluttid}
                onChange={(e) => setSluttid(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Anteckningar (valfritt)</label>
            <textarea
              value={anteckningar}
              onChange={(e) => setAnteckningar(e.target.value)}
              rows={3}
              placeholder="T.ex. nyckelboxkod, parkeringsinstruktioner…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50">
            Avbryt
          </button>
          <button onClick={handleSave} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Boka visning
          </button>
        </div>
      </div>
    </div>
  );
}

function VisningarCard() {
  const { slug } = Route.useParams();
  const adress = prettyAddr(slug);
  const [visningar, setVisningar] = useState<Visning[]>([]);
  const [showModal, setShowModal] = useState(false);

  function load() { setVisningar(listVisningar(slug)); }
  useEffect(load, [slug]);

  const now = Date.now();
  const kommande = visningar.filter((v) => v.sluttid >= now);
  const past = visningar.filter((v) => v.sluttid < now);

  function timeFmt(ts: number) {
    return new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  function dateFmt(ts: number) {
    return new Date(ts).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  }

  return (
    <>
      <Card title="Visningar" icon="🏠" action={
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
        >
          + Boka
        </button>
      }>
        {kommande.length === 0 && past.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Inga inplanerade visningar</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              + Boka första visningen
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border text-sm">
            {kommande.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium text-foreground">{dateFmt(v.datum)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {timeFmt(v.datum)}–{timeFmt(v.sluttid)} · {v.typ} · {v.deltagare.length} anmälda
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/visning/$id"
                    params={{ id: v.id }}
                    className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    Starta ▶
                  </Link>
                  <button
                    onClick={() => exportVisningToICS(v, adress)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    → Kalender
                  </button>
                </div>
              </div>
            ))}
            {past.length > 0 && (
              <p className="pt-2.5 text-[11px] text-muted-foreground">{past.length} genomförd{past.length > 1 ? "a" : ""} visning{past.length > 1 ? "ar" : ""}</p>
            )}
          </div>
        )}
      </Card>
      {showModal && (
        <BokaNyVisningModal slug={slug} adress={adress} onClose={() => setShowModal(false)} onSaved={() => { load(); setShowModal(false); }} />
      )}
    </>
  );
}

function DetaljerCard({ slug }: { slug: string }) {
  const o = getObjektBySlug(slug);
  const typ = o?.typ ?? "—";
  const storlek = o?.boarea ? `${o.boarea} m²` : "—";
  const rum = o?.rum ? String(o.rum) : "—";
  const pris = o?.pris ? fmtKrShort(o.pris) : "—";
  const ansvarig = o?.ansvarig ?? "—";
  const skapadDatum = o && "savedAt" in o ? new Date((o as { savedAt: number }).savedAt).toLocaleDateString("sv-SE") : "—";
  const [avgift, setAvgift] = useState(() => getObjektNotes(slug).manadsavgift ?? "");

  return (
    <Card title="Detaljer" icon="ℹ️">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <Row k="Objekttyp" v={typ} />
          <Row k="Storlek" v={storlek} />
          <Row k="Antal rum" v={rum} />
          <Row k="Utgångspris" v={pris} />
          <dt className="text-muted-foreground">Månadsavgift</dt>
          <dd>
            <input
              type="text"
              value={avgift}
              onChange={(e) => setAvgift(e.target.value)}
              onBlur={() => setManadsavgift(slug, avgift)}
              placeholder="t.ex. 3 500 kr/mån"
              className="w-full border-b border-transparent bg-transparent text-sm focus:border-primary/60 focus:outline-none"
            />
          </dd>
          <Row k="Ansvarig mäklare" v={ansvarig} />
          <Row k="Skapat" v={skapadDatum} />
        </dl>
    </Card>
  );
}

function ParterCard({ slug }: { slug: string }) {
  const [dialogRelation, setDialogRelation] = useState<KontaktRelation | null>(null);
  const [tick, setTick] = useState(0);

  const linked = listKontakter().filter((k) =>
    k.objektKopplingar.some((kp) => kp.slug === slug)
  );
  const saljare = linked.filter((k) => k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "säljare"));
  const kopare = linked.filter((k) => k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "köpare"));
  const spekulanter = linked.filter((k) => k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "spekulant"));

  void tick;

  return (
    <>
      <Card title="Parter" icon="👥">
        <PartSection label="Säljare" persons={saljare} onAdd={() => setDialogRelation("säljare")} />
        <PartSection label="Köpare" persons={kopare} onAdd={() => setDialogRelation("köpare")} className="mt-4" />
        {spekulanter.length > 0 && (
          <PartSection label="Spekulanter" persons={spekulanter} className="mt-4" />
        )}
      </Card>
      {dialogRelation && (
        <KontaktVäljarDialog
          slug={slug}
          relation={dialogRelation}
          onClose={() => setDialogRelation(null)}
          onLinked={() => { setTick((t) => t + 1); setDialogRelation(null); }}
        />
      )}
    </>
  );
}

function PartSection({ label, persons, onAdd, className }: { label: string; persons: Kontakt[]; onAdd?: () => void; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        {onAdd && (
          <button onClick={onAdd} className="text-[10px] text-primary/70 hover:text-primary">+ Koppla</button>
        )}
      </div>
      {persons.length > 0 ? (
        <div className="mt-2 space-y-2">
          {persons.map((p) => (
            <Link key={p.id} to="/kunder/$id" params={{ id: p.id }}>
              <Party name={`${p.fornamn} ${p.efternamn}`} sub={p.telefon} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground italic">Ingen kopplad ännu</div>
      )}
    </div>
  );
}

function KontaktVäljarDialog({
  slug, relation, onClose, onLinked,
}: {
  slug: string; relation: KontaktRelation; onClose: () => void; onLinked: () => void;
}) {
  const [q, setQ] = useState("");
  const all = listKontakter();
  const filtered = q.trim().length < 2 ? all : all.filter((k) => {
    const hay = `${k.fornamn} ${k.efternamn} ${k.telefon}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  function link(k: Kontakt) {
    addObjektKoppling(k.id, { slug, relation, addedAt: Date.now(), anteckning: "" });
    onLinked();
  }

  const roleLabel = { säljare: "säljare", köpare: "köpare", spekulant: "spekulant", kontakt: "kontakt" }[relation];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 "
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-card p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 text-xl text-muted-foreground hover:text-foreground">✕</button>
        <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/80">Koppla kontakt</div>
        <h2 className="mb-4 text-xl font-medium" style={serif}>Välj {roleLabel}<span className="text-primary">.</span></h2>
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Sök namn eller telefon…"
          className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          autoFocus
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Inga kontakter hittades</div>
          ) : filtered.map((k) => (
            <button key={k.id} onClick={() => link(k)}
              className="flex w-full items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                {[k.fornamn[0], k.efternamn[0]].filter(Boolean).join("").toUpperCase() || "?"}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{k.fornamn} {k.efternamn}</div>
                <div className="text-[11px] text-muted-foreground">{k.telefon || k.epost || "—"}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          Finns inte kontakten? <Link to="/kunder" onClick={onClose} className="text-primary hover:underline">Lägg till i kundregistret →</Link>
        </div>
      </div>
    </div>
  );
}

function BeskrivningCard() {
  const { slug } = Route.useParams();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => getObjektNotes(slug).beskrivning);

  function handleSave() {
    setObjektBeskrivning(slug, text);
    setEditing(false);
  }

  return (
    <Card title="Beskrivning" icon="📄" action="✎" onAction={() => setEditing((v) => !v)}>
      {editing ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Skriv objektbeskrivningen här…"
            className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm leading-relaxed focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditing(false)} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-foreground/5">Avbryt</button>
            <button onClick={handleSave} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Spara</button>
          </div>
        </div>
      ) : text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{text}</p>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Ingen beskrivning — klicka ✎ för att lägga till
        </div>
      )}
    </Card>
  );
}

function VardebevakareCard({ className }: { className?: string }) {
  return (
    <Card title="Värdebevakare" icon="🔔" action="+" className={className}>
        <div className="grid grid-cols-3 gap-4 border-b border-border pb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <div>Kontakt</div>
          <div>Pris</div>
          <div>Ansvarig mäklare</div>
        </div>
        <div className="py-8 text-center text-sm text-muted-foreground">Inga värdebevakare ännu</div>
    </Card>
  );
}

function Placeholder({ tab }: { tab: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-12 text-center ">
      <div className="text-xs uppercase tracking-[0.22em] text-primary/80">{tab}</div>
      <div className="mt-3 text-2xl" style={serif}>Kommer härnäst</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Skicka skärmdumpen för fliken <span className="font-medium text-foreground">{tab}</span> så bygger jag layouten.
      </p>
    </div>
  );
}

const STATUS_OPTIONS = [
  "Till salu", "Redo (Kommande)", "Under intag", "Intaget",
  "Såld", "Vilande", "Inget uppdrag", "Arkiverad",
] as const;

function statusColor(s: string) {
  if (s === "Till salu") return "border-primary/40 bg-primary/10 text-primary";
  if (s === "Redo (Kommande)") return "border-orange-400/40 bg-orange-400/10 text-orange-500";
  if (s === "Såld") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-600";
  if (s === "Vilande" || s === "Inget uppdrag") return "border-muted text-muted-foreground";
  return "border-border text-muted-foreground";
}

function StatusPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] transition-colors hover:opacity-80",
          statusColor(value),
        ].join(" ")}
      >
        {value}
        <span className="ml-0.5 opacity-60">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/5",
                  s === value ? "font-medium text-primary" : "text-foreground",
                ].join(" ")}
              >
                {s === value && <span className="text-primary">✓</span>}
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const INTRESSE_CONFIG: Record<SpekulantIntresse, { label: string; color: string }> = {
  budgivare:      { label: "Budgivare",         color: "bg-emerald-500/12 text-emerald-400 border-emerald-500/30" },
  aktiv:          { label: "Intresserad",        color: "bg-blue-500/12 text-blue-400 border-blue-500/30" },
  följer:         { label: "Följer budgivning",  color: "bg-amber-500/12 text-amber-400 border-amber-500/30" },
  ej_intresserad: { label: "Ej intresserad",     color: "bg-muted/60 text-muted-foreground border-border" },
};
const INTRESSE_ORDER: SpekulantIntresse[] = ["budgivare", "aktiv", "följer", "ej_intresserad"];
const ALL_INTRESSE = INTRESSE_ORDER;

function spekulantAiInsikt(
  spekulanter: ReturnType<typeof listKontakter>,
  slug: string
): string {
  const kopplingMap = spekulanter.map((k) =>
    k.objektKopplingar.find((kp) => kp.slug === slug && kp.relation === "spekulant")
  );
  const budgivare = kopplingMap.filter((kp) => kp?.intresse === "budgivare").length;
  const aktiva    = kopplingMap.filter((kp) => !kp?.intresse || kp.intresse === "aktiv").length;
  const följer    = kopplingMap.filter((kp) => kp?.intresse === "följer").length;
  const avböjt    = kopplingMap.filter((kp) => kp?.intresse === "ej_intresserad").length;
  void följer;

  const utan_nastaSteg = spekulanter.filter(
    (k) => !k.nastaSteg || k.nastaSteg.datum < Date.now()
  ).length;

  if (budgivare >= 2) return `${budgivare} budgivare — hög budkonkurrens. Förbered budstrategin med säljaren.`;
  if (budgivare === 1 && aktiva > 0) return `1 budgivare och ${aktiva} aktiv${aktiva > 1 ? "a" : ""} — uppmuntra de aktiva att lägga bud.`;
  if (budgivare === 1) return "1 budgivare. Kontrollera om fler spekulanter kan aktiveras innan budgivning.";
  if (aktiva === 0 && avböjt > 0) return "Alla spekulanter har avböjt. Kan vara läge att se över pris eller marknadsföring.";
  if (utan_nastaSteg > 0) return `${utan_nastaSteg} spekulant${utan_nastaSteg > 1 ? "er saknar" : " saknar"} nästa steg — boka uppföljning.`;
  if (aktiva > 3) return `${aktiva} aktiva spekulanter — bra intresse. Håll kontinuerlig kontakt.`;
  return `${spekulanter.length} spekulant${spekulanter.length !== 1 ? "er" : ""} registrerad${spekulanter.length !== 1 ? "e" : ""}. Uppdatera status löpande.`;
}

function SpekulanterTopView({ slug }: { slug: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tick, setTick]             = useState(0);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"ring" | "sms" | null>(null);
  const [spekulanter, setSpekulanter] = useState(() =>
    listKontakter().filter((k) =>
      k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "spekulant")
    )
  );
  const [kommande, setKommande] = useState<Visning[]>([]);
  void tick;

  function reload() {
    setSpekulanter(
      listKontakter().filter((k) =>
        k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "spekulant")
      )
    );
    setKommande(listVisningar(slug).filter((v) => v.sluttid >= Date.now()));
  }
  useEffect(reload, [slug]);

  function changeIntresse(kontaktId: string, intresse: SpekulantIntresse) {
    setObjektKopplingIntresse(kontaktId, slug, intresse);
    if (intresse === "budgivare") {
      const k = spekulanter.find((s) => s.id === kontaktId);
      if (k) {
        const namn = `${k.fornamn} ${k.efternamn}`;
        const existing = listBud(slug);
        if (!existing.some((b) => b.namn === namn)) {
          addBud(slug, { belopp: 0, namn, telefon: k.telefon ?? "", villkor: "" });
        }
      }
    }
    reload();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const sorted = [...spekulanter].sort((a, b) => {
    const ia = a.objektKopplingar.find((kp) => kp.slug === slug && kp.relation === "spekulant")?.intresse ?? "aktiv";
    const ib = b.objektKopplingar.find((kp) => kp.slug === slug && kp.relation === "spekulant")?.intresse ?? "aktiv";
    return INTRESSE_ORDER.indexOf(ia) - INTRESSE_ORDER.indexOf(ib);
  });

  const selectedVals = spekulanter.filter((k) => selected.has(k.id));
  const aiInsikt = spekulantAiInsikt(spekulanter, slug);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary/70">Spekulanter</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{spekulanter.length} registrerade</div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted-foreground hover:text-foreground">
              Avmarkera alla
            </button>
          )}
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            + Koppla spekulant
          </button>
        </div>
      </div>

      {/* AI-insikt */}
      {spekulanter.length > 0 && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <span className="mt-0.5 text-sm">✦</span>
          <p className="text-sm text-foreground">{aiInsikt}</p>
        </div>
      )}

      {spekulanter.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Inga spekulanter kopplade till detta objekt ännu
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((k) => (
            <SpekulantKort
              key={k.id}
              kontakt={k}
              slug={slug}
              kommande={kommande}
              selected={selected.has(k.id)}
              onToggleSelect={() => toggleSelect(k.id)}
              onChangeIntresse={(s) => changeIntresse(k.id, s)}
              onReload={reload}
            />
          ))}
        </div>
      )}

      {/* Bulk-bar */}
      {selected.size > 0 && (
        <BulkBar
          selected={selectedVals}
          bulkAction={bulkAction}
          onBulkAction={setBulkAction}
          onChangeIntresse={(ids, s) => { ids.forEach((id) => changeIntresse(id, s)); setSelected(new Set()); }}
          onClear={() => { setSelected(new Set()); setBulkAction(null); }}
        />
      )}

      {dialogOpen && (
        <KontaktVäljarDialog
          slug={slug}
          relation="spekulant"
          onClose={() => setDialogOpen(false)}
          onLinked={() => { reload(); setTick((t) => t + 1); setDialogOpen(false); }}
        />
      )}
    </div>
  );
}

/* ── Spekulant-kort ── */
function SpekulantKort({
  kontakt: k, slug, kommande, selected, onToggleSelect, onChangeIntresse, onReload,
}: {
  kontakt: Kontakt;
  slug: string;
  kommande: Visning[];
  selected: boolean;
  onToggleSelect: () => void;
  onChangeIntresse: (s: SpekulantIntresse) => void;
  onReload: () => void;
}) {
  const koppling   = k.objektKopplingar.find((kp) => kp.slug === slug && kp.relation === "spekulant");
  const intresse: SpekulantIntresse = koppling?.intresse ?? "aktiv";
  const cfg        = INTRESSE_CONFIG[intresse];
  const dagSedan   = koppling ? Math.floor((Date.now() - koppling.addedAt) / 86_400_000) : 0;
  const budMin     = Number(k.budgetMin) || 0;
  const budMax     = Number(k.budgetMax) || 0;
  const harBudget  = budMin > 0 || budMax > 0;
  const meds       = koppling?.medspekulanter ?? [];

  const [showBokaMenu, setShowBokaMenu] = useState(false);
  const bokaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBokaMenu) return;
    const h = (e: MouseEvent) => {
      if (bokaRef.current && !bokaRef.current.contains(e.target as Node)) setShowBokaMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showBokaMenu]);

  function bokaVisning(v: Visning) {
    addDeltagare(slug, v.id, {
      namn: `${k.fornamn} ${k.efternamn}`,
      telefon: k.telefon ?? "",
      kontaktId: k.id,
      anmald: true,
      deltog: false,
    });
    setShowBokaMenu(false);
  }

  const actionBtn = "rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground";

  return (
    <div className={`rounded-lg border bg-background transition-colors ${selected ? "border-primary/50 bg-primary/3" : "border-border"}`}>
      {/* Top: checkbox + namn + pill */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-3.5 w-3.5 shrink-0 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link to="/kunder/$id" params={{ id: k.id }} className="font-medium text-foreground hover:text-primary">
              {k.fornamn} {k.efternamn}
            </Link>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {k.telefon && <span>{k.telefon}</span>}
            {k.epost   && <span>{k.epost}</span>}
            <span>Kopplad {dagSedan === 0 ? "idag" : `${dagSedan}d sedan`}</span>
            {harBudget && (
              <span className="font-medium text-foreground">
                Budget {budMin > 0 ? `${(budMin / 1_000_000).toFixed(1)}M` : ""}
                {budMax > 0 ? `–${(budMax / 1_000_000).toFixed(1)}M` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status-knappar */}
      <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-4 py-2.5">
        {ALL_INTRESSE.map((s) => (
          <button
            key={s}
            onClick={() => { if (s !== intresse) onChangeIntresse(s); }}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              s === intresse
                ? cfg.color
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {INTRESSE_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Åtgärdsknappar */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 px-4 py-2.5">
        {k.telefon && (
          <a href={`tel:${k.telefon}`} className={actionBtn}>📞 Ring</a>
        )}
        {k.telefon && (
          <a href={`sms:${k.telefon}`} className={actionBtn}>💬 SMS</a>
        )}
        {k.epost && (
          <a href={`mailto:${k.epost}`} className={actionBtn}>✉ Mejla</a>
        )}
        <Link to="/kunder/$id" params={{ id: k.id }} className={actionBtn}>
          Profil →
        </Link>
        {kommande.length > 0 && (
          <div ref={bokaRef} className="relative">
            <button onClick={() => setShowBokaMenu((v) => !v)} className={`${actionBtn} text-primary border-primary/30`}>
              📅 Boka visning
            </button>
            {showBokaMenu && (
              <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[200px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                {kommande.map((v) => {
                  const d = new Date(v.datum);
                  const already = v.deltagare.some((p) => p.kontaktId === k.id || p.telefon === k.telefon);
                  return (
                    <button
                      key={v.id}
                      onMouseDown={(e) => { e.preventDefault(); if (!already) bokaVisning(v); }}
                      disabled={already}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        already ? "cursor-default text-muted-foreground/50" : "hover:bg-white/5"
                      }`}
                    >
                      <span>{d.toLocaleDateString("sv", { weekday: "short", month: "short", day: "numeric" })} {d.toLocaleTimeString("sv", { hour: "2-digit", minute: "2-digit" })}</span>
                      {already ? <span className="text-[10px] text-primary">Bokad</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Medspekulanter */}
      <MedspekulantSektion kontaktId={k.id} slug={slug} meds={meds} onUpdate={onReload} />
    </div>
  );
}

/* ── Medspekulant-sektion ── */
function MedspekulantSektion({
  kontaktId, slug, meds, onUpdate,
}: {
  kontaktId: string;
  slug: string;
  meds: Medspekulant[];
  onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [namn, setNamn]     = useState("");
  const [tel, setTel]       = useState("");

  function handleAdd() {
    if (!namn.trim()) return;
    setMedspekulanter(kontaktId, slug, [...meds, { namn: namn.trim(), telefon: tel.trim() }]);
    setNamn(""); setTel(""); setAdding(false); onUpdate();
  }

  function handleRemove(i: number) {
    setMedspekulanter(kontaktId, slug, meds.filter((_, idx) => idx !== i));
    onUpdate();
  }

  return (
    <div className="border-t border-border/40 px-4 pb-3 pt-2.5">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Medspekulant</div>
      <div className="flex flex-wrap gap-1.5">
        {meds.map((m, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[11px]">
            <span className="font-medium text-foreground">{m.namn}</span>
            {m.telefon && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <a href={`tel:${m.telefon}`} className="text-muted-foreground hover:text-foreground">{m.telefon}</a>
                <a href={`sms:${m.telefon}`} className="text-primary/60 hover:text-primary">💬</a>
              </>
            )}
            <button onClick={() => handleRemove(i)} className="ml-0.5 text-muted-foreground/50 hover:text-foreground">×</button>
          </div>
        ))}
        {adding ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              value={namn}
              onChange={(e) => setNamn(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNamn(""); setTel(""); } }}
              placeholder="Namn"
              className="h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:border-primary focus:outline-none w-28"
            />
            <input
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNamn(""); setTel(""); } }}
              placeholder="Telefon"
              className="h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:border-primary focus:outline-none w-28"
            />
            <button onClick={handleAdd} className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90">Lägg till</button>
            <button onClick={() => { setAdding(false); setNamn(""); setTel(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Avbryt</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="rounded-md border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground/60 hover:border-primary/40 hover:text-muted-foreground">
            + Lägg till
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Bulk-bar ── */
function BulkBar({
  selected, bulkAction, onBulkAction, onChangeIntresse, onClear,
}: {
  selected: Kontakt[];
  bulkAction: "ring" | "sms" | null;
  onBulkAction: (a: "ring" | "sms" | null) => void;
  onChangeIntresse: (ids: string[], s: SpekulantIntresse) => void;
  onClear: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const phones = selected.map((k) => k.telefon).filter(Boolean) as string[];
  const emails = selected.map((k) => k.epost).filter(Boolean) as string[];
  const ids    = selected.map((k) => k.id);

  const barBtn = "rounded-md border border-border/60 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-white/5";

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 shadow-2xl">
        <span className="text-xs font-semibold text-primary">{selected.length} valda</span>
        <div className="mx-1 h-4 w-px bg-border" />

        {/* Ring */}
        {phones.length > 0 && (
          <div className="relative">
            <button onClick={() => { onBulkAction(bulkAction === "ring" ? null : "ring"); setStatusOpen(false); }} className={barBtn}>
              📞 Ring
            </button>
            {bulkAction === "ring" && (
              <div className="absolute bottom-full left-0 mb-2 min-w-[180px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                {selected.filter((k) => k.telefon).map((k) => (
                  <a key={k.id} href={`tel:${k.telefon}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-white/5">
                    <span className="font-medium">{k.fornamn}</span>
                    <span className="text-muted-foreground">{k.telefon}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SMS */}
        {phones.length > 0 && (
          <div className="relative">
            <button onClick={() => { onBulkAction(bulkAction === "sms" ? null : "sms"); setStatusOpen(false); }} className={barBtn}>
              💬 SMS
            </button>
            {bulkAction === "sms" && (
              <div className="absolute bottom-full left-0 mb-2 min-w-[180px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                {selected.filter((k) => k.telefon).map((k) => (
                  <a key={k.id} href={`sms:${k.telefon}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-white/5">
                    <span className="font-medium">{k.fornamn}</span>
                    <span className="text-muted-foreground">{k.telefon}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mejla alla */}
        {emails.length > 0 && (
          <a href={`mailto:${emails.join(",")}`} className={barBtn}>
            ✉ Mejla alla
          </a>
        )}

        {/* Byt status */}
        <div className="relative">
          <button onClick={() => { setStatusOpen((v) => !v); onBulkAction(null); }} className={barBtn}>
            Byt status ▾
          </button>
          {statusOpen && (
            <div className="absolute bottom-full left-0 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              {ALL_INTRESSE.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); onChangeIntresse(ids, s); setStatusOpen(false); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-white/5"
                >
                  <span className={`h-2 w-2 rounded-full border ${INTRESSE_CONFIG[s].color}`} />
                  {INTRESSE_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-1 h-4 w-px bg-border" />
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>
    </div>
  );
}

function Card({ title, icon, action, onAction, className, children }: { title: string; icon?: string; action?: ReactNode; onAction?: () => void; className?: string; children: ReactNode }) {
  return (
    <section className={["rounded-xl border border-border bg-card/80 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)] ", className].filter(Boolean).join(" ")}>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
          {icon && <span>{icon}</span>}
          {title}
        </div>
        {action !== undefined && (
          typeof action === "string"
            ? <button onClick={onAction} className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20">{action}</button>
            : action
        )}
      </header>
      {children}
    </section>
  );
}

function PillBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary">
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-mono text-foreground">{v}</dd>
    </>
  );
}

function Party({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-foreground/[0.02] px-3 py-2 text-sm">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] text-primary">
        {name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-foreground">{name}</div>
        {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Donut() {
  return (
    <svg viewBox="0 0 42 42" className="h-36 w-36 -rotate-90">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="hsl(var(--muted-foreground) / 0.12)" strokeWidth="6" />
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="oklch(0.72 0.18 220)" strokeWidth="6" strokeDasharray="75 25" strokeDashoffset="0" />
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="oklch(0.75 0.16 160)" strokeWidth="6" strokeDasharray="25 75" strokeDashoffset="-75" />
    </svg>
  );
}

export function slugifyAddr(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettyAddr(slug: string): string {
  const parts = slug.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return parts.join(" ");
}

/* Look up the real Objekt row from the central data list so the detail
   page reflects what the user sees in /objekt (price, rooms, area, …). */
export function getObjektBySlug(slug: string): Objekt | undefined {
  const saved = listObjekt().find((o) => slugifyAddr(o.adress) === slug);
  if (saved) return saved;
  return OBJEKT.find((o) => slugifyAddr(o.adress) === slug);
}

/* True when the slug is NOT one of the seeded demo objects. Includes objects
   the user created via /objekt/nytt as well as unknown slugs. Deterministic
   on both server and client (depends only on the static OBJEKT list), which
   avoids hydration mismatches. */
export function isUserCreatedSlug(slug: string): boolean {
  return !OBJEKT.some((o) => slugifyAddr(o.adress) === slug);
}

export function fmtKrShort(n: number): string {
  return n.toLocaleString("sv-SE") + " kr";
}
export function fmtSek(n: number): string {
  return n.toLocaleString("sv-SE") + " SEK";
}

/* Derive a deterministic postal + city for the property from the slug,
   so seller / contact addresses stay consistent with the listed property. */
const SE_LOCALITIES: { postal: string; city: string }[] = [
  { postal: "112 34", city: "Stockholm" },
  { postal: "169 55", city: "Solna" },
  { postal: "182 30", city: "Danderyd" },
  { postal: "413 01", city: "Göteborg" },
  { postal: "211 18", city: "Malmö" },
  { postal: "752 36", city: "Uppsala" },
  { postal: "583 30", city: "Linköping" },
  { postal: "722 12", city: "Västerås" },
  { postal: "852 31", city: "Sundsvall" },
  { postal: "903 25", city: "Umeå" },
];
function propertyLocality(slug: string) {
  return SE_LOCALITIES[hashSlug(slug) % SE_LOCALITIES.length];
}
function propertyFullAddr(slug: string): string {
  const { postal, city } = propertyLocality(slug);
  return `${prettyAddr(slug)}, ${postal} ${city}`;
}
/* Most sellers live at the listed property; occasionally one has moved out
   and is registered on another address in the same city. */
function sellerAddress(slug: string, idx: number): string {
  const { postal, city } = propertyLocality(slug);
  const livesAtProperty = ((hashSlug(slug) >> (idx + 1)) & 0b11) !== 0; // ~75%
  if (livesAtProperty) return `${prettyAddr(slug)}, ${postal} ${city}`;
  const altStreets = ["Parkgatan", "Kyrkogatan", "Skolvägen", "Bergsgatan", "Strandvägen", "Hantverkargatan"];
  const street = altStreets[(hashSlug(slug) + idx * 7) % altStreets.length];
  const num = ((hashSlug(slug) + idx * 13) % 60) + 1;
  return `${street} ${num}, ${postal} ${city}`;
}

/* ============================================================
   INTAG VIEW
   ============================================================ */

type SectionId =
  | "maklarjournal" | "handlaggare" | "uppdrag" | "vardering"
  | "saljare" | "provision" | "dokument" | "filer" | "tjanster" | "kapitalvinst";

function IntagView({ adress }: { adress: string }) {
  const { slug } = Route.useParams();
  const ansvarig = getObjektBySlug(slug)?.ansvarig ?? "";
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    maklarjournal: false, handlaggare: false, uppdrag: false, vardering: false,
    saljare: false, provision: false, dokument: false, filer: false, tjanster: false, kapitalvinst: false,
  });
  const toggle = (id: SectionId) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="flex flex-col gap-2 pl-2">
      <Section id="maklarjournal" title="Mäklarjournal" badge="12" open={open.maklarjournal} onToggle={toggle}>
        <MaklarjournalBody ansvarig={ansvarig} />
      </Section>
      <Section id="handlaggare" title="Handläggare" open={open.handlaggare} onToggle={toggle}>
        <HandlaggareBody />
      </Section>
      <Section id="uppdrag" title="Uppdrag" open={open.uppdrag} onToggle={toggle}>
        <UppdragBody adress={adress} />
      </Section>
      <Section id="vardering" title="Värdering" open={open.vardering} onToggle={toggle}>
        <VarderingBody />
      </Section>
      <Section id="saljare" title="Säljare" open={open.saljare} onToggle={toggle}>
        <EmptyBody label="Inga säljare tillagda ännu." actionLabel="+ Lägg till säljare" />
      </Section>
      <Section id="provision" title="Provision" open={open.provision} onToggle={toggle}>
        <ProvisionBody />
      </Section>
      <Section id="dokument" title="Dokument" open={open.dokument} onToggle={toggle} rightSlot={
        <div className="flex gap-3 text-xs text-primary">
          <span className="hover:underline cursor-pointer">Hjälp – fullmakt</span>
          <span className="hover:underline cursor-pointer">Hjälp – dokumentmanualer</span>
        </div>
      }>
        <DokumentBody />
      </Section>
      <Section id="filer" title="Filer" open={open.filer} onToggle={toggle}>
        <FilerBody />
      </Section>
      <Section id="tjanster" title="Tjänster" open={open.tjanster} onToggle={toggle}>
        <TjansterBody />
      </Section>
      <Section id="kapitalvinst" title="Kapitalvinst" open={open.kapitalvinst} onToggle={toggle} rightSlot={
        <span className="text-xs text-primary hover:underline cursor-pointer">Hjälp</span>
      }>
        <KapitalvinstBody />
      </Section>
    </div>
  );
}

function Section({
  id, title, badge, open, onToggle, rightSlot, children,
}: {
  id: SectionId; title: string; badge?: string; open: boolean;
  onToggle: (id: SectionId) => void; rightSlot?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{title}</span>
          {badge && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[10px] font-medium text-orange-300">
              {badge}
            </span>
          )}
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-3">
          {rightSlot}
        </div>
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

/* ---------- Fields ---------- */

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs text-muted-foreground">{label}{hint && <span className="ml-1 opacity-60">{hint}</span>}</div>
      {children}
    </label>
  );
}

const BlankCtx = createContext(false);

function Input({ value, placeholder, suffix, readOnly, onChange }: { value?: string; placeholder?: string; suffix?: string; readOnly?: boolean; onChange?: (v: string) => void }) {
  const blank = useContext(BlankCtx);
  const v = blank ? undefined : value;
  const controlled = onChange !== undefined;
  return (
    <div className="flex items-center gap-2">
      <input
        {...(controlled ? { value: v ?? "" } : { defaultValue: v })}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
      />
      {suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

/* ---------- Swedish holiday helpers ---------- */
function _easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function sweHolidays(year: number): Set<string> {
  const s = new Set<string>();
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const fixed = (m: number, d: number) => s.add(fmt(new Date(year, m - 1, d)));
  const off = (base: Date, n: number) =>
    s.add(fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() + n)));

  fixed(1, 1); fixed(1, 6); fixed(5, 1); fixed(6, 6); fixed(12, 25); fixed(12, 26);

  const e = _easterDate(year);
  off(e, -2); off(e, 0); off(e, 1); off(e, 39); off(e, 49);

  for (let d = 20; d <= 26; d++) { const dt = new Date(year, 5, d); if (dt.getDay() === 6) { s.add(fmt(dt)); break; } }
  for (let o = 0; o < 7; o++) { const dt = new Date(year, 9, 31 + o); if (dt.getDay() === 6) { s.add(fmt(dt)); break; } }

  return s;
}

const _MONTH_SV = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];
const _DAY_SV   = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"];

/* ---------- DatePickerInput ---------- */
function DatePickerInput({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const blank  = useContext(BlankCtx);
  const val    = blank ? "" : (value ?? "");
  const today  = new Date();

  const toYMD  = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  const todayStr = toYMD(today);

  const parsed = val.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(val + "T12:00:00") : null;

  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(() => parsed?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth()     ?? today.getMonth());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const d = new Date(val + "T12:00:00");
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [val]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const holidays = sweHolidays(viewYear);

  /* Build 6×7 grid starting on Monday */
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; month: number; year: number; cur: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    cells.push({ day: prevDays - i, month: m, year: viewMonth === 0 ? viewYear - 1 : viewYear, cur: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: viewMonth, year: viewYear, cur: true });
  const rem = 42 - cells.length;
  for (let d = 1; d <= rem; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    cells.push({ day: d, month: m, year: viewMonth === 11 ? viewYear + 1 : viewYear, cur: false });
  }

  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  function pickDate(y: number, m: number, d: number) {
    onChange?.(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    setOpen(false);
  }
  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }

  return (
    <div ref={wrapRef} className="relative">
      {/* Input row */}
      <div className="flex">
        <input
          type="text"
          value={val}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="ÅÅÅÅ-MM-DD"
          readOnly={!onChange}
          className="h-9 w-full min-w-0 rounded-md rounded-r-none border border-r-0 border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex h-9 shrink-0 items-center rounded-md rounded-l-none border border-border bg-background px-2.5 text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <button type="button" onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-sm font-medium">{_MONTH_SV[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 px-3 pt-2">
            {_DAY_SV.map((d, i) => (
              <div key={d} className={["py-1 text-center text-[10px] font-medium uppercase tracking-wide", i >= 5 ? "text-red-400/60" : "text-muted-foreground/50"].join(" ")}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="px-3 pb-3">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((cell, ci) => {
                  const ds = `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
                  const isSel     = val === ds;
                  const isToday   = ds === todayStr;
                  const isHoliday = holidays.has(ds);
                  const isSun     = ci === 6;
                  const isSat     = ci === 5;
                  const isRed     = isHoliday || isSun;

                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => pickDate(cell.year, cell.month, cell.day)}
                      className={[
                        "relative flex h-8 w-full items-center justify-center rounded-md text-[13px] transition-colors",
                        isSel
                          ? "bg-primary text-primary-foreground font-medium"
                          : isRed && cell.cur
                          ? "text-red-400 hover:bg-red-500/10"
                          : isSat && cell.cur
                          ? "text-muted-foreground hover:bg-white/5"
                          : cell.cur
                          ? "text-foreground hover:bg-white/5"
                          : "text-muted-foreground/25 hover:bg-white/5",
                      ].join(" ")}
                    >
                      {cell.day}
                      {isToday && !isSel && (
                        <span className="absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-primary/60" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-2">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <span className="h-2 w-2 rounded-full bg-red-400/70" />
              Röd dag
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <span className="h-0.5 w-3 rounded-full bg-primary/60" />
              Idag
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ value, options, onChange }: { value?: string; options: string[]; onChange?: (v: string) => void }) {
  const blank = useContext(BlankCtx);
  const opts = blank ? ["", ...options.filter((o) => o !== "")] : options;
  const v = blank ? "" : value;
  const controlled = onChange !== undefined;
  return (
    <select
      {...(controlled ? { value: v ?? "" } : { defaultValue: v })}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-primary/40 focus:outline-none"
    >
      {opts.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
    </select>
  );
}

function Checkbox({ label, defaultChecked, onChange }: { label: string; defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  const blank = useContext(BlankCtx);
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        defaultChecked={blank ? false : defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-background accent-primary"
      />
      {label}
    </label>
  );
}

function BtnPrimary({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
function BtnGhost({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function QuickNavBar({ onTabChange }: { onTabChange: (tab: SideTab) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4 border-b border-border pb-3 text-xs">
      <button onClick={() => onTabChange("Marknad")} className="text-primary hover:underline">Publicera</button>
      <button onClick={() => onTabChange("Marknad")} className="text-primary hover:underline">Klippbok</button>
      <button onClick={() => onTabChange("Start")} className="text-primary hover:underline">Anteckningar</button>
      <button onClick={() => onTabChange("Dokument")} className="text-primary hover:underline">Mäklarjournal</button>
    </div>
  );
}

/* ---------- Mäklarjournal ---------- */

const MJ_ITEMS = [
  "Legitimering av säljare",
  "Legitimering av köpare",
  "PEP-kontroll säljare",
  "PEP-kontroll köpare",
  "Sanktionslistekontroll säljare",
  "Sanktionslistekontroll köpare",
  "Information om budgivning",
  "Information om mäklararvode",
  "Information om besiktningsklausul",
  "Information om dolda fel",
  "Frågelistan undertecknad",
  "Objektsbeskrivning undertecknad",
];

type MjEntry = { datum: string; utfordAv: string; kommentar: string; label: string; custom?: boolean };

function MaklarjournalBody({ ansvarig }: { ansvarig: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState<MjEntry[]>(() =>
    MJ_ITEMS.map((label) => ({ label, datum: "", utfordAv: ansvarig, kommentar: "" }))
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => MJ_ITEMS.map(() => false));
  const [bulkDate, setBulkDate] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const anyChecked = checked.some(Boolean);
  const allChecked = checked.length > 0 && checked.every(Boolean);

  function toggleCheckAll() {
    setChecked(items.map(() => !allChecked));
  }

  function toggleCheck(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    setChecked((c) => c.map((v, j) => (j === i ? !v : v)));
  }

  function applyBulkDate() {
    if (!bulkDate) return;
    setItems((es) => es.map((e, i) => (checked[i] ? { ...e, datum: bulkDate } : e)));
    setChecked(items.map(() => false));
    setBulkDate("");
  }

  function patch(i: number, p: Partial<MjEntry>) {
    setItems((es) => es.map((e, j) => (j === i ? { ...e, ...p } : e)));
  }

  function addCustomItem() {
    const label = newLabel.trim();
    if (!label) return;
    setItems((es) => [...es, { label, datum: "", utfordAv: ansvarig, kommentar: "", custom: true }]);
    setChecked((c) => [...c, false]);
    setNewLabel("");
  }

  function removeItem(i: number) {
    setItems((es) => es.filter((_, j) => j !== i));
    setChecked((c) => c.filter((_, j) => j !== i));
    if (openIdx === i) setOpenIdx(null);
  }

  return (
    <div className="space-y-2">
      {anyChecked && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2">
          <span className="text-xs text-primary">{checked.filter(Boolean).length} markerade</span>
          <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none" />
          <button onClick={applyBulkDate} disabled={!bulkDate}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40">
            Sätt datum
          </button>
          <button onClick={() => setChecked(items.map(() => false))} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Avmarkera alla
          </button>
        </div>
      )}

      <div className="divide-y divide-border rounded-md border border-border">
        {/* Markera alla-rad */}
        <div className="flex items-center gap-3 bg-foreground/[0.02] px-3 py-2">
          <input type="checkbox" checked={allChecked} onChange={toggleCheckAll}
            className="h-4 w-4 shrink-0 accent-primary" />
          <span className="text-xs text-muted-foreground cursor-pointer select-none" onClick={toggleCheckAll}>
            {allChecked ? "Avmarkera alla" : "Markera alla"}
          </span>
        </div>
        {items.map((item, i) => {
          const isOpen = openIdx === i;
          const done = !!item.datum;
          return (
            <div key={i}>
              <div onClick={() => setOpenIdx(isOpen ? null : i)}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-foreground/[0.02]">
                <input type="checkbox" checked={checked[i] ?? false}
                  onClick={(e) => toggleCheck(i, e)} onChange={() => {}}
                  className="h-4 w-4 shrink-0 accent-primary" />
                <span className={["flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  done ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400" : "border-border text-muted-foreground"].join(" ")}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.datum && <span className="text-xs text-muted-foreground">{item.datum}</span>}
                {item.kommentar && !isOpen && (
                  <span className="max-w-[140px] truncate text-xs text-muted-foreground italic">"{item.kommentar}"</span>
                )}
                {item.custom && (
                  <button onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                    className="text-[11px] text-muted-foreground/50 hover:text-destructive" title="Ta bort">×</button>
                )}
                <span className="text-xs text-muted-foreground">{isOpen ? "−" : "+"}</span>
              </div>
              {isOpen && (
                <div className="space-y-3 bg-background/40 px-3 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Datum">
                      <input type="date" value={item.datum} max={today}
                        onChange={(e) => patch(i, { datum: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none" />
                    </Field>
                    <Field label="Utförd av">
                      <Input value={item.utfordAv} onChange={(e) => patch(i, { utfordAv: e.target.value })} placeholder={ansvarig || "Mäklare"} />
                    </Field>
                  </div>
                  <Field label="Kommentar">
                    <textarea
                      value={item.kommentar}
                      onChange={(e) => patch(i, { kommentar: e.target.value })}
                      placeholder="Anteckning om denna åtgärd..."
                      rows={2}
                      className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lägg till egen punkt */}
      <div className="flex gap-2 pt-1">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
          placeholder="Lägg till egen punkt i journalen..."
          className="flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />
        <button onClick={addCustomItem} disabled={!newLabel.trim()}
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40">
          + Lägg till
        </button>
      </div>
    </div>
  );
}

/* ---------- Handläggare ---------- */

function HandlaggareBody() {
  return (
    <div>
      <div className="mb-3 flex justify-end"><BtnPrimary>+ Lägg till handläggare</BtnPrimary></div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Namn</th>
              <th className="px-3 py-2 text-left">Roll</th>
              <th className="px-3 py-2 text-left">Titel</th>
              <th className="px-3 py-2 text-left">Ansvarig</th>
              <th className="px-3 py-2 text-left">Visa på internet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              { n: "Johan Karlsson", r: "Ansvarig mäklare", t: "Reg. fastighetsmäklare", a: true, v: true },
              { n: "Lisa Lindgren", r: "Assistent", t: "Mäklarassistent", a: false, v: false },
            ].map((h) => (
              <tr key={h.n}>
                <td className="px-3 py-2">{h.n}</td>
                <td className="px-3 py-2 text-muted-foreground">{h.r}</td>
                <td className="px-3 py-2 text-muted-foreground">{h.t}</td>
                <td className="px-3 py-2"><input type="checkbox" defaultChecked={h.a} className="h-4 w-4 accent-primary" /></td>
                <td className="px-3 py-2"><input type="checkbox" defaultChecked={h.v} className="h-4 w-4 accent-primary" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------- Koppla kontakt-modal -------- */
function KopplaKontaktModal({
  slug,
  relation,
  onClose,
}: {
  slug: string;
  relation: "säljare" | "köpare";
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ fornamn: "", efternamn: "", telefon: "", epost: "" });

  const all = listKontakter();
  const alreadyIds = new Set(
    all
      .filter((k) => k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === relation))
      .map((k) => k.id)
  );
  const q = query.toLowerCase();
  const normTel = (t: string) => {
    let s = t.replace(/[\s\-()+.]/g, "");
    // +46701234567 / 46701234567 → 0701234567
    if (s.startsWith("46") && s.length >= 11) s = "0" + s.slice(2);
    return s;
  };
  const qTel = normTel(query);
  const filtered = all.filter(
    (k) =>
      `${k.fornamn} ${k.efternamn}`.toLowerCase().includes(q) ||
      normTel(k.telefon).includes(qTel) ||
      k.epost.toLowerCase().includes(q)
  );

  function link(kontaktId: string) {
    addObjektKoppling(kontaktId, { slug, relation, addedAt: Date.now(), anteckning: "" });
    onClose();
  }

  function createAndLink() {
    if (!form.fornamn || !form.efternamn) return;
    const k = saveKontakt({
      fornamn: form.fornamn, efternamn: form.efternamn,
      telefon: form.telefon, epost: form.epost,
      adress: "", ort: "", budgetMin: "", budgetMax: "",
      sokTyper: [], sokOmraden: [], anteckningar: "",
      gdprGodkant: null, objektKopplingar: [], aktiviteter: [], nastaSteg: null,
    });
    addObjektKoppling(k.id, { slug, relation, addedAt: Date.now(), anteckning: "" });
    onClose();
  }

  const label = relation === "säljare" ? "säljare" : "köpare";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-medium">Koppla {label}</h2>
          <button onClick={onClose} className="text-lg leading-none text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <input
            autoFocus
            type="text"
            placeholder="Sök namn, telefon eller e-post…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
          />

          <div className="max-h-56 divide-y divide-border/40 overflow-y-auto rounded-md border border-border">
            {!query ? (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                Skriv för att söka bland kontakter
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                Ingen kontakt matchar sökningen
              </div>
            ) : (
              filtered.slice(0, 25).map((k) => {
                const linked = alreadyIds.has(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => !linked && link(k.id)}
                    className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors ${linked ? "cursor-default opacity-50" : "hover:bg-muted/30"}`}
                  >
                    <div>
                      <div className="font-medium">{k.fornamn} {k.efternamn}</div>
                      <div className="text-xs text-muted-foreground">{k.telefon || k.epost || "—"}</div>
                    </div>
                    <span className={`text-xs font-medium ${linked ? "text-muted-foreground" : "text-primary"}`}>
                      {linked ? "✓ Kopplad" : "+ Koppla"}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border/60 pt-4">
            {!creating ? (
              <button onClick={() => setCreating(true)} className="text-sm text-primary hover:underline">
                + Skapa ny kontakt och koppla
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">Ny kontakt</p>
                <div className="grid grid-cols-2 gap-2">
                  {([["Förnamn *", "fornamn"], ["Efternamn *", "efternamn"], ["Telefon", "telefon"], ["E-post", "epost"]] as const).map(
                    ([ph, key]) => (
                      <input
                        key={key}
                        placeholder={ph}
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
                      />
                    )
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setCreating(false)} className="text-sm text-muted-foreground hover:text-foreground">Avbryt</button>
                  <button
                    onClick={createAndLink}
                    disabled={!form.fornamn || !form.efternamn}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                  >
                    Skapa och koppla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function loadKopare(slug: string) {
  return listKontakter().filter((k) =>
    k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "köpare")
  );
}

function KopareView({ onTabChange }: { onTabChange?: (tab: SideTab) => void }) {
  const { slug } = Route.useParams();
  const [open, setOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [persons, setPersons] = useState(() => loadKopare(slug));

  function refresh() { setPersons(loadKopare(slug)); }

  const cols = ["#", "Namn", "Telefon", "E-post", "Ort", "BankID", "Ta bort"];

  return (
    <div className="space-y-6">
      {onTabChange && <QuickNavBar onTabChange={onTabChange} />}

      {showModal && (
        <KopplaKontaktModal
          slug={slug}
          relation="köpare"
          onClose={() => { setShowModal(false); refresh(); }}
        />
      )}

      <section className="rounded-md border border-border bg-card">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Köpare</span>
            {persons.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">{persons.length}</span>
            )}
            <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-primary/80 hover:underline">Hjälp - fullmakt</span>
          </div>
        </button>

        {open && (
          <div className="border-t border-border px-4 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <BtnPrimary onClick={() => setShowModal(true)}>+ Lägg till köpare</BtnPrimary>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {cols.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {persons.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Inga köpare kopplade ännu.{" "}
                        <button onClick={() => setShowModal(true)} className="text-primary hover:underline">
                          Lägg till köpare →
                        </button>
                      </td>
                    </tr>
                  ) : persons.map((p, i) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{p.fornamn} {p.efternamn}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.telefon ? <a href={`tel:${p.telefon}`} className="hover:text-primary">{p.telefon}</a> : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.epost ? <a href={`mailto:${p.epost}`} className="hover:text-primary">{p.epost}</a> : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.ort || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700">BankID ✓</span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => { removeObjektKoppling(p.id, slug, "köpare"); refresh(); }}
                          className="text-xs text-rose-400 hover:text-rose-700"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   TILLTRÄDE VIEW (sidomeny → Tillträde)
   ============================================================ */

type TiSection =
  | "mj" | "kopare" | "forbered" | "likvid"
  | "dokument" | "filer" | "efterarbete" | "kapitalvinst";

function TilltradeView() {
  const [open, setOpen] = useState<Record<TiSection, boolean>>({
    mj: false, kopare: false, forbered: false, likvid: false,
    dokument: false, filer: false, efterarbete: false, kapitalvinst: false,
  });
  const [done, setDone] = useState<Record<TiSection, boolean>>({
    mj: false, kopare: false, forbered: false, likvid: false,
    dokument: false, filer: false, efterarbete: false, kapitalvinst: false,
  });
  const toggle = (id: TiSection) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const toggleDone = (id: TiSection) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <div className="flex flex-col gap-2 pl-2">
      <TiSec id="mj" title="Mäklarjournal" badge="8" open={open.mj} onToggle={toggle} done={done.mj} onToggleDone={toggleDone}>
        <TiMjBody />
      </TiSec>
      <TiSec id="kopare" title="Köpare" open={open.kopare} onToggle={toggle} done={done.kopare} onToggleDone={toggleDone}>
        <TiKopareBody />
      </TiSec>
      <TiSec id="forbered" title="Förbered tillträde" open={open.forbered} onToggle={toggle} done={done.forbered} onToggleDone={toggleDone} helpLabel="Hjälp">
        <TiForberedBody />
      </TiSec>
      <TiSec id="likvid" title="Likvidavräkning" open={open.likvid} onToggle={toggle} done={done.likvid} onToggleDone={toggleDone} helpLabel="?">
        <TiLikvidBody />
      </TiSec>
      <TiSec id="dokument" title="Dokument" open={open.dokument} onToggle={toggle} done={done.dokument} onToggleDone={toggleDone} helpLabel="Hjälp - fullmakt    Hjälp - dokumentmanualer">
        <DokumentBody />
      </TiSec>
      <TiSec id="filer" title="Filer" open={open.filer} onToggle={toggle} done={done.filer} onToggleDone={toggleDone}>
        <FilerBody />
      </TiSec>
      <TiSec id="efterarbete" title="Efterarbete tillträde" open={open.efterarbete} onToggle={toggle} done={done.efterarbete} onToggleDone={toggleDone}>
        <TiEfterarbeteBody />
      </TiSec>
      <TiSec id="kapitalvinst" title="Kapitalvinst" open={open.kapitalvinst} onToggle={toggle} done={done.kapitalvinst} onToggleDone={toggleDone} helpLabel="Hjälp">
        <KapitalvinstBody />
      </TiSec>
    </div>
  );
}

function TiSec({
  id, title, badge, open, onToggle, done, onToggleDone, helpLabel, children,
}: {
  id: TiSection; title: string; badge?: string; open: boolean;
  onToggle: (id: TiSection) => void;
  done?: boolean; onToggleDone?: (id: TiSection) => void;
  helpLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span
            role="checkbox"
            aria-checked={!!done}
            onClick={(e) => { e.stopPropagation(); onToggleDone?.(id); }}
            title={done ? "Klart – klicka för att avmarkera" : "Markera som klart"}
            className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-[10px] transition-colors ${
              done
                ? "bg-emerald-500/25 text-emerald-700 hover:bg-emerald-500/35"
                : "border border-border bg-transparent text-transparent hover:border-emerald-500/60 hover:text-emerald-400/50"
            }`}
          >
            ✓
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{title}</span>
          {badge && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[10px] font-medium text-orange-300">
              {badge}
            </span>
          )}
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
        {helpLabel && <span className="text-[11px] text-primary/70">{helpLabel}</span>}
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

/* ---------- Mäklarjournal (Tillträde) ---------- */
const TI_MJ_ITEMS = [
  "Uppföljande kontroll av förfoganderätt, makemedgivande, inskrivningar, inteckningar, gemensamhetsanläggningar, andra rättigheter eller belastningar",
  "Kontroll och reglering av kommunal fastighetsavgift",
  "Likvidavräkning upprättad",
  "Överlämnat budgivningslista till säljare och köpare",
  "Överlämnat journal till säljare",
  "Överlämnat journal till köpare",
  "Köpebrev undertecknat av båda parter",
  "Uppdraget upphör",
];
function TiMjBody() {
  const [checked, setChecked] = useState<boolean[]>(() => TI_MJ_ITEMS.map(() => false));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <BtnPrimary>
          <span onClick={() => setChecked(TI_MJ_ITEMS.map(() => true))}>Ändra alla till utförda</span>
        </BtnPrimary>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" />
          Dölj den orangea 'varningsnotifieringen'
        </label>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {TI_MJ_ITEMS.map((label, i) => (
          <div key={i} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => setChecked((c) => c.map((v, j) => (i === j ? !v : v)))}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-orange-500/40 text-[11px] text-orange-300">+</span>
            <span className="flex-1">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Köpare ---------- */
function TiKopareBody() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <BtnPrimary>✎ Byt köparens adress</BtnPrimary>
        <BtnPrimary>+ Lägg till ny kontakt</BtnPrimary>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Sorteringsordning","Namn","Andel","Pers. nr./Org. nr.","Telefon","E-post","Adress","BankID","Aktivitet"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={9} className="px-3 py-6 text-xs text-muted-foreground">Inga poster</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Utskrift budgivningslista</h3>
        <div className="flex gap-2">
          <BtnPrimary>🖨 Utskrift budgivningslista</BtnPrimary>
          <BtnPrimary>✉ E-post</BtnPrimary>
        </div>
      </div>
    </div>
  );
}

/* ============================== Dokument ============================== */

type DokRow = { n: string; meta?: string; tag: string; tagCls: string; created: string; updated: string };

function getDokDocuments(isBrf: boolean): DokRow[] {
  const typLabel = isBrf ? "Bostadsrätt" : "Fastighet";
  return [
    { n: "Frågelistan", meta: "Import från kundenssida  Import från kundenssida", tag: "Licensdokument", tagCls: "bg-sky-500/15 text-sky-700", created: "2026-06-11", updated: "2026-06-12" },
    { n: `Förmedlingsuppdrag - ${typLabel}`, meta: "MSF 1.2  1.0", tag: "Licensdokument", tagCls: "bg-sky-500/15 text-sky-700", created: "2026-05-27", updated: "2026-05-27" },
    { n: `Intag - ${typLabel.toLowerCase()}`, meta: "Mspecs  1.0", tag: "MSF dokument", tagCls: "bg-amber-500/15 text-amber-700", created: "2026-05-27", updated: "2026-05-27" },
  ];
}

type DokFile = {
  ord: number; typ: string; ext: "pdf" | "png"; kategori: string; titel: string;
  beskrivning?: string; vInternet: boolean; vMarknad: boolean; vKund: boolean; uppladdad: string;
};

const DOK_FILES: DokFile[] = [
  { ord: 1, typ: "Fastighetsutdrag", ext: "pdf", kategori: "", titel: "HUDDINGE NYINGEN 5 2026-05-27 0931", vInternet: false, vMarknad: false, vKund: false, uppladdad: "2026-05-27 09:31" },
  { ord: 2, typ: "", ext: "pdf", kategori: "", titel: "Nordkyc 2026-05-27", beskrivning: "Nordkyc pdf", vInternet: false, vMarknad: false, vKund: false, uppladdad: "2026-05-27 11:47" },
  { ord: 3, typ: "", ext: "pdf", kategori: "", titel: "Areamätning", vInternet: true, vMarknad: false, vKund: false, uppladdad: "2026-06-12 09:57" },
  { ord: 4, typ: "Radon", ext: "pdf", kategori: "", titel: "Radonprotokoll", vInternet: true, vMarknad: false, vKund: false, uppladdad: "2026-06-12 09:57" },
  { ord: 5, typ: "Fastighetskarta", ext: "png", kategori: "", titel: "Fastighetskarta-2026-06-12", vInternet: true, vMarknad: false, vKund: false, uppladdad: "2026-06-12 09:58" },
  { ord: 6, typ: "Fastighetskarta", ext: "png", kategori: "", titel: "Flygfotokarta-2026-06-12", vInternet: true, vMarknad: false, vKund: false, uppladdad: "2026-06-12 09:58" },
];

function DokSection({
  title, children, defaultOpen = true, rightLinks,
}: { title: string; children: ReactNode; defaultOpen?: boolean; rightLinks?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-md border border-border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">{title}</span>
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
        {rightLinks && <div className="flex items-center gap-4 text-xs">{rightLinks}</div>}
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

function FileIcon({ ext }: { ext: "pdf" | "png" }) {
  const cls = ext === "pdf" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-700";
  return <span className={`inline-flex h-7 w-6 items-center justify-center rounded-sm text-[9px] font-bold uppercase ${cls}`}>{ext}</span>;
}

type UploadedFile = { name: string; ext: string; sizeKb: number; date: string };

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "fil";
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function DokumentView({ slug, onTabChange }: { slug: string; onTabChange: (tab: SideTab) => void }) {
  const isBrf = getObjektBySlug(slug)?.typ === "Bostadsrätt";
  const dokRef = useRef<HTMLInputElement>(null);
  const filRef = useRef<HTMLInputElement>(null);
  const [uploadedDok, setUploadedDok] = useState<UploadedFile[]>([]);
  const [uploadedFil, setUploadedFil] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(files: FileList | null, target: "dok" | "fil") {
    if (!files) return;
    const mapped: UploadedFile[] = Array.from(files).map((f) => ({
      name: f.name,
      ext: fileExt(f.name),
      sizeKb: Math.round(f.size / 1024),
      date: todayStr(),
    }));
    if (target === "dok") setUploadedDok((prev) => [...prev, ...mapped]);
    else setUploadedFil((prev) => [...prev, ...mapped]);
  }

  const blank = isUserCreatedSlug(slug);
  const baseDokFiles = blank ? [] : DOK_FILES;
  const allFiles = [...baseDokFiles.map((f, i) => ({ ...f, ord: i + 1 })), ...uploadedFil.map((f, i) => ({
    ord: baseDokFiles.length + i + 1,
    ext: (f.ext === "pdf" ? "pdf" : "png") as "pdf" | "png",
    typ: "Övrigt",
    titel: f.name,
    beskrivning: undefined as string | undefined,
    vInternet: false,
    vMarknad: false,
    vKund: false,
    uppladdad: f.date,
  }))];

  return (
    <div className="space-y-6">
      <input ref={dokRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.png" className="hidden" onChange={(e) => addFiles(e.target.files, "dok")} />
      <input ref={filRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files, "fil")} />

      <QuickNavBar onTabChange={onTabChange} />

      <DokSection
        title="Dokument"
        rightLinks={
          <>
            <span className="text-primary/80 hover:underline">Hjälp - fullmakt</span>
            <span className="text-primary/80 hover:underline">Hjälp - dokumentmanualer</span>
          </>
        }
      >
        <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <span>ℹ</span>
          <span>För att lära dig allt om dokumenthanteringen, lägg till dina dokument via knappen nedan.</span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <BtnPrimary onClick={() => dokRef.current?.click()}>+ Lägg till dokument</BtnPrimary>
          <BtnGhost>✉ Brev</BtnGhost>
          <BtnGhost>🧾 Kvitto</BtnGhost>
          <BtnGhost>📅 Faktura</BtnGhost>
          <BtnGhost>＋ Marknadsvärdering</BtnGhost>
          <BtnGhost>🔒 Skriv ut kundkännedom (via BankID)</BtnGhost>
          <BtnGhost>🔒 Mäklarjournal</BtnGhost>
          <BtnGhost>🔒 Utskrift budgivningslista</BtnGhost>
          <BtnGhost>🔒 Multiutskrift / E-post</BtnGhost>
          <BtnGhost>🔒 Spara till filer</BtnGhost>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Namn ↕</th>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 font-medium">Skapad ↕</th>
                <th className="px-3 py-2 font-medium">Ändrad ↕</th>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2"><input type="checkbox" className="h-4 w-4 accent-primary" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(blank ? [] : getDokDocuments(isBrf)).map((d) => (
                <tr key={d.n}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{d.n}</div>
                    {d.meta && <div className="text-xs text-muted-foreground">{d.meta}</div>}
                  </td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11px] ${d.tagCls}`}>{d.tag}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{d.created}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.updated}</td>
                  <td className="px-3 py-2 text-muted-foreground">✉</td>
                  <td className="px-3 py-2 text-muted-foreground">📄 ⚙</td>
                  <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4 accent-primary" /></td>
                </tr>
              ))}
              {uploadedDok.map((f, i) => (
                <tr key={`up-${i}`} className="bg-primary/5">
                  <td className="px-3 py-2">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.sizeKb} KB</div>
                  </td>
                  <td className="px-3 py-2"><span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">Uppladdad</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{f.date}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.date}</td>
                  <td className="px-3 py-2 text-muted-foreground">✉</td>
                  <td className="px-3 py-2 text-muted-foreground">📄 ⚙</td>
                  <td className="px-3 py-2"><input type="checkbox" className="h-4 w-4 accent-primary" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DokSection>

      <DokSection title="Filer">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files, "fil"); }}
          onClick={() => filRef.current?.click()}
          className={[
            "mb-4 flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed text-sm transition-colors",
            dragOver
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground",
          ].join(" ")}
        >
          {dragOver ? "Släpp filer här" : "Dra filer hit eller klicka för att ladda upp"}
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <BtnPrimary onClick={() => filRef.current?.click()}>+ Lägg till</BtnPrimary>
            <BtnGhost>🔒 Multiutskrift / E-post</BtnGhost>
          </div>
          <div className="flex flex-wrap gap-2">
            <BtnGhost>🗺 Beställ lantmäterikarta</BtnGhost>
            <BtnGhost>🗺 Beställ från Lantmäteriet</BtnGhost>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Sort.","Typ","Kategori","Titel","Beskrivning","Visa på internet","Visa på marknadsdokument","Visas på Kundens sida","Källa","Uppladdad","Aktivitet","Välj"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allFiles.map((f) => (
                <tr key={f.ord}>
                  <td className="px-3 py-2">
                    <select defaultValue={String(f.ord)} className="w-14 rounded-md border border-border bg-background/40 px-2 py-1 text-xs">
                      {allFiles.map((_, j) => <option key={j}>{j + 1}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><FileIcon ext={f.ext} /></td>
                  <td className="px-3 py-2">{f.typ}</td>
                  <td className="px-3 py-2">{f.titel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.beskrivning ?? ""}</td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked={f.vInternet} className="h-4 w-4 accent-primary" /></td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked={f.vMarknad} className="h-4 w-4 accent-primary" /></td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked={f.vKund} className="h-4 w-4 accent-primary" /></td>
                  <td className="px-3 py-2 text-muted-foreground"></td>
                  <td className="px-3 py-2 text-muted-foreground">{f.uppladdad}</td>
                  <td className="px-3 py-2 text-muted-foreground">⚙</td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" className="h-4 w-4 accent-primary" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1 text-xs text-muted-foreground">
          {["10","25","50","100"].map((n) => (
            <span key={n} className={`cursor-pointer rounded px-2 py-1 ${n === "25" ? "bg-primary/20 text-primary" : "hover:bg-foreground/5"}`}>{n}</span>
          ))}
        </div>
      </DokSection>

      <DokSection title="Webbadresser">
        <div className="mb-3 flex justify-end">
          <BtnPrimary>+ Lägg till</BtnPrimary>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["#","Titel","Visa på internet","URL","Kategori","URL beskrivning","Aktivitet"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Inga poster</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DokSection>
    </div>
  );
}

/* ============================== Mäklarräkenskap ============================== */

function MrField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function MrInput({ value, suffix, placeholder, className }: { value?: string; suffix?: string; placeholder?: string; className?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        defaultValue={value}
        placeholder={placeholder}
        className={`rounded-md border border-border bg-background/40 px-3 py-2 text-right text-sm focus:border-primary/40 focus:outline-none ${className ?? "w-32"}`}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function MrRadio({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
}

function MrProvisionBody() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MrField label="Provision beräknat betaldatum">
          <input type="date" className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none" />
        </MrField>
        <MrField label="Provision betaldatum">
          <input type="date" className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none" />
        </MrField>
      </div>

      <div className="text-xs text-muted-foreground">Alla belopp anges inkl. moms.</div>

      <div className="flex flex-wrap items-center gap-6">
        <MrRadio name="prov-typ" label="Fastprisuppdrag" />
        <MrRadio name="prov-typ" label="Procent" />
        <MrRadio name="prov-typ" label="Fastprisuppdrag och procent" defaultChecked />
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Arvode</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MrField label="Belopp exkl. moms"><MrInput value="60 000" suffix="SEK" /></MrField>
          <MrField label="Belopp inkl. moms"><MrInput value="75 000" suffix="SEK" /></MrField>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Procent</div>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-5">
          <MrField label="Exkl. moms"><MrInput value="12" suffix="%" className="w-20" /></MrField>
          <MrField label="Inkl. moms"><MrInput value="15" suffix="%" className="w-20" /></MrField>
          <MrField label="Från"><MrInput value="5 800 000" suffix="SEK" /></MrField>
          <MrField label="Till"><MrInput suffix="SEK" /></MrField>
          <div className="flex items-end gap-2 pb-1">
            <button className="grid h-7 w-7 place-items-center rounded-full border border-border text-sm">−</button>
            <button className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">+</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
        <div className="text-sm font-medium">Övre gräns för provision</div>
        <MrField label="Belopp exkl. moms"><MrInput value="0" suffix="SEK" /></MrField>
        <MrField label="Belopp inkl. moms"><MrInput value="0" suffix="SEK" /></MrField>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-4">
        <div className="text-sm font-medium">Rabatt</div>
        <MrField label="Belopp exkl. moms"><MrInput value="0" suffix="SEK" /></MrField>
        <MrField label="Belopp inkl. moms"><MrInput value="0" suffix="SEK" /></MrField>
        <label className="flex items-center gap-2 pb-1 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-primary" />
          Procent
        </label>
      </div>

      <div className="space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Total provision inkl. moms</span><span className="font-medium">75 000 SEK</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Provisionen baseras på startpriset</span><span>4 975 000 SEK</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Momssats</span><span>25 %</span></div>
      </div>
    </div>
  );
}

function MrDelningBody() {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Delning av provision/arvode</div>
      <div className="flex flex-wrap items-center gap-3">
        <MrInput value="0.00" suffix="% Till" className="w-24" />
        <input
          placeholder=""
          className="h-10 flex-1 min-w-[240px] rounded-md border border-border bg-background/40 px-3 text-sm focus:border-primary/40 focus:outline-none"
        />
        <BtnPrimary>Välj medarbetare</BtnPrimary>
      </div>
    </div>
  );
}

function MrUppdragskostnaderBody() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Provision utan moms</span>
        <span className="font-medium">60 000 SEK</span>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium">Intäkter exkl. moms.</div>
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <MrField label="Titel">
              <input placeholder="Namn på kostnad" className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none" />
            </MrField>
            <MrField label="Kostnad"><MrInput value="0" className="w-full" /></MrField>
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Kostnader exkl. moms.</div>
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <MrField label="Titel">
              <input placeholder="Namn på kostnad" className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none" />
            </MrField>
            <MrField label="Kostnad"><MrInput value="0" className="w-full" /></MrField>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Summa intäkter</span>
          <span className="font-medium">60 000 SEK</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Summa netto</span>
          <span className="font-medium">60 000 SEK</span>
        </div>
      </div>
    </div>
  );
}

function MaklarrakenskapView({ onTabChange }: { onTabChange: (tab: SideTab) => void }) {
  return (
    <div className="space-y-6">
      <QuickNavBar onTabChange={onTabChange} />
      <DokSection title="Provision"><MrProvisionBody /></DokSection>
      <DokSection title="Delning av provision/arvode" defaultOpen={false}><MrDelningBody /></DokSection>
      <DokSection title="Uppdragskostnader" defaultOpen={false}><MrUppdragskostnaderBody /></DokSection>
    </div>
  );
}

/* ---------- Förbered tillträde ---------- */
function TiForberedBody() {
  const { slug } = Route.useParams();

  function openKallelse() {
    const emails = getPartyEmails(slug);
    const kontrakt = getKontrakt(slug);
    const adress = listObjekt().find((o) => o.id === slug)?.adress || slug;
    const subject = `Kallelse till tillträde – ${adress}`;
    const body = `Hej!\n\nDu kallas härmed till tillträde av ${adress}.\n\nTillträdesdatum: ${kontrakt.tilltradesdatum || "(datum ej satt)"}\n\nMed vänliga hälsningar,\nErik Lindqvist`;
    window.open(buildMailto(emails, subject, body), "_blank");
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <BtnPrimary onClick={openKallelse}>✉ E-post kallelse</BtnPrimary>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tillträdesplats" hint="(För kallelser, dokument mm)"><Input /></Field>
        <Field label="Handläggare"><Input /></Field>
        <Field label="Köparens bank"><Input /></Field>
        <Field label="Handläggare på köparens bank"><Input /></Field>
        <Field label="Tillträdesdatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
        <Field label="Bankens kontaktuppgifter">
          <textarea className="h-20 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
        </Field>
        <Field label="Tillträdestid säljare"><Input placeholder="HH:MM" /></Field>
        <Field label="Tillträdestid köpare"><Input placeholder="HH:MM" /></Field>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lån</h3>
          <div className="flex gap-2">
            <BtnGhost>Manual Tambur</BtnGhost>
            <BtnPrimary>Tambur</BtnPrimary>
            <BtnPrimary>+ Lägg till</BtnPrimary>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["#","Typ av lån","Lånekategori","Datum för lånekontroll","Långivare","Lånenummer","Belopp (SEK)","Total lösenkostnad","Aktivitet"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody><tr><td colSpan={9} className="px-3 py-6 text-xs text-muted-foreground">Inga poster</td></tr></tbody>
          </table>
        </div>
      </div>

      <Field label="Kommentar">
        <textarea className="h-24 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
    </div>
  );
}

/* ---------- Likvidavräkning ---------- */
function TiLikvidBody() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"Gemensam" | "Säljare" | "Köpare">("Gemensam");

  function openLikvidKallelse() {
    const emails = getPartyEmails(slug);
    const kontrakt = getKontrakt(slug);
    const adress = listObjekt().find((o) => o.id === slug)?.adress || slug;
    const subject = `Tillträdesmöte och likvidavräkning – ${adress}`;
    const body = `Hej!\n\nHärmed kallas du till tillträdesmöte och likvidavräkning för ${adress}.\n\nTillträdesdatum: ${kontrakt.tilltradesdatum || "(datum ej satt)"}\n\nMed vänliga hälsningar,\nErik Lindqvist`;
    window.open(buildMailto(emails, subject, body), "_blank");
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-border bg-background/40 p-1">
          {(["Gemensam","Säljare","Köpare"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
          <label className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
            <input type="checkbox" className="h-3.5 w-3.5 accent-primary" />
            Klart för tillträde
          </label>
        </div>
        <div className="flex gap-2">
          <BtnPrimary>🖨 Skriv ut likvid</BtnPrimary>
          <BtnPrimary>✎ E-signatur</BtnPrimary>
          <BtnPrimary onClick={openLikvidKallelse}>✉ E-post kallelse och likvid</BtnPrimary>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Information om köpeskilling</h3>
        <div className="grid items-end gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Slutpris"><Input placeholder="0" suffix="SEK" /></Field>
          <BtnGhost>Manuell beloppstext</BtnGhost>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Betalad handpenning (till mäklarens klientmedelskonto eller direkt till säljaren)">
          <Input placeholder="Betalad handpenn" suffix="SEK" />
        </Field>
        <Field label="Betaldatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
        <Field label="Provision betaldatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
      </div>

      <div className="space-y-2">
        <Checkbox label="Handpenningen deponeras på mäklarens klientmedelskonto" defaultChecked />
        <Checkbox label='Visa endast "Redovisas separat"' />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Utbetalningar av deponerad handpenning</h3>
          <BtnPrimary>+ Lägg till</BtnPrimary>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["#","Bankkontonummer","Transaktionsdatum","Belopp (SEK)","Kommentar","Aktivitet"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody><tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Inga utbetalningar</td></tr></tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-orange-500/40 bg-orange-500/15 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Total provision inkl. moms.","75 000 SEK"],
            ["Moms","15 000 SEK"],
            ["Provisionen baseras på slutpriset","4 975 000 SEK"],
            ["Summa exkl. moms.","60 000 SEK"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="font-medium text-orange-100">{k}</span>
              <span className="text-orange-100">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Efterarbete tillträde ---------- */
function TiEfterarbeteBody() {
  const { slug } = Route.useParams();
  const demoSaljare = getDemoSaljare(slug);
  const andel = demoSaljare.length === 1 ? "1/1" : "1/2";
  const sellers = demoSaljare.map((s, i) => ({
    n: s.namn, a: andel, pnr: s.pnr, db: "Nej",
    tel: s.telefon, mail: s.email, adr: sellerAddress(slug, i), ks: "Ja",
  }));
  const customer = [
    { k: "Underlag kapitalvinst", s: "Ändrad av kund", sCls: "bg-amber-500/20 text-amber-200", u: "2026-06-09 00:24" },
    { k: "Driftskostnader", s: "Granskad & importerad", sCls: "bg-emerald-500/20 text-emerald-200", u: "" },
    { k: "Frågelista", s: "Granskad & importerad", sCls: "bg-emerald-500/20 text-emerald-200", u: "" },
    { k: "Bilder & Dokument", s: "Tillgänglig", sCls: "bg-sky-500/20 text-sky-200", u: "Ingen ny data från säljare" },
    { k: "Byggnadsinformation", s: "Granskad & importerad", sCls: "bg-emerald-500/20 text-emerald-200", u: "" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <BtnGhost>Fördela andelar</BtnGhost>
        <BtnPrimary>+ Lägg till säljare</BtnPrimary>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Sort.","Namn","Andel","Pers. nr.","Dödsbo","Telefon","E-post","Adress","BankID","Kundenssida","Aktivitet"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sellers.map((s, i) => (
              <tr key={s.n}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">{s.n}</td>
                <td className="px-3 py-2">{s.a}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.pnr}</td>
                <td className="px-3 py-2">{s.db}</td>
                <td className="px-3 py-2 text-muted-foreground">📞 {s.tel}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.mail} ✉</td>
                <td className="px-3 py-2 text-muted-foreground">{s.adr}</td>
                <td className="px-3 py-2"><span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700">BankID ✓</span></td>
                <td className="px-3 py-2">{s.ks}</td>
                <td className="px-3 py-2 text-muted-foreground">⚙</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Kundens sida</h3>
          <BtnGhost>Besök Kundens Sida ↗</BtnGhost>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Synlig för kund","Kategori","Status","Uppdaterad","Kan kunden ändra?","Skicka igen?"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customer.map((c) => (
                <tr key={c.k}>
                  <td className="px-3 py-2"><input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" /></td>
                  <td className="px-3 py-2">{c.k}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11px] ${c.sCls}`}>{c.s}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{c.u}</td>
                  <td className="px-3 py-2 text-muted-foreground">🔒</td>
                  <td className="px-3 py-2"><button className="rounded bg-primary/80 px-2 py-1 text-xs text-primary-foreground">✉</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Uppdrag ---------- */

function UppdragBody({ adress }: { adress: string }) {
  const o = getObjektBySlug(slugifyAddr(adress));
  const prisStr = o?.pris ? o.pris.toLocaleString("sv-SE") : "0";
  const statusStr = o?.status ?? "Under intag";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <BtnGhost>Beställ lantmäterikarta</BtnGhost>
        <BtnGhost>Beställ från Lantmäteriet</BtnGhost>
      </div>
      <Field label="Uppdragsnamn"><Input value={propertyFullAddr(slugifyAddr(adress))} /></Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox label="Utland" />
        <Checkbox label="Marknadsförs som nyproduktion" />
        <Checkbox label="Rapportera ej till statistiktjänster" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Status"><Select value={statusStr} options={["Under intag", "Till salu", "Sålt", "Avslutat"]} /></Field>
        <Field label="Kontraktstyp"><Select value="Förmedling" options={["Förmedling", "Skrivuppdrag"]} /></Field>
        <Field label="Datum för intagsbesök"><Input value="2026-05-27" /></Field>
        <Field label="Eget nummer / arkiv-id"><Input placeholder="—" /></Field>
        <Field label="Uppdraget startar"><Input value="2026-05-27" /></Field>
        <Field label="Ensamrättstid t.o.m"><Input value="2026-08-25" /></Field>
        <Field label="Pris"><Input value={prisStr} suffix="SEK" /></Field>
        <Field label="Pris i annan valuta"><Input value="0" suffix="EUR" /></Field>
        <Field label="Pristyp"><Select value="Utgångspris" options={["Utgångspris", "Acceptpris", "Fast pris"]} /></Field>
        <Field label="Valuta i uppdraget"><Select value="SEK" options={["SEK", "EUR", "USD"]} /></Field>
        <Field label="Tillträde"><Input value="Enligt överenskommelse" /></Field>
        <Field label="Huvudfastighet"><Input placeholder="—" /></Field>
      </div>
      <Field label="Information om försäljningen">
        <textarea rows={4} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
    </div>
  );
}

/* ---------- Värdering ---------- */

function VarderingBody() {
  const [tab, setTab] = useState<"data" | "valueguard">("data");
  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-border">
        {[["data", "Värderingsdata"], ["valueguard", "Valueguard"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={["px-3 py-2 text-sm transition-colors", tab === id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
            {label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {tab === "data" ? "Här kan du beställa Värderingsdatas tjänster." : "Här kan du beställa Valueguards tjänster."}
      </p>
      <BtnPrimary>Till {tab === "data" ? "Värderingsdatas" : "Valueguards"} tjänst</BtnPrimary>
    </div>
  );
}

/* ---------- Provision ---------- */

function ProvisionBody() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Provision beräknat betaldatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
        <Field label="Provision betaldatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
      </div>
      <p className="text-xs text-muted-foreground">Alla belopp anges inkl. moms.</p>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="prov" className="accent-primary" />Fastprisuppdrag</label>
        <label className="flex items-center gap-2"><input type="radio" name="prov" className="accent-primary" />Procent</label>
        <label className="flex items-center gap-2"><input type="radio" name="prov" defaultChecked className="accent-primary" />Fastprisuppdrag och procent</label>
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Arvode</div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Belopp exkl. moms"><Input value="60 000" suffix="SEK" readOnly /></Field>
          <Field label="Belopp inkl. moms"><Input value="75 000" suffix="SEK" /></Field>
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Procent</div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Exkl. moms"><Input value="12" suffix="%" /></Field>
          <Field label="Inkl. moms"><Input value="15" suffix="%" /></Field>
          <Field label="Från"><Input value="5 800 000" suffix="SEK" /></Field>
          <Field label="Till"><Input placeholder="—" suffix="SEK" /></Field>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Övre gräns för provision (exkl. moms)"><Input value="0" suffix="SEK" /></Field>
        <Field label="Övre gräns för provision (inkl. moms)"><Input value="0" suffix="SEK" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Rabatt exkl. moms"><Input value="0" suffix="SEK" /></Field>
        <Field label="Rabatt inkl. moms"><Input value="0" suffix="SEK" /></Field>
      </div>
      <div className="rounded-md border border-border bg-background/40 p-4 text-sm">
        <div className="grid gap-1 md:grid-cols-2">
          <span className="text-muted-foreground">Total provision inkl. moms.</span><span>75 000 SEK</span>
          <span className="text-muted-foreground">Provisionen baseras på startpriset</span><span>4 975 000 SEK</span>
          <span className="text-muted-foreground">Momssats</span><span>25 %</span>
          <span className="text-muted-foreground">Moms</span><span>15 000 SEK</span>
          <span className="text-muted-foreground">Summa exkl. moms.</span><span>60 000 SEK</span>
        </div>
      </div>
      <Field label="Kommentar">
        <textarea rows={3} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
    </div>
  );
}

/* ---------- Dokument ---------- */

function DokumentBody() {
  const { slug } = Route.useParams();
  const isBrf = getObjektBySlug(slug)?.typ === "Bostadsrätt";
  const typLabel = isBrf ? "Bostadsrätt" : "Fastighet";
  const docs = [
    { n: "Frågelistan", k: "Licensdokument", c: "2026-06-11", u: "2026-06-12" },
    { n: `Förmedlingsuppdrag – ${typLabel}`, k: "Licensdokument", c: "2026-05-27", u: "2026-05-27" },
    { n: `Intag – ${typLabel.toLowerCase()}`, k: "MSF dokument", c: "2026-05-27", u: "2026-05-27" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <BtnPrimary>+ Lägg till dokument</BtnPrimary>
        <BtnGhost>✉ Brev</BtnGhost>
        <BtnGhost>Kvitto</BtnGhost>
        <BtnGhost>Faktura</BtnGhost>
        <BtnGhost>+ Marknadsvärdering</BtnGhost>
        <BtnGhost>Skriv ut kundkännedom (via BankID)</BtnGhost>
        <BtnGhost>Mäklarjournal</BtnGhost>
        <BtnGhost>Utskrift budgivningslista</BtnGhost>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Namn</th>
              <th className="px-3 py-2 text-left">Skapad</th>
              <th className="px-3 py-2 text-left">Ändrad</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {docs.map((d) => (
              <tr key={d.n}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">PDF</span>
                    {d.n}
                    <span className="ml-2 rounded bg-foreground/[0.05] px-1.5 py-0.5 text-[10px] text-muted-foreground">{d.k}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{d.c}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.u}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">⋯</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Filer ---------- */

function FilerBody() {
  const files = [
    { t: "Fastighetsutdrag", titel: "HUDDINGE NYINGEN 5 2026-05-27 0931", net: false, mark: false, kund: false, d: "2026-05-27" },
    { t: "", titel: "Nordkyc 2026-05-27", besk: "Nordkyc pdf", net: false, mark: false, kund: false, d: "2026-05-27" },
    { t: "", titel: "Areamätning", net: true, mark: false, kund: false, d: "2026-06-12" },
    { t: "Radon", titel: "Radonprotokoll", net: true, mark: false, kund: false, d: "2026-06-12" },
    { t: "Fastighetskarta", titel: "Fastighetskarta-2026-06-12", net: true, mark: false, kund: false, d: "2026-06-12" },
    { t: "Fastighetskarta", titel: "Flygfotokarta-2026-06-12", net: true, mark: false, kund: false, d: "2026-06-12" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-md border-2 border-dashed border-border bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
        Dra filer hit för att ladda upp
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <BtnPrimary>+ Lägg till</BtnPrimary>
          <BtnGhost>Multiutskrift / e-post</BtnGhost>
        </div>
        <div className="flex gap-2">
          <BtnGhost>Beställ lantmäterikarta</BtnGhost>
          <BtnGhost>Beställ från Lantmäteriet</BtnGhost>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Kategori</th>
              <th className="px-3 py-2 text-left">Titel</th>
              <th className="px-3 py-2 text-left">Beskrivning</th>
              <th className="px-3 py-2 text-center">Internet</th>
              <th className="px-3 py-2 text-center">Marknadsdok.</th>
              <th className="px-3 py-2 text-center">Kundsida</th>
              <th className="px-3 py-2 text-left">Uppladdad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {files.map((f, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.t || "—"}</td>
                <td className="px-3 py-2">{f.titel}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.besk || ""}</td>
                <td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked={f.net} className="h-4 w-4 accent-primary" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked={f.mark} className="h-4 w-4 accent-primary" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked={f.kund} className="h-4 w-4 accent-primary" /></td>
                <td className="px-3 py-2 text-muted-foreground">{f.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Tjänster ---------- */

function TjansterBody() {
  const active = [
    { name: "Rebel Elhandel AB", desc: "El och försäkring", status: "Aktiva", d: "2026-05-27" },
    { name: "Nordkyc", desc: "KYC-kontroll", status: "Pågående", d: "2026-05-27" },
    { name: "VärderingsData", desc: "Värdering", status: "Aktiverad", d: "2026-06-13" },
  ];
  const avail = ["Sustera", "OBM-Gruppen", "Cowrite", "EFKT", "Valueguard", "Broker market", "FastOut", "Realforce", "Diakrit", "SE360", "SE-Print", "Anticimex", "HF Agency (Husfoto)", "Room Sketcher", "WTW"];
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        I fliken tjänster kan ni aktivera och/eller beställa tjänster från externa leverantörer.
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Aktiverade tjänster</div>
        <div className="grid gap-3 md:grid-cols-3">
          {active.map((a) => (
            <div key={a.name} className="rounded-md border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">{a.name}</div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700">{a.status}</span>
              </div>
              <div className="mb-2 text-xs text-muted-foreground">{a.desc}</div>
              <div className="text-[11px] text-muted-foreground">Senast updaterad: {a.d}</div>
              <button className="mt-3 w-full rounded-md border border-border py-1.5 text-xs hover:border-primary/40 hover:text-primary">Beställ</button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Tillgängliga tjänster</div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {avail.map((a) => (
            <div key={a} className="rounded-md border border-border bg-card p-3">
              <div className="mb-2 font-medium">{a}</div>
              <button className="w-full rounded-md border border-border py-1.5 text-xs hover:border-primary/40 hover:text-primary">Beställ</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Kapitalvinst ---------- */

function KapitalvinstBody() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="kv" defaultChecked className="accent-primary" />Småhus K5-beräkning</label>
          <label className="flex items-center gap-2"><input type="radio" name="kv" className="accent-primary" />Näringsfastighet K7-beräkning</label>
        </div>
        <div className="flex gap-2">
          <BtnGhost>Hämta data från uppdraget</BtnGhost>
          <BtnPrimary>Skriv ut blankett för underlag</BtnPrimary>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="kv2" defaultChecked className="accent-primary" />Beloppen nedan är gemensamma</label>
        <label className="flex items-center gap-2"><input type="radio" name="kv2" className="accent-primary" />Beloppen nedan är individuella</label>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Försäljning</div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Kontraktsdatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
          <Field label="Försäljningspris"><Input placeholder="0" suffix="SEK" /></Field>
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Försäljningsutgifter</div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provision"><Input value="75 000" suffix="SEK" /></Field>
          <Field label="Värdering"><Input placeholder="0" suffix="SEK" /></Field>
          <Field label="Besiktning"><Input placeholder="0" suffix="SEK" /></Field>
          <Field label="Övrigt"><Input placeholder="0" suffix="SEK" /></Field>
        </div>
        <div className="mt-3 text-right text-sm text-muted-foreground">Summa försäljningsutgifter: <span className="text-foreground">−75 000 SEK</span></div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Inköp</div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Kontraktsdatum"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
          <Field label="Inköpspris"><Input placeholder="0" suffix="SEK" /></Field>
          <Field label="Taxeringsvärde 1952"><Input placeholder="0" suffix="SEK" /></Field>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared empty ---------- */

function EmptyBody({ label, actionLabel }: { label: string; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
      <span>{label}</span>
      {actionLabel && <BtnPrimary>{actionLabel}</BtnPrimary>}
    </div>
  );
}

/* ============================================================
   OBJEKTSINFO VIEW
   ============================================================ */

type OiSection =
  | "uppdrag" | "grunddata" | "boarea" | "byggnad"
  | "el" | "ovrigt" | "rum" | "bilder"
  | "nycklar" | "naromrade" | "omradesbesk";

function ObjektsinfoView({ adress, slug }: { adress: string; slug: string }) {
  const blank = isUserCreatedSlug(slug);
  const objTyp = getObjektBySlug(slug)?.typ;
  const isBrf = objTyp === "Bostadsrätt";
  const [open, setOpen] = useState<Record<OiSection, boolean>>({
    uppdrag: true, grunddata: true, boarea: true, byggnad: true,
    el: true, ovrigt: true, rum: true, bilder: true,
    nycklar: true, naromrade: true, omradesbesk: true,
  });
  const toggle = (id: OiSection) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const [done, setDone] = useState<Record<OiSection, boolean>>(
    blank
      ? {
          uppdrag: false, grunddata: false, boarea: false, byggnad: false,
          el: false, ovrigt: false, rum: false, bilder: false,
          nycklar: false, naromrade: false, omradesbesk: false,
        }
      : {
          uppdrag: false, grunddata: true, boarea: true, byggnad: true,
          el: false, ovrigt: false, rum: true, bilder: true,
          nycklar: false, naromrade: true, omradesbesk: true,
        }
  );
  const toggleDone = (id: OiSection) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <BlankCtx.Provider value={blank}>
    <div className="flex flex-col gap-2 pl-2">
      <OiSec id="uppdrag" title="Uppdrag" open={open.uppdrag} onToggle={toggle} done={done.uppdrag} onToggleDone={toggleDone}>
        <UppdragBody adress={adress} />
      </OiSec>
      <OiSec id="grunddata" title="Grunddata" open={open.grunddata} onToggle={toggle} done={done.grunddata} onToggleDone={toggleDone}>
        <GrunddataBody adress={adress} slug={slug} />
      </OiSec>
      <OiSec id="boarea" title="Boarea & rumsantal" open={open.boarea} onToggle={toggle} done={done.boarea} onToggleDone={toggleDone}>
        <BoareaBody slug={slug} />
      </OiSec>
      <OiSec id="byggnad" title="Byggnad" open={open.byggnad} onToggle={toggle} done={done.byggnad} onToggleDone={toggleDone}>
        <ByggnadBody isBrf={isBrf} />
      </OiSec>
      <OiSec id="el" title="El, uppvärmning & ventilation" open={open.el} onToggle={toggle} done={done.el} onToggleDone={toggleDone}>
        <ElBody />
      </OiSec>
      <OiSec id="ovrigt" title="Parkering, uteplats & övrigt" open={open.ovrigt} onToggle={toggle} done={done.ovrigt} onToggleDone={toggleDone}>
        <OvrigtBody />
      </OiSec>
      <OiSec id="rum" title="Rum" open={open.rum} onToggle={toggle} done={done.rum} onToggleDone={toggleDone}>
        <RumBody slug={slug} />
      </OiSec>
      <OiSec id="bilder" title="Bilder" open={open.bilder} onToggle={toggle} done={done.bilder} onToggleDone={toggleDone}>
        <BilderSectionBody slug={slug} />
      </OiSec>
      <OiSec id="nycklar" title="Nycklar och larm" open={open.nycklar} onToggle={toggle} done={done.nycklar} onToggleDone={toggleDone}>
        <NycklarBody />
      </OiSec>
      <OiSec id="naromrade" title="Närområde" open={open.naromrade} onToggle={toggle} done={done.naromrade} onToggleDone={toggleDone}>
        <NaromradeBody adress={adress} />
      </OiSec>
      <OiSec id="omradesbesk" title="Områdesbeskrivning" open={open.omradesbesk} onToggle={toggle} done={done.omradesbesk} onToggleDone={toggleDone}>
        <OmradesbeskBody />
      </OiSec>

      {/* Objektsbeskrivning längst ner — används för kontrakt */}
      <div className="mt-2 rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Objektsbeskrivning</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/60">Används vid kontrakt och juridiska dokument</div>
        </div>
        <div className="p-4">
          <ObjektsbeskrivningView adress={adress} slug={slug} />
        </div>
      </div>
    </div>
    </BlankCtx.Provider>
  );
}

function OiSec({
  id, title, open, onToggle, done, onToggleDone, children,
}: {
  id: OiSection; title: string; open: boolean;
  onToggle: (id: OiSection) => void;
  done?: boolean; onToggleDone?: (id: OiSection) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span
            role="checkbox"
            aria-checked={!!done}
            aria-label={done ? `Markera ${title} som ej klar` : `Markera ${title} som klar`}
            title={done ? "Klart – klicka för att avmarkera" : "Markera som klart"}
            onClick={(e) => { e.stopPropagation(); onToggleDone?.(id); }}
            className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-[10px] transition-colors ${
              done
                ? "bg-emerald-500/25 text-emerald-700 hover:bg-emerald-500/35"
                : "border border-border bg-transparent text-transparent hover:border-emerald-500/60 hover:text-emerald-400/50"
            }`}
          >
            ✓
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{title}</span>
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

/* ---------- Grunddata ---------- */

function GrunddataBody({ adress, slug }: { adress: string; slug: string }) {
  const blank = useContext(BlankCtx);
  const o = getObjektBySlug(slug);
  // Sync from the saved objekt the user typed in (typ, postnr, stad, boarea, rum)
  const isBrf = o?.typ === "Bostadsrätt";
  const upplatelse = isBrf ? "Bostadsrätt" : "Friköpt";
  const objektstyp = o?.typ ?? "Villa";
  const kategori = isBrf ? "Bostadsrätt" : "Småhus";
  const gatu = blank ? (o?.adress ?? adress) : adress;
  const postnr = o?.postnr ?? (blank ? "" : "12345");
  const ort = o?.stad ?? (blank ? "" : "Stockholm");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <BtnGhost>Beställ lantmäterikarta</BtnGhost>
        <BtnGhost>Beställ från Lantmäteriet</BtnGhost>
      </div>
      <div className="flex flex-wrap gap-6">
        <Checkbox label="Del av" />
        <Checkbox label="Andelsrätt" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Upplåtelse"><Select value={upplatelse} options={["Friköpt", "Tomträtt", "Arrende", "Bostadsrätt"]} /></Field>
        <Field label="Objektstyp"><Select value={objektstyp} options={["Villa", "Radhus", "Kedjehus", "Parhus", "Fritidshus", "Bostadsrätt", "Lägenhet"]} /></Field>
        <Field label="Objektskategori"><Select value={kategori} options={["Småhus", "Bostadsrätt", "Tomt", "Näringsfastighet"]} /></Field>
        <Field label="Typkod"><Select value={isBrf ? "320 - Hyreshusenhet, bostäder" : "220 - Småhusenhet, bebyggd"} options={["220 - Småhusenhet, bebyggd", "210 - Småhusenhet, obebyggd", "320 - Hyreshusenhet, bostäder"]} /></Field>
        <Field label="Fastighetsbeteckning"><Input value={blank ? "" : "HUDDINGE NYINGEN 5"} placeholder={blank ? "—" : undefined} /></Field>
        <Field label="Gatuadress"><Input value={gatu} /></Field>
        <Field label="Län"><Select value={blank ? "" : "Stockholm"} options={["Stockholm", "Uppsala", "Södermanland", "Västra Götaland", "Skåne"]} /></Field>
        <Field label="Postnummer"><Input value={postnr} placeholder={blank ? "—" : undefined} /></Field>
        <Field label="Kommun"><Select value={blank ? "" : "Huddinge"} options={["Huddinge", "Stockholm", "Nacka", "Solna", "Sollentuna"]} /></Field>
        <Field label="Ort"><Input value={ort} placeholder={blank ? "—" : undefined} /></Field>
        <Field label="Distrikt"><Input placeholder="—" /></Field>
        <Field label="Område"><Input value={blank ? "" : "Länna"} placeholder={blank ? "—" : undefined} /></Field>
      </div>
      {!isBrf && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tomtareal/mark"><Input value={blank ? "" : "1 994,5"} suffix="m²" /></Field>
            <Field label="Tomtarealuppgifter enligt"><Input value={blank ? "" : "Lantmäteriet"} placeholder={blank ? "—" : undefined} /></Field>
            <Field label="Vattenareal"><Input placeholder="0" suffix="m²" /></Field>
            <Field label="Totalareal"><Input value={blank ? "" : "1 994,5"} suffix="m²" /></Field>
          </div>
          <Field label="Tomtbeskrivning">
            <textarea rows={3} defaultValue={blank ? "" : "Stor och uppvuxen trädgårdstomt med gott om plats för både lek, odling och avkoppling. Tomten präglas av generösa gräsytor, slingrande gångar och en rik variation av träd, buskar och planteringar som skapar en grönskande och privat miljö."} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
          </Field>
        </>
      )}
    </div>
  );
}

/* ---------- Boarea ---------- */

function BoareaBody({ slug }: { slug?: string }) {
  const blank = useContext(BlankCtx);
  const o = slug ? getObjektBySlug(slug) : undefined;
  const isBrf = o?.typ === "Bostadsrätt";
  const boarea = blank ? (o?.boarea ? String(o.boarea) : "") : "69";
  const rum = blank ? (o?.rum ? String(o.rum) : "") : "4";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center"><Checkbox label="Visa ca framför Boarea" /></div>
        <Field label="Areauppgift enligt"><Input value={blank ? "" : "Mätning"} placeholder={blank ? "—" : undefined} /></Field>
        <Field label="Boarea"><Input value={boarea} suffix="m²" /></Field>
        <Field label="Byggnadsarea"><Input placeholder="0" suffix="m²" /></Field>
        <Field label="Biarea (BIA)"><Input value={blank ? "" : "65"} suffix="m²" /></Field>
        <Field label="Bruksarea (BRA)"><Input placeholder="0" suffix="m²" /></Field>
      </div>
      <Field label="Boareabeskrivning">
        <textarea rows={2} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Antal rum"><Input value={rum} /></Field>
        <Field label="Antal sovrum"><Input value={blank ? "" : "2"} /></Field>
        <div></div>
        <Field label="Möjlighet till antal sovrum"><Input value={blank ? "" : "3"} /></Field>
      </div>
      {!isBrf && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Taxeringsår"><Input value={blank ? "" : "2024"} /></Field>
            <Field label="Taxeringsvärde byggnad"><Input value={blank ? "" : "1 511 000"} suffix="SEK" /></Field>
            <Field label="Taxeringsvärdet är"><Select value="Fastställt" options={["Fastställt", "Preliminärt"]} /></Field>
            <Field label="Taxeringsvärde mark"><Input value={blank ? "" : "2 605 000"} suffix="SEK" /></Field>
            <Field label="Värdeår"><Input value={blank ? "" : "1944"} /></Field>
            <Field label="Summa taxeringsvärde"><Input value={blank ? "" : "4 116 000"} suffix="SEK" readOnly /></Field>
          </div>
          <Field label="Taxeringsvärdesbeskrivning">
            <textarea rows={2} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
          </Field>
        </>
      )}
    </div>
  );
}

/* ---------- Byggnad ---------- */

function ByggnadBody({ isBrf }: { isBrf?: boolean }) {
  const blank = useContext(BlankCtx);
  if (isBrf) {
    return (
      <div className="space-y-5">
        <Field label="Allmän information om byggnaden">
          <textarea rows={2} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Byggnadstyp"><Select value={blank ? "" : "Flerfamiljshus"} options={["Flerfamiljshus", "Radhuslänga", "Kedjehus"]} /></Field>
          <Field label="Byggår"><Input value={blank ? "" : ""} placeholder="—" /></Field>
          <Field label="Antal våningar"><Input placeholder="—" /></Field>
          <Field label="Hiss"><Select value="" options={["Ja", "Nej"]} /></Field>
          <Field label="Fasadtyp"><Input placeholder="—" /></Field>
          <Field label="Taktyp/takbeklädnad"><Input placeholder="—" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Vatten"><Input value={blank ? "" : "Kommunalt vatten"} placeholder="—" /></Field>
          <Field label="Avlopp"><Input value={blank ? "" : "Kommunalt avlopp"} placeholder="—" /></Field>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Field label="Allmän information">
        <textarea rows={2} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Byggnadstyp"><Input value={blank ? "" : "1-planshus med källare"} placeholder="—" /></Field>
        <Field label="Standardpoäng"><Input value={blank ? "" : "32"} placeholder="—" /></Field>
        <Field label="Byggår"><Input value={blank ? "" : "1944"} placeholder="—" /></Field>
        <Field label="Om-/tillbyggnadsår"><Input placeholder="—" /></Field>
        <Field label="Mark"><Input value={blank ? "" : "Sten"} placeholder="—" /></Field>
        <Field label="Grundmur"><Input placeholder="—" /></Field>
        <Field label="Taktyp/takbeklädnad"><Input value={blank ? "" : "Papp"} placeholder="—" /></Field>
        <Field label="Grund"><Input value={blank ? "" : "Källare"} placeholder="—" /></Field>
        <Field label="Utvändiga plåtarbeten"><Input placeholder="—" /></Field>
        <Field label="Fasadtyp"><Input value={blank ? "" : "Träfasad"} placeholder="—" /></Field>
        <Field label="Stomme"><Input value={blank ? "" : "Trä"} placeholder="—" /></Field>
        <Field label="Fönster"><Input value={blank ? "" : "3-glasfönster isoler"} placeholder="—" /></Field>
        <div></div>
        <Field label="Bjälklag"><Input value={blank ? "" : "Trä"} placeholder="—" /></Field>
      </div>
      <Field label="Byggnadskommentar">
        <textarea rows={3} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vatten"><Input value={blank ? "" : "Kommunalt vatten året om"} placeholder="—" /></Field>
        <Field label="Avlopp"><Input value={blank ? "" : "Kommunalt avlopp"} placeholder="—" /></Field>
      </div>
    </div>
  );
}

/* ---------- El & uppvärmning ---------- */

function ElBody() {
  const blank = useContext(BlankCtx);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Typ av uppvärmning"><Input value="Bergvärmepump" /></Field>
        <Field label="Ålder på värmeanläggning"><Input value="1 år" /></Field>
        <Field label="Skick på värmeanläggning"><Input value="Mycket gott skick" /></Field>
        <Field label="Märke på värmeanläggning"><Input value="Nibe" /></Field>
        <Field label="Typ av ventilation"><Input value="Självdrag" /></Field>
        <Field label="Senaste inspektion av ventilation"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
        <Field label="Elkablar"><Input value="Ledningar bytta" /></Field>
        <Field label="Jordat eller ojordat"><Input value="Jordat" /></Field>
        <Field label="Huvudsäkring"><Input value="25 A" /></Field>
      </div>
      <Field label="El kommentar">
        <textarea rows={3} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Skorstenstyp"><Input placeholder="Skorstenstyp" /></Field>
        <Field label="Senast provtryckt"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
      </div>
      <Field label="Skorstenskommentar">
        <textarea rows={2} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <Checkbox label="Radon finns" />
      <Field label="Radon kommentar">
        <textarea rows={2} defaultValue={blank ? "" : "Korttidsmätning gjord tidigare, se separat protokoll."} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
    </div>
  );
}

/* ---------- Övrigt ---------- */

function OvrigtBody() {
  const blank = useContext(BlankCtx);
  return (
    <div className="space-y-5">
      <Field label="Parkeringsbeskrivning">
        <textarea rows={2} defaultValue={blank ? "" : "Carport med plats för två bilar"} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <Field label="Uteplatsbeskrivning">
        <textarea rows={4} defaultValue={blank ? "" : "Från huset nås den generösa altanen som delvis är under tak och erbjuder gott om plats för både matgrupp och grill. Här skapas en naturlig förlängning av bostaden under årets varmare månader med utsikt över den grönskande trädgården."} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <Field label="Övriga byggnader">
        <textarea rows={2} defaultValue={blank ? "" : "Förråd/Vedbod samt äldre hus på baksidan av tomten (Dåligt skick)"} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <Field label="TV/Internet beskrivning">
        <textarea rows={2} defaultValue={blank ? "" : "Fiber - Bundet Telia nov 2026"} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
      <Field label="Utförda renoveringar">
        <textarea rows={6} defaultValue={blank ? "" : `2025-08: Byte källardörr.
2025-02: Bergvärmepump driftsattes. Nibe S1256-13. Borrdjup 260 m.
2024-10: Tilläggsisolering vind, ca 300 mm cellulosa ovanpå befintligt kutterspån.
2017: Badrummet källaren
2015: Fönster på entréplan
2003: Köket renoverades`} className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm focus:border-primary/40 focus:outline-none" />
      </Field>
    </div>
  );
}

/* ---------- Rum ---------- */

const ROOMS = [
  { n: "HALL", v: "Entréplan", b: "Välkomnande hall med vitmålade väggar och ljust trägolv som är genomgående i stora delar av bostaden." },
  { n: "GÄST-WC", v: "Entréplan", b: "Praktisk gäst-WC med fönster som ger naturligt ljusinsläpp och möjlighet till vädring." },
  { n: "VARDAGSRUM", v: "Entréplan", b: "Rymligt vardagsrum med parkettgolv, ljusgröna väggar och generöst ljusinsläpp från stora fönster i två väderstreck." },
  { n: "MATRUM", v: "Entréplan", b: "Ljust och trivsamt matrum med trägolv, vitmålade väggar och stort fönster." },
  { n: "KÖK", v: "Entréplan", b: "Trivsamt kök från 2003 med gott om arbetsyta och förvaring bakom köksluckor i trä." },
  { n: "SOVRUM 1", v: "Entréplan", b: "Rofyllt sovrum med trägolv och väggar i grå kulör kombinerat med en mönstrad fondtapet." },
  { n: "SOVRUM 2", v: "Entréplan", b: "Trivsamt sovrum med målade väggar i blågrå kulör och parkettgolv." },
  { n: "GROVINGÅNG", v: "Källare", b: "Praktisk groventré på källarplanet med egen entré utifrån." },
  { n: "WC", v: "Källare", b: "WC på källarplanet med målade väggar i grå kulör och ljusa ytskikt." },
  { n: "PANNRUM/FÖRVARING", v: "Källare", b: "Pannrum på källarplanet med plats för teknisk utrustning samt goda förvaringsmöjligheter." },
  { n: "BADRUM & TVÄTT", v: "Källare", b: "Rymligt badrum på källarplanet, renoverat 2017, med klinkergolv och helkaklade väggar." },
];

function RumBody({ slug }: { slug: string }) {
  const propertyType = getObjektBySlug(slug)?.typ;
  return (
    <div className="space-y-4">
      <RumSektion slug={slug} propertyType={propertyType} />
      <div className="overflow-x-auto rounded-md border border-border hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-16">#</th>
              <th className="px-3 py-2 text-left">Namn på rum</th>
              <th className="px-3 py-2 text-left">Våningsplan</th>
              <th className="px-3 py-2 text-left">Beskrivning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Inga rum tillagda</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Bilder ---------- */

function BilderSectionBody({ slug }: { slug: string }) {
  const blank = isUserCreatedSlug(slug);
  const [bilder, setBilder] = useState(() => listBilder(slug));

  function handleUpload(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      compressImageCard(file).then((dataUrl) => {
        const added = addBilder(slug, [{ name: file.name, dataUrl }]);
        setBilder((prev) => [...prev, ...added]);
      });
    });
  }

  function handleRemove(id: string) {
    removeBild(slug, id);
    setBilder((prev) => prev.filter((b) => b.id !== id));
  }

  if (blank) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Uppdragets bilder</div>
            <div className="text-xs text-muted-foreground">{bilder.length === 0 ? "Inga bilder uppladdade ännu" : `${bilder.length} bild${bilder.length > 1 ? "er" : ""}`}</div>
          </div>
          <label className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            + Lägg till bilder
          </label>
        </div>
        {bilder.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/[0.02] transition-colors">
            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <div className="text-2xl mb-2 opacity-50">📷</div>
            Klicka för att ladda upp bilder
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {bilder.map((b, i) => (
              <div key={b.id} className="group overflow-hidden rounded-md border border-border bg-background/40">
                <div className="relative aspect-[4/3]">
                  <img src={b.dataUrl} alt={b.name} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{i + 1}</span>
                  <button onClick={() => handleRemove(b.id)}
                    className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white group-hover:flex">×</button>
                </div>
                <div className="px-2 py-1.5 text-xs truncate text-muted-foreground">{b.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  const o = getObjektBySlug(slug);
  const pool = pickImages(slug, o?.typ, o?.boarea); // [facade, ...interiors]
  const addrShort = prettyAddr(slug).split(" ")[0];
  const grid = pool.map((url, i) => ({
    url,
    title: i === 0 ? `${addrShort} – fasad` : `${addrShort} – interiör ${i}`,
  }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Uppdragets bilder</div>
          <div className="text-xs text-muted-foreground">Publicerad <span className="text-foreground">({grid.length}/{grid.length})</span></div>
        </div>
        <div className="flex gap-2">
          <BtnGhost>↓ Ladda ner</BtnGhost>
          <BtnGhost>Skriv ut / e-post</BtnGhost>
          <BtnPrimary>+ Lägg till bilder</BtnPrimary>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {grid.map((g, i) => (
          <div key={i} className="overflow-hidden rounded-md border border-border bg-background/40">
            <div className="relative aspect-[4/3]">
              <img src={g.url} alt={g.title} loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{i + 1}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 text-xs">
              <span className="truncate text-muted-foreground">{g.title}</span>
              <input type="checkbox" className="h-3.5 w-3.5 accent-primary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   KONTRAKT VIEW (sidomeny → Kontrakt)
   ============================================================ */

type KoSection =
  | "mj" | "publicera" | "saljare" | "kopare"
  | "kontrakt" | "dokument" | "filer" | "efterarbete";

function KontraktView({ slug, onTabChange }: { slug: string; onTabChange: (tab: SideTab) => void }) {
  const [open, setOpen] = useState<Record<KoSection, boolean>>({
    mj: true, publicera: false, saljare: false, kopare: false,
    kontrakt: true, dokument: false, filer: false, efterarbete: false,
  });
  const [done, setDone] = useState<Record<KoSection, boolean>>(() => {
    const k = getKontrakt(slug);
    return {
      mj: false, publicera: false, saljare: false, kopare: false,
      kontrakt: k.signerat, dokument: false, filer: false, efterarbete: false,
    };
  });
  const toggle = (id: KoSection) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const toggleDone = (id: KoSection) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <div className="flex flex-col gap-2 pl-2">
      <KoSec id="mj" title="Mäklarjournal" open={open.mj} onToggle={toggle} done={done.mj} onToggleDone={toggleDone}>
        <MaMjBody />
      </KoSec>
      <KoSec id="publicera" title="Publicera" open={open.publicera} onToggle={toggle} done={done.publicera} onToggleDone={toggleDone}>
        <MaPubliceraBody />
      </KoSec>
      <KoSec id="saljare" title="Säljare" open={open.saljare} onToggle={toggle} done={done.saljare} onToggleDone={toggleDone}>
        <KoPartyBody role="Säljare" slug={slug} onTabChange={onTabChange} />
      </KoSec>
      <KoSec id="kopare" title="Köpare" open={open.kopare} onToggle={toggle} done={done.kopare} onToggleDone={toggleDone}>
        <KoPartyBody role="Köpare" slug={slug} onTabChange={onTabChange} />
      </KoSec>
      <KoSec id="kontrakt" title="Kontraktsinformation" open={open.kontrakt} onToggle={toggle} done={done.kontrakt} onToggleDone={toggleDone}>
        <KoKontraktinfoBody slug={slug} onSaved={() => setDone((d) => ({ ...d, kontrakt: true }))} />
      </KoSec>
      <KoSec id="dokument" title="Dokument" open={open.dokument} onToggle={toggle} done={done.dokument} onToggleDone={toggleDone}>
        <DokumentBody />
      </KoSec>
      <KoSec id="filer" title="Filer" open={open.filer} onToggle={toggle} done={done.filer} onToggleDone={toggleDone}>
        <FilerBody />
      </KoSec>
      <KoSec id="efterarbete" title="Efterarbete kontrakt" open={open.efterarbete} onToggle={toggle} done={done.efterarbete} onToggleDone={toggleDone} helpLabel="Hantera handpenningen">
        <KoEfterarbeteBody slug={slug} />
      </KoSec>
    </div>
  );
}

function KoSec({
  id, title, badge, open, onToggle, done, onToggleDone, helpLabel, children,
}: {
  id: KoSection; title: string; badge?: string; open: boolean;
  onToggle: (id: KoSection) => void;
  done?: boolean; onToggleDone?: (id: KoSection) => void;
  helpLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span
            role="checkbox"
            aria-checked={!!done}
            onClick={(e) => { e.stopPropagation(); onToggleDone?.(id); }}
            title={done ? "Klart – klicka för att avmarkera" : "Markera som klart"}
            className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-[10px] transition-colors ${
              done
                ? "bg-emerald-500/25 text-emerald-700 hover:bg-emerald-500/35"
                : "border border-border bg-transparent text-transparent hover:border-emerald-500/60 hover:text-emerald-400/50"
            }`}
          >
            ✓
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{title}</span>
          {badge && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[10px] font-medium text-orange-300">
              {badge}
            </span>
          )}
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
        {helpLabel && <span className="text-[11px] text-primary/70">{helpLabel}</span>}
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

/* ---------- Säljare / Köpare ---------- */
function KoPartyBody({ role, slug, onTabChange }: { role: "Säljare" | "Köpare"; slug: string; onTabChange: (tab: SideTab) => void }) {
  const relation = role === "Säljare" ? "säljare" : "köpare";
  const persons = listKontakter().filter((k) =>
    k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === relation)
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {persons.length > 0
            ? `${persons.length} ${role.toLowerCase()}${persons.length > 1 ? "e" : ""} kopplade till uppdraget.`
            : `Inga ${role.toLowerCase()} kopplade ännu.`}
        </div>
        <div className="flex gap-2">
          {persons.some((p) => p.epost) && (
            <BtnGhost onClick={() => {
              const emails = persons.map((p) => p.epost).filter((e): e is string => Boolean(e));
              const subject = `Meddelande angående uppdraget`;
              const body = `Hej!\n\nMed vänliga hälsningar,\nErik Lindqvist`;
              window.open(buildMailto(emails, subject, body), "_blank");
            }}>
              ✉ E-post {role === "Säljare" ? "säljare" : "köpare"}
            </BtnGhost>
          )}
          <BtnGhost onClick={() => onTabChange(role === "Säljare" ? "Säljare" : "Köpare")}>
            Hantera i {role.toLowerCase()}-fliken →
          </BtnGhost>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Namn","E-post","Telefon","Legitimerad","Aktivitet"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {persons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Koppla {role.toLowerCase()} via fliken "{role}" i sidomenyn
                </td>
              </tr>
            ) : persons.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium">{p.fornamn} {p.efternamn}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.epost ? (
                    <a href={`mailto:${p.epost}`} className="hover:text-primary">{p.epost}</a>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.telefon ? <a href={`tel:${p.telefon}`} className="hover:text-primary">{p.telefon}</a> : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">BankID ✓</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">⚙</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Kontraktsinformation ---------- */
function KoKontraktinfoBody({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const [form, setForm] = useState<KontraktData>(() => {
    const saved = getKontrakt(slug);
    if (!saved.slutpris) {
      const winner = listBud(slug).find((b) => b.vinnare);
      if (winner) return { ...saved, slutpris: String(winner.belopp) };
    }
    return saved;
  });
  const [saved, setSavedFlag] = useState(false);

  function set<K extends keyof KontraktData>(key: K, value: KontraktData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedFlag(false);
  }

  function handleSave() {
    saveKontrakt(slug, { ...form, signerat: true });
    setObjektStatus(slug, "Såld");
    setSavedFlag(true);
    onSaved();
  }

  return (
    <div className="space-y-5">
      {form.signerat && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <span>✓</span>
          <span>Kontraktet är signerat och sparat. Objektet markerat som Såld.</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Kontraktsdatum">
          <DatePickerInput value={form.kontraktsdatum} onChange={(v) => set("kontraktsdatum", v)} />
        </Field>
        <Field label="Tillträdesdatum">
          <DatePickerInput value={form.tilltradesdatum} onChange={(v) => set("tilltradesdatum", v)} />
        </Field>
        <Field label="Slutpris" hint={form.slutpris ? `= ${Number(form.slutpris).toLocaleString("sv-SE")} kr` : undefined}>
          <Input value={form.slutpris} onChange={(v) => set("slutpris", v)} placeholder="0" suffix="SEK" />
        </Field>
        <Field label="Handpenning">
          <Input value={form.handpenning} onChange={(v) => set("handpenning", v)} placeholder="0" suffix="SEK" />
        </Field>
        <Field label="Handpenning betalas senast">
          <DatePickerInput value={form.handpenningDatum} onChange={(v) => set("handpenningDatum", v)} />
        </Field>
        <Field label="Kontraktstyp">
          <Select value={form.kontraktstyp} onChange={(v) => set("kontraktstyp", v)} options={["Köpekontrakt","Överlåtelseavtal","Skrivuppdrag"]} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Besiktningsklausul">
          <Select value={form.besiktningsklausul} onChange={(v) => set("besiktningsklausul", v)} options={["Nej","Ja – före tillträde","Ja – återgångsrätt"]} />
        </Field>
        <Field label="Finansieringsvillkor">
          <Select value={form.finansieringsvillkor} onChange={(v) => set("finansieringsvillkor", v)} options={["Nej","Ja"]} />
        </Field>
      </div>
      <Field label="Övriga villkor / anteckning">
        <textarea
          value={form.ovrigaVillkor}
          onChange={(e) => set("ovrigaVillkor", e.target.value)}
          className="h-24 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
          placeholder="Skriv villkor som ska gälla i kontraktet…"
        />
      </Field>
      <div className="flex flex-wrap gap-4">
        <Checkbox label="Köparen har erhållit objektsbeskrivning" defaultChecked={form.checkObjektsbeskrivning}
          onChange={(v) => set("checkObjektsbeskrivning", v)} />
        <Checkbox label="Köparen har erhållit frågelista" defaultChecked={form.checkFragelista}
          onChange={(v) => set("checkFragelista", v)} />
        <Checkbox label="Säljaren har erhållit budgivningslista" defaultChecked={form.checkBudgivningslista}
          onChange={(v) => set("checkBudgivningslista", v)} />
      </div>
      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-[11px] text-emerald-400">✓ Sparat</span>}
        <BtnGhost>Förhandsgranska kontrakt</BtnGhost>
        <BtnPrimary onClick={handleSave}>
          {form.signerat ? "✓ Uppdatera kontrakt" : "Signera och spara"}
        </BtnPrimary>
      </div>
    </div>
  );
}

/* ---------- Efterarbete kontrakt ---------- */
function KoEfterarbeteBody({ slug }: { slug: string }) {
  const [form, setForm] = useState<KontraktData>(() => getKontrakt(slug));
  const [savedFlag, setSavedFlag] = useState(false);

  function set<K extends keyof KontraktData>(key: K, value: KontraktData[K]) {
    setForm((f) => { const next = { ...f, [key]: value }; return next; });
    setSavedFlag(false);
  }

  function handleSave() {
    saveKontrakt(slug, form);
    setSavedFlag(true);
  }

  const slutpris = Number(form.slutpris) || 0;
  const provisionPct = getBudget().provisionPct;
  const provisionExMoms = Math.round(slutpris * provisionPct);
  const moms = Math.round(provisionExMoms * 0.25);
  const provisionInkMoms = provisionExMoms + moms;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <BtnGhost onClick={() => {
          const k = getKontrakt(slug);
          const subject = encodeURIComponent("Handpenning – kontraktsinformation");
          window.open(`mailto:?subject=${subject}`, "_blank");
        }}>✉ E-post</BtnGhost>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Betalad handpenning">
          <Input value={form.betaladHandpenning} onChange={(v) => set("betaladHandpenning", v)} placeholder="0" suffix="SEK" />
        </Field>
        <Field label="Betaldatum">
          <DatePickerInput value={form.betaldatum} onChange={(v) => set("betaldatum", v)} />
        </Field>
        <Field label="Provision betaldatum">
          <DatePickerInput value={form.provisionBetaldatum} onChange={(v) => set("provisionBetaldatum", v)} />
        </Field>
        <div />
      </div>
      <Checkbox
        label="Handpenningen deponeras på mäklarens klientmedelskonto"
        defaultChecked={form.deponerasKonto}
        onChange={(v) => set("deponerasKonto", v)}
      />
      <Field label="Intern anteckning om handpenning (skrivs ej ut)">
        <textarea
          value={form.handpenningKommentar}
          onChange={(e) => set("handpenningKommentar", e.target.value)}
          className="h-24 w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
        />
      </Field>

      <div className="flex items-center justify-end gap-2">
        {savedFlag && <span className="text-[11px] text-emerald-400">✓ Sparat</span>}
        <BtnPrimary onClick={handleSave}>Spara efterarbete</BtnPrimary>
      </div>

      {slutpris > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Provisionsberäkning</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Slutpris</span>
              <span className="font-medium">{slutpris.toLocaleString("sv-SE")} SEK</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Provision ({(provisionPct * 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %)</span>
              <span className="font-medium">{provisionExMoms.toLocaleString("sv-SE")} SEK</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Moms (25 %)</span>
              <span className="font-medium">{moms.toLocaleString("sv-SE")} SEK</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-primary">
              <span>Total provision inkl. moms</span>
              <span>{provisionInkMoms.toLocaleString("sv-SE")} SEK</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   BUDGIVNING VIEW (sidomeny → Budgivning)
   ============================================================ */
type BuSection = "budgivning" | "boende" | "dokument" | "filer";

function BudgivningView({ slug }: { slug: string }) {
  const [open, setOpen] = useState<Record<BuSection, boolean>>({
    budgivning: true, boende: false, dokument: false, filer: false,
  });
  const [done, setDone] = useState<Record<BuSection, boolean>>({
    budgivning: false, boende: false, dokument: true, filer: true,
  });
  const toggle = (id: BuSection) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const toggleDone = (id: BuSection) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <div className="flex flex-col gap-2 pl-2">
      <BuSec id="budgivning" title="Budgivning" open={open.budgivning} onToggle={toggle} done={done.budgivning} onToggleDone={toggleDone} helpLabel="Hjälp - budgivning">
        <BuBudgivningBody slug={slug} />
      </BuSec>
      <BuSec id="boende" title="Boendekostnadskalkyl" open={open.boende} onToggle={toggle} done={done.boende} onToggleDone={toggleDone}>
        <MaBoendeBody />
      </BuSec>
      <BuSec id="dokument" title="Dokument" open={open.dokument} onToggle={toggle} done={done.dokument} onToggleDone={toggleDone} helpLabel="Hjälp - fullmakt    Hjälp - dokumentmanualer">
        <DokumentBody />
      </BuSec>
      <BuSec id="filer" title="Filer" open={open.filer} onToggle={toggle} done={done.filer} onToggleDone={toggleDone}>
        <FilerBody />
      </BuSec>
    </div>
  );
}

function BuSec({
  id, title, open, onToggle, done, onToggleDone, helpLabel, children,
}: {
  id: BuSection; title: string; open: boolean;
  onToggle: (id: BuSection) => void;
  done?: boolean; onToggleDone?: (id: BuSection) => void;
  helpLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span
            role="checkbox"
            aria-checked={!!done}
            onClick={(e) => { e.stopPropagation(); onToggleDone?.(id); }}
            title={done ? "Klart – klicka för att avmarkera" : "Markera som klart"}
            className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-[10px] transition-colors ${
              done
                ? "bg-emerald-500/25 text-emerald-700 hover:bg-emerald-500/35"
                : "border border-border bg-transparent text-transparent hover:border-emerald-500/60 hover:text-emerald-400/50"
            }`}
          >
            ✓
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{title}</span>
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
        {helpLabel && <span className="text-[11px] text-primary/70">{helpLabel}</span>}
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

/* ---------- Budgivning body ---------- */
function BuBudgivningBody({ slug }: { slug: string }) {
  const [bids, setBids] = useState<Bud[]>(() => listBud(slug));
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [godkannAlla, setGodkannAlla] = useState(() => getBudSettings(slug).godkannAllaBud);
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  function refresh() { setBids(listBud(slug)); }

  function handleMarkVinnare(budId: string) {
    markeraVinnare(slug, budId);
    refresh();
  }

  function handleDelete(budId: string) {
    if (!window.confirm("Ta bort budet permanent?")) return;
    deleteBud(slug, budId);
    refresh();
  }

  function handleDraTillbaka(budId: string) {
    dragaTillbakaBud(slug, budId, true);
    refresh();
  }

  function handleÅteraktivera(budId: string) {
    dragaTillbakaBud(slug, budId, false);
    refresh();
  }

  function toggleGodkannAlla() {
    const next = !godkannAlla;
    setGodkannAlla(next);
    setBudSettings(slug, { godkannAllaBud: next });
  }

  const activeBids = bids.filter((b) => !b.tillbakadragen);
  const withdrawnBids = bids.filter((b) => b.tillbakadragen);
  const highestBid = activeBids[0]?.belopp ?? 0;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-md border border-primary/50 bg-primary/5 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/10"
        >
          ⚙ Inställningar
        </button>
        <button className="rounded-md border border-primary/50 bg-primary/5 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/10">
          ✉ Kommunikation
        </button>
        <button
          onClick={toggleGodkannAlla}
          className={[
            "rounded-md border px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
            godkannAlla
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
          ].join(" ")}
        >
          {godkannAlla ? "✓ Godkänn alla bud" : "Godkänn alla bud"}
        </button>
      </div>

      {/* Godkänn alla bud notice */}
      {godkannAlla && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-[12px] text-emerald-600">
          <span>✓</span>
          <span>Alla inkomna bud godkänns automatiskt — säljaren har gett sitt medgivande.</span>
        </div>
      )}

      {/* Aktiva bud */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Budlista</h3>
            {activeBids.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Högsta bud: <span className="font-medium text-primary">{fmtBud(highestBid)}</span> · {activeBids.length} aktiva bud
              </div>
            )}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            + Lägg till bud
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["#","Namn","Telefon","Bud","Villkor","Datum","Status",""].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeBids.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">Inga aktiva bud — klicka "+ Lägg till bud" för att registrera det första</td></tr>
              ) : activeBids.map((b, i) => (
                <tr key={b.id} className={b.vinnare ? "bg-emerald-500/5" : ""}>
                  <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{b.namn}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{b.telefon || "—"}</td>
                  <td className="px-3 py-2.5 font-mono font-medium text-foreground">{b.belopp > 0 ? fmtBud(b.belopp) : <span className="text-muted-foreground">Ej angivet</span>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{b.villkor || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[11px]">
                    {new Date(b.tidpunkt).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5">
                    {b.vinnare ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">✓ Vinnare</span>
                    ) : godkannAlla ? (
                      <button onClick={() => handleMarkVinnare(b.id)} className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20">
                        Markera vinnare
                      </button>
                    ) : (
                      <button onClick={() => handleMarkVinnare(b.id)} className="text-[11px] text-muted-foreground hover:text-primary">
                        Markera vinnare
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDraTillbaka(b.id)}
                        className="text-[11px] text-muted-foreground hover:text-amber-500"
                        title="Dra tillbaka budet"
                      >
                        ↩ Tillbaka
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="text-[11px] text-muted-foreground hover:text-red-400" title="Ta bort permanent">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tillbakadragna bud */}
      {withdrawnBids.length > 0 && (
        <div>
          <button
            onClick={() => setShowWithdrawn((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showWithdrawn ? "▲" : "▼"} {withdrawnBids.length} tillbakadragna bud
          </button>
          {showWithdrawn && (
            <div className="mt-2 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[600px] text-sm opacity-60">
                <tbody className="divide-y divide-border">
                  {withdrawnBids.map((b) => (
                    <tr key={b.id} className="line-through">
                      <td className="px-3 py-2 text-muted-foreground">{b.namn}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{b.belopp > 0 ? fmtBud(b.belopp) : "Ej angivet"}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {new Date(b.tidpunkt).toLocaleDateString("sv-SE")}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">Återkallat</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { handleÅteraktivera(b.id); setShowWithdrawn(false); }}
                            className="text-[11px] text-muted-foreground no-underline hover:text-primary"
                            style={{ textDecoration: "none" }}
                          >
                            Återaktivera
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="text-[11px] text-muted-foreground hover:text-red-400"
                            style={{ textDecoration: "none" }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Utskrift */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Utskrift budgivningslista</h3>
        <div className="flex flex-wrap gap-2">
          <BtnPrimary>🖨 Utskrift budgivningslista</BtnPrimary>
          <BtnGhost>✉ E-post</BtnGhost>
        </div>
      </div>

      {addOpen && (
        <LäggTillBudDialog
          slug={slug}
          onClose={() => setAddOpen(false)}
          onSaved={() => { refresh(); setAddOpen(false); }}
        />
      )}
      {settingsOpen && <BuSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function LäggTillBudDialog({ slug, onClose, onSaved }: { slug: string; onClose: () => void; onSaved: () => void }) {
  const [namn, setNamn] = useState("");
  const [telefon, setTelefon] = useState("");
  const [beloppRaw, setBeloppRaw] = useState("");
  const [villkor, setVillkor] = useState("");
  const [kontaktQ, setKontaktQ] = useState("");

  const kontakter = listKontakter();
  const filtered = kontaktQ.trim().length >= 2
    ? kontakter.filter((k) => `${k.fornamn} ${k.efternamn} ${k.telefon}`.toLowerCase().includes(kontaktQ.toLowerCase()))
    : [];

  function fillFromContact(k: Kontakt) {
    setNamn(`${k.fornamn} ${k.efternamn}`);
    setTelefon(k.telefon ?? "");
    setKontaktQ("");
  }

  function handleSave() {
    const belopp = parseInt(beloppRaw.replace(/\D/g, ""), 10);
    if (!namn.trim() || !belopp) return;
    addBud(slug, { belopp, namn: namn.trim(), telefon, villkor });
    onSaved();
  }

  const canSave = namn.trim().length > 0 && parseInt(beloppRaw.replace(/\D/g, ""), 10) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 "
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-card p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 text-xl text-muted-foreground hover:text-foreground">✕</button>
        <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-primary/80">Registrera bud</div>
        <h2 className="mb-5 text-xl font-medium" style={serif}>Nytt bud<span className="text-primary">.</span></h2>

        {/* Optional contact search */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-muted-foreground">Hämta från kontakt (valfritt)</label>
          <div className="relative">
            <input
              value={kontaktQ}
              onChange={(e) => setKontaktQ(e.target.value)}
              placeholder="Sök kontakt…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            {filtered.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {filtered.map((k) => (
                  <button key={k.id} onClick={() => fillFromContact(k)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary/5">
                    <span className="font-medium">{k.fornamn} {k.efternamn}</span>
                    <span className="text-muted-foreground">{k.telefon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Namn *</label>
            <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Budgivarens namn"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Telefon</label>
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="070-000 00 00"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Bud (SEK) *</label>
            <input
              value={fmtSweNum(beloppRaw)}
              onChange={(e) => handleNumberInput(e, setBeloppRaw)}
              placeholder="0"
              inputMode="numeric"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Villkor</label>
            <input value={villkor} onChange={(e) => setVillkor(e.target.value)} placeholder="t.ex. Besiktningsklausul, 60 dagars tillträde"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-foreground/5">Avbryt</button>
          <button onClick={handleSave} disabled={!canSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">
            Registrera bud
          </button>
        </div>
      </div>
    </div>
  );
}

function Pager() {
  return (
    <div className="mt-2 flex justify-end gap-1 text-xs">
      {["10","25","50","100"].map((n,i) => (
        <span key={n} className={`rounded px-2 py-0.5 ${i===0 ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>{n}</span>
      ))}
    </div>
  );
}

function BuSettingsModal({ onClose }: { onClose: () => void }) {
  const { slug } = Route.useParams();
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-md border border-border bg-card shadow-xl" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-primary/10 px-5 py-3">
          <h3 className="text-sm font-semibold text-primary">Inställningar för budgivningen</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="space-y-5 px-5 py-5 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground">Uppdragsnamn:</span>
            <span className="text-foreground">{propertyFullAddr(slug)}</span>
          </div>
          <Field label="Utgående SMS-nummer">
            <select className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
              <option>Mspecs standardnummer</option>
            </select>
          </Field>
          <Field label="Budgivningsleverantör">
            <select className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
              <option>Mspecs - standard budgivning</option>
            </select>
          </Field>
          <div className="space-y-2">
            <Checkbox label="Tillåt bud via budgivningssidan" />
            <Checkbox label="Tillåt bud via SMS" />
            <Checkbox label="Visa budgivning på marknadsplatser, tex Hemnet" />
            <Checkbox label='Visa "Budgivning pågår" på hemsida' />
          </div>
          <Field label="Budinställningar (Hemsida)">
            <select className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
              <option>Visa alla bud</option>
            </select>
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
              <span>Handläggare</span>
              <div className="flex gap-6"><span>📱 Telefonnummer</span><span>✉ E-post</span></div>
            </div>
            <BuContactRow name="Johan Karlsson" tel="0703-45 67 89" email="johan.karlsson@example.se" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
              <span>Säljare</span>
              <div className="flex gap-6"><span>📱 Telefonnummer</span><span>✉ E-post</span></div>
            </div>
            {getDemoSaljare(slug).map((s) => (
              <BuContactRow key={s.telefon} name={s.namn} tel={s.telefon} email={s.email} />
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-md bg-primary px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90">Stäng</button>
        </div>
      </div>
    </div>
  );
}

function BuContactRow({ name, tel, email }: { name: string; tel: string; email: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-border py-2 text-sm">
      <span>{name}</span>
      <div className="flex items-center gap-2">
        <input defaultValue={tel} className="w-40 rounded-md border border-border bg-background/40 px-2 py-1 text-xs" />
        <input type="checkbox" />
      </div>
      <div className="flex items-center gap-2">
        <input defaultValue={email} className="w-56 rounded-md border border-border bg-background/40 px-2 py-1 text-xs" />
        <input type="checkbox" />
      </div>
    </div>
  );
}

/* ---------- Nycklar och larm ---------- */

function NycklarBody() {
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Den här informationen visas inte på objektsbeskrivningar eller på hemsida
      </p>
      <Checkbox label="Mäklaren har nyckel" defaultChecked />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Mottog nyckel den"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
        <Field label="Vem tog emot nyckeln på kontoret?"><Input /></Field>
        <Field label="Återlämnade nyckel den"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
        <Field label="Vem lämnades nyckel ut till?"><Input /></Field>
        <Field label="Nyckel nr/Nyckel ID"><Input /></Field>
      </div>
      <Field label="Nyckelkommentar">
        <textarea className="min-h-[80px] w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2 border-t border-border pt-5">
        <Field label="Larmkod"><Input /></Field>
        <Field label="Larmbolag"><Input placeholder="t.ex. Verisure, Sector Alarm" /></Field>
        <Field label="Larminstruktioner"><Input /></Field>
        <Field label="Kontaktperson larm"><Input /></Field>
      </div>
    </div>
  );
}

/* ---------- Närområde (karta) ---------- */

function NaromradeBody({ adress }: { adress: string }) {
  const lat = "59.2062932";
  const lng = "18.1528481";
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng)-0.006}%2C${Number(lat)-0.003}%2C${Number(lng)+0.006}%2C${Number(lat)+0.003}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
        <Field label="Latitud"><Input value={lat} /></Field>
        <Field label="Longitud"><Input value={lng} /></Field>
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">Närområde:</div>
          Klicka på <em>Redigera karta</em>. Klicka på kartan dit du önskar få markören. Klicka på <em>Spara redigering</em>.
          <br />Om du klickar på <em>Markera</em> placeras markören till dess originalläge.
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <BtnGhost>Redigera karta</BtnGhost>
        <BtnPrimary>Markera</BtnPrimary>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <iframe
          title={`Karta för ${adress}`}
          src={mapSrc}
          className="h-[420px] w-full"
          loading="lazy"
        />
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">Länk till adressen i Google Maps</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adress)}`}
          target="_blank" rel="noreferrer"
          className="rounded border border-border px-2 py-1 hover:bg-foreground/[0.04]"
        >📋 Kopiera</a>
      </div>
    </div>
  );
}

/* ---------- Områdesbeskrivning ---------- */

function OmradesbeskBody() {
  const txt = `OMRÅDET:
Länna är ett idylliskt villaområde med närhet till sjö och skog. Länna Handelsplats med affärer ligger på nära avstånd, och området har även kort bilavstånd till Farsta och Haninge centrum. Till City tar man sig med bil på endast 20 minuter.

SKOLA:
I Länna finns förskola (Blåbärsstället) samt Engelska skolan. Mer information om skolor och förskolor finns på www.huddingekommun.se.

FRITID:
I Skogås finns ett stort utbud av aktiviteter för alla åldrar, som tennis, badminton, basket, dans, fotboll och simhall. Vintertid finns skidspår och långfärdskridskoåkning på de plogade sjöarna Drevviken och Magelungen. Hockeyhall finns i närliggande Stortorp. Ca 4 km bort ligger Ågesta Friluftsområde med löpspår, ridskola, golfklubb med 27 hål samt brukshundsklubb.

CENTRUM / KOMMUNIKATIONER:
Skogås centrum erbjuder ett bra utbud av butiker och restauranger, systembolag, apotek, vårdcentral mm. Från centrum går pendeltåg till Stockholm och Västerhaninge/Nynäshamn. Direktbussar går från Länna till bla Farsta och Haninge. Från närliggande Vega finns direktbuss till Gullmarsplan.`;
  return (
    <div className="space-y-5">
      <Field label="Områdesbeskrivning">
        <textarea defaultValue={txt} className="min-h-[260px] w-full rounded-md border border-border bg-background/40 px-3 py-2 text-xs leading-relaxed" />
      </Field>
      <div className="flex justify-end">
        <BtnGhost>🔍 Sök områdesbeskrivning</BtnGhost>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium">Övriga områdesbeskrivningar</div>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Språk</th><th className="px-3 py-2 text-left">Områdesbeskrivning</th></tr>
            </thead>
            <tbody><tr><td colSpan={2} className="px-3 py-3 text-xs text-muted-foreground">Inga poster</td></tr></tbody>
          </table>
        </div>
        <div className="flex justify-end"><BtnPrimary>+ Lägg till</BtnPrimary></div>
      </div>
      <Field label="Kommunikationer">
        <textarea className="min-h-[80px] w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm" />
      </Field>
      <Field label="Vägbeskrivningar">
        <textarea className="min-h-[80px] w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm" />
      </Field>
    </div>
  );
}

/* ============================================================
   MARKNAD VIEW
   ============================================================ */

type MaSection =
  | "mj" | "marknad" | "visningar" | "publicera"
  | "boende" | "dokument" | "filer" | "tjanster";

function MarknadView() {
  const [open, setOpen] = useState<Record<MaSection, boolean>>({
    mj: true, marknad: false, visningar: false, publicera: false,
    boende: false, dokument: false, filer: false, tjanster: false,
  });
  const [done, setDone] = useState<Record<MaSection, boolean>>({
    mj: false, marknad: false, visningar: false, publicera: false,
    boende: false, dokument: false, filer: false, tjanster: false,
  });
  const toggle = (id: MaSection) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const toggleDone = (id: MaSection) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <div className="flex flex-col gap-2 pl-2">
      <MaSec id="mj" title="Mäklarjournal" badge="5" open={open.mj} onToggle={toggle} done={done.mj} onToggleDone={toggleDone}>
        <MaMjBody />
      </MaSec>
      <MaSec id="marknad" title="Marknad" open={open.marknad} onToggle={toggle} done={done.marknad} onToggleDone={toggleDone}>
        <MaMarknadBody />
      </MaSec>
      <MaSec id="visningar" title="Visningsdetaljer" open={open.visningar} onToggle={toggle} done={done.visningar} onToggleDone={toggleDone}>
        <MaVisningarBody />
      </MaSec>
      <MaSec id="publicera" title="Publicera" open={open.publicera} onToggle={toggle} done={done.publicera} onToggleDone={toggleDone}>
        <MaPubliceraBody />
      </MaSec>
      <MaSec id="boende" title="Boendekostnadskalkyl" open={open.boende} onToggle={toggle} done={done.boende} onToggleDone={toggleDone}>
        <MaBoendeBody />
      </MaSec>
      <MaSec id="dokument" title="Dokument" open={open.dokument} onToggle={toggle} done={done.dokument} onToggleDone={toggleDone}>
        <DokumentBody />
      </MaSec>
      <MaSec id="filer" title="Filer" open={open.filer} onToggle={toggle} done={done.filer} onToggleDone={toggleDone}>
        <FilerBody />
      </MaSec>
      <MaSec id="tjanster" title="Tjänster" open={open.tjanster} onToggle={toggle} done={done.tjanster} onToggleDone={toggleDone}>
        <TjansterBody />
      </MaSec>
    </div>
  );
}

/* ============================================================
   VISNINGAR VIEW (sidomeny → Visningar)
   ============================================================ */
function _visTimeFmt(ts: number) {
  return new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}
function _visFullDateFmt(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
}

function VisningRow({ v, slug, adress, now, expandedId, onToggleExpand, newDeltagare, kontaktSuggestions, suggForId, onNamnChange, onPickKontakt, onPhoneChange, onAddDeltagare, onDeleteVisning, onLoad }: {
  v: Visning; slug: string; adress: string; now: number;
  expandedId: string | null; onToggleExpand: (id: string | null) => void;
  newDeltagare: Record<string, { namn: string; telefon: string; kontaktId?: string }>;
  kontaktSuggestions: { id: string; namn: string; telefon: string }[];
  suggForId: string | null;
  onNamnChange: (visningId: string, val: string) => void;
  onPickKontakt: (visningId: string, k: { id: string; namn: string; telefon: string }) => void;
  onPhoneChange: (visningId: string, val: string) => void;
  onAddDeltagare: (visningId: string) => void;
  onDeleteVisning: (visningId: string) => void;
  onLoad: () => void;
}) {
  const isExpanded = expandedId === v.id;
  const isPast = v.datum < now;

  return (
    <div className={`rounded-xl border transition-colors ${isPast ? "border-border/50 bg-card/40" : "border-border bg-card/80"}`}>
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => onToggleExpand(isExpanded ? null : v.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleExpand(isExpanded ? null : v.id); } }}
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
            isPast ? "bg-muted/50 text-muted-foreground" : "bg-primary/10 text-primary"
          }`}>
            {v.typ === "Öppen" ? "🏠" : v.typ === "Privat" ? "🔑" : "⚖️"}
          </span>
          <div>
            <p className={`text-sm font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
              {_visFullDateFmt(v.datum)}
            </p>
            <p className="text-xs text-muted-foreground">
              {_visTimeFmt(v.datum)}–{_visTimeFmt(v.sluttid)} · {v.typ} · {v.deltagare.length} anmälda
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPast && (
            <>
              <Link
                to="/visning/$id"
                params={{ id: v.id }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
              >
                Starta ▶
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); exportVisningToICS(v, adress); }}
                className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                → Kalender
              </button>
            </>
          )}
          <span className={`text-xs text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}>›</span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border px-4 py-4">
          {v.anteckningar && (
            <p className="mb-3 text-xs text-muted-foreground">{v.anteckningar}</p>
          )}

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary/60">
            Deltagare ({v.deltagare.length})
          </p>

          {v.deltagare.length > 0 ? (
            <div className="mb-3 divide-y divide-border rounded-lg border border-border">
              {v.deltagare.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">{d.namn}</p>
                    {d.telefon && <p className="text-xs text-muted-foreground">{d.telefon}</p>}
                  </div>
                  {isPast && (
                    <button
                      onClick={() => { toggleDeltog(slug, v.id, d.id); onLoad(); }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        d.deltog
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {d.deltog ? "Deltog ✓" : "Ej deltog"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">Inga deltagare registrerade ännu.</p>
          )}

          <div className="space-y-1.5">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Namn eller sök kontakt…"
                  value={newDeltagare[v.id]?.namn ?? ""}
                  onChange={(e) => onNamnChange(v.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAddDeltagare(v.id)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                {suggForId === v.id && kontaktSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                    {kontaktSuggestions.map((k) => (
                      <button
                        key={k.id}
                        onMouseDown={() => onPickKontakt(v.id, k)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-foreground/[0.04]"
                      >
                        <span className="font-medium text-foreground">{k.namn}</span>
                        <span className="text-muted-foreground">{k.telefon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="tel"
                placeholder="Telefon"
                value={newDeltagare[v.id]?.telefon ?? ""}
                onChange={(e) => onPhoneChange(v.id, e.target.value)}
                className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => onAddDeltagare(v.id)}
                className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                + Lägg till
              </button>
            </div>
            {newDeltagare[v.id]?.kontaktId && (
              <p className="text-[10px] text-emerald-500">✓ Kopplad till befintlig kontakt</p>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onDeleteVisning(v.id)}
              className="text-[11px] text-red-400/60 hover:text-red-400"
            >
              Ta bort visning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VisningarView() {
  const { slug } = Route.useParams();
  const adress = prettyAddr(slug);
  const [visningar, setVisningar] = useState<Visning[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newDeltagare, setNewDeltagare] = useState<Record<string, { namn: string; telefon: string; kontaktId?: string }>>({});
  const [kontaktSuggestions, setKontaktSuggestions] = useState<{ id: string; namn: string; telefon: string }[]>([]);
  const [suggForId, setSuggForId] = useState<string | null>(null);

  function load() { setVisningar(listVisningar(slug)); }
  useEffect(load, [slug]);

  const now = Date.now();
  const kommande = visningar.filter((v) => v.datum >= now);
  const genomforda = visningar.filter((v) => v.datum < now);

  function onNamnChange(visningId: string, val: string) {
    setNewDeltagare((p) => ({ ...p, [visningId]: { ...p[visningId], namn: val, kontaktId: undefined } }));
    const q = val.toLowerCase().trim();
    if (q.length < 2) { setKontaktSuggestions([]); setSuggForId(null); return; }
    const all = listKontakter();
    const matches = all
      .filter((k) => `${k.fornamn} ${k.efternamn}`.toLowerCase().includes(q) || k.telefon?.includes(q))
      .slice(0, 5)
      .map((k) => ({ id: k.id, namn: `${k.fornamn} ${k.efternamn}`, telefon: k.telefon ?? "" }));
    setKontaktSuggestions(matches);
    setSuggForId(matches.length > 0 ? visningId : null);
  }

  function onPickKontakt(visningId: string, k: { id: string; namn: string; telefon: string }) {
    setNewDeltagare((p) => ({ ...p, [visningId]: { namn: k.namn, telefon: k.telefon, kontaktId: k.id } }));
    setKontaktSuggestions([]);
    setSuggForId(null);
  }

  function onPhoneChange(visningId: string, val: string) {
    setNewDeltagare((p) => ({ ...p, [visningId]: { ...p[visningId], telefon: val } }));
  }

  function handleAddDeltagare(visningId: string) {
    const d = newDeltagare[visningId];
    if (!d?.namn?.trim()) return;
    addDeltagare(slug, visningId, {
      namn: d.namn.trim(), telefon: d.telefon?.trim() ?? "",
      kontaktId: d.kontaktId, anmald: true, deltog: false,
    });
    setNewDeltagare((prev) => ({ ...prev, [visningId]: { namn: "", telefon: "" } }));
    setKontaktSuggestions([]);
    setSuggForId(null);
    load();
  }

  function handleDeleteVisning(visningId: string) {
    deleteVisning(slug, visningId);
    load();
  }

  return (
    <div className="space-y-4 pl-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Visningar</h2>
          <p className="text-xs text-muted-foreground">{adress}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          + Boka visning
        </button>
      </div>

      {kommande.length === 0 && genomforda.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <span className="text-4xl">🏠</span>
          <p className="text-sm font-medium text-foreground">Inga visningar inplanerade</p>
          <p className="text-xs text-muted-foreground">Boka den första visningen för att komma igång.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-1 rounded-lg bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20"
          >
            + Boka visning
          </button>
        </div>
      ) : (
        <>
          {kommande.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/60">Kommande ({kommande.length})</p>
              {kommande.map((v) => (
                <VisningRow
                  key={v.id} v={v} slug={slug} adress={adress} now={now}
                  expandedId={expandedId} onToggleExpand={(id) => setExpandedId(id)}
                  newDeltagare={newDeltagare} kontaktSuggestions={kontaktSuggestions} suggForId={suggForId}
                  onNamnChange={onNamnChange} onPickKontakt={onPickKontakt} onPhoneChange={onPhoneChange}
                  onAddDeltagare={handleAddDeltagare} onDeleteVisning={handleDeleteVisning} onLoad={load}
                />
              ))}
            </div>
          )}
          {genomforda.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Genomförda ({genomforda.length})</p>
              {genomforda.map((v) => (
                <VisningRow
                  key={v.id} v={v} slug={slug} adress={adress} now={now}
                  expandedId={expandedId} onToggleExpand={(id) => setExpandedId(id)}
                  newDeltagare={newDeltagare} kontaktSuggestions={kontaktSuggestions} suggForId={suggForId}
                  onNamnChange={onNamnChange} onPickKontakt={onPickKontakt} onPhoneChange={onPhoneChange}
                  onAddDeltagare={handleAddDeltagare} onDeleteVisning={handleDeleteVisning} onLoad={load}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <BokaNyVisningModal slug={slug} adress={adress} onClose={() => setShowModal(false)} onSaved={() => { load(); setShowModal(false); }} />
      )}
    </div>
  );
}

function MaSec({
  id, title, badge, open, onToggle, done, onToggleDone, children,
}: {
  id: MaSection; title: string; badge?: string; open: boolean;
  onToggle: (id: MaSection) => void;
  done?: boolean; onToggleDone?: (id: MaSection) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span
            role="checkbox"
            aria-checked={!!done}
            onClick={(e) => { e.stopPropagation(); onToggleDone?.(id); }}
            title={done ? "Klart – klicka för att avmarkera" : "Markera som klart"}
            className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-[10px] transition-colors ${
              done
                ? "bg-emerald-500/25 text-emerald-700 hover:bg-emerald-500/35"
                : "border border-border bg-transparent text-transparent hover:border-emerald-500/60 hover:text-emerald-400/50"
            }`}
          >
            ✓
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{title}</span>
          {badge && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[10px] font-medium text-orange-300">
              {badge}
            </span>
          )}
          <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </div>
      </button>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}

/* ---------- Mäklarjournal (Marknad-varianten) ---------- */

const MA_MJ_ITEMS = [
  "Verkat för att säljaren lämnar de uppgifter om objektet som kan antas vara av betydelse för köparen",
  "Upprättat objektsbeskrivning",
  "Objektsbeskrivning godkänd av säljaren",
  "Energiprestanda och/eller energiklass medtagen i annons",
  "Informerat säljare om budgivningsprocess",
];

function MaMjBody() {
  const [checked, setChecked] = useState<boolean[]>(() => MA_MJ_ITEMS.map(() => false));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <BtnPrimary>
          <span onClick={() => setChecked(MA_MJ_ITEMS.map(() => true))}>Ändra alla till utförda</span>
        </BtnPrimary>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" />
          Dölj den orangea 'varningsnotifieringen'
        </label>
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {MA_MJ_ITEMS.map((label, i) => (
          <div key={i} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => setChecked((c) => c.map((v, j) => (i === j ? !v : v)))}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-orange-500/40 text-[11px] text-orange-300">+</span>
            <span className="flex-1">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Marknad (rubrik + beskrivningar) ---------- */

function MaMarknadBody() {
  const { slug } = Route.useParams();
  const obj = getObjektBySlug(slug);
  const saved = getObjektNotes(slug);

  const [rubrik, setRubrik] = useState(saved.rubrik ?? "");
  const [kortBeskr, setKortBeskr] = useState(saved.kortBeskrivning ?? "");
  const [langBeskr, setLangBeskr] = useState(saved.langBeskrivning ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved_, setSaved_] = useState(false);

  function saveTexts() {
    setObjektMarknadText(slug, { rubrik, kortBeskrivning: kortBeskr, langBeskrivning: langBeskr });
    setSaved_(true);
    setTimeout(() => setSaved_(false), 2000);
  }

  async function handleAI() {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateMarketingText({
        data: {
          adress: obj?.adress ?? slug,
          typ: obj?.typ ?? "Bostad",
          rum: obj?.rum,
          boarea: obj?.boarea,
          pris: obj?.pris,
          stad: obj?.stad,
          postnr: obj?.postnr,
          extraInfo: langBeskr ? `Befintlig text att utgå från: ${langBeskr.slice(0, 500)}` : undefined,
        },
      });
      setRubrik(result.rubrik);
      setKortBeskr(result.kort);
      setLangBeskr(result.lang);
      setObjektMarknadText(slug, {
        rubrik: result.rubrik,
        kortBeskrivning: result.kort,
        langBeskrivning: result.lang,
      });
    } catch (e: any) {
      setAiError(e?.message ?? "Okänt fel");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* AI generate button */}
      <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">AI-genererade annonstexter</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Generera rubrik + kort + lång beskrivning automatiskt baserat på objektdata
          </p>
        </div>
        <button
          onClick={handleAI}
          disabled={aiLoading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {aiLoading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Genererar…
            </>
          ) : (
            <>✨ Generera med AI</>
          )}
        </button>
      </div>

      {aiError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {aiError}
        </div>
      )}

      <Field label="Rubrik till säljande beskrivning">
        <input
          value={rubrik}
          onChange={(e) => setRubrik(e.target.value)}
          onBlur={saveTexts}
          className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
          placeholder="Ange rubrik…"
        />
      </Field>

      <Field label={`Kort säljande beskrivning (${kortBeskr.length} / max 300 tecken)`}>
        <textarea
          rows={3}
          value={kortBeskr}
          onChange={(e) => setKortBeskr(e.target.value)}
          onBlur={saveTexts}
          maxLength={300}
          className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm leading-relaxed focus:border-primary/50 focus:outline-none"
          placeholder="Kort och säljande intro…"
        />
      </Field>

      <Field label={`Lång säljande beskrivning (${langBeskr.length} tecken)`}>
        <textarea
          rows={16}
          value={langBeskr}
          onChange={(e) => setLangBeskr(e.target.value)}
          onBlur={saveTexts}
          className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm leading-relaxed focus:border-primary/50 focus:outline-none"
          placeholder="Detaljerad beskrivning av bostaden…"
        />
      </Field>

      <div className="flex items-center justify-between">
        <button
          onClick={saveTexts}
          className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          {saved_ ? "✓ Sparat!" : "Spara texter"}
        </button>
        <p className="text-[11px] text-muted-foreground">Texterna sparas lokalt och används i objektsbeskrivningen</p>
      </div>
    </div>
  );
}

/* ---------- Visningsdetaljer ---------- */

function MaVisningarBody() {
  const [showModal, setShowModal] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="vis" className="accent-primary" />Visa endast datum</label>
        <label className="flex items-center gap-2"><input type="radio" name="vis" defaultChecked className="accent-primary" />Visa datum och tid</label>
        <label className="flex items-center gap-2"><input type="radio" name="vis" className="accent-primary" />Tidsseparerade visningar</label>
      </div>
      <div className="flex justify-end">
        <BtnPrimary><span onClick={() => setShowModal(true)}>+ Lägg till visning</span></BtnPrimary>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Datum</th>
              <th className="px-3 py-2 text-left">Start</th>
              <th className="px-3 py-2 text-left">Slut</th>
              <th className="px-3 py-2 text-left">Antal tider</th>
              <th className="px-3 py-2 text-left">Visas av</th>
              <th className="px-3 py-2 text-center">På internet</th>
              <th className="px-3 py-2 text-left">Kommentar</th>
              <th className="px-3 py-2 text-left">Spekulanter</th>
            </tr>
          </thead>
          <tbody><tr><td colSpan={8} className="px-3 py-3 text-xs text-muted-foreground">Inga poster</td></tr></tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-primary/80">Visningsdetaljer</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Startdatum *"><Input placeholder="ÅÅÅÅ-MM-DD" /></Field>
                <Field label="Visas av"><Select value="Johan Karlsson" options={["Johan Karlsson", "Lisa Lindgren"]} /></Field>
                <Field label="Start tid"><Input placeholder="--:--" /></Field>
                <Field label="Sluttid"><Input placeholder="--:--" /></Field>
              </div>
              <div className="flex flex-wrap gap-5">
                <Checkbox label="Visa på marknadsdokument" />
                <Checkbox label="Visa på internet" />
                <Checkbox label="Tillåt boka visningar från hemsida" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kommentarer">
                  <textarea rows={4} className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm" />
                </Field>
                <Field label="Intern anteckning (visas inte på internet)">
                  <textarea rows={4} className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm" />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <BtnGhost>Spara och boka i kalender</BtnGhost>
                <BtnPrimary><span onClick={() => setShowModal(false)}>Spara</span></BtnPrimary>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Publicera ---------- */

function MaPubliceraBody() {
  const platforms = [
    { name: "SkandiaMäklarna", status: "Förhandsgranskning", color: "emerald", published: "2026-06-12 10:09", updated: "2026-06-12 13:40" },
    { name: "Hemnet", status: "Ej publicerad", color: "muted", link: "Priskalkyl" },
    { name: "Boneo", desc: "Bonnier annonsering" },
    { name: "Bonnier Bostadsboxen", desc: "Digital annonsering på DN, Di och Expressen + ett hundratal lokaltidningar. Kontakta bostad@bonniernews.se för mer information och demo." },
    { name: "Booli", desc: "Kostnadsfri sökmotor för bostäder." },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Generellt</div>
          <Checkbox label="Säljare/köpare godkänner att slutpris kan användas i marknadsföring." />
          <Checkbox label="Säljare/köpare godkänner att försäljningen kan användas i marknadsföring." />
        </div>
        <BtnGhost>Avpublicera alla marknadsplatser</BtnGhost>
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Marknadsplatser</div>
        <div className="rounded-md border border-border bg-background/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">SkandiaMäklarna</div>
              <div className="mt-2 grid grid-cols-[160px_1fr] gap-y-1 text-sm">
                <span className="text-muted-foreground">Nuvarande status:</span>
                <span><span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase text-emerald-700">Förhandsgranskning</span></span>
                <span className="text-muted-foreground">Publicerad:</span><span>2026-06-12 10:09</span>
                <span className="text-muted-foreground">Senast uppdaterad:</span><span>2026-06-12 13:40</span>
              </div>
            </div>
          </div>
          <button className="mt-4 w-full rounded-md border border-border py-2 text-xs uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-primary">
            Uppdatera förhandsgranskning ⚙
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {platforms.slice(1).map((p) => (
          <div key={p.name} className="rounded-md border border-border bg-card p-4">
            <div className="mb-2 font-medium">{p.name}</div>
            {p.status && (
              <div className="mb-2 text-xs">
                <span className="text-muted-foreground">Nuvarande status: </span>
                <span className="rounded bg-foreground/[0.06] px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{p.status}</span>
              </div>
            )}
            {p.link && <div className="mb-2 text-xs text-primary hover:underline cursor-pointer">{p.link}</div>}
            {p.desc && <div className="text-xs leading-relaxed text-muted-foreground">{p.desc}</div>}
            <div className="mt-3 flex justify-end">
              <button className="text-xs text-muted-foreground hover:text-foreground">⚙</button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-sm font-medium">Publicera på fler marknadsplatser?</div>
        <div className="mt-1 text-xs text-muted-foreground">Mspecs samarbetar med många marknadsplatser där ni kan publicera era objekt.</div>
      </div>
    </div>
  );
}

/* ---------- Boendekostnadskalkyl ---------- */

const BANKS = ["Handelsbanken", "ICA Banken", "Länsförsäkringar", "SEB", "Danske Bank", "Nordea"];

function MaBoendeBody() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Skicka boendekostnadskalkyl till köpare via en av våra samarbetande banker.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {BANKS.map((b) => (
          <button
            key={b}
            className="rounded-md border border-border bg-background/40 px-4 py-6 text-center text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-background/60"
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Säljare (top-level tab) ---------- */

const SALJARE_CUSTOMER = [
  { k: "Underlag kapitalvinst", s: "Ändrad av kund", sCls: "bg-amber-500/20 text-amber-200", u: "2026-06-09 00:24" },
  { k: "Driftskostnader", s: "Granskad & importerad", sCls: "bg-emerald-500/20 text-emerald-200", u: "" },
  { k: "Frågelista", s: "Granskad & importerad", sCls: "bg-emerald-500/20 text-emerald-200", u: "" },
  { k: "Bilder & Dokument", s: "Tillgänglig", sCls: "bg-sky-500/20 text-sky-200", u: "Ingen ny data från säljare" },
  { k: "Byggnadsinformation", s: "Granskad & importerad", sCls: "bg-emerald-500/20 text-emerald-200", u: "" },
];

function loadSaljare(slug: string) {
  return listKontakter().filter((k) =>
    k.objektKopplingar.some((kp) => kp.slug === slug && kp.relation === "säljare")
  );
}

function SaljareView({ onTabChange }: { onTabChange: (tab: SideTab) => void }) {
  const { slug } = Route.useParams();
  const [open, setOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [realSaljare, setRealSaljare] = useState(() => loadSaljare(slug));

  function refreshSaljare() { setRealSaljare(loadSaljare(slug)); }

  const totalPersons = realSaljare.length;

  return (
    <div className="space-y-6">
      <QuickNavBar onTabChange={onTabChange} />

      {showModal && (
        <KopplaKontaktModal
          slug={slug}
          relation="säljare"
          onClose={() => { setShowModal(false); refreshSaljare(); }}
        />
      )}

      <section className="rounded-md border border-border bg-card">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Säljare</span>
            {realSaljare.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">{realSaljare.length}</span>
            )}
            <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-primary/80 hover:underline">Hjälp - fullmakt</span>
            <span className="text-primary/80 hover:underline">Hantera dödsbo</span>
          </div>
        </button>

        {open && (
          <div className="border-t border-border px-4 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <BtnGhost>Fördela andelar</BtnGhost>
              <BtnPrimary onClick={() => setShowModal(true)}>+ Lägg till säljare</BtnPrimary>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Sorteringsordning","Namn","Andel","Pers. nr./Org. nr.","Dödsbo","Telefon","E-post","Adress","BankID","Kundenssida","Aktivitet"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {realSaljare.map((p, i) => (
                    <Fragment key={p.id}>
                      <tr>
                        <td className="px-3 py-2">
                          <select defaultValue={String(i + 1)} className="w-16 rounded-md border border-border bg-background/40 px-2 py-1 text-xs">
                            {Array.from({ length: totalPersons }, (_, j) => <option key={j}>{j + 1}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 font-medium">{p.fornamn} {p.efternamn}</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2">Nej</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.telefon ? <>📞 <a href={`tel:${p.telefon}`} className="hover:text-primary">{p.telefon}</a></> : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.epost ? <a href={`mailto:${p.epost}`} className="hover:text-primary">{p.epost} ✉</a> : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{[p.adress, p.ort].filter(Boolean).join(", ") || "—"}</td>
                        <td className="px-3 py-2"><span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700">BankID ✓</span></td>
                        <td className="px-3 py-2">Ja</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => { removeObjektKoppling(p.id, slug, "säljare"); refreshSaljare(); }}
                            className="text-xs text-rose-400 hover:text-rose-700"
                            title="Ta bort koppling"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={11} className="px-3 py-2">
                          <textarea
                            placeholder="Kommentar"
                            className="min-h-[64px] w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                          />
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  {realSaljare.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Ingen säljare kopplad ännu — använd <span className="text-primary">+ Lägg till säljare</span>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Kundens sida</h3>
          <BtnGhost>Besök Kundens Sida ↗</BtnGhost>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.04] text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Synlig för kund","Kategori","Status","Uppdaterad","Kan kunden ändra?","Skicka igen?"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SALJARE_CUSTOMER.map((c) => (
                <tr key={c.k}>
                  <td className="px-3 py-2"><input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" /></td>
                  <td className="px-3 py-2">{c.k}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11px] ${c.sCls}`}>{c.s}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{c.u}</td>
                  <td className="px-3 py-2 text-muted-foreground">🔒</td>
                  <td className="px-3 py-2"><button className="rounded bg-primary/80 px-2 py-1 text-xs text-primary-foreground">✉</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
/* ============================== Objektsbeskrivning ============================== */

// ── Innehållspooler för BRF-beskrivningar (slumpas deterministiskt per objekt) ──

const _BRF_TAGLINE_ADJ = ["Välplanerad", "Genomrenoverad", "Modern", "Charmig", "Exklusiv", "Trivsam", "Fräsch", "Rymlig och ljus"] as const;
const _BRF_TAGLINE_LOC = [
  "i populärt läge", "nära pendeltåg", "med söderläge", "med utsikt över staden",
  "nära centrum", "i eftertraktat område", "med härlig innergård", "i lugnt kvarter",
] as const;

const _BRF_HALL = [
  "Välkomnande hall med smarta förvaringslösningar och plats för ytterkläder och skor. Naturligt ljusinsläpp och ett trivsamt första intryck som binder samman bostadens rum på ett naturligt sätt.",
  "Generös entréhall med inbyggda garderober och gott om plats för ytterkläder. Ljusa väggar och ett genomtänkt entréparti skapar ett positivt välkomnande. Hallen leder smidigt vidare till bostadens övriga rum.",
  "Praktisk och väl disponerad hall med förvaringslösningar för det dagliga. Ljus och luftig med parkett som bär vidare in i bostaden. En naturlig startpunkt för ett funktionellt hem.",
  "Rymlig hall med trägolv och neutrala, ljusa väggar. Gott om plats för krokar, skor och kompletterande förvaring. Hallen binder samman bostadens rum på ett naturligt och trivsamt sätt.",
  "Stilren hal med vitmålade väggar och klinker i entrépartiet. Genomtänkta lösningar för avhängning och skoförvaring. Skapar ett luftigt och positivt första intryck.",
] as const;

const _BRF_VARDAGSRUM = [
  "Rymligt och ljust vardagsrum med generöst ljusinsläpp från stora fönster. Gott om plats för soffgrupp, tv-möbel och bokhyllor. Öppen och inbjudande känsla med trägolv i välvårdat skick.",
  "Trivsamt vardagsrum med parkettgolv och välkomnande atmosfär. Fönster mot lugnt väderstreck ger behagligt ljusinsläpp under stora delar av dagen. Rymligt för en generös soffgrupp och ett bra tv-bord.",
  "Ljust och luftigt vardagsrum med högt i tak och stora fönster. Kombineras naturligt med matplatsen och skapar ett socialt och öppet flöde. Gott om plats för möblemang och personliga detaljer.",
  "Välproportionerat vardagsrum med genomtänkt planlösning. Trivsam och inbjudande miljö med plats för både avkoppling och umgänge. Fönster mot lugn innergård ger ett rofyllt läge.",
  "Stilfullt vardagsrum med plats för en generös soffgrupp och ett väl tilltaget tv-bord. Ljust läge med fönster mot söder. Parkett i välvårdat skick och neutrala väggar som ger stor frihet i inredningen.",
] as const;

const _BRF_KOK = [
  { stil: "modernt", utr: "induktionshäll, integrerad ugn, köksfläkt, diskmaskin och kylskåp med frys", extra: "Matplatsen vid köket passar perfekt för vardagsmåltiderna." },
  { stil: "stilrent och funktionellt", utr: "spis med keramikhäll, ugn, köksfläkt, diskmaskin samt separat kylskåp och frys", extra: "Köksön ger extra arbetsyta och är en naturlig samlingsplats." },
  { stil: "genomrenoverat", utr: "induktionshäll, ugn med pyrolytisk rengöring, köksfläkt, diskmaskin och inbyggda vitvaror", extra: "Öppen planlösning mot vardagsrummet skapar ett socialt kök." },
  { stil: "välplanerat", utr: "keramikhäll, ugn, köksfläkt, diskmaskin, separat kylskåp och frys i kolonn", extra: "Gott om förvaring i välorganiserade höga skåp och lådor." },
  { stil: "tidsenligt", utr: "induktionshäll, inbyggd ugn med ångfunktion, köksfläkt, diskmaskin och kombinerad kyl-frys", extra: "Köket bjuder på goda arbetsytor och ett smart utformat förvaringssystem." },
] as const;

const _BRF_KOK_AR_OFFSET = [0, 2, 4, 7, 11, 15] as const;

const _BRF_SOVRUM1 = [
  "Rofyllt sovrum med plats för dubbelsäng, sängbord och garderober längs en hel vägg. Lugnt läge med gott om naturligt ljus och rofylld atmosfär.",
  "Välproportionerat sovrum med genomtänkt förvaring i inbyggda garderober. Rymligt för dubbelsäng med sängbordsmöbler och personliga detaljer. Lugnt och trivsamt.",
  "Trivsamt sovrum med parkettgolv och neutrala väggar. Plats för dubbelsäng samt garderober med goda förvaringsmöjligheter. Lugnt läge mot innergård.",
  "Ljust och luftigt sovrum med fönster mot tyst innergård. Rymligt för en dubbelsäng med sängbord på båda sidor. Välvårdad parkettgolv och neutrala väggar.",
  "Stilrent sovrum med vitmålade väggar och plankgolv. Gott om plats för dubbelsäng och garderober. Rofyllt och inbjudande med bra ljusinsläpp.",
] as const;

const _BRF_SOVRUM2 = [
  "Trivsamt sovrum som fungerar utmärkt som barnrum, gästrum eller hemmakontor. Ljus och luftig miljö med parkettgolv och neutrala väggar.",
  "Flexibelt rum med möjlighet att användas som sovrum, arbetsrum eller hobbyrum. Bra ljusinsläpp och neutral inredning som ger stor frihet.",
  "Praktiskt sovrum i fint skick. Passar som gäst- eller barnrum, alternativt hemmakontor. Fönster mot innergård ger ett lugnt läge.",
  "Kompakt men välplanerat sovrum som maximerar ytan. Passar barnrum, hemmakontor eller gästrum. Ljust och funktionellt.",
  "Genomtänkt sovrum med plats för enkelsäng och kompletterande förvaring. Enkelt att anpassa till barnrum, arbetsrum eller gästvind.",
] as const;

const _BRF_BADRUM_AR = [2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023] as const;
const _BRF_BADRUM = [
  (ar: number) => `Helkaklat badrum renoverat ${ar} med klinkersgolv och golvvärme. Utrustat med dusch, WC, handfat med underskåp, spegel med integrerad belysning samt tvättmaskin och torktumlare.`,
  (ar: number) => `Renoverat badrum (${ar}) med kakel och klinker i genomtänkt design. Glasduschhörna, WC, kommod med handfat, spegelskåp med belysning och plats för tvättmaskin.`,
  (ar: number) => `Välplanerat badrum renoverat ${ar} med helkaklade väggar och klinkersgolv med golvvärme. Fullt utrustat med duschutrymme, WC, handfat, spegel och tvättutrustning.`,
  (ar: number) => `Modernt badrum från ${ar} med dusch, WC och handfat i en ren och ljus design. Klinker med golvvärme, helkaklade väggar och plats för tvättmaskin.`,
  (ar: number) => `Stilrent och helkaklat badrum renoverat ${ar}. Glasdusch med inbyggda hyllor, WC, handfat i kommod, stor spegelyta med backlit belysning och kombinerad tvättmaskin.`,
] as const;

const _BRF_BALKONG = [
  { har: true, text: "Inglasad balkong mot sydost med plats för utemöbler och grill. Används som ett extra rum under stora delar av året." },
  { har: true, text: "Rymlig balkong mot söder med fin utsikt och solexponering under stora delar av dagen. Gott om plats för matgrupp och solstolar." },
  { har: true, text: "Trivsam balkong mot lugn innergård — ett fridsamt och grönt läge. Passar perfekt för morgonkaffet eller kvällsavkopplingen." },
  { har: true, text: "Generös terrass med vacker stadsvy. Privat och insynsskyddad med plats för loungemöbler och planteringar." },
  { har: false, text: "" },
] as const;

const _BRF_BYGGNAD_VENTILATION = ["Mekanisk frånluft (F)", "FTX-system med värmeåtervinning", "Mekanisk till- och frånluft", "Självdrag med mekanisk tilluft"] as const;
const _BRF_BYGGNAD_VARME = ["Fjärrvärme", "Bergvärme via föreningen", "Frånluftsvärmepump", "Fjärrvärme med individuell mätning"] as const;
const _BRF_BYGGNAD_INTERNET = ["Fiber 1 Gbit/s via föreningen", "Fiber via Tele2 (föreningsavtal)", "Bredband via Telia, 500/500 Mbit", "Fiber via Bahnhof"] as const;

const _BRF_OMRADE = [
  (ort: string) => `${ort} är ett välkänt och omtyckt område med nära tillgång till service, restauranger och kollektivtrafik. Området bjuder på ett trivsamt gatuliv och blandad bebyggelse. Kommunikationerna är goda med pendeltåg och busstrafik som tar dig till city på kort tid.`,
  (ort: string) => `Området kring ${ort} präglas av en välmående stadsdelskaraktär med butiker, kaféer och grönområden i närheten. God tillgång till skolor och förskolor. Pendeln tar dig smidigt in till central Stockholm på under 30 minuter.`,
  (ort: string) => `${ort} är ett populärt bostadsområde med ett levande kulturliv och nära till shopping och natur. Cykelvänligt med välskötta cykelbanor. Nära pendeltåg och tunnelbana som tar dig till city bekvämt.`,
  (ort: string) => `Lugn och trivsam stadsdel nära ${ort} centrum med goda kommunikationer. Nära matbutiker, apotek, restauranger och parker. Kort pendlingsavstånd till Stockholm city.`,
  (ort: string) => `${ort} erbjuder ett komplett vardagsliv med service, natur och kollektivtrafik inom bekvämt avstånd. Populärt familjeområde med bra skolor och förskolor i närheten.`,
] as const;

function bpick<T>(arr: readonly T[], h: number, rotBits: number): T {
  const mixed = ((h >>> rotBits) | (h << (32 - rotBits))) >>> 0;
  return arr[mixed % arr.length];
}

function ObjektsbeskrivningView({ adress, slug }: { adress: string; slug: string }) {
  const o = getObjektBySlug(slug);
  const notes = getObjektNotes(slug);
  const aiRubrik = notes.rubrik ?? "";
  const aiKort = notes.kortBeskrivning ?? "";
  const aiLang = notes.langBeskrivning ?? "";
  const images = pickImages(slug, o?.typ, o?.boarea);
  const heroImage = images[0];
  const rumStr = o?.rum ? String(o.rum) : "—";
  const boareaStr = o?.boarea ? `${o.boarea} m²` : "—";
  const prisStr = o?.pris ? fmtSek(o.pris) : "—";
  const ortStr = o?.stad ?? "—";
  const postnrStr = o?.postnr
    ? `${o.postnr.slice(0, 3)} ${o.postnr.slice(3)}`
    : "—";
  const typStr = o?.typ ?? "—";
  const isBrf = o?.typ === "Bostadsrätt";

  // Deterministic BRF-data based on slug
  const h = hashSlug(slug);
  const foreningsnamn = `BRF ${adress.split(" ")[0]}`;
  const orgNr = `7${(h % 10)}${((h >> 3) % 10)}${((h >> 5) % 10)}${((h >> 7) % 10)}${((h >> 9) % 10)}${((h >> 11) % 10)}-${((h >> 13) % 10)}${((h >> 15) % 10)}${((h >> 17) % 10)}${((h >> 19) % 10)}`;
  const antalLgh = 12 + (h % 60);
  const skuld = ((3000 + (h % 8000)) * (o?.boarea ?? 60)).toLocaleString("sv-SE");
  const avgift = (2500 + ((o?.boarea ?? 60) * 35)).toLocaleString("sv-SE");
  const vaning = 1 + (h % 5);
  const hiss = (h % 3) !== 0;

  // Per-objekt genererat innehåll för BRF
  const rum = o?.rum ?? 2;
  const ort = o?.stad ?? "Stockholm";
  const typByRum: Record<number, string> = { 1: "etta", 2: "tvåa", 3: "trea", 4: "fyra", 5: "femma", 6: "sexa" };
  const brfTagline = `${bpick(_BRF_TAGLINE_ADJ, h, 0)} ${typByRum[rum] ?? "bostadsrätt"} ${bpick(_BRF_TAGLINE_LOC, h, 5)}`;
  const brfHall = bpick(_BRF_HALL, h, 3);
  const brfVardagsrum = bpick(_BRF_VARDAGSRUM, h, 7);
  const brfKok = bpick(_BRF_KOK, h, 11);
  const brfKokAr = 2024 - bpick(_BRF_KOK_AR_OFFSET, h, 13);
  const brfSovrum1 = bpick(_BRF_SOVRUM1, h, 17);
  const brfSovrum2 = bpick(_BRF_SOVRUM2, h, 19);
  const brfBadrumAr = bpick(_BRF_BADRUM_AR, h, 23);
  const brfBadrum = bpick(_BRF_BADRUM, h, 9)(brfBadrumAr);
  const brfBalkong = bpick(_BRF_BALKONG, h, 15);
  const brfByggAr = 1955 + (h % 50);
  const brfVentilation = bpick(_BRF_BYGGNAD_VENTILATION, h, 21);
  const brfVarme = bpick(_BRF_BYGGNAD_VARME, h, 27);
  const brfInternet = bpick(_BRF_BYGGNAD_INTERNET, h, 25);
  const brfOmrade = bpick(_BRF_OMRADE, h, 29)(ort);
  const [layout, setLayout] = useState("Huvudbild");
  const [logoPos, setLogoPos] = useState("Vänster");
  const [rubrik, setRubrik] = useState("Gatuadress");
  const [rubrikPos, setRubrikPos] = useState("Vänster");
  const [innehallRubrik, setInnehallRubrik] = useState("Centrerad");
  const [bilder, setBilder] = useState("Ingen");
  const [inledning, setInledning] = useState("1 - säljande beskrivning(ar) och kortfakta");
  const [opts, setOpts] = useState({
    kortSalj: false, snabbfakta: false, grunddata: false,
    objektinfo: true, rubrikSalj: true, kortSalj2: true,
    langSalj: false, lan: false, assist: false, omrade: true,
    bildtext: false, planlosning: false, karta: false,
    sidnr: false, doljMaklare: false, qrPdf: true,
  });
  const set = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="flex flex-col gap-4 pl-2 lg:flex-row">
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
            Objektsbeskrivning
            <span className="text-muted-foreground">▾</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-border px-2 py-1 text-xs hover:border-primary/40 hover:text-primary">🖨 Skriv ut</button>
            <button className="rounded border border-border px-2 py-1 text-xs hover:border-primary/40 hover:text-primary">💾 Spara PDF</button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-white text-neutral-900 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
          <div className="relative w-full overflow-hidden p-10">
            <div className="flex items-start justify-between">
              <div style={serif} className="text-2xl tracking-wide text-neutral-800">
                SkandiaMäklarna
                <div className="mt-1 text-[10px] tracking-[0.4em] text-neutral-500">— REAL ESTATE —</div>
              </div>
              {opts.qrPdf && (
                <div className="grid h-16 w-16 grid-cols-6 grid-rows-6 gap-[1px] bg-neutral-900 p-1">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div key={i} className={(i * 37) % 3 === 0 ? "bg-white" : "bg-neutral-900"} />
                  ))}
                </div>
              )}
            </div>
            <div className="mt-10 overflow-hidden rounded">
              <img src={heroImage} alt={adress} className="h-[420px] w-full object-cover" />
            </div>
            <div className="mt-8 text-center">
              <div style={serif} className="text-4xl text-neutral-800">{adress}</div>
              <div className="mt-2 text-sm text-neutral-500">{ortStr}</div>
            </div>
          </div>

          <div className="h-px bg-neutral-200" />

          <div className="p-10">
            {isBrf ? (
              <>
                <h2 style={serif} className="text-center text-2xl text-neutral-800">{aiRubrik || brfTagline}</h2>
                {aiKort && <p className="mt-4 text-center text-sm text-neutral-600 italic leading-relaxed max-w-2xl mx-auto">{aiKort}</p>}

                <h3 style={serif} className="mt-8 text-xl text-neutral-800">Snabbfakta</h3>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Pb k="Rum" v={rumStr} /><Pb k="Boarea" v={boareaStr} />
                  <Pb k="Månadsavgift" v={`${avgift} kr/mån`} /><Pb k="Pris" v={prisStr} />
                  <Pb k="Våning" v={`${vaning} tr${hiss ? " (hiss)" : ""}`} /><Pb k="Byggår" v={String(brfByggAr)} />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Om bostaden</h3>
                <div className="mt-3 grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                  <Pr k="Bostadstyp" v="Bostadsrätt" />
                  <Pr k="Gatuadress" v={adress} />
                  <Pr k="Postnummer" v={postnrStr} />
                  <Pr k="Ort" v={ortStr} />
                  <Pr k="Boarea" v={boareaStr} />
                  <Pr k="Areauppgift enligt" v="Mätning" />
                  <Pr k="Antal rum" v={rumStr} />
                  <Pr k="Våning" v={`${vaning} tr`} />
                  <Pr k="Hiss" v={hiss ? "Ja" : "Nej"} />
                  <Pr k="Byggår" v={String(brfByggAr)} />
                  <Pr k="Typ av uppvärmning" v={brfVarme} />
                  <Pr k="Ventilation" v={brfVentilation} />
                  <Pr k="Internet" v={brfInternet} />
                  <Pr k="Pris" v={`${prisStr}, utgångspris`} />
                  <Pr k="Tillträde" v="Enligt överenskommelse" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Förening</h3>
                <div className="mt-3 grid grid-cols-[220px_1fr] gap-y-2 text-sm">
                  <Pr k="Föreningens namn" v={foreningsnamn} />
                  <Pr k="Organisationsnummer" v={orgNr} />
                  <Pr k="Antal lägenheter" v={String(antalLgh)} />
                  <Pr k="Föreningens skuld" v={`${skuld} SEK`} />
                  <Pr k="Månadsavgift" v={`${avgift} kr/mån`} />
                  <Pr k="Avgiften inkluderar" v="Värme, vatten, sopor, kabel-TV" />
                  <Pr k="Senaste årsredovisning" v="2024" />
                </div>

                {aiLang && (
                  <div className="mt-8">
                    <h3 style={serif} className="text-xl text-neutral-800">Beskrivning</h3>
                    <div className="mt-3 space-y-4 text-sm leading-relaxed text-neutral-700">
                      {aiLang.split(/\n\n+/).filter(Boolean).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>
                )}

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Rumsbeskrivning</h3>
                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                  <RumP titel="HALL" text={brfHall} />
                  <RumP titel="VARDAGSRUM" text={brfVardagsrum} />
                  <RumP
                    titel="KÖK"
                    text={`${brfKok.stil.charAt(0).toUpperCase() + brfKok.stil.slice(1)} kök renoverat ${brfKokAr} med gott om arbetsyta och välorganiserad förvaring. Utrustat med ${brfKok.utr}. ${brfKok.extra}`}
                  />
                  {rum >= 2 && <RumP titel="SOVRUM 1" text={brfSovrum1} />}
                  {rum >= 3 && <RumP titel="SOVRUM 2" text={brfSovrum2} />}
                  {rum >= 4 && <RumP titel="SOVRUM 3" text="Ytterligare sovrum med flexibel användning — passar som barnrum, gästrum eller arbetsrum." />}
                  <RumP titel="BADRUM" text={brfBadrum} />
                  {brfBalkong.har && <RumP titel="BALKONG" text={brfBalkong.text} />}
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Kostnader</h3>
                <div className="mt-3 grid grid-cols-[220px_1fr] gap-y-2 text-sm">
                  <Pr k="Månadsavgift" v={`${avgift} kr/mån`} />
                  <Pr k="Avgiften inkluderar" v="Värme, vatten, sopor, kabel-TV" />
                  <Pr k="Fastighetsskatt/-avgift" v="Ingår i månadsavgiften" />
                  <Pr k="Energistatus" v="Energideklaration är beställd" />
                  <Pr k="Internet/TV" v={brfInternet} />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Områdesbeskrivning</h3>
                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                  <p>{brfOmrade}</p>
                </div>
              </>
            ) : (
              <>
                <h2 style={serif} className="text-center text-2xl text-neutral-800">
                  {aiRubrik || "Charmigt hus från 1944 i grönskande miljö"}
                </h2>
                {aiKort && <p className="mt-4 text-center text-sm text-neutral-600 italic leading-relaxed max-w-2xl mx-auto">{aiKort}</p>}
                {aiLang && (
                  <div className="mt-8">
                    <h3 style={serif} className="text-xl text-neutral-800">Beskrivning</h3>
                    <div className="mt-3 space-y-4 text-sm leading-relaxed text-neutral-700">
                      {aiLang.split(/\n\n+/).filter(Boolean).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>
                )}

                <h3 style={serif} className="mt-8 text-xl text-neutral-800">Snabbfakta</h3>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Pb k="Rum" v={rumStr} /><Pb k="Boarea" v={boareaStr} />
                  <Pb k="Biarea (BIA)" v="65 m²" /><Pb k="Tomtareal/mark" v="1 994,5 m²" />
                  <Pb k="Pris" v={prisStr} /><Pb k="Pristyp" v="Utgångspris" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Om bostaden</h3>
                <div className="mt-3 grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                  <Pr k="Bostadstyp" v={`Objektstyp, ${typStr.toLowerCase()}`} />
                  <Pr k="Fastighetsbeteckning" v="HUDDINGE NYINGEN 5" />
                  <Pr k="Typkod" v="220 - Småhusenhet, bebyggd" />
                  <Pr k="Område" v="Länna" />
                  <Pr k="Gatuadress" v={adress} />
                  <Pr k="Postnummer" v={postnrStr} />
                  <Pr k="Ort" v={ortStr} />
                  <Pr k="Tomtbeskrivning" v="Stor och uppvuxen trädgårdstomt med gott om plats för både lek, odling och avkoppling. Tomten präglas av generösa gräsytor, slingrande gångar och en rik variation av träd, buskar och planteringar som skapar en grönskande och privat miljö." />
                  <Pr k="Tomtarealuppgifter enligt" v="Lantmäteriet" />
                  <Pr k="Tomtareal/mark" v="1 994,5 m²" />
                  <Pr k="Totalareal" v="1 994,5 m²" />
                  <Pr k="Boarea" v={boareaStr} />
                  <Pr k="Biarea (BIA)" v="65 m²" />
                  <Pr k="Areauppgift enligt" v="Mätning" />
                  <Pr k="Antal rum" v={rumStr} />
                  <Pr k="Antal sovrum" v="2" />
                  <Pr k="Max antal sovrum" v="3" />
                  <Pr k="Taxeringsår" v="2024" />
                  <Pr k="Taxeringsvärdet är" v="Fastställt" />
                  <Pr k="Värdeår" v="1944" />
                  <Pr k="Taxeringsvärde byggnad" v="1 511 000 SEK" />
                  <Pr k="Taxeringsvärde mark" v="2 605 000 SEK" />
                  <Pr k="Summa taxeringsvärde" v="4 116 000 SEK" />
                  <Pr k="Pris" v={`${prisStr}, utgångspris`} />
                  <Pr k="Tillträde" v="Enligt överenskommelse" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Rumsbeskrivning</h3>
                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                  <RumP titel="HALL, Entréplan" text="Välkomnande hall med vitmålade väggar och ljust trägolv som är genomgående i stora delar av bostaden. Här finns plats för avhängning av ytterkläder och skor samt utrymme för ytterligare förvaring. Hallen binder samman bostadens rum och ger ett ljust och trivsamt första intryck." />
                  <RumP titel="GÄST-WC, Entréplan" text="Praktisk gäst-WC med fönster som ger naturligt ljusinsläpp. Väggarna är delvis kaklade med vitt kakel och blå dekor. Utrustad med WC, handfat, spegel samt ett väggskåp." />
                  <RumP titel="VARDAGSRUM, Entréplan" text="Rymligt vardagsrum med parkettgolv, ljusgröna väggar och generöst ljusinsläpp från stora fönster i två väderstreck. Här finns gott om plats för en större soffgrupp, tv-möbel och annat möblemang." />
                  <RumP titel="MATRUM, Entréplan" text="Ljust och trivsamt matrum med trägolv, vitmålade väggar och stort fönster. Gott om plats för ett större matbord. Placerat i anslutning till både vardagsrum och kök, vilket skapar ett naturligt flöde." />
                  <RumP titel="KÖK, Entréplan" text="Trivsamt kök från 2003 med gott om arbetsyta och förvaring bakom köksluckor i trä. Utrustat med spis, ugn, fläkt, diskmaskin samt kombinerad kyl och frys. Stort fönster ger fint ljusinsläpp." />
                  <RumP titel="SOVRUM 1, Entréplan" text="Rofyllt sovrum med trägolv och väggar i grå kulör kombinerat med en mönstrad fondtapet. Plats för dubbelsäng samt förvaring i garderober." />
                  <RumP titel="SOVRUM 2, Entréplan" text="Trivsamt sovrum med målade väggar i blågrå kulör och parkettgolv. Passar som barnrum, gästrum eller arbetsrum." />
                  <RumP titel="GROVINGÅNG, Källare" text="Praktisk groventré på källarplanet med egen entré utifrån. Gott om plats för avhängning och kompletterande förvaring." />
                  <RumP titel="WC, Källare" text="WC på källarplanet med målade väggar i grå kulör. Utrustad med WC, handfat, spegel och väggskåp." />
                  <RumP titel="PANNRUM/FÖRVARING, Källare" text="Pannrum med plats för teknisk utrustning samt goda förvaringsmöjligheter. Husets bergvärmepump från Nibe, installerad 2025 (Nibe S1256-13, borrdjup 260 m)." />
                  <RumP titel="BADRUM & TVÄTT, Källare" text="Rymligt badrum, renoverat 2017, med klinkergolv och helkaklade väggar. Utrustat med duschhörna, badkar, kommod, högskåp samt tvättpelare." />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Inteckningar</h3>
                <div className="mt-3 grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                  <Pr k="Inteckningar" v="5" />
                  <Pr k="Totalt belopp" v="4 484 000 SEK" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Kostnader</h3>
                <div className="mt-3 grid grid-cols-[220px_1fr] gap-y-2 text-sm">
                  <Pr k="Årlig elförbrukning" v="10 393 kWh/år" />
                  <Pr k="Hushållsel" v="13 311 SEK/år" />
                  <Pr k="Uppvärmning" v="12 538 SEK/år" />
                  <Pr k="Vatten och avlopp" v="5 399 SEK/år" />
                  <Pr k="Renhållning" v="3 287 SEK/år" />
                  <Pr k="Sommarvatten" v="500 SEK/år" />
                  <Pr k="Summa driftskostnad" v="35 035 SEK/år" />
                  <Pr k="Antal personer i hushållet" v="3" />
                  <Pr k="Fastighetsskatt/-avgift" v="10 425 SEK/år" />
                  <Pr k="Försäkring" v="Hemförsäkring tillkommer för köpare. (Säljare har Gjensidige villaförsäkring)" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Övriga rättigheter och belastningar</h3>
                <div className="mt-3 grid grid-cols-[220px_1fr] gap-y-2 text-sm">
                  <Pr k="Planer och bestämmelser" v="Länna 4:30 mfl, Detaljplan (1993-11-22, senast ändrad 2022-08-29)" />
                  <Pr k="Rättigheter förmån" v="Officialservitut: VATTENLEDNING" />
                  <Pr k="Rättigheter förmån" v="Officialservitut: AVLOPP" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Byggnad</h3>
                <div className="mt-3 grid grid-cols-[220px_1fr] gap-y-2 text-sm">
                  <Pr k="Byggnadstyp" v="1-planshus med källare" />
                  <Pr k="Byggår" v="1944" />
                  <Pr k="Standardpoäng" v="32" />
                  <Pr k="Utförda renoveringar" v="2025-08 byte källardörr. 2025-02 bergvärmepump driftsattes (Nibe S1256-13, 260 m). 2024-10 tilläggsisolering vind ca 300 mm cellulosa. 2017 badrum källare. 2015 fönster entréplan. 2003 kök. 2000 V/A samt papp på taket." />
                  <Pr k="Grund" v="Källare" />
                  <Pr k="Taktyp/takbeklädnad" v="Papp" />
                  <Pr k="Fasadtyp" v="Träfasad" />
                  <Pr k="Fönster" v="3-glasfönster isoler" />
                  <Pr k="Stomme" v="Trä" />
                  <Pr k="Bjälklag" v="Trä" />
                  <Pr k="Vatten" v="Kommunalt vatten året om" />
                  <Pr k="Avlopp" v="Kommunalt avlopp" />
                  <Pr k="Typ av uppvärmning" v="Bergvärmepump" />
                  <Pr k="Märke på värmeanläggning" v="Nibe" />
                  <Pr k="Typ av ventilation" v="Självdrag" />
                  <Pr k="Huvudsäkring" v="25 A" />
                  <Pr k="Jordat eller ojordat" v="Jordat" />
                  <Pr k="Radon kommentar" v="Korttidsmätning gjord tidigare, se separat protokoll." />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Parkering & uteplats</h3>
                <div className="mt-3 grid grid-cols-[220px_1fr] gap-y-2 text-sm">
                  <Pr k="Parkeringsbeskrivning" v="Carport med plats för två bilar" />
                  <Pr k="Uteplatsbeskrivning" v="Generös altan delvis under tak med plats för matgrupp och grill. I anslutning finns en stenlagd uteplats under pergola för loungemöbler, omgiven av grönska och klätterväxter." />
                  <Pr k="Övriga byggnader" v="Förråd/Vedbod samt äldre hus på baksidan av tomten (dåligt skick)" />
                  <Pr k="TV/internet" v="Fiber – Bundet Telia nov 2026" />
                  <Pr k="Energistatus" v="Energideklaration är beställd" />
                </div>

                <h3 style={serif} className="mt-10 text-xl text-neutral-800">Områdesbeskrivning</h3>
                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                  <p><strong>OMRÅDET:</strong> Länna är ett idylliskt villaområde med närhet till sjö och skog. Länna Handelsplats med affärer ligger på nära avstånd, och området har även kort bilavstånd till Farsta och Haninge centrum. Till City tar man sig med bil på endast 20 minuter.</p>
                  <p><strong>SKOLA:</strong> I Länna finns förskola (Blåbärsstället) samt Engelska skolan. Mer information finns på www.huddingekommun.se.</p>
                  <p><strong>FRITID:</strong> I Skogås finns ett stort utbud av aktiviteter; tennis, badminton, basket, dans, fotboll och simhall. Vintertid finns skidspår och långfärdskridskoåkning på Drevviken och Magelungen. Ca 4 km bort ligger Ågesta Friluftsområde.</p>
                  <p><strong>CENTRUM / KOMMUNIKATIONER:</strong> Skogås centrum erbjuder butiker, restauranger, systembolag, apotek och vårdcentral. Pendeltåg går till Stockholm och Västerhaninge/Nynäshamn.</p>
                </div>
              </>
            )}

            <h3 style={serif} className="mt-10 text-xl text-neutral-800">Kontakter</h3>
            <div className="mt-3 text-sm">
              <div className="text-neutral-500">Ansvarig mäklare</div>
              <div className="font-medium">Max Stendahl</div>
              <div>Fastighetsmäklare</div>
              <div>max.stendahl@skandiamaklarna.se</div>
              <div>070-959 73 70</div>
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 rounded-md border border-border bg-card lg:w-[320px]">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Objektsbeskrivning</span>
          <button className="text-muted-foreground hover:text-foreground">✕</button>
        </header>
        <div className="space-y-5 overflow-y-auto p-4 text-sm" style={{ maxHeight: "calc(100vh - 240px)" }}>
          <ObSelect label="Position logotyp" value={logoPos} onChange={setLogoPos} options={["Vänster", "Centrerad", "Höger"]} />
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Layout förstasida</div>
            <ObSelect label="Layout" value={layout} onChange={setLayout} options={["Huvudbild", "Collage", "Endast text"]} />
            <ObSelect label="Rubrik" value={rubrik} onChange={setRubrik} options={["Gatuadress", "Säljande rubrik", "Anpassad"]} />
            <ObCheck label="Kort säljande beskrivning" checked={opts.kortSalj} onChange={() => set("kortSalj")} />
            <ObCheck label="Snabbfakta" checked={opts.snabbfakta} onChange={() => set("snabbfakta")} />
            <ObSelect label="Position rubrik" value={rubrikPos} onChange={setRubrikPos} options={["Vänster", "Centrerad", "Höger"]} />
            <ObCheck label="Grunddata på ny sida" checked={opts.grunddata} onChange={() => set("grunddata")} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Layout innehåll</div>
            <ObSelect label="Inledning" value={inledning} onChange={setInledning} options={[
              "1 - säljande beskrivning(ar) och kortfakta",
              "2 - säljande beskrivning(ar)",
              "3 - endast kortfakta",
            ]} />
            <ObCheck label="Objektinformation" checked={opts.objektinfo} onChange={() => set("objektinfo")} />
            <div className="ml-5 space-y-1">
              <ObCheck label="Rubrik säljande beskrivning" checked={opts.rubrikSalj} onChange={() => set("rubrikSalj")} />
              <ObCheck label="Kort säljande beskrivning" checked={opts.kortSalj2} onChange={() => set("kortSalj2")} />
              <ObCheck label="Lång säljande beskrivning" checked={opts.langSalj} onChange={() => set("langSalj")} />
              <ObCheck label="Län och kommun" checked={opts.lan} onChange={() => set("lan")} />
              <ObCheck label="Assisterande" checked={opts.assist} onChange={() => set("assist")} />
              <ObCheck label="Områdesbeskrivning" checked={opts.omrade} onChange={() => set("omrade")} />
            </div>
            <ObSelect label="Position rubrik och kort säljande beskrivning" value={innehallRubrik} onChange={setInnehallRubrik} options={["Vänster", "Centrerad", "Höger"]} />
            <ObSelect label="Bilder" value={bilder} onChange={setBilder} options={["Ingen", "1 stor", "2 i bredd", "Galleri"]} />
            <ObCheck label="Bildtexter" checked={opts.bildtext} onChange={() => set("bildtext")} />
            <ObCheck label="Planlösning" checked={opts.planlosning} onChange={() => set("planlosning")} />
            <ObCheck label="Karta" checked={opts.karta} onChange={() => set("karta")} />
            <ObCheck label="Visa sidnumrering" checked={opts.sidnr} onChange={() => set("sidnr")} />
            <ObCheck label="Dölj mäklarinformation" checked={opts.doljMaklare} onChange={() => set("doljMaklare")} />
            <ObCheck label="Skapa PDF med QR-kod" checked={opts.qrPdf} onChange={() => set("qrPdf")} />
          </div>
          <button className="w-full rounded border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary">Lägg till bilaga från Filer</button>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Underskrifter</div>
        </div>
      </aside>
    </div>
  );
}

function Pb({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-neutral-100 py-1"><span className="text-neutral-600">{k}</span><span className="text-neutral-900">{v}</span></div>;
}
function Pr({ k, v }: { k: string; v: string }) {
  return <><div className="py-1 text-neutral-600">{k}</div><div className="py-1 text-neutral-900">{v}</div></>;
}
function RumP({ titel, text }: { titel: string; text: string }) {
  return <div><div className="font-medium text-neutral-800">{titel}</div><div className="text-neutral-700">{text}</div></div>;
}
function ObCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-primary" />
      <span>{label}</span>
    </label>
  );
}
function ObSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
