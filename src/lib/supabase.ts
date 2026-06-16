import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

const URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Klient-renderad app: använd standard browserklient som sparar sessionen
// i localStorage och fäster JWT på alla anrop automatiskt.
export const supabase = createClient<Database>(URL, ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export function getSupabase() {
  return supabase;
}
