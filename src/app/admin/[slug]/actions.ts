"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/admin/data";

/**
 * Admin-serveråtgärder (fas 6). Tunna wrappers: auktorisationen bor i RLS +
 * serverfunktionerna (create_enrollment/move_enrollment är atomära och
 * enforce:ar datamodellens regler). Ingen åtgärd här har extern effekt —
 * inga mejl, inga anrop utanför Supabase (repo-CLAUDE.md #1).
 */

type Result = { ok: boolean; error?: string; id?: string };

function fail(error: unknown): Result {
  const msg =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : "okänt fel";
  return { ok: false, error: msg };
}

const COHORT_STATUS = ["planned", "active", "completed", "cancelled"] as const;
const PARTY = ["platform", "leader"] as const;

export async function createCohort(slug: string, form: FormData): Promise<Result> {
  const { tenantId } = await requireTenantAdmin(slug);
  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  const startDate = String(form.get("start_date") ?? "");
  const price = Number(form.get("price_per_participant_sek"));
  if (!name || !startDate || !Number.isFinite(price) || price < 0) {
    return { ok: false, error: "namn, startdatum och pris krävs" };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!course) return { ok: false, error: "tenanten har ingen kurs" };

  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      tenant_id: tenantId,
      course_id: course.id,
      name,
      start_date: startDate,
      end_date: String(form.get("end_date") ?? "") || null,
      price_per_participant_sek: Math.round(price),
    })
    .select("id")
    .single();
  if (error) return fail(error);

  revalidatePath(`/admin/${slug}/kohorter`);
  return { ok: true, id: data.id as string };
}

export async function updateCohort(
  slug: string,
  cohortId: string,
  form: FormData,
): Promise<Result> {
  const { tenantId } = await requireTenantAdmin(slug);
  const supabase = await createClient();

  const status = String(form.get("status") ?? "");
  const soldBy = String(form.get("sold_by") ?? "");
  const deliveredBy = String(form.get("delivered_by") ?? "");
  const price = Number(form.get("price_per_participant_sek"));
  if (
    !COHORT_STATUS.includes(status as (typeof COHORT_STATUS)[number]) ||
    !PARTY.includes(soldBy as (typeof PARTY)[number]) ||
    !PARTY.includes(deliveredBy as (typeof PARTY)[number]) ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return { ok: false, error: "ogiltiga fält" };
  }

  const { error } = await supabase
    .from("cohorts")
    .update({
      name: String(form.get("name") ?? "").trim(),
      start_date: String(form.get("start_date") ?? ""),
      end_date: String(form.get("end_date") ?? "") || null,
      price_per_participant_sek: Math.round(price),
      status,
      sold_by: soldBy,
      delivered_by: deliveredBy,
    })
    .eq("id", cohortId)
    .eq("tenant_id", tenantId);
  if (error) return fail(error);

  revalidatePath(`/admin/${slug}/kohorter/${cohortId}`);
  revalidatePath(`/admin/${slug}/kohorter`);
  return { ok: true };
}

export async function addEnrollment(
  slug: string,
  cohortId: string,
  form: FormData,
): Promise<Result> {
  await requireTenantAdmin(slug);
  const supabase = await createClient();

  const userId = String(form.get("user_id") ?? "");
  if (!userId) return { ok: false, error: "välj deltagare" };
  const startsAt = String(form.get("starts_at") ?? "") || null;
  const company = String(form.get("company") ?? "").trim() || null;
  const overrideRaw = String(form.get("price_override_sek") ?? "").trim();
  const priceOverride = overrideRaw === "" ? null : Math.round(Number(overrideRaw));
  if (priceOverride !== null && !Number.isFinite(priceOverride)) {
    return { ok: false, error: "ogiltigt prisavdrag" };
  }

  const { error } = await supabase.rpc("create_enrollment", {
    p_cohort_id: cohortId,
    p_user_id: userId,
    p_starts_at: startsAt,
    p_company: company,
    p_price_override_sek: priceOverride,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "deltagaren har redan en aktiv plats på kursen" };
    }
    return fail(error);
  }

  revalidatePath(`/admin/${slug}/kohorter/${cohortId}`);
  return { ok: true };
}

export async function moveEnrollment(
  slug: string,
  enrollmentId: string,
  toCohortId: string,
  newStartsAt: string | null,
): Promise<Result> {
  await requireTenantAdmin(slug);
  const supabase = await createClient();

  const { error } = await supabase.rpc("move_enrollment", {
    p_enrollment_id: enrollmentId,
    p_to_cohort_id: toCohortId,
    p_new_starts_at: newStartsAt || null,
  });
  if (error) return fail(error);

  revalidatePath(`/admin/${slug}/kohorter`);
  return { ok: true };
}

/**
 * Brand-wizarden: bygger brand_spec-jsonb enligt mallens schema och sparar.
 * Renderas direkt: tenant-vyerna läser spec:en ur DB per request (fas 2-beviset).
 */
export async function saveBrandSpec(slug: string, form: FormData): Promise<Result> {
  const { tenantId } = await requireTenantAdmin(slug);
  const supabase = await createClient();

  const { buildBrandSpec, COLOR_KEYS } = await import("@/lib/admin/brand-spec");
  const g = (k: string) => String(form.get(k) ?? "");
  const colors = Object.fromEntries(COLOR_KEYS.map((k) => [k, g(`color_${k}`)])) as Record<
    (typeof COLOR_KEYS)[number],
    string
  >;

  const built = buildBrandSpec({
    tenant_name: g("tenant_name"),
    course_name: g("course_name"),
    certificate_title: g("certificate_title"),
    tagline: g("tagline"),
    org_legal_name: g("org_legal_name"),
    org_nr: g("org_nr"),
    org_website: g("org_website"),
    org_contact: g("org_contact"),
    colors,
    font_serif: g("font_serif"),
    font_sans: g("font_sans"),
    font_mono: g("font_mono"),
    tone_words: g("tone_words"),
    address: g("address"),
    language: g("language"),
    sample_line_1: g("sample_line_1"),
    sample_line_2: g("sample_line_2"),
    avoid: g("avoid"),
    logo_url: g("logo_url"),
    cert_issuer_text: g("cert_issuer_text"),
    cert_signature_name: g("cert_signature_name"),
    cert_signature_title: g("cert_signature_title"),
    subdomain: g("subdomain"),
    custom_domain: g("custom_domain"),
  });
  if (!built.ok) return { ok: false, error: built.error };

  const { error } = await supabase
    .from("tenant_brands")
    .upsert(
      { tenant_id: tenantId, brand_spec: built.spec, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" },
    );
  if (error) return fail(error);

  revalidatePath(`/admin/${slug}/brand`);
  revalidatePath(`/${slug}`);
  return { ok: true };
}

/** Manuell fakturerad/betald-markering — kan sättas OCH ångras (ingen extern effekt). */
export async function setEnrollmentMark(
  slug: string,
  enrollmentId: string,
  field: "invoiced_at" | "paid_at",
  value: boolean,
): Promise<Result> {
  const { tenantId } = await requireTenantAdmin(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("enrollments")
    .update({ [field]: value ? new Date().toISOString() : null })
    .eq("id", enrollmentId)
    .eq("tenant_id", tenantId);
  if (error) return fail(error);

  revalidatePath(`/admin/${slug}/kohorter`);
  return { ok: true };
}
