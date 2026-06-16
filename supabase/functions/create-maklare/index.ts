// Supabase Edge Function: create-maklare
// Skapar en ny mäklare (auth-konto + profilrad) på ett kontor.
// Endast super_admin, franchise_admin eller kontorsadmin får anropa, och bara
// för kontor i sin egen behörighet. Använder service_role (server-side hemlighet).
//
// Deploy:  supabase functions deploy create-maklare
// (service_role-nyckeln finns automatiskt som env i Edge Functions.)

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Klient som agerar som anroparen (för identitet + behörighet)
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser } } = await caller.auth.getUser();
    if (!authUser) return json({ error: "Ej inloggad" }, 401);

    const { data: me } = await caller
      .from("users")
      .select("role, is_super_admin, franchise_id, office_id")
      .eq("id", authUser.id)
      .single();

    const isAdmin = me?.is_super_admin || me?.role === "franchise_admin" || me?.role === "admin";
    if (!isAdmin) return json({ error: "Saknar behörighet" }, 403);

    const { name, email, password, office_id, role } = await req.json();
    if (!name || !email || !password || !office_id) {
      return json({ error: "Fyll i namn, e-post, lösenord och kontor" }, 400);
    }
    if (String(password).length < 6) {
      return json({ error: "Lösenordet måste vara minst 6 tecken" }, 400);
    }

    const admin = createClient(url, service);

    // Behörighet: kontoret måste ligga inom anroparens scope (om ej super admin)
    if (!me?.is_super_admin) {
      const { data: office } = await admin
        .from("offices")
        .select("id, franchise_id")
        .eq("id", office_id)
        .single();
      const allowed = office && (
        office.id === me?.office_id ||
        (office.franchise_id && office.franchise_id === me?.franchise_id)
      );
      if (!allowed) return json({ error: "Kontoret ligger utanför din behörighet" }, 403);
    }

    // Skapa auth-konto (bekräftat direkt)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr || !created.user) {
      return json({ error: cErr?.message ?? "Kunde inte skapa konto" }, 400);
    }

    // Skapa profilrad
    const { error: pErr } = await admin.from("users").insert({
      id: created.user.id,
      name,
      office_id,
      role: role === "admin" ? "admin" : "maklare",
      active: true,
    });
    if (pErr) {
      // Rulla tillbaka auth-kontot om profilen inte kunde skapas
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: pErr.message }, 400);
    }

    return json({ ok: true, id: created.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
