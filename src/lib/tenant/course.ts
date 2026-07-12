import { createClient } from "@/lib/supabase/server";
import { computeGating, type SectionRequirements as GatingReq } from "./gating";

export type SectionRequirements = GatingReq;

export type CourseSection = {
  id: string;
  title: string;
  position: number;
  content: string | null;
  requirements: SectionRequirements;
  dripOffsetDays: number | null;
};

export type CourseModule = {
  id: string;
  title: string;
  position: number;
  intro: string | null;
  sections: CourseSection[];
};

export type CourseView = {
  id: string;
  displayName: string;
  certificateTitle: string | null;
  unlockMode: string;
  modules: CourseModule[];
};

/**
 * Läser tenantens publicerade kurs (struktur) via den inloggade klienten.
 * RLS gatar allt: bara en medlem i tenanten får rader.
 */
export async function getCourseForTenant(
  tenantId: string,
): Promise<CourseView | null> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, display_name, certificate_title, unlock_mode")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!course) return null;

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, position, intro, sections(id, title, position, content, requirements, drip_offset_days)")
    .eq("course_id", course.id);

  const shaped: CourseModule[] = (modules ?? [])
    .map((m) => ({
      id: m.id as string,
      title: m.title as string,
      position: m.position as number,
      intro: (m.intro as string | null) ?? null,
      sections: ((m.sections as Record<string, unknown>[] | null) ?? [])
        .map((s) => ({
          id: s.id as string,
          title: s.title as string,
          position: s.position as number,
          content: (s.content as string | null) ?? null,
          requirements: (s.requirements as SectionRequirements) ?? {},
          dripOffsetDays: (s.drip_offset_days as number | null) ?? null,
        }))
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position);

  return {
    id: course.id as string,
    displayName: course.display_name as string,
    certificateTitle: (course.certificate_title as string | null) ?? null,
    unlockMode: course.unlock_mode as string,
    modules: shaped,
  };
}

/** Alla sektioner i kursordning (moduler efter position, sektioner efter position). */
export function sectionsInOrder(course: CourseView): CourseSection[] {
  return course.modules.flatMap((m) => m.sections);
}

export type SectionGate = { unlocked: boolean; complete: boolean };

/**
 * Laddar användarens progress + kohortstart och beräknar gating-tillståndet per
 * sektion via den rena gating-kärnan (samma logik som checkoff-åtgärden använder).
 */
export async function getGatingState(
  course: CourseView,
  userId: string,
): Promise<Map<string, SectionGate>> {
  const supabase = await createClient();
  const ordered = sectionsInOrder(course);

  const [progressRes, uploadRes, attemptRes, enrollRes] = await Promise.all([
    supabase.from("section_progress").select("section_id").eq("user_id", userId),
    supabase.from("uploads").select("section_id").eq("user_id", userId),
    supabase.from("quiz_attempts").select("quiz_id, passed").eq("user_id", userId).eq("passed", true),
    supabase
      .from("enrollments")
      .select("starts_at")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const progress = {
    completedSectionIds: new Set((progressRes.data ?? []).map((r) => r.section_id as string)),
    uploadedSectionIds: new Set((uploadRes.data ?? []).map((r) => r.section_id as string)),
    passedQuizIds: new Set((attemptRes.data ?? []).map((r) => r.quiz_id as string)),
  };

  const cohortStart = enrollRes.data?.starts_at
    ? new Date(`${enrollRes.data.starts_at}T00:00:00Z`)
    : null;

  const states = computeGating({
    unlockMode: course.unlockMode === "scheduled" ? "scheduled" : "self_paced",
    sections: ordered.map((s) => ({
      id: s.id,
      requirements: s.requirements,
      dripOffsetDays: s.dripOffsetDays,
    })),
    cohortStart,
    progress,
  });

  return new Map(states.map((st) => [st.id, { unlocked: st.unlocked, complete: st.complete }]));
}
