import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import {
  analyzeRoomImages,
  finalizeRoomText,
  type RoomClarification,
} from "../lib/ai.functions";
import {
  type Brf, tomBrf,
  type BrfFile, type BrfImage, type BrfByggnad, type BrfKontakt,
  INGAR_I_AVGIFTEN,
} from "../lib/brfTypes";
import { saveBrf, deleteBrf, searchBrfs, type SavedBrf } from "../lib/brfStore";
import { useUserRole, isKontorschef } from "../lib/userRole";
import { saveObjekt } from "../lib/objektStore";
import { slugifyAddr, type Typ } from "../data/objekt";
import { listKontakter, addObjektKoppling } from "../lib/kontaktStore";
import { getSession } from "../lib/supabaseAuth";
import type { Kontakt } from "../lib/kontaktTypes";
import { AddressInput } from "../components/AddressInput";

export const Route = createFileRoute("/objekt/nytt")({
  head: () => ({
    meta: [
      { title: "Nytt objekt · Stendahl CRM" },
      { name: "description", content: "Mata in ett nytt objekt med AI-stöd för rumstexter." },
    ],
  }),
  component: ObjektsformularPage,
});

type ObjektsTyp = "brf" | "villa" | "radhus";

const TYP_LABELS: Record<ObjektsTyp, string> = {
  brf: "Bostadsrätt",
  villa: "Villa",
  radhus: "Radhus",
};

const FLOORS = ["Entréplan", "Plan 2", "Plan 3", "Källare", "Vind"];

const QUICK_ROOMS = [
  "Hall",
  "Vardagsrum",
  "Kök",
  "Matrum",
  "Sovrum",
  "Badrum",
  "WC",
  "Tvätt",
  "Balkong",
  "Allrum",
];

type RoomImage = { id: string; name: string; dataUrl: string };
type Answer = { id: string; question: string; answer: string };
type Room = {
  id: number;
  name: string;
  floor: string;
  notes: string;
  images: RoomImage[];
  // AI state
  aiStatus: "idle" | "analyzing" | "needs-input" | "finalizing" | "done" | "error";
  aiError?: string;
  aiDraft?: string;
  aiObserved?: string[];
  aiQuestions?: RoomClarification[];
  aiAnswers?: Answer[];
};

type Grund = {
  adress: string; ort: string; omrade: string; pris: string; boarea: string;
  rum: string; avgift: string; forening: string; nyckelord: string;
};
type Byggnad = {
  byggar: string; byggnadstyp: string; tomt: string; biarea: string; varme: string;
  fasad: string; fonster: string; vatten: string; el: string; ventilation: string; ovrigt: string;
};

const tomGrund: Grund = { adress: "", ort: "", omrade: "", pris: "", boarea: "", rum: "", avgift: "", forening: "", nyckelord: "" };
const tomByggnad: Byggnad = { byggar: "", byggnadstyp: "", tomt: "", biarea: "", varme: "", fasad: "", fonster: "", vatten: "", el: "", ventilation: "", ovrigt: "" };

function formatSwedishNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  // Gruppera bara större tal så att t.ex. årtal (1998) inte blir "1 998".
  if (digits.length < 5) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function ObjektsformularPage() {
  const [type, setType] = useState<ObjektsTyp>("villa");
  const userRole = useUserRole();
  const canDeleteBrf = isKontorschef(userRole);
  const [grund, setGrund] = useState<Grund>(tomGrund);
  const [byggnad, setByggnad] = useState<Byggnad>(tomByggnad);
  const [brf, setBrf] = useState<Brf>(tomBrf);
  const [brfQuery, setBrfQuery] = useState("");
  const [brfPickerOpen, setBrfPickerOpen] = useState(false);
  const [brfSavedTick, setBrfSavedTick] = useState(0);
  const [brfSavedMsg, setBrfSavedMsg] = useState<string | null>(null);
  const [loadedBrfId, setLoadedBrfId] = useState<string | null>(null);
  type BrfTab = "grunddata" | "byggnader" | "parkering" | "kostnader" | "kontakter" | "filer" | "bilder" | "webbadresser" | "bostader";
  const [brfTab, setBrfTab] = useState<BrfTab>("grunddata");
  const brfMatches = useMemo<SavedBrf[]>(() => {
    // Re-read on tick changes too
    void brfSavedTick;
    return searchBrfs(brfQuery).slice(0, 8);
  }, [brfQuery, brfSavedTick]);

  function loadBrf(saved: SavedBrf) {
    const { id: _id, savedAt: _savedAt, ...rest } = saved;
    // Defensiv merge så äldre sparade föreningar (utan nya fält) fungerar
    setBrf({ ...tomBrf, ...rest });
    setLoadedBrfId(saved.id);
    setBrfPickerOpen(false);
    setBrfQuery("");
    setBrfTab("grunddata");
  }
  function handleSaveBrf() {
    if (!brf.namn.trim() && !brf.orgnr.trim()) {
      setBrfSavedMsg("Ange minst namn eller org.nr för att spara.");
      return;
    }
    const entry = saveBrf(brf);
    setLoadedBrfId(entry.id);
    setBrfSavedTick((t) => t + 1);
    setBrfSavedMsg(`Sparat: ${entry.namn || entry.orgnr}`);
    setTimeout(() => setBrfSavedMsg(null), 2500);
  }
  function handleDeleteBrf(id: string) {
    if (!canDeleteBrf) {
      window.alert(
        "Du har inte behörighet att ta bort bostadsrättsföreningar.\n\nEndast kontorschef kan utföra denna åtgärd."
      );
      return;
    }
    const target = searchBrfs("").find((b) => b.id === id);
    const namn = target?.namn || target?.orgnr || "denna förening";
    const ok = window.confirm(
      `⚠️ VARNING – Permanent borttagning\n\n` +
      `Du är på väg att ta bort föreningen:\n"${namn}"\n\n` +
      `Detta går INTE att ångra. All data om föreningen försvinner och kan påverka kopplade objekt.\n\n` +
      `Är du helt säker på att du vill fortsätta?`
    );
    if (!ok) return;
    deleteBrf(id);
    if (loadedBrfId === id) setLoadedBrfId(null);
    setBrfSavedTick((t) => t + 1);
  }
  function newBrf() {
    setBrf(tomBrf);
    setLoadedBrfId(null);
  }
  const [saljareKontakt, setSaljareKontakt] = useState<Kontakt | null>(null);
  const [saljareQuery, setSaljareQuery] = useState("");
  const [saljareOpen, setSaljareOpen] = useState(false);
  const saljareMatches = useMemo(() => {
    const q = saljareQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return listKontakter()
      .filter((k) => `${k.fornamn} ${k.efternamn} ${k.telefon}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [saljareQuery]);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [counter, setCounter] = useState(0);
  type CustomField = {
    id: string;
    label: string;
    value: string;
    visInternet: boolean;
    visProspekt: boolean;
  };
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  function addCustomField(label = "") {
    setCustomFields((f) => [
      ...f,
      { id: crypto.randomUUID(), label, value: "", visInternet: true, visProspekt: true },
    ]);
  }
  function patchCustomField(id: string, patch: Partial<CustomField>) {
    setCustomFields((f) => f.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCustomField(id: string) {
    setCustomFields((f) => f.filter((c) => c.id !== id));
  }
  const navigate = useNavigate();
  const [savedObjMsg, setSavedObjMsg] = useState<string | null>(null);

  async function handleSaveObjekt() {
    if (!grund.adress.trim()) {
      setSavedObjMsg("Ange minst adress för att spara objektet.");
      setTimeout(() => setSavedObjMsg(null), 3000);
      return;
    }
    // Dela "12345 Ort" → postnr + stad
    const ortRaw = grund.ort.trim();
    const m = ortRaw.match(/^\s*(\d{3}\s?\d{2})\s+(.+)$/);
    const postnr = m ? m[1].replace(/\s/g, "") : "";
    const stad = m ? m[2].trim() : (ortRaw || grund.omrade.trim());
    const typMap: Record<ObjektsTyp, Typ> = {
      brf: "Bostadsrätt",
      villa: "Villa",
      radhus: "Radhus",
    };
    const pris = Number(grund.pris.replace(/\D/g, "")) || 0;
    const boarea = Number(String(grund.boarea).replace(",", ".")) || 0;
    const rum = Number(String(grund.rum).replace(",", ".")) || 0;
    const authUser = await getSession();
    const saljareNamn = saljareKontakt
      ? `${saljareKontakt.fornamn} ${saljareKontakt.efternamn}`
      : "";
    const entry = saveObjekt({
      adress: grund.adress.trim(),
      postnr,
      stad,
      typ: typMap[type],
      rum,
      boarea,
      pris,
      saljare: saljareNamn,
      ansvarig: authUser?.name ?? "Max Stendahl",
      status: "Under intag",
      kalla: "Eget upplägg",
    });
    if (saljareKontakt) {
      addObjektKoppling(saljareKontakt.id, {
        slug: slugifyAddr(entry.adress),
        relation: "säljare",
        addedAt: Date.now(),
        anteckning: "",
      });
    }
    setSavedObjMsg(`Sparat: ${entry.adress}`);
    setTimeout(() => {
      setSavedObjMsg(null);
      navigate({ to: "/objekt/$slug", params: { slug: slugifyAddr(entry.adress) }, search: { tab: undefined, q: undefined } });
    }, 900);
  }

  const analyzeFn = useServerFn(analyzeRoomImages);
  const finalizeFn = useServerFn(finalizeRoomText);

  function patchRoom(id: number, patch: Partial<Room>) {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRoom(name: string, floor = "Entréplan") {
    const id = counter;
    setCounter((c) => c + 1);
    setRooms((rs) => [...rs, {
      id, name, floor, notes: "", images: [], aiStatus: "idle",
    }]);
  }

  function deleteRoom(id: number) {
    setRooms((rs) => rs.filter((r) => r.id !== id));
  }

  function handleFiles(id: number, fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result ?? "");
        setRooms((rs) => rs.map((r) => r.id === id ? {
          ...r,
          images: [...r.images, { id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, dataUrl }],
        } : r));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(roomId: number, imageId: string) {
    setRooms((rs) => rs.map((r) => r.id === roomId
      ? { ...r, images: r.images.filter((i) => i.id !== imageId) }
      : r));
  }

  async function analyzeRoom(room: Room) {
    if (room.images.length === 0) return;
    patchRoom(room.id, { aiStatus: "analyzing", aiError: undefined });
    try {
      const res = await analyzeFn({
        data: {
          roomName: room.name || "Rum",
          floor: room.floor,
          propertyType: TYP_LABELS[type],
          existingNotes: room.notes,
          images: room.images.map((i) => ({ name: i.name, dataUrl: i.dataUrl })),
        },
      });
      const answers: Answer[] = res.clarifications.map((c) => ({ id: c.id, question: c.question, answer: "" }));
      patchRoom(room.id, {
        aiDraft: res.description,
        aiObserved: res.observed,
        aiQuestions: res.clarifications,
        aiAnswers: answers,
        aiStatus: res.clarifications.length > 0 ? "needs-input" : "done",
        notes: res.clarifications.length === 0 && res.description
          ? (room.notes ? room.notes + "\n\n" + res.description : res.description)
          : room.notes,
      });
    } catch (e: any) {
      patchRoom(room.id, { aiStatus: "error", aiError: e?.message ?? "Något gick fel." });
    }
  }

  function setAnswer(roomId: number, qid: string, value: string) {
    setRooms((rs) => rs.map((r) => r.id === roomId
      ? { ...r, aiAnswers: (r.aiAnswers ?? []).map((a) => a.id === qid ? { ...a, answer: value } : a) }
      : r));
  }

  async function finalizeRoom(room: Room) {
    const unanswered = (room.aiAnswers ?? []).some((a) => !a.answer);
    if (unanswered) return;
    patchRoom(room.id, { aiStatus: "finalizing", aiError: undefined });
    try {
      const res = await finalizeFn({
        data: {
          roomName: room.name,
          floor: room.floor,
          baseDescription: room.aiDraft ?? "",
          observed: room.aiObserved ?? [],
          answers: (room.aiAnswers ?? []).map((a) => ({ question: a.question, answer: a.answer })),
          existingNotes: room.notes,
        },
      });
      patchRoom(room.id, {
        aiStatus: "done",
        notes: room.notes ? room.notes + "\n\n" + res.text : res.text,
      });
    } catch (e: any) {
      patchRoom(room.id, { aiStatus: "error", aiError: e?.message ?? "Något gick fel." });
    }
  }

  const totalImages = rooms.reduce((a, r) => a + r.images.length, 0);
  const filledFields = Object.values(grund).filter(Boolean).length +
    (type !== "brf"
      ? Object.values(byggnad).filter(Boolean).length
      : Object.values(brf).filter(Boolean).length) +
    customFields.filter((c) => c.label.trim() && c.value.trim()).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 pb-32 pt-10">
        <section className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Nytt objekt</div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serifStyle}>
              Lägg upp ett objekt<span className="text-primary">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Fakta, foton och anteckningar per rum. AI:n läser av bilderna, frågar dig vid osäkerhet, och skriver färdig text.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Stat label="Rum" value={String(rooms.length)} />
            <div className="h-8 w-px bg-muted/60" />
            <Stat label="Bilder" value={String(totalImages)} />
            <div className="h-8 w-px bg-muted/60" />
            <Stat label="Fält" value={String(filledFields)} />
            <div className="h-8 w-px bg-muted/60" />
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleSaveObjekt}
                className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Spara objekt
              </button>
              {savedObjMsg && (
                <span className="text-[10px] normal-case tracking-normal text-primary">{savedObjMsg}</span>
              )}
            </div>
          </div>
        </section>

        <Card>
          <SectionTitle eyebrow="01" title="Objekttyp" />
          <div className="mb-8 flex flex-wrap gap-2">
            {(Object.keys(TYP_LABELS) as ObjektsTyp[]).map((t) => {
              const active = type === t;
              return (
                <button key={t} onClick={() => setType(t)}
                  className={[
                    "rounded-full border px-5 py-2 text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_30px_-8px_var(--primary)]"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  ].join(" ")}>
                  {TYP_LABELS[t]}
                </button>
              );
            })}
          </div>

          <SectionTitle eyebrow="02" title="Grundinfo" />
          <Grid>
            <AdressFalt
              value={grund.adress}
              onChange={(adress, ort, omrade) =>
                setGrund((g) => ({ ...g, adress, ort: ort ?? g.ort, omrade: omrade ?? g.omrade }))
              }
            />
            <Field label="Postnummer och ort" value={grund.ort} onChange={(v) => setGrund({ ...grund, ort: v })} placeholder="T.ex. 123 45 Stockholm" />
            <Field label="Område / stadsdel" value={grund.omrade} onChange={(v) => setGrund({ ...grund, omrade: v })} placeholder="T.ex. Södermalm" />
          </Grid>
          <Grid cols={4} className="mt-6 border-t border-border/50 pt-6">
            <FieldNumber label="Utgångspris (SEK)" value={grund.pris} onChange={(v) => setGrund({ ...grund, pris: v })} />
            <Field label="Boarea (kvm)" value={grund.boarea} onChange={(v) => setGrund({ ...grund, boarea: v })} type="number" />
            <Field label="Antal rum" value={grund.rum} onChange={(v) => setGrund({ ...grund, rum: v })} type="number" />
            <FieldNumber label={type === "brf" ? "Månadsavgift (SEK)" : "Driftkostnad/år (SEK)"} value={grund.avgift}
              onChange={(v) => setGrund({ ...grund, avgift: v })} />
          </Grid>
          <Grid cols={2} className="mt-6 border-t border-border/50 pt-6">
            <Field label={type === "brf" ? "Bostadsrättsförening" : "Fastighetsbeteckning"} value={grund.forening}
              onChange={(v) => setGrund({ ...grund, forening: v })} />
            <Field label="Övrigt att lyfta" value={grund.nyckelord}
              onChange={(v) => setGrund({ ...grund, nyckelord: v })} />
          </Grid>

          {/* Säljare */}
          <div className="mt-6 border-t border-border/50 pt-6">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Säljare (valfritt)</div>
            {saljareKontakt ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3.5 py-2.5">
                <div className="min-w-0 flex-1 text-sm text-foreground">
                  {saljareKontakt.fornamn} {saljareKontakt.efternamn}
                  {saljareKontakt.telefon && <span className="ml-2 text-muted-foreground">{saljareKontakt.telefon}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => { setSaljareKontakt(null); setSaljareQuery(""); }}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕ Ta bort
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={saljareQuery}
                  onChange={(e) => { setSaljareQuery(e.target.value); setSaljareOpen(true); }}
                  onFocus={() => setSaljareOpen(true)}
                  onBlur={() => setTimeout(() => setSaljareOpen(false), 150)}
                  placeholder="Sök kontakt att koppla som säljare…"
                  className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
                {saljareOpen && saljareMatches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
                    {saljareMatches.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSaljareKontakt(k); setSaljareQuery(""); setSaljareOpen(false); }}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-foreground/[0.04]"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {k.fornamn[0]}{k.efternamn[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{k.fornamn} {k.efternamn}</div>
                          {k.telefon && <div className="text-xs text-muted-foreground">{k.telefon}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {type === "brf" && (
          <Card>
            <SectionTitle eyebrow="03" title="Bostadsrättsförening"
              subtitle="All info om föreningen — visas bara för bostadsrätter." />
            <div className="mb-6 rounded-xl border border-border/50 bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Föreningskort</div>
                  <div className="text-xs text-muted-foreground">
                    {loadedBrfId
                      ? `Laddat från sparad förening · ändringar sparas när du klickar Spara.`
                      : "Sök en sparad förening eller fyll i nedan och spara som kort."}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={newBrf}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-white/5"
                  >
                    Ny förening
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBrf}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    {loadedBrfId ? "Uppdatera kort" : "Spara som kort"}
                  </button>
                </div>
              </div>
              <div className="relative mt-3">
                <input
                  type="text"
                  value={brfQuery}
                  onChange={(e) => { setBrfQuery(e.target.value); setBrfPickerOpen(true); }}
                  onFocus={() => setBrfPickerOpen(true)}
                  onBlur={() => setTimeout(() => setBrfPickerOpen(false), 150)}
                  placeholder="Sök förening (namn eller org.nr)…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/40"
                />
                {brfPickerOpen && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                    {brfMatches.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-muted-foreground">
                        Inga sparade föreningar{brfQuery ? " matchar din sökning" : " ännu"}.
                      </div>
                    ) : (
                      brfMatches.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-white/5"
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); loadBrf(s); }}
                            className="flex-1 text-left"
                          >
                            <div className="text-sm text-foreground">{s.namn || "(namn saknas)"}</div>
                            <div className="text-xs text-muted-foreground">
                              {[s.orgnr, s.antalLgh && `${s.antalLgh} lgh`].filter(Boolean).join(" · ") || "–"}
                            </div>
                          </button>
                          {canDeleteBrf && (
                            <button
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleDeleteBrf(s.id); }}
                              className="rounded px-2 py-1 text-xs text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Ta bort förening (endast kontorschef)"
                              title="Ta bort förening – endast kontorschef"
                            >
                              Ta bort
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {brfSavedMsg && (
                <div className="mt-2 text-xs text-primary">{brfSavedMsg}</div>
              )}
            </div>
            <BrfTabs
              tab={brfTab}
              setTab={setBrfTab}
              brf={brf}
              setBrf={setBrf}
            />
          </Card>
        )}

        {type !== "brf" && (
          <Card>
            <SectionTitle eyebrow="03" title="Byggnad & teknik" />
            <Grid cols={4}>
              <Field label="Byggår" value={byggnad.byggar} onChange={(v) => setByggnad({ ...byggnad, byggar: v })} />
              <Field label="Byggnadstyp" value={byggnad.byggnadstyp} onChange={(v) => setByggnad({ ...byggnad, byggnadstyp: v })} />
              <Field label="Tomtarea (kvm)" value={byggnad.tomt} onChange={(v) => setByggnad({ ...byggnad, tomt: v })} />
              <Field label="Biarea (kvm)" value={byggnad.biarea} onChange={(v) => setByggnad({ ...byggnad, biarea: v })} type="number" />
            </Grid>
            <Grid cols={3} className="mt-6 border-t border-border/50 pt-6">
              <Field label="Uppvärmning" value={byggnad.varme} onChange={(v) => setByggnad({ ...byggnad, varme: v })} />
              <Field label="Fasad" value={byggnad.fasad} onChange={(v) => setByggnad({ ...byggnad, fasad: v })} />
              <Field label="Fönster" value={byggnad.fonster} onChange={(v) => setByggnad({ ...byggnad, fonster: v })} />
            </Grid>
            <Grid cols={3} className="mt-6 border-t border-border/50 pt-6">
              <Field label="Vatten & avlopp" value={byggnad.vatten} onChange={(v) => setByggnad({ ...byggnad, vatten: v })} />
              <Field label="El / kabel" value={byggnad.el} onChange={(v) => setByggnad({ ...byggnad, el: v })} />
              <Field label="Ventilation" value={byggnad.ventilation} onChange={(v) => setByggnad({ ...byggnad, ventilation: v })} />
            </Grid>
            <div className="mt-6 border-t border-border/50 pt-6">
              <FieldTextarea label="Övrigt om byggnaden" value={byggnad.ovrigt} onChange={(v) => setByggnad({ ...byggnad, ovrigt: v })} />
            </div>
          </Card>
        )}

        <Card>
          <SectionTitle
            eyebrow="+"
            title="Egna fält"
            subtitle="Lägg till valfria fält som t.ex. Parkering, Egna anteckningar, Förvaring – och välj var de ska synas."
          />

          {customFields.length === 0 ? (
            <div className="mb-5 rounded-xl border border-dashed border-border bg-black/20 px-5 py-8 text-center text-sm text-muted-foreground">
              Inga egna fält tillagda än.
            </div>
          ) : (
            <div className="mb-5 flex flex-col gap-3">
              {customFields.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) => patchCustomField(c.id, { label: e.target.value })}
                      placeholder="Fältnamn (t.ex. Parkering)"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <textarea
                      value={c.value}
                      onChange={(e) => patchCustomField(c.id, { value: e.target.value })}
                      placeholder="Innehåll…"
                      rows={2}
                      className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(c.id)}
                      className="self-start rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      aria-label="Ta bort fält"
                    >
                      Ta bort
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-border/50 pt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={c.visInternet}
                        onChange={(e) => patchCustomField(c.id, { visInternet: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      Syns på internet
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={c.visProspekt}
                        onChange={(e) => patchCustomField(c.id, { visProspekt: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      Syns i prospekt / objektsbeskrivning
                    </label>
                    {!c.visInternet && !c.visProspekt && (
                      <span className="text-xs text-muted-foreground">
                        (endast intern – visas inte för kund)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {["Parkering", "Förvaring", "Egna anteckningar", "Tillträde", "Visningar"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => addCustomField(preset)}
                className="rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
              >
                + {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addCustomField("")}
              className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20"
            >
              + Eget fält
            </button>
          </div>
        </Card>

        {/* Rum */}
        <Card>
          <SectionTitle
            eyebrow={type === "brf" ? "03" : "04"}
            title="Rum"
            subtitle="Lägg till rum, ladda upp foton — AI:n beskriver dem åt dig."
          />

          {/* Quick-add */}
          <div className="mb-6 rounded-xl border border-border/50 bg-muted/30 p-5">
            <MiniLabel className="mb-3">Snabblägg till</MiniLabel>
            <div className="flex flex-wrap gap-2">
              {QUICK_ROOMS.map((name) => (
                <button key={name} onClick={() => addRoom(name)}
                  className="rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary">
                  + {name}
                </button>
              ))}
              <button onClick={() => addRoom("Nytt rum")}
                className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20">
                + Annat rum
              </button>
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-black/20 px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <UploadIcon />
              </div>
              <div className="text-base text-foreground" style={serifStyle}>Inga rum tillagda än.</div>
              <div className="mt-1 max-w-sm text-xs text-muted-foreground">
                Använd snabbknapparna ovan för att lägga till t.ex. Hall, Kök eller Sovrum.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {rooms.map((room, idx) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={idx + 1}
                  onPatch={(p) => patchRoom(room.id, p)}
                  onDelete={() => deleteRoom(room.id)}
                  onUpload={(files) => handleFiles(room.id, files)}
                  onRemoveImage={(imgId) => removeImage(room.id, imgId)}
                  onAnalyze={() => analyzeRoom(room)}
                  onAnswer={(qid, val) => setAnswer(room.id, qid, val)}
                  onFinalize={() => finalizeRoom(room)}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col items-center gap-3 pb-8">
          <button
            type="button"
            onClick={handleSaveObjekt}
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Spara objekt
          </button>
          {savedObjMsg && (
            <span className="text-xs text-primary">{savedObjMsg}</span>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ─────── Room card ─────── */

function RoomCard({
  room, index, onPatch, onDelete, onUpload, onRemoveImage, onAnalyze, onAnswer, onFinalize,
}: {
  room: Room;
  index: number;
  onPatch: (p: Partial<Room>) => void;
  onDelete: () => void;
  onUpload: (files: FileList | null) => void;
  onRemoveImage: (id: string) => void;
  onAnalyze: () => void;
  onAnswer: (qid: string, value: string) => void;
  onFinalize: () => void;
}) {
  const canAnalyze = room.images.length > 0 && room.aiStatus !== "analyzing" && room.aiStatus !== "finalizing";
  const unanswered = useMemo(
    () => (room.aiAnswers ?? []).some((a) => !a.answer),
    [room.aiAnswers],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="font-mono text-xs text-primary/70">{String(index).padStart(2, "0")}</span>
        <input
          className="flex-1 min-w-[160px] border-b border-transparent bg-transparent pb-0.5 text-lg font-medium focus:border-primary/60 focus:outline-none"
          style={serifStyle}
          value={room.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Rummets namn"
        />
        <button onClick={onDelete}
          className="rounded-md border border-white/5 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive">
          Ta bort
        </button>
      </div>

      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_1.3fr]">
        {/* Left: meta + notes */}
        <div>
          <MiniLabel>Våning</MiniLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FLOORS.map((f) => {
              const active = room.floor === f;
              return (
                <button key={f} onClick={() => onPatch({ floor: f })}
                  className={[
                    "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                    active ? "border-primary bg-primary/15 text-primary"
                           : "border-border bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground",
                  ].join(" ")}>
                  {f}
                </button>
              );
            })}
          </div>

          <MiniLabel className="mt-5">Anteckningar</MiniLabel>
          <textarea
            className="mt-2 min-h-[140px] w-full resize-y rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            value={room.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Material, renoveringsår, mått, utrustning... AI-texten klistras in här."
          />
        </div>

        {/* Right: photos + AI */}
        <div>
          <MiniLabel>Foton</MiniLabel>
          {room.images.length === 0 ? (
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.04]">
              <input type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ""; }} />
              <UploadIcon />
              <div className="mt-2 text-sm">Ladda upp foton</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">JPG, PNG · flera bilder</div>
            </label>
          ) : (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {room.images.map((img) => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-black/30">
                    <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                    <button onClick={() => onRemoveImage(img.id)}
                      className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white group-hover:flex"
                      aria-label="Ta bort bild">×</button>
                  </div>
                ))}
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-primary">
                  <input type="file" multiple accept="image/*" className="hidden"
                    onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ""; }} />
                  <span className="text-2xl leading-none">+</span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.14em]">Mer</span>
                </label>
              </div>
            </div>
          )}

          {/* AI panel */}
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary/80">AI-analys</div>
              <button onClick={onAnalyze} disabled={!canAnalyze}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100">
                {room.aiStatus === "analyzing" ? "Analyserar…" : room.aiStatus === "done" ? "Kör igen" : "Analysera bilder"}
              </button>
            </div>

            {room.aiStatus === "idle" && room.images.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">Ladda upp minst en bild för att starta AI-analysen.</p>
            )}
            {room.aiStatus === "idle" && room.images.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">Klicka för att låta AI:n läsa av rummet och föreslå en beskrivning.</p>
            )}
            {room.aiStatus === "analyzing" && (
              <p className="mt-3 text-xs text-muted-foreground">Läser av bilderna…</p>
            )}
            {room.aiStatus === "error" && (
              <p className="mt-3 text-xs text-destructive">{room.aiError}</p>
            )}

            {(room.aiStatus === "needs-input" || room.aiStatus === "finalizing") && room.aiQuestions && room.aiQuestions.length > 0 && (
              <div className="mt-4 space-y-4">
                {room.aiDraft && (
                  <p className="rounded-md bg-black/30 p-3 text-xs italic leading-relaxed text-foreground/80">
                    "{room.aiDraft}"
                  </p>
                )}
                <div className="text-[11px] uppercase tracking-[0.16em] text-primary/70">
                  AI:n är osäker — välj rätt alternativ
                </div>
                {room.aiQuestions.map((q) => {
                  const ans = (room.aiAnswers ?? []).find((a) => a.id === q.id);
                  return (
                    <div key={q.id}>
                      <div className="mb-1.5 text-sm text-foreground">{q.question}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((opt) => {
                          const sel = ans?.answer === opt;
                          return (
                            <button key={opt} onClick={() => onAnswer(q.id, opt)}
                              className={[
                                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                sel ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-muted/40 text-foreground hover:border-primary/50",
                              ].join(" ")}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <button onClick={onFinalize} disabled={unanswered || room.aiStatus === "finalizing"}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100">
                  {room.aiStatus === "finalizing" ? "Skriver text…" : "Skriv färdig text"}
                </button>
              </div>
            )}

            {room.aiStatus === "done" && (
              <p className="mt-3 text-xs text-primary">✓ Text inklistrad i anteckningarna.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────── helpers ─────── */

const serifStyle = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-2xl font-medium normal-case text-foreground" style={serifStyle}>{value}</div>
      <div className="mt-0.5 text-[10px] tracking-[0.2em]">{label}</div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card p-7  shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      {children}
    </section>
  );
}

function SectionTitle({ eyebrow, title, subtitle, className = "" }: { eyebrow?: string; title: string; subtitle?: string; className?: string }) {
  return (
    <div className={`mb-6 flex items-baseline gap-4 ${className}`}>
      {eyebrow && <span className="font-mono text-xs tracking-[0.2em] text-primary/70">{eyebrow}</span>}
      <div>
        <h2 className="text-xl font-medium" style={serifStyle}>{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Grid({ children, cols = 3, className = "" }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const map = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" } as const;
  return <div className={`grid grid-cols-1 gap-x-4 gap-y-5 ${map[cols]} ${className}`}>{children}</div>;
}

function FieldNumber({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const selStart = input.selectionStart ?? 0;
    const beforeCursor = input.value.slice(0, selStart);
    const digitsBefore = beforeCursor.replace(/\D/g, "").length;

    const clean = input.value.replace(/\D/g, "");
    onChange(clean);

    requestAnimationFrame(() => {
      const formatted = formatSwedishNumber(clean);
      let newPos = 0;
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) digitCount++;
        if (digitCount >= digitsBefore) {
          newPos = i + 1;
          break;
        }
      }
      input.setSelectionRange(newPos, newPos);
    });
  }
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <input type="text" inputMode="numeric" value={formatSwedishNumber(value)} onChange={handleChange} placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background focus:outline-none" />
    </label>
  );
}

function parseFullAdress(raw: string): { adress: string; ort: string; omrade: string } | null {
  // Match "Storgatan 12, 123 45 Stockholm" or "Storgatan 12 12345 Stockholm"
  const m = raw.match(/^(.+?),?\s+(\d{3}\s?\d{2})\s+(.+)$/);
  if (!m) return null;
  return { adress: m[1].trim(), ort: `${m[2]} ${m[3]}`.trim(), omrade: "" };
}

function AdressFalt({ value, onChange }: {
  value: string;
  onChange: (adress: string, ort?: string, omrade?: string) => void;
}) {
  function handleBlur(raw: string) {
    const parsed = parseFullAdress(raw);
    if (parsed) onChange(parsed.adress, parsed.ort, parsed.omrade);
  }
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Adress</div>
      <AddressInput
        value={value}
        onChange={(v) => { onChange(v); handleBlur(v); }}
        onSelect={(road, postcode, city) => {
          const ort = [postcode, city].filter(Boolean).join(" ");
          onChange(road, ort || undefined);
        }}
        placeholder="Sök adress…"
      />
    </label>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  if (type === "number") {
    return <FieldNumber label={label} value={value} onChange={onChange} placeholder={placeholder} />;
  }
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background focus:outline-none" />
    </label>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="min-h-[90px] w-full resize-y rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none" />
    </label>
  );
}

function MiniLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70 ${className}`}>{children}</div>;
}

function FieldSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none">
        <option value="">{placeholder ?? "Välj…"}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-primary/80">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
// ===== BRF Tabs =====
type BrfTabId = "grunddata" | "byggnader" | "parkering" | "kostnader" | "kontakter" | "filer" | "bilder" | "webbadresser" | "bostader";

const BRF_TABS: { id: BrfTabId; label: string }[] = [
  { id: "grunddata", label: "Grunddata" },
  { id: "byggnader", label: "Byggnader" },
  { id: "parkering", label: "Parkering" },
  { id: "kostnader", label: "Kostnader" },
  { id: "kontakter", label: "Kontakter" },
  { id: "filer", label: "Filer" },
  { id: "bilder", label: "Bilder" },
  { id: "webbadresser", label: "Webbadresser" },
  { id: "bostader", label: "Bostäder" },
];

// (Brf, BrfFile, BrfImage importeras högst upp i filen)

function BrfTabs({
  tab, setTab, brf, setBrf,
}: {
  tab: BrfTabId;
  setTab: (t: BrfTabId) => void;
  brf: Brf;
  setBrf: (b: Brf) => void;
}) {
  function patch(p: Partial<Brf>) {
    setBrf({ ...brf, ...p });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {BRF_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "relative -mb-px rounded-t-md px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors " +
                (active
                  ? "border-b-2 border-primary bg-primary/5 text-primary"
                  : "border-b-2 border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "grunddata" && (
        <div>
          <Grid cols={3}>
            <Field label="Föreningens namn" value={brf.namn} onChange={(v) => patch({ namn: v })} />
            <Field label="Organisationsnummer" value={brf.orgnr} onChange={(v) => patch({ orgnr: v })} />
            <Field label="Bildades år" value={brf.bildades} onChange={(v) => patch({ bildades: v })} type="number" />
          </Grid>
          <Grid cols={4} className="mt-6 border-t border-border/50 pt-6">
            <FieldSelect label="Taxeringstyp" value={brf.taxering} onChange={(v) => patch({ taxering: v })}
              options={["Privatbostadsföretag (äkta)", "Oäkta bostadsföretag"]} />
            <FieldSelect label="Juridisk person accepteras" value={brf.juridiskPerson} onChange={(v) => patch({ juridiskPerson: v })}
              options={["Ja", "Nej"]} />
            <FieldSelect label="Markägare" value={brf.markagare} onChange={(v) => patch({ markagare: v })}
              options={["Föreningen äger marken", "Tomträtt"]} />
            <Field label="TV / internet" value={brf.tvInternet} onChange={(v) => patch({ tvInternet: v })} />
          </Grid>
          <Grid cols={3} className="mt-6 border-t border-border/50 pt-6">
            <Field label="Antal lägenheter" value={brf.antalLgh} onChange={(v) => patch({ antalLgh: v })} type="number" />
            <Field label="Antal hyresrätter" value={brf.antalHyres} onChange={(v) => patch({ antalHyres: v })} type="number" />
            <Field label="Antal lokaler" value={brf.antalLokaler} onChange={(v) => patch({ antalLokaler: v })} type="number" />
          </Grid>
          <div className="mt-6 border-t border-border/50 pt-6">
            <FieldTextarea label="Allmän information" value={brf.allman} onChange={(v) => patch({ allman: v })} />
          </div>
        </div>
      )}

      {tab === "byggnader" && (
        <BrfByggnaderPanel
          byggnader={brf.byggnader}
          onChange={(byggnader) => patch({ byggnader })}
          ovrigaUtrymmen={brf.ovrigaUtrymmen}
          setOvrigaUtrymmen={(v) => patch({ ovrigaUtrymmen: v })}
          renoveringar={brf.renoveringar}
          setRenoveringar={(v) => patch({ renoveringar: v })}
          kommandeRenoveringar={brf.kommandeRenoveringar}
          setKommandeRenoveringar={(v) => patch({ kommandeRenoveringar: v })}
        />
      )}

      {tab === "parkering" && (
        <FieldTextarea
          label="Parkering"
          value={brf.parkering}
          onChange={(v) => patch({ parkering: v })}
          placeholder="T.ex. P-plats 750 kr/mån, garageplats 1 400 kr/mån, kötid ca 2 år…"
        />
      )}

      {tab === "kostnader" && (
        <BrfKostnaderPanel brf={brf} patch={patch} />
      )}

      {tab === "kontakter" && (
        <BrfKontakterPanel
          kontakter={brf.kontakter}
          onChange={(kontakter) => patch({ kontakter })}
        />
      )}

      {tab === "filer" && (
        <BrfFilesPanel
          filer={brf.filer}
          onChange={(filer) => patch({ filer })}
        />
      )}

      {tab === "bilder" && (
        <BrfImagesPanel
          bilder={brf.bilder}
          onChange={(bilder) => patch({ bilder })}
        />
      )}

      {tab === "webbadresser" && (
        <div className="grid gap-5">
          <Field label="Hemsida" value={brf.hemsida} onChange={(v) => patch({ hemsida: v })} placeholder="https://…" />
          <FieldTextarea
            label="Övriga webbadresser"
            value={brf.webbadresser}
            onChange={(v) => patch({ webbadresser: v })}
            placeholder="Allabrf.se: …&#10;Årsredovisning: …"
          />
        </div>
      )}

      {tab === "bostader" && (
        <div className="rounded-xl border border-dashed border-border bg-black/20 px-6 py-10 text-center">
          <div className="text-sm text-foreground" style={serifStyle}>Bostäder i föreningen</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Här listas alla objekt du har skapat i appen som tillhör <span className="text-foreground">{brf.namn || "den här föreningen"}</span> — sålda, till salu och utkast.
            <br />Kopplingen aktiveras när objekt sparas till databasen.
          </div>
        </div>
      )}
    </div>
  );
}

function BrfFilesPanel({ filer, onChange }: { filer: BrfFile[]; onChange: (f: BrfFile[]) => void }) {
  function handleFiles(fl: FileList | null) {
    if (!fl) return;
    Array.from(fl).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result ?? "");
        onChange([...filer, { id: crypto.randomUUID(), name: file.name, size: file.size, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  }
  return (
    <div>
      <label className="mb-4 flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground">
        <UploadIcon />
        <span>Ladda upp PDF, årsredovisning, stadgar…</span>
        <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </label>
      {filer.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground">Inga filer uppladdade.</div>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-lg border border-border/50">
          {filer.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm text-foreground">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                type="button"
                onClick={() => onChange(filer.filter((x) => x.id !== f.id))}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BrfImagesPanel({ bilder, onChange }: { bilder: BrfImage[]; onChange: (b: BrfImage[]) => void }) {
  function handleFiles(fl: FileList | null) {
    if (!fl) return;
    Array.from(fl).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result ?? "");
        onChange([...bilder, { id: crypto.randomUUID(), name: file.name, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  }
  return (
    <div>
      <label className="mb-4 flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground">
        <UploadIcon />
        <span>Ladda upp bilder på fastigheten, innergård…</span>
        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </label>
      {bilder.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground">Inga bilder uppladdade.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {bilder.map((b) => (
            <div key={b.id} className="group relative overflow-hidden rounded-lg border border-border/50">
              <img src={b.dataUrl} alt={b.name} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(bilder.filter((x) => x.id !== b.id))}
                className="absolute right-1.5 top-1.5 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Byggnader-panel =====
function BrfByggnaderPanel({
  byggnader, onChange,
  ovrigaUtrymmen, setOvrigaUtrymmen,
  renoveringar, setRenoveringar,
  kommandeRenoveringar, setKommandeRenoveringar,
}: {
  byggnader: BrfByggnad[];
  onChange: (b: BrfByggnad[]) => void;
  ovrigaUtrymmen: string; setOvrigaUtrymmen: (v: string) => void;
  renoveringar: string; setRenoveringar: (v: string) => void;
  kommandeRenoveringar: string; setKommandeRenoveringar: (v: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  function add() {
    const id = crypto.randomUUID();
    onChange([
      ...byggnader,
      {
        id, namn: "", byggar: "", gatuadress: "", postnummer: "", ort: "",
        antalVaningar: "", hiss: "", hissBeskrivning: "",
        uppvarmning: "", tvInternet: "",
        energiklass: "", energistatus: "", energianvandning: "", beskrivning: "",
      },
    ]);
    setOpenId(id);
  }
  function update(id: string, p: Partial<BrfByggnad>) {
    onChange(byggnader.map((b) => (b.id === id ? { ...b, ...p } : b)));
  }
  function remove(id: string) {
    onChange(byggnader.filter((b) => b.id !== id));
    if (openId === id) setOpenId(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">Byggnader i föreningen</div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          + Lägg till byggnad
        </button>
      </div>

      {byggnader.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-black/20 px-6 py-8 text-center text-sm text-muted-foreground">
          Inga byggnader tillagda.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Namn på byggnaden</th>
                <th className="px-4 py-2.5 text-left font-medium">Byggår</th>
                <th className="px-4 py-2.5 text-left font-medium">Adress</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {byggnader.map((b) => (
                <Fragment key={b.id}>
                  <tr className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-foreground">{b.namn || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-foreground">{b.byggar || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{[b.gatuadress, b.ort].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === b.id ? null : b.id)}
                        className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      >
                        {openId === b.id ? "Stäng" : "Redigera"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(b.id)}
                        className="ml-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        Ta bort
                      </button>
                    </td>
                  </tr>
                  {openId === b.id && (
                    <tr className="bg-black/30">
                      <td colSpan={4} className="px-4 py-5">
                        <Grid cols={3}>
                          <Field label="Namn på byggnaden" value={b.namn} onChange={(v) => update(b.id, { namn: v })} />
                          <Field label="Byggår" value={b.byggar} onChange={(v) => update(b.id, { byggar: v })} type="number" />
                          <Field label="Antal våningar" value={b.antalVaningar} onChange={(v) => update(b.id, { antalVaningar: v })} type="number" />
                        </Grid>
                        <Grid cols={3} className="mt-4">
                          <Field label="Gatuadress" value={b.gatuadress} onChange={(v) => update(b.id, { gatuadress: v })} />
                          <Field label="Postnummer" value={b.postnummer} onChange={(v) => update(b.id, { postnummer: v })} />
                          <Field label="Ort" value={b.ort} onChange={(v) => update(b.id, { ort: v })} />
                        </Grid>
                        <Grid cols={3} className="mt-4">
                          <FieldSelect label="Det finns hiss" value={b.hiss} onChange={(v) => update(b.id, { hiss: v })} options={["Ja", "Nej"]} />
                          <Field label="Uppvärmning / ventilation" value={b.uppvarmning} onChange={(v) => update(b.id, { uppvarmning: v })} />
                          <Field label="TV / internet" value={b.tvInternet} onChange={(v) => update(b.id, { tvInternet: v })} />
                        </Grid>
                        <Grid cols={3} className="mt-4">
                          <FieldSelect label="Energiklass" value={b.energiklass} onChange={(v) => update(b.id, { energiklass: v })}
                            options={["A", "B", "C", "D", "E", "F", "G"]} />
                          <Field label="Energistatus" value={b.energistatus} onChange={(v) => update(b.id, { energistatus: v })} placeholder="Energideklaration utförd" />
                          <Field label="Specifik energianvändning (kWh/m²)" value={b.energianvandning} onChange={(v) => update(b.id, { energianvandning: v })} type="number" />
                        </Grid>
                        <div className="mt-4">
                          <FieldTextarea label="Beskrivning byggnad" value={b.beskrivning} onChange={(v) => update(b.id, { beskrivning: v })} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-5 border-t border-border/50 pt-6 md:grid-cols-2">
        <FieldTextarea label="Övriga utrymmen i föreningen" value={ovrigaUtrymmen} onChange={setOvrigaUtrymmen} />
        <FieldTextarea label="Utförda renoveringar" value={renoveringar} onChange={setRenoveringar} />
        <FieldTextarea label="Kommande renoveringar" value={kommandeRenoveringar} onChange={setKommandeRenoveringar} />
      </div>
    </div>
  );
}

// ===== Kostnader-panel =====
function BrfKostnaderPanel({ brf, patch }: { brf: Brf; patch: (p: Partial<Brf>) => void }) {
  function toggle(item: string) {
    const has = brf.ingarIAvgiften.includes(item);
    patch({ ingarIAvgiften: has ? brf.ingarIAvgiften.filter((x) => x !== item) : [...brf.ingarIAvgiften, item] });
  }
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ingår i avgiften</div>
      <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-3">
        {INGAR_I_AVGIFTEN.map((item) => {
          const active = brf.ingarIAvgiften.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-all " +
                (active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-primary/5")
              }
            >
              {active ? "✓ " : ""}{item}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FieldTextarea label="Beskrivning månadsavgift" value={brf.beskrivningManadsavgift} onChange={(v) => patch({ beskrivningManadsavgift: v })} />
        <FieldTextarea label="Beskrivning av kostnader som ingår" value={brf.beskrivningKostnaderIngar} onChange={(v) => patch({ beskrivningKostnaderIngar: v })} />
      </div>

      <Grid cols={2} className="mt-6 border-t border-border/50 pt-6">
        <FieldNumber label="Pantsättningsavgift" value={brf.pantavgift} onChange={(v) => patch({ pantavgift: v })} />
        <FieldNumber label="Överlåtelseavgift" value={brf.overlatelseavgift} onChange={(v) => patch({ overlatelseavgift: v })} />
      </Grid>
      <Grid cols={3} className="mt-4">
        <FieldSelect label="Överlåtelseavgift betalas av" value={brf.overlataresBetalas} onChange={(v) => patch({ overlataresBetalas: v })}
          options={["Köpare", "Säljare"]} />
        <FieldNumber label="Nettoskuldsättning (SEK)" value={brf.nettoskuld} onChange={(v) => patch({ nettoskuld: v })} />
        <Field label="Uppgifter från årsredovisning (år)" value={brf.nettoskuldAr} onChange={(v) => patch({ nettoskuldAr: v })} type="number" />
      </Grid>
    </div>
  );
}

// ===== Kontakter-panel =====
function BrfKontakterPanel({ kontakter, onChange }: { kontakter: BrfKontakt[]; onChange: (k: BrfKontakt[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);

  function add() {
    const id = crypto.randomUUID();
    onChange([
      ...kontakter,
      { id, roll: "", fornamn: "", efternamn: "", foretag: "", telefon: "", epost: "", anteckning: "" },
    ]);
    setOpenId(id);
  }
  function update(id: string, p: Partial<BrfKontakt>) {
    onChange(kontakter.map((k) => (k.id === id ? { ...k, ...p } : k)));
  }
  function remove(id: string) {
    onChange(kontakter.filter((k) => k.id !== id));
    if (openId === id) setOpenId(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">Kontakter (styrelse, förvaltare, ekonom)</div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          + Lägg till kontakt
        </button>
      </div>

      {kontakter.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-black/20 px-6 py-8 text-center text-sm text-muted-foreground">
          Inga kontakter tillagda.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Namn</th>
                <th className="px-4 py-2.5 text-left font-medium">Roll</th>
                <th className="px-4 py-2.5 text-left font-medium">Telefon</th>
                <th className="px-4 py-2.5 text-left font-medium">E-post</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {kontakter.map((k) => {
                const namn = [k.fornamn, k.efternamn].filter(Boolean).join(" ") || "—";
                return (
                  <Fragment key={k.id}>
                    <tr className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-foreground">{namn}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{k.roll || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{k.telefon || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{k.epost || "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenId(openId === k.id ? null : k.id)}
                          className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                        >
                          {openId === k.id ? "Stäng" : "Redigera"}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(k.id)}
                          className="ml-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          Ta bort
                        </button>
                      </td>
                    </tr>
                    {openId === k.id && (
                      <tr className="bg-black/30">
                        <td colSpan={5} className="px-4 py-5">
                          <Grid cols={3}>
                            <Field label="Förnamn" value={k.fornamn} onChange={(v) => update(k.id, { fornamn: v })} />
                            <Field label="Efternamn" value={k.efternamn} onChange={(v) => update(k.id, { efternamn: v })} />
                            <FieldSelect label="Roll" value={k.roll} onChange={(v) => update(k.id, { roll: v })}
                              options={["Ordförande", "Vice ordförande", "Ledamot", "Suppleant", "Förvaltare", "Ekonom", "Vicevärd", "Annat"]} />
                          </Grid>
                          <Grid cols={3} className="mt-4">
                            <Field label="Företag" value={k.foretag} onChange={(v) => update(k.id, { foretag: v })} />
                            <Field label="Telefon" value={k.telefon} onChange={(v) => update(k.id, { telefon: v })} />
                            <Field label="E-post" value={k.epost} onChange={(v) => update(k.id, { epost: v })} />
                          </Grid>
                          <div className="mt-4">
                            <FieldTextarea label="Anteckning" value={k.anteckning} onChange={(v) => update(k.id, { anteckning: v })} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
