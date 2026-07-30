import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-klienten (kringgår RLS). FÅR ENDAST användas i server-åtgärder som
 * kräver admin-API:t (GDPR-raderingen) — ALDRIG i renderingsvägen (fas 2-principen:
 * tenant-isolationen vilar på RLS hela vägen). Importera aldrig från klientkod.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Service-miljövariabler saknas");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
