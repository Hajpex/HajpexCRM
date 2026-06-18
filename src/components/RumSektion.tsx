import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  analyzeRoomImages,
  finalizeRoomText,
  type RoomClarification,
} from "../lib/ai.functions";
import { listRum, addRum, updateRum, deleteRum } from "../lib/rumStore";

const serifStyle = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

const FLOORS = ["Entréplan", "Plan 2", "Plan 3", "Källare", "Vind"];
const QUICK_ROOMS = ["Hall", "Vardagsrum", "Kök", "Matrum", "Sovrum", "Badrum", "WC", "Tvätt", "Balkong", "Allrum"];

type RoomImage = { id: string; name: string; dataUrl: string };
type Answer = { id: string; question: string; answer: string };

/** Persisterat rum (från rumStore) + transient state för bilder och AI-analys. */
type EditorRoom = {
  id: string;
  name: string;
  floor: string;
  description: string;
  images: RoomImage[];
  aiStatus: "idle" | "analyzing" | "needs-input" | "finalizing" | "done" | "error";
  aiError?: string;
  aiDraft?: string;
  aiObserved?: string[];
  aiQuestions?: RoomClarification[];
  aiAnswers?: Answer[];
  aiVariants?: [string, string, string];
};

export function RumSektion({ slug, propertyType }: { slug: string; propertyType?: string }) {
  const [rooms, setRooms] = useState<EditorRoom[]>(() =>
    listRum(slug).map((r) => ({ ...r, images: [], aiStatus: "idle" as const }))
  );

  const analyzeFn = useServerFn(analyzeRoomImages);
  const finalizeFn = useServerFn(finalizeRoomText);

  function patch(id: string, p: Partial<EditorRoom>) {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function handleAddRoom(name: string, floor = "Entréplan") {
    const saved = addRum(slug, name, floor);
    setRooms((rs) => [...rs, { ...saved, images: [], aiStatus: "idle" }]);
  }

  function handleDeleteRoom(id: string) {
    deleteRum(slug, id);
    setRooms((rs) => rs.filter((r) => r.id !== id));
  }

  /** Persisterande ändring (namn, våning, beskrivning) → store + state. */
  function persist(id: string, p: { name?: string; floor?: string; description?: string }) {
    updateRum(slug, id, p);
    patch(id, p);
  }

  function handleFiles(id: string, fileList: FileList | null) {
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

  function removeImage(roomId: string, imageId: string) {
    setRooms((rs) => rs.map((r) => r.id === roomId
      ? { ...r, images: r.images.filter((i) => i.id !== imageId) }
      : r));
  }

  async function analyzeRoom(room: EditorRoom) {
    if (room.images.length === 0) return;
    patch(room.id, { aiStatus: "analyzing", aiError: undefined });
    try {
      const res = await analyzeFn({
        data: {
          roomName: room.name || "Rum",
          floor: room.floor,
          propertyType: propertyType ?? "",
          existingNotes: room.description,
          images: room.images.map((i) => ({ name: i.name, dataUrl: i.dataUrl })),
        },
      });
      const answers: Answer[] = res.clarifications.map((c) => ({ id: c.id, question: c.question, answer: "" }));
      const noClarifications = res.clarifications.length === 0;
      if (noClarifications && res.description) {
        const desc = room.description ? room.description + "\n\n" + res.description : res.description;
        updateRum(slug, room.id, { description: desc });
        patch(room.id, {
          aiDraft: res.description, aiObserved: res.observed, aiQuestions: [],
          aiAnswers: [], aiStatus: "done", description: desc,
        });
      } else {
        patch(room.id, {
          aiDraft: res.description, aiObserved: res.observed,
          aiQuestions: res.clarifications, aiAnswers: answers, aiStatus: "needs-input",
        });
      }
    } catch (e: any) {
      patch(room.id, { aiStatus: "error", aiError: e?.message ?? "Något gick fel." });
    }
  }

  function setAnswer(roomId: string, qid: string, value: string) {
    setRooms((rs) => rs.map((r) => r.id === roomId
      ? { ...r, aiAnswers: (r.aiAnswers ?? []).map((a) => a.id === qid ? { ...a, answer: value } : a) }
      : r));
  }

  async function finalizeRoom(room: EditorRoom) {
    const unanswered = (room.aiAnswers ?? []).some((a) => !a.answer);
    if (unanswered) return;
    patch(room.id, { aiStatus: "finalizing", aiError: undefined });
    try {
      const res = await finalizeFn({
        data: {
          roomName: room.name,
          floor: room.floor,
          baseDescription: room.aiDraft ?? "",
          observed: room.aiObserved ?? [],
          answers: (room.aiAnswers ?? []).map((a) => ({ question: a.question, answer: a.answer })),
          existingNotes: room.description,
        },
      });
      patch(room.id, { aiStatus: "done", aiVariants: res.variants });
    } catch (e: any) {
      patch(room.id, { aiStatus: "error", aiError: e?.message ?? "Något gick fel." });
    }
  }

  function pickVariant(room: EditorRoom, text: string) {
    const desc = room.description ? room.description + "\n\n" + text : text;
    updateRum(slug, room.id, { description: desc });
    patch(room.id, { description: desc, aiStatus: "idle", aiVariants: undefined });
  }

  return (
    <div className="space-y-5">
      {/* Snabblägg till */}
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
        <MiniLabel className="mb-3">Lägg till rum</MiniLabel>
        <div className="flex flex-wrap gap-2">
          {QUICK_ROOMS.map((name) => (
            <button key={name} onClick={() => handleAddRoom(name)}
              className="rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary">
              + {name}
            </button>
          ))}
          <button onClick={() => handleAddRoom("Nytt rum")}
            className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20">
            + Annat rum
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-black/20 px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <UploadIcon />
          </div>
          <div className="text-base text-foreground" style={serifStyle}>Inga rum tillagda än.</div>
          <div className="mt-1 max-w-sm text-xs text-muted-foreground">
            Lägg till t.ex. Hall, Kök eller Sovrum — ladda sedan upp foton så beskriver AI:n rummet åt dig.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {rooms.map((room, idx) => (
            <RoomCard
              key={room.id}
              room={room}
              index={idx + 1}
              onName={(v) => persist(room.id, { name: v })}
              onFloor={(v) => persist(room.id, { floor: v })}
              onDescription={(v) => persist(room.id, { description: v })}
              onDelete={() => handleDeleteRoom(room.id)}
              onUpload={(files) => handleFiles(room.id, files)}
              onRemoveImage={(imgId) => removeImage(room.id, imgId)}
              onAnalyze={() => analyzeRoom(room)}
              onAnswer={(qid, val) => setAnswer(room.id, qid, val)}
              onFinalize={() => finalizeRoom(room)}
              onPickVariant={(text) => pickVariant(room, text)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({
  room, index, onName, onFloor, onDescription, onDelete, onUpload, onRemoveImage, onAnalyze, onAnswer, onFinalize, onPickVariant,
}: {
  room: EditorRoom;
  index: number;
  onName: (v: string) => void;
  onFloor: (v: string) => void;
  onDescription: (v: string) => void;
  onDelete: () => void;
  onUpload: (files: FileList | null) => void;
  onRemoveImage: (id: string) => void;
  onAnalyze: () => void;
  onAnswer: (qid: string, value: string) => void;
  onFinalize: () => void;
  onPickVariant: (text: string) => void;
}) {
  const canAnalyze = room.images.length > 0 && room.aiStatus !== "analyzing" && room.aiStatus !== "finalizing";
  const unanswered = useMemo(() => (room.aiAnswers ?? []).some((a) => !a.answer), [room.aiAnswers]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="font-mono text-xs text-primary/70">{String(index).padStart(2, "0")}</span>
        <input
          className="flex-1 min-w-[160px] border-b border-transparent bg-transparent pb-0.5 text-lg font-medium focus:border-primary/60 focus:outline-none"
          style={serifStyle}
          value={room.name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Rummets namn"
        />
        <button onClick={onDelete}
          className="rounded-md border border-white/5 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive">
          Ta bort
        </button>
      </div>

      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_1.3fr]">
        {/* Left: meta + beskrivning */}
        <div>
          <MiniLabel>Våning</MiniLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FLOORS.map((f) => {
              const active = room.floor === f;
              return (
                <button key={f} onClick={() => onFloor(f)}
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

          <MiniLabel className="mt-5">Beskrivning</MiniLabel>
          <textarea
            className="mt-2 min-h-[140px] w-full resize-y rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            value={room.description}
            onChange={(e) => onDescription(e.target.value)}
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

            {room.aiStatus === "done" && room.aiVariants && room.aiVariants.some(Boolean) && (
              <div className="mt-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-primary/70">Välj ett alternativ</div>
                {(["Kort", "Standard", "Utförlig"] as const).map((label, i) => {
                  const text = room.aiVariants![i];
                  if (!text) return null;
                  return (
                    <div key={label} className="rounded-lg border border-border bg-black/20 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
                        <button
                          onClick={() => onPickVariant(text)}
                          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                        >
                          Använd →
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80">{text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70 ${className}`}>{children}</div>;
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
