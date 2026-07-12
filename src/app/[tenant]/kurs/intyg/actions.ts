"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";

type Result = { ok: boolean; error?: string };

/**
 * Lämnar heder-och-samvete-attestationen. Lydelsen sätts server-side i
 * submit_attestation (versionerad) — klienten kan inte ändra texten.
 */
export async function submitAttestation(
  tenant: string,
  type = "live_session_honor",
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };

  const { tenantId } = await getTenantContext(tenant);
  const course = await getCourseForTenant(tenantId);
  if (!course) return { ok: false, error: "ingen kurs" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_attestation", {
    p_course_id: course.id,
    p_type: type,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${tenant}/kurs/intyg`);
  return { ok: true };
}

/**
 * Utfärdar certifikatet. issue_certificate (SECURITY DEFINER) RE-VERIFIERAR alla
 * typade krav server-side innan raden skapas — den här åtgärden kan inte kringgå det.
 * Idempotent: redan utfärdat (icke-revokerat) certifikat återanvänds.
 */
export async function issueCertificate(
  tenant: string,
): Promise<Result & { slug?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };

  const { tenantId } = await getTenantContext(tenant);
  const course = await getCourseForTenant(tenantId);
  if (!course) return { ok: false, error: "ingen kurs" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_certificate", {
    p_course_id: course.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${tenant}/kurs/intyg`);
  return { ok: true, slug: (data as { verify_slug?: string })?.verify_slug };
}
