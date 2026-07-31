"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant } from "@/lib/tenant/course";

type Result = { ok: boolean; error?: string };

/**
 * Loggåtgärder (fas 7). Reglerna bor i DB-funktionen log_activity (typregister,
 * dagsdubbletter, 7-dagarsfönstret, inga framtida datum) — åtgärderna här är
 * tunna wrappers som översätter fel till lugn svenska. Inget outbound.
 */
async function log(
  tenant: string,
  logType: string,
  loggedDate: string,
  metadata: Record<string, unknown>,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };
  const { tenantId } = await getTenantContext(tenant);
  const course = await getCourseForTenant(tenantId);
  if (!course) return { ok: false, error: "ingen kurs" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_activity", {
    p_course_id: course.id,
    p_log_type: logType,
    p_logged_date: loggedDate,
    p_source: "manual",
    p_metadata: metadata,
  });
  if (error) {
    if (/redan loggad/.test(error.message)) {
      return { ok: false, error: "Den dagen är redan loggad — den räknas." };
    }
    if (/dagar bakåt/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    if (/framtiden/.test(error.message)) {
      return { ok: false, error: "Datumet ligger i framtiden." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function logPracticeDay(
  tenant: string,
  loggedDate: string,
  note: string,
): Promise<Result> {
  const res = await log(tenant, "practice_day", loggedDate, note.trim() ? { note: note.trim() } : {});
  if (res.ok) revalidatePath(`/${tenant}/kurs/logg`);
  return res;
}

/**
 * Auto-loggning från meditationsspelaren: spelaren rapporterar att ≥90 % av
 * sektionens media spelats (mätt i klienten, v1 — loggat i DECISIONS). Servern
 * validerar att sektionen faktiskt har media och hör till kursen; log_activity
 * är idempotent (två genomförda meditationer samma dag ⇒ fortfarande EN rad).
 */
export async function recordPlayback(tenant: string, sectionId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ej inloggad" };
  const { tenantId } = await getTenantContext(tenant);
  const course = await getCourseForTenant(tenantId);
  if (!course) return { ok: false, error: "ingen kurs" };

  const section = course.modules.flatMap((m) => m.sections).find((s) => s.id === sectionId);
  if (!section?.mediaPath) return { ok: false, error: "sektionen har inget media" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_activity", {
    p_course_id: course.id,
    p_log_type: "practice_day",
    p_logged_date: new Date().toISOString().slice(0, 10),
    p_source: "auto",
    p_metadata: { section_id: sectionId },
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${tenant}/kurs/logg`);
  return { ok: true };
}

export async function logGuideSession(
  tenant: string,
  form: FormData,
): Promise<Result> {
  const loggedDate = String(form.get("logged_date") ?? "");
  const format = String(form.get("format") ?? "annat");
  const context = String(form.get("context") ?? "").trim();
  const participantsRaw = String(form.get("participants_count") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (!loggedDate) return { ok: false, error: "välj datum" };

  const participants = participantsRaw === "" ? null : Number(participantsRaw);
  if (participants !== null && (!Number.isInteger(participants) || participants < 0)) {
    return { ok: false, error: "ogiltigt deltagarantal" };
  }

  const res = await log(tenant, "guide_session", loggedDate, {
    format,
    context: context || null,
    participants_count: participants,
    note: note || null,
  });
  if (res.ok) revalidatePath(`/${tenant}/kurs/guideresa`);
  return res;
}
