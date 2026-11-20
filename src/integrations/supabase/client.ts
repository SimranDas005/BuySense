/**
 * The single Supabase client used by the whole app: authentication, sessions,
 * RLS-protected data and RPCs. No other auth backend exists in BuySense.
 */
import { createClient } from "@supabase/supabase-js";
import type { AppDatabase } from "./app-db";

const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] ?? "https://hazcabigmgniaoewhqfs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  "sb_publishable_ICeVwEysX7Lxwhp_4cAV-Q_PuA59u_t";

export const supabase = createClient<AppDatabase>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Recovery / confirmation links are exchanged once, explicitly, in AuthProvider.
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
