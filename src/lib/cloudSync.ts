import { supabase } from "./supabase";

/**
 * Molnsynk-lager.
 *
 * De befintliga datalagren (kontaktStore, objektStore, …) läser och skriver
 * fortfarande synkront mot localStorage. Det här lagret speglar localStorage
 * till Supabase per kontor:
 *
 *  - hydrateFromCloud(officeId): hämtar kontorets data och skriver in i
 *    localStorage INNAN appen renderar → alla synkrona läsanrop får molndatan.
 *  - schedulePush(key): anropas från varje store-write() och skickar (debounced)
 *    upp hela listan till app_state-tabellen.
 *
 * Lagring: tabellen app_state (office_id, store_key, data jsonb) — en rad per
 * datalager per kontor.
 */

/** localStorage-nycklar som synkas till molnet (affärsdata, ej UI-inställningar). */
export const SYNCED_KEYS = [
  "hajpex.kontakter.v1",
  "stendahl.objektLibrary.v1",
  "hajpex.budgivning.v1",
  "hajpex.budSettings.v1",
  "hajpex.visningar.v1",
  "hajpex.intagsmoten.v1",
  "hajpex.kontrakt.v1",
  "stendahl.brfLibrary.v1",
  "hajpex.budget.v1",
  "hajpex.objektNotes.v1",
] as const;

let currentOfficeId: string | null = null;
let hydrated = false;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

export function isHydrated(): boolean {
  return hydrated;
}

/** Återställ vid utloggning så inget pushas till fel kontor. */
export function resetCloudSync(): void {
  currentOfficeId = null;
  hydrated = false;
  for (const k of Object.keys(timers)) {
    clearTimeout(timers[k]);
    delete timers[k];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any {
  return supabase;
}

async function upsert(officeId: string, key: string, value: unknown): Promise<void> {
  const { error } = await sb()
    .from("app_state")
    .upsert(
      { office_id: officeId, store_key: key, data: value, updated_at: new Date().toISOString() },
      { onConflict: "office_id,store_key" }
    );
  if (error) console.error(`[cloudSync] kunde inte spara ${key}:`, error.message ?? error);
}

/**
 * Hämtar kontorets data till localStorage. Körs efter inloggning, före render.
 * Molnet är auktoritativt. Markören DATA_OFFICE_KEY visar vilket kontor den
 * lokala datan tillhör, så att ett kontorsbyte rensar gammal data istället för
 * att felaktigt pusha upp den till det nya kontoret. Saknad markör tolkas som
 * äldre lokal data (före molnsynk) som får migreras upp en gång.
 */
const DATA_OFFICE_KEY = "hajpex.dataOffice.v1";

export async function hydrateFromCloud(officeId: string): Promise<void> {
  if (typeof window === "undefined") return;
  currentOfficeId = officeId;

  const { data, error } = await sb()
    .from("app_state")
    .select("store_key, data")
    .eq("office_id", officeId);

  if (error) {
    console.error("[cloudSync] hydrering misslyckades:", error.message ?? error);
    hydrated = true; // låt appen köra vidare på lokal data
    return;
  }

  const cloud = new Map<string, unknown>(
    ((data ?? []) as { store_key: string; data: unknown }[]).map((r) => [r.store_key, r.data])
  );

  const localOwner = window.localStorage.getItem(DATA_OFFICE_KEY);
  // Får lokal data migreras upp? Endast om den faktiskt tillhör detta kontor
  // (samma ägare) eller om ingen markör finns ännu (äldre data före molnsynk).
  const mayMigrateUp = !localOwner || localOwner === officeId;

  for (const key of SYNCED_KEYS) {
    if (cloud.has(key)) {
      // Molnet är auktoritativt
      try {
        window.localStorage.setItem(key, JSON.stringify(cloud.get(key)));
      } catch { /* ignore */ }
    } else if (mayMigrateUp) {
      // Molnet saknar nyckeln men datan tillhör detta kontor → migrera upp
      const local = window.localStorage.getItem(key);
      if (local) {
        try { await upsert(officeId, key, JSON.parse(local)); } catch { /* ignore */ }
      }
    } else {
      // Bytte till ett annat kontor som saknar denna data → rensa gammal lokal data
      window.localStorage.removeItem(key);
    }
  }

  try { window.localStorage.setItem(DATA_OFFICE_KEY, officeId); } catch { /* ignore */ }
  hydrated = true;
}

/**
 * Anropas från store-write(). Skickar upp hela listan (debounced) till molnet.
 * Gör inget förrän vi är hydrerade och inloggade (currentOfficeId satt).
 */
export function schedulePush(key: string): void {
  if (typeof window === "undefined") return;
  if (!currentOfficeId || !hydrated) return;

  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    const officeId = currentOfficeId;
    if (!officeId) return;
    let value: unknown = null;
    try {
      const raw = window.localStorage.getItem(key);
      value = raw ? JSON.parse(raw) : null;
    } catch { return; }
    if (value !== null) void upsert(officeId, key, value);
  }, 600);
}
