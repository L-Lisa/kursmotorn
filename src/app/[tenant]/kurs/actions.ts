"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, getCurrentUser, isReviewMode } from "@/lib/tenant/context";
import { getCourseForTenant, getGatingState, sectionsInOrder } from "@/lib/tenant/course";

type Result = { ok: boolean; error?: string };

// Granskningsläget är ett läsläge: gransknings-/adminkonton skriver aldrig progress.
// (Samma grind finns i DB — migration ..15 — detta ger bara det lugna felet.)
const REVIEW_READONLY = "Granskningsläget är ett läsläge — ingen progress skrivs.";

/**
 * Bockar av / bockar ur en sektion. Gating ENFORCE:as server-side här — inte i
 * klienten (SPEC §2.3). En låst sektion kan aldrig bockas av, oavsett vad klienten
 * skickar. Provregeln följer med eftersom gating-kärnan är samma som i vyn.
 */
export async function toggleSection(tenant: string, sectionId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };

  const { tenantId } = await getTenantContext(tenant);
  if (await isReviewMode(tenantId)) return { ok: false, error: REVIEW_READONLY };
  const course = await getCourseForTenant(tenantId);
  if (!course) return { ok: false, error: "ingen kurs" };

  const section = sectionsInOrder(course).find((s) => s.id === sectionId);
  if (!section) return { ok: false, error: "okänd sektion" };
  if (!section.requirements?.checkoff) return { ok: false, error: "sektionen bockas inte av manuellt" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("section_progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("section_id", sectionId)
    .maybeSingle();

  if (existing) {
    await supabase.from("section_progress").delete().eq("id", existing.id);
  } else {
    // Enforce gating: bara en upplåst sektion får bockas av.
    const gate = (await getGatingState(course, user.id)).get(sectionId);
    if (!gate?.unlocked) return { ok: false, error: "sektionen är låst" };
    const { error } = await supabase
      .from("section_progress")
      .insert({ tenant_id: tenantId, user_id: user.id, section_id: sectionId });
    if (error) return { ok: false, error: error.message };
  }

  // "layout" så även läsvyn (/kurs/vecka/…) uppdateras — avbockning/ångra görs där med.
  revalidatePath(`/${tenant}/kurs`, "layout");
  return { ok: true };
}

/**
 * Registrerar en klar MP4-uppladdning (metadataraden). Filen är redan uppladdad till
 * Storage via TUS på path <tenant>/<user>/<section>/... (storage-RLS gatar prefixet).
 * Gating ENFORCE:as: bara en upplåst uppladdningssektion får registreras.
 */
export async function recordUpload(
  tenant: string,
  sectionId: string,
  storagePath: string,
  sizeBytes: number,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };

  const { tenantId } = await getTenantContext(tenant);
  if (await isReviewMode(tenantId)) return { ok: false, error: REVIEW_READONLY };
  const course = await getCourseForTenant(tenantId);
  if (!course) return { ok: false, error: "ingen kurs" };

  const section = sectionsInOrder(course).find((s) => s.id === sectionId);
  if (!section?.requirements?.upload_required) return { ok: false, error: "ej uppladdningssektion" };
  if (!storagePath.startsWith(`${tenantId}/${user.id}/${sectionId}/`)) {
    return { ok: false, error: "fel path-prefix" };
  }

  const gate = (await getGatingState(course, user.id)).get(sectionId);
  if (!gate?.unlocked) return { ok: false, error: "sektionen är låst" };

  const supabase = await createClient();
  const { error } = await supabase.from("uploads").insert({
    tenant_id: tenantId,
    user_id: user.id,
    section_id: sectionId,
    storage_path: storagePath,
    size_bytes: sizeBytes,
  });
  if (error) return { ok: false, error: error.message };

  // "layout" så även läsvyn (/kurs/vecka/…) uppdateras — avbockning/ångra görs där med.
  revalidatePath(`/${tenant}/kurs`, "layout");
  return { ok: true };
}
