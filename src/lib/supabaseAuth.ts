import { supabase } from "./supabase";

export type AppRole = "admin" | "maklare" | "franchise_admin";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: AppRole;
  officeId: string | null;
  officeName: string;
  franchiseId: string | null;
  isSuperAdmin: boolean;
};

type UserRow = {
  id: string;
  name: string;
  initials: string | null;
  role: string;
  office_id: string | null;
  franchise_id: string | null;
  is_super_admin: boolean;
};

/** Bygg AppUser från en users-rad + känd e-post. */
async function buildAppUser(u: UserRow, email: string): Promise<AppUser> {
  let officeName = "";
  if (u.office_id) {
    const { data: o } = await supabase
      .from("offices")
      .select("name")
      .eq("id", u.office_id)
      .single() as { data: { name: string } | null; error: unknown };
    officeName = o?.name ?? "";
  }

  return {
    id: u.id,
    email,
    name: u.name,
    initials: u.initials ?? u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
    role: u.role as AppRole,
    officeId: u.office_id,
    officeName,
    franchiseId: u.franchise_id,
    isSuperAdmin: u.is_super_admin ?? false,
  };
}

async function fetchUserRow(userId: string): Promise<UserRow | null> {
  const { data } = await supabase
    .from("users")
    .select("id, name, initials, role, office_id, franchise_id, is_super_admin")
    .eq("id", userId)
    .single() as { data: UserRow | null; error: unknown };
  return data;
}

export type SignInResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: "auth" | "profile"; message: string };

export async function signInDetailed(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, reason: "auth", message: error?.message ?? "Inloggning misslyckades" };
  }

  const u = await fetchUserRow(data.user.id);
  if (!u) {
    return { ok: false, reason: "profile", message: "Hittade ingen profil (users-raden saknas)" };
  }

  return { ok: true, user: await buildAppUser(u, data.user.email ?? email) };
}

export async function signIn(email: string, password: string): Promise<AppUser | null> {
  const res = await signInDetailed(email, password);
  return res.ok ? res.user : null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Hämtar inloggad användare utifrån befintlig session (ingen extra getUser()-rundtur). */
export async function getSession(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser) return null;

  const u = await fetchUserRow(sessionUser.id);
  if (!u) return null;
  return buildAppUser(u, sessionUser.email ?? "");
}

export async function fetchAppUser(userId: string): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email ?? "";
  const u = await fetchUserRow(userId);
  if (!u) return null;
  return buildAppUser(u, email);
}

/* ─────────────────────────────────────────────────────────────
   Aktivt kontor — för super_admin & franchise_admin som ser flera
   kontor. Vanlig mäklare har bara sitt eget kontor.
───────────────────────────────────────────────────────────── */

export type OfficeRef = { id: string; name: string };

const ACTIVE_OFFICE_KEY = "hajpex.activeOffice.v1";

/** True om användaren kan se mer än sitt eget kontor. */
export function hasMultiOfficeAccess(user: AppUser): boolean {
  return user.isSuperAdmin || user.role === "franchise_admin";
}

/** Kontor användaren får se. RLS avgör mängden (super=alla, franchise=sina, övriga=sitt). */
export async function listAccessibleOffices(): Promise<OfficeRef[]> {
  const { data } = await supabase
    .from("offices")
    .select("id, name")
    .order("name") as { data: OfficeRef[] | null; error: unknown };
  return data ?? [];
}

export function getStoredActiveOfficeId(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(ACTIVE_OFFICE_KEY); } catch { return null; }
}

export function setActiveOfficeId(officeId: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(ACTIVE_OFFICE_KEY, officeId); } catch { /* ignore */ }
}

/**
 * Vilket kontor ska visas/hydreras just nu.
 * Vanlig användare → sitt eget kontor (ingen extra fråga).
 * Admin med flera kontor → sparat val om giltigt, annars eget/första kontoret.
 */
export async function resolveActiveOfficeId(user: AppUser): Promise<string | null> {
  if (!hasMultiOfficeAccess(user)) return user.officeId;

  const offices = await listAccessibleOffices();
  const stored = getStoredActiveOfficeId();
  if (stored && offices.some((o) => o.id === stored)) return stored;

  const fallback = (user.officeId && offices.some((o) => o.id === user.officeId))
    ? user.officeId
    : (offices[0]?.id ?? null);
  if (fallback) setActiveOfficeId(fallback);
  return fallback;
}

export async function registerOffice(opts: {
  officeName: string;
  email: string;
  password: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
  });
  if (authError || !authData.user) return { ok: false, error: authError?.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: office, error: officeError } = await sb
    .from("offices")
    .insert({ name: opts.officeName })
    .select("id")
    .single() as { data: { id: string } | null; error: unknown };

  if (officeError || !office) return { ok: false, error: "Kunde inte skapa kontor" };

  const { error: userError } = await sb.from("users").insert({
    id: authData.user.id,
    office_id: office.id,
    name: opts.name,
    role: "admin",
  }) as { error: unknown };

  if (userError) return { ok: false, error: String(userError) };

  return { ok: true };
}
