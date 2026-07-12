import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBrand } from "./brand";
import type { TenantContext } from "./types";

/**
 * Enda vägen till en tenants brand. Läser via den smala publika RPC:n
 * (tenant_public_brand) så den fungerar BÅDE före inloggning (login-sidan) och
 * efter (kursvyn) — samma context-lager oavsett. Detta lager ÄR eject-snittet:
 * exporten byter bara ut datakällan, inte komponenterna.
 *
 * cache() dedupar anropet per request så layout + page kan hämta samma context
 * utan dubbel RPC.
 */
export const getTenantContext = cache(
  async (slug: string): Promise<TenantContext> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("tenant_public_brand", {
      p_slug: slug,
    });

    const row = Array.isArray(data) ? data[0] : undefined;
    if (error || !row) notFound();

    return {
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      status: row.status as string,
      brand: parseBrand(row.brand_spec),
    };
  },
);

/** Inloggad användare (eller null). RLS avgör vad hen sedan kan läsa. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
