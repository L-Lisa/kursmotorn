import { createClient } from "@/lib/supabase/server";
import { computeLogWindows, type LogWindowResult } from "./log-windows";
import { sectionsInOrder, type CourseView } from "./course";

/**
 * Logg-datalagret (fas 7). Serverfunktioner för praxisloggen och guidesessionerna —
 * läser via den inloggade klienten (RLS: egna rader). Fönster-/certberäkningen för
 * UTFÄRDANDE bor i DB (_cert_requirement_met); det här lagret speglar samma regler
 * för VISNING (testerna kör samma mönster mot båda så de inte divergerar).
 */

export type PracticeLogView = {
  startsAt: string | null; // aktiv enrollments starts_at (fönsterankaret)
  weeks: number;
  minDaysPerWeek: number;
  manualWindowDays: number | null;
  loggedDates: string[]; // egna practice_day-datum
  loggedToday: boolean;
  windows: LogWindowResult | null; // null utan enrollment
  /** Antal loggade dagar i fönstret som innehåller dagens datum (null = utanför fönstren). */
  currentWindow: { index: number; daysLogged: number; target: number } | null;
};

export async function getPracticeLog(course: CourseView, userId: string): Promise<PracticeLogView> {
  const supabase = await createClient();

  const [enrollRes, logRes, reqRes, defRes, dispRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("starts_at")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("activity_logs")
      .select("logged_date")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("log_type", "practice_day"),
    supabase
      .from("course_certificate_requirements")
      .select("config")
      .eq("course_id", course.id)
      .eq("type", "log_threshold")
      .maybeSingle(),
    supabase
      .from("log_type_defs")
      .select("manual_window_days")
      .eq("course_id", course.id)
      .eq("log_type", "practice_day")
      .maybeSingle(),
    supabase
      .from("approvals")
      .select("target")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("approval_type", "log_threshold_dispens")
      .eq("passed", true),
  ]);

  const cfg = (reqRes.data?.config ?? {}) as Record<string, unknown>;
  const weeks = typeof cfg.weeks === "number" ? cfg.weeks : 6;
  const minDaysPerWeek = typeof cfg.min_days_per_week === "number" ? cfg.min_days_per_week : 5;
  const loggedDates = (logRes.data ?? []).map((r) => r.logged_date as string);
  const startsAt = (enrollRes.data?.starts_at as string | null) ?? null;
  const dispensedWindows = (dispRes.data ?? [])
    .map((r) => Number((r.target as Record<string, unknown> | null)?.window_index))
    .filter((n) => Number.isFinite(n));

  const windows = startsAt
    ? computeLogWindows({ startsAt, weeks, minDaysPerWeek, loggedDates, dispensedWindows })
    : null;

  const today = new Date().toISOString().slice(0, 10);
  const cur = windows?.windows.find((w) => today >= w.start && today <= w.end) ?? null;

  return {
    startsAt,
    weeks,
    minDaysPerWeek,
    manualWindowDays: (defRes.data?.manual_window_days as number | null) ?? null,
    loggedDates,
    loggedToday: loggedDates.includes(today),
    windows,
    currentWindow: cur ? { index: cur.index, daysLogged: cur.daysLogged, target: minDaysPerWeek } : null,
  };
}

export type CertRequirementView = { type: string; met: boolean };

/** Certstatus per krav via certificate_status (samma DB-sanning som utfärdandet). */
export async function getCertRequirements(
  courseId: string,
): Promise<{ requirements: CertRequirementView[]; allMet: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("certificate_status", { p_course_id: courseId });
  if (!data) return null;
  const reqs = ((data.requirements as { type: string; met: boolean }[]) ?? []).map((r) => ({
    type: r.type,
    met: r.met,
  }));
  return { requirements: reqs, allMet: !!data.all_met };
}

/** Svenska kravetiketter — motorns ord, generiska (aldrig kursens innehåll). */
export function requirementLabel(type: string): string {
  const map: Record<string, string> = {
    sections_complete: "Alla delar genomförda",
    final_quiz_pass: "Godkänt slutprov",
    attestation: "Intygande",
    log_threshold: "Praxisloggen",
    upload_sections: "Inspelningarna",
    manual_approval: "Bedömd certifieringssession",
  };
  return map[type] ?? type;
}

export type GuideFormat = { key: string; label: string };

export type GuideSessionRow = {
  id: string;
  loggedDate: string;
  format: string;
  context: string | null;
  participantsCount: number | null;
  note: string | null;
};

export type GuideJourney = {
  formats: GuideFormat[];
  licenseTarget: number;
  sessions: GuideSessionRow[];
  /** Datum för första uppladdningen i kursens sista uppladdningssektion (V9) — eller null. */
  finalUploadDate: string | null;
  countedSessions: number; // sessioner daterade EFTER finalUploadDate
  level: "certifierad" | "deltagare";
};

export async function getGuideJourney(course: CourseView, userId: string): Promise<GuideJourney> {
  const supabase = await createClient();

  const uploadSections = sectionsInOrder(course).filter((s) => s.requirements?.upload_required);
  const finalUploadSection = uploadSections.at(-1) ?? null;

  const [defRes, logRes, uploadRes, certRes] = await Promise.all([
    supabase
      .from("log_type_defs")
      .select("config")
      .eq("course_id", course.id)
      .eq("log_type", "guide_session")
      .maybeSingle(),
    supabase
      .from("activity_logs")
      .select("id, logged_date, metadata")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("log_type", "guide_session")
      .order("logged_date", { ascending: false }),
    finalUploadSection
      ? supabase
          .from("uploads")
          .select("created_at")
          .eq("user_id", userId)
          .eq("section_id", finalUploadSection.id)
          .order("created_at")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("certificates")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const cfg = (defRes.data?.config ?? {}) as Record<string, unknown>;
  const formats: GuideFormat[] = Array.isArray(cfg.formats)
    ? (cfg.formats as GuideFormat[]).filter((f) => f && typeof f.key === "string")
    : [{ key: "annat", label: "Annat" }];
  const licenseTarget = typeof cfg.license_target === "number" ? cfg.license_target : 10;

  const sessions: GuideSessionRow[] = (logRes.data ?? []).map((r) => {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id as string,
      loggedDate: r.logged_date as string,
      format: typeof md.format === "string" ? md.format : "annat",
      context: typeof md.context === "string" ? md.context : null,
      participantsCount: typeof md.participants_count === "number" ? md.participants_count : null,
      note: typeof md.note === "string" ? md.note : null,
    };
  });

  const finalUploadDate = uploadRes.data?.created_at
    ? String(uploadRes.data.created_at).slice(0, 10)
    : null;
  const countedSessions = finalUploadDate
    ? sessions.filter((s) => s.loggedDate > finalUploadDate).length
    : 0;

  return {
    formats,
    licenseTarget,
    sessions,
    finalUploadDate,
    countedSessions,
    level: certRes.data ? "certifierad" : "deltagare",
  };
}
