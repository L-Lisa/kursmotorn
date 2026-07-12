import { createClient } from "@/lib/supabase/server";

export type SectionRequirements = {
  checkoff?: boolean;
  quiz_id?: string | null;
  upload_required?: boolean;
};

export type CourseSection = {
  id: string;
  title: string;
  position: number;
  content: string | null;
  requirements: SectionRequirements;
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
 * RLS gatar allt: bara en medlem i tenanten får rader. Fas 2 renderar bara
 * strukturen — avbockning/gating/prov är fas 3–4.
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
    .select("id, title, position, intro, sections(id, title, position, content, requirements)")
    .eq("course_id", course.id);

  const shaped: CourseModule[] = (modules ?? [])
    .map((m) => ({
      id: m.id as string,
      title: m.title as string,
      position: m.position as number,
      intro: (m.intro as string | null) ?? null,
      sections: ((m.sections as CourseSection[] | null) ?? [])
        .slice()
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
