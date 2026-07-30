import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, getCurrentUser } from "@/lib/tenant/context";
import { getCourseForTenant, sectionsInOrder, type CourseView } from "@/lib/tenant/course";
import { isSectionComplete } from "@/lib/tenant/gating";
import { buildUnderlag, type Underlag } from "@/lib/tenant/underlag";
import type { Brand } from "@/lib/tenant/types";

/**
 * Datalager för motor-admin (fas 6). Allt läses via den inloggade klienten —
 * RLS är auktoriteten; is_tenant_admin-RPC:n används bara för att gate:a
 * RENDERINGEN (en icke-admin ska få 404, inte en tom sida).
 */

export type AdminContext = {
  tenantId: string;
  slug: string;
  brand: Brand;
  userId: string;
};

export async function requireTenantAdmin(slug: string): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/admin/${slug}`);
  const ctx = await getTenantContext(slug);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_tenant_admin", { tid: ctx.tenantId });
  if (!isAdmin) notFound();
  return { tenantId: ctx.tenantId, slug: ctx.slug, brand: ctx.brand, userId: user.id };
}

export type CohortRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  priceSek: number;
  status: string;
  soldBy: string;
  deliveredBy: string;
  enrollmentCount: number;
};

export async function listCohorts(tenantId: string): Promise<CohortRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohorts")
    // Uttrycklig FK-hint: enrollments↔cohorts har två relationer (composite-FK:n
    // från integritetshärdningen) — utan hint är embedden tvetydig för PostgREST.
    .select(
      "id, name, start_date, end_date, price_per_participant_sek, status, sold_by, delivered_by, enrollments!enrollments_cohort_id_fkey(id, status)",
    )
    .eq("tenant_id", tenantId)
    .order("start_date");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    startDate: c.start_date as string,
    endDate: (c.end_date as string | null) ?? null,
    priceSek: c.price_per_participant_sek as number,
    status: c.status as string,
    soldBy: c.sold_by as string,
    deliveredBy: c.delivered_by as string,
    enrollmentCount: ((c.enrollments as { status: string }[] | null) ?? []).filter(
      (e) => e.status === "active",
    ).length,
  }));
}

export type MemberInfo = { userId: string; fullName: string; email: string; role: string };

export async function getMemberNames(tenantId: string): Promise<Map<string, MemberInfo>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("tenant_member_names", { p_tenant_id: tenantId });
  const map = new Map<string, MemberInfo>();
  for (const r of (data as Record<string, unknown>[] | null) ?? []) {
    map.set(r.user_id as string, {
      userId: r.user_id as string,
      fullName: r.full_name as string,
      email: r.email as string,
      role: r.member_role as string,
    });
  }
  return map;
}

export type EnrollmentRow = {
  id: string;
  userId: string;
  fullName: string;
  cohortId: string;
  status: string;
  startsAt: string;
  company: string | null;
  priceOverrideSek: number | null;
  invoicedAt: string | null;
  paidAt: string | null;
  movedFrom: string | null;
};

export async function listEnrollments(
  tenantId: string,
  cohortId?: string,
): Promise<EnrollmentRow[]> {
  const supabase = await createClient();
  const members = await getMemberNames(tenantId);
  let q = supabase
    .from("enrollments")
    .select(
      "id, user_id, cohort_id, status, starts_at, company, price_override_sek, invoiced_at, paid_at, moved_from_enrollment_id",
    )
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (cohortId) q = q.eq("cohort_id", cohortId);
  const { data } = await q;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    userId: e.user_id as string,
    fullName: members.get(e.user_id as string)?.fullName ?? "(okänd)",
    cohortId: e.cohort_id as string,
    status: e.status as string,
    startsAt: e.starts_at as string,
    company: (e.company as string | null) ?? null,
    priceOverrideSek: (e.price_override_sek as number | null) ?? null,
    invoicedAt: (e.invoiced_at as string | null) ?? null,
    paidAt: (e.paid_at as string | null) ?? null,
    movedFrom: (e.moved_from_enrollment_id as string | null) ?? null,
  }));
}

export type CohortUnderlag = {
  cohort: CohortRow;
  underlag: Underlag;
};

export async function getCohortUnderlag(
  tenantId: string,
  cohortId: string,
): Promise<CohortUnderlag | null> {
  const cohorts = await listCohorts(tenantId);
  const cohort = cohorts.find((c) => c.id === cohortId);
  if (!cohort) return null;
  const enrollments = await listEnrollments(tenantId, cohortId);
  const underlag = buildUnderlag(
    cohort.priceSek,
    enrollments.map((e) => ({
      enrollmentId: e.id,
      fullName: e.fullName,
      company: e.company,
      status: e.status,
      startsAt: e.startsAt,
      priceOverrideSek: e.priceOverrideSek,
      invoicedAt: e.invoicedAt,
      paidAt: e.paidAt,
    })),
  );
  return { cohort, underlag };
}

/** Härledd deltagarstatus: klar (allt komplett/certifikat) · fast (>14 dagar tyst) · aktiv. */
export const STUCK_AFTER_DAYS = 14;

export type ParticipantRow = {
  userId: string;
  fullName: string;
  email: string;
  cohortId: string | null;
  cohortName: string | null;
  progressPct: number;
  lastActiveAt: string | null;
  finalQuiz: "passed" | "attempted" | "none" | "no_quiz";
  derived: "klar" | "fast" | "aktiv";
};

export async function listParticipants(
  tenantId: string,
  cohortFilter?: string,
): Promise<ParticipantRow[]> {
  const supabase = await createClient();
  const [members, course, cohorts] = await Promise.all([
    getMemberNames(tenantId),
    getCourseForTenant(tenantId),
    listCohorts(tenantId),
  ]);
  const cohortName = new Map(cohorts.map((c) => [c.id, c.name]));

  const [enrollRes, progressRes, uploadRes, attemptRes, logRes, certRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("user_id, cohort_id, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    supabase
      .from("section_progress")
      .select("user_id, section_id, completed_at")
      .eq("tenant_id", tenantId),
    supabase.from("uploads").select("user_id, section_id, created_at").eq("tenant_id", tenantId),
    supabase
      .from("quiz_attempts")
      .select("user_id, quiz_id, passed, created_at")
      .eq("tenant_id", tenantId),
    supabase.from("activity_logs").select("user_id, created_at").eq("tenant_id", tenantId),
    supabase
      .from("certificates")
      .select("user_id, revoked_at")
      .eq("tenant_id", tenantId),
  ]);

  const sections = course ? sectionsInOrder(course) : [];
  const finalQuizIds = new Set(
    await getFinalQuizIds(course),
  );

  type Acc = {
    completed: Set<string>;
    uploaded: Set<string>;
    passedQuizzes: Set<string>;
    finalAttempts: number;
    finalPassed: boolean;
    lastActive: string | null;
    hasCert: boolean;
  };
  const acc = new Map<string, Acc>();
  const get = (uid: string): Acc => {
    let a = acc.get(uid);
    if (!a) {
      a = {
        completed: new Set(),
        uploaded: new Set(),
        passedQuizzes: new Set(),
        finalAttempts: 0,
        finalPassed: false,
        lastActive: null,
        hasCert: false,
      };
      acc.set(uid, a);
    }
    return a;
  };
  const bump = (a: Acc, ts: unknown) => {
    const t = typeof ts === "string" ? ts : null;
    if (t && (!a.lastActive || t > a.lastActive)) a.lastActive = t;
  };

  for (const r of progressRes.data ?? []) {
    const a = get(r.user_id as string);
    a.completed.add(r.section_id as string);
    bump(a, r.completed_at);
  }
  for (const r of uploadRes.data ?? []) {
    const a = get(r.user_id as string);
    a.uploaded.add(r.section_id as string);
    bump(a, r.created_at);
  }
  for (const r of attemptRes.data ?? []) {
    const a = get(r.user_id as string);
    if (r.passed) a.passedQuizzes.add(r.quiz_id as string);
    if (finalQuizIds.has(r.quiz_id as string)) {
      a.finalAttempts += 1;
      if (r.passed) a.finalPassed = true;
    }
    bump(a, r.created_at);
  }
  for (const r of logRes.data ?? []) bump(get(r.user_id as string), r.created_at);
  for (const r of certRes.data ?? []) {
    if (!r.revoked_at) get(r.user_id as string).hasCert = true;
  }

  const enrollmentByUser = new Map<string, string>();
  for (const e of enrollRes.data ?? []) {
    enrollmentByUser.set(e.user_id as string, e.cohort_id as string);
  }

  const now = Date.now();
  const rows: ParticipantRow[] = [];
  for (const [userId, m] of members) {
    if (m.role !== "participant") continue;
    const cohortId = enrollmentByUser.get(userId) ?? null;
    if (cohortFilter && cohortId !== cohortFilter) continue;

    const a = acc.get(userId);
    const progress = a
      ? { completedSectionIds: a.completed, uploadedSectionIds: a.uploaded, passedQuizIds: a.passedQuizzes }
      : { completedSectionIds: new Set<string>(), uploadedSectionIds: new Set<string>(), passedQuizIds: new Set<string>() };
    const done = sections.filter((s) => isSectionComplete(s, progress)).length;
    const pct = sections.length ? Math.round((100 * done) / sections.length) : 0;

    const allDone = sections.length > 0 && done === sections.length;
    const klar = (a?.hasCert ?? false) || allDone;
    const quiet =
      !a?.lastActive || now - new Date(a.lastActive).getTime() > STUCK_AFTER_DAYS * 86400_000;

    rows.push({
      userId,
      fullName: m.fullName,
      email: m.email,
      cohortId,
      cohortName: cohortId ? (cohortName.get(cohortId) ?? null) : null,
      progressPct: pct,
      lastActiveAt: a?.lastActive ?? null,
      finalQuiz:
        finalQuizIds.size === 0
          ? "no_quiz"
          : a?.finalPassed
            ? "passed"
            : (a?.finalAttempts ?? 0) > 0
              ? "attempted"
              : "none",
      derived: klar ? "klar" : quiet ? "fast" : "aktiv",
    });
  }

  return rows.sort((x, y) => x.fullName.localeCompare(y.fullName, "sv"));
}

async function getFinalQuizIds(course: CourseView | null): Promise<string[]> {
  if (!course) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", course.id)
    .eq("is_final", true);
  return (data ?? []).map((q) => q.id as string);
}
