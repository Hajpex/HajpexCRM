import { supabase } from "./supabase";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: "admin" | "maklare";
  officeId: string;
  officeName: string;
};

export async function signIn(email: string, password: string): Promise<AppUser | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return fetchAppUser(data.user.id);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function fetchAppUser(userId: string): Promise<AppUser | null> {
  const { data: authData } = await supabase.auth.getUser();
  const email = authData?.user?.email ?? "";

  const { data: u } = await supabase
    .from("users")
    .select("id, name, initials, role, office_id")
    .eq("id", userId)
    .single() as { data: { id: string; name: string; initials: string | null; role: string; office_id: string } | null; error: unknown };

  if (!u) return null;

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
  };
}

export async function getSession(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  return fetchAppUser(data.session.user.id);
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
