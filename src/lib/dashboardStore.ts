const KEY = "hajpex.dashboard.v1";

export type WidgetId =
  | "aktiva-objekt"
  | "pipeline"
  | "spekulanter"
  | "budgivning"
  | "att-gora";

export type WidgetWidth = "full" | "half";

export type WidgetDef = {
  id: WidgetId;
  label: string;
  description: string;
  width: WidgetWidth;
};

export const WIDGET_DEFS: WidgetDef[] = [
  { id: "aktiva-objekt",  label: "Aktiva objekt",        description: "Tabell med pågående uppdrag",        width: "full" },
  { id: "pipeline",       label: "Pipeline",              description: "Objektsflöde per status",            width: "half" },
  { id: "spekulanter",    label: "Senaste spekulanter",   description: "Nyligen kopplade spekulanter",       width: "half" },
  { id: "budgivning",     label: "Pågående budgivning",   description: "Objekt med registrerade bud",       width: "half" },
  { id: "att-gora",       label: "Att göra",              description: "Objekt som behöver åtgärd",         width: "half" },
];

export type WidgetState = { id: WidgetId; visible: boolean };

const DEFAULT: WidgetState[] = WIDGET_DEFS.map((d) => ({ id: d.id, visible: true }));

export function getDashboardWidgets(): WidgetState[] {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed: WidgetState[] = JSON.parse(raw);
    // ensure all widget ids are present (new widgets added after first save)
    const ids = new Set(parsed.map((w) => w.id));
    const merged = [...parsed];
    for (const def of WIDGET_DEFS) {
      if (!ids.has(def.id)) merged.push({ id: def.id, visible: true });
    }
    return merged;
  } catch {
    return DEFAULT;
  }
}

export function saveDashboardWidgets(widgets: WidgetState[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(widgets));
}
