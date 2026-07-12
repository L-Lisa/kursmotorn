/**
 * Gating-kärnan (fas 3). REN funktion — samma logik i kursvyn (visning) och i
 * checkoff-serveråtgärden (enforcement). SPEC §2.3 + §4.2:
 *  - self_paced: avbockning av en sektion öppnar nästa.
 *  - scheduled:  sektioner öppnas per datum (kohortstart + drip_offset_days).
 *  - PROVREGELN (båda lägen): tid/avbockning låser ALDRIG upp förbi ett underkänt prov.
 *  - Kombinerade villkor per sektion: checkoff / godkänt prov / uppladdning — alla som är satta krävs.
 */

export type SectionRequirements = {
  checkoff?: boolean;
  quiz_id?: string | null;
  upload_required?: boolean;
};

export type GatingSection = {
  id: string;
  requirements: SectionRequirements;
  dripOffsetDays?: number | null;
};

export type UserProgress = {
  completedSectionIds: Set<string>;
  passedQuizIds: Set<string>;
  uploadedSectionIds: Set<string>;
};

export type GatingInput = {
  unlockMode: "self_paced" | "scheduled";
  sections: GatingSection[]; // i kursordning
  cohortStart?: Date | null; // krävs för scheduled
  today?: Date;
  progress: UserProgress;
};

export type SectionState = { id: string; unlocked: boolean; complete: boolean };

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** Är sektionens alla satta villkor uppfyllda? */
export function isSectionComplete(s: GatingSection, p: UserProgress): boolean {
  const r = s.requirements || {};
  if (r.checkoff && !p.completedSectionIds.has(s.id)) return false;
  if (r.quiz_id && !p.passedQuizIds.has(r.quiz_id)) return false;
  if (r.upload_required && !p.uploadedSectionIds.has(s.id)) return false;
  return true;
}

export function computeGating(input: GatingInput): SectionState[] {
  const { unlockMode, sections, progress } = input;
  const today = input.today ?? new Date();
  const cohortStart = input.cohortStart ?? null;

  const out: SectionState[] = [];
  let prevComplete = true; // första sektionens "föregående" räknas som klar
  let quizGateBroken = false; // provregeln: ett underkänt/oavklarat prov-krav tidigare i sekvensen

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    let unlocked: boolean;

    if (unlockMode === "scheduled") {
      const drip = s.dripOffsetDays ?? 0;
      const timeOk = cohortStart ? today >= addDays(cohortStart, drip) : true;
      // Provregeln överskrider tiden: ett oavklarat prov-krav tidigare låser framåt.
      unlocked = timeOk && !quizGateBroken;
    } else {
      unlocked = i === 0 ? true : prevComplete && !quizGateBroken;
    }

    const complete = isSectionComplete(s, progress);
    out.push({ id: s.id, unlocked, complete });

    // Efter denna sektion: om den KRÄVER ett prov som inte är godkänt, blockera allt efter.
    if (s.requirements?.quiz_id && !progress.passedQuizIds.has(s.requirements.quiz_id)) {
      quizGateBroken = true;
    }
    prevComplete = complete;
  }

  return out;
}
