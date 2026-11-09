import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let _admin: SupabaseClient | null = null;

/** Cliente com service role: só no servidor. Todas as tabelas glam_ têm RLS fechado. */
export function db(): SupabaseClient {
  if (!_admin) {
    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    }
    _admin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
