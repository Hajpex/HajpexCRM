import { supabase } from "./supabase";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: "admin" | "maklare";
  officeId: string;
  officeName: string;
  isSuperAdmin: boolean;
};

type UserRow = {
  id: string;
  name: string;
  initials: string | null;
  role: string;
  office_id: string;
  is_super_admin: boolean;
};

/** Bygg AppUser från en users-rad + känd e-post. */
async function buildAppUser(u: UserRow, email: string): Promise<AppUser> {
  const { data: o } = await supabase
    .from("offices")
    .select("name")
    .eq("id", u.office_id)
    .single() as { data: { name: string } | null; error: unknown };

  return {
    id: u.id,
    email,
    name: u.name,
    initials: u.initials ?? u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
    role: u.role as "admin" | "maklare",
    officeId: u.office_id,
    officeName: o?.name ?? "",
    isSuperAdmin: u.is_super_admin ?? false,
  };
}

async function fetchUserRow(userId: string): Promise<UserRow | null> {
  const { data } = await supabase
    .from("users")
    .select("id, name, initials, role, office_id, is_super_admin")
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
