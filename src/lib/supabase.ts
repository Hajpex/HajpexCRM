import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./supabase.types";

const URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function getSupabase() {
  return createBrowserClient<Database>(URL, ANON);
}

export const supabase = createBrowserClient<Database>(URL, ANON);
