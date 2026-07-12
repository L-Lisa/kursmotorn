-- Kursmotorn v1 — enrollment-integritet (fas 1-härdning, review-fynd 2, 2026-07-12).
-- enrollments.course_id är denormaliserad (krävs för det partiella unika indexet
-- enrollments_one_active_per_course + certfönster-beräkningen). Utan detta kan den DRIVA
-- från cohortens course_id — RLS tillåter en tenant-admin att skriva en enrollment med
-- godtycklig course_id, och då räknar "en aktiv per kurs"-garantin och certfönstren tyst fel.
-- Composite-FK gör att DB:n garanterar det som fas 6-serverfunktionen annars bara lovar.

-- FK-målet kräver en unik nyckel på (id, course_id). id är redan PK → trivialt uppfyllt.
alter table public.cohorts
  add constraint cohorts_id_course_key unique (id, course_id);

-- Enrollmentens (cohort_id, course_id) MÅSTE peka på samma cohort-rads course_id.
alter table public.enrollments
  add constraint enrollments_cohort_course_fk
  foreign key (cohort_id, course_id)
  references public.cohorts (id, course_id)
  on delete cascade;
