-- Kursmotorn v1 — fas 7: certvillkors-utvärderingen kompletteras med MG-typerna.
-- Kravutvärderingen bor fortsatt i EN funktion (_cert_requirement_met, fas 5-beslutet);
-- utfärdandefunktionen är oförändrad — MG-certifikat förblir i praktiken ospärrbara i
-- fas A eftersom manual_approval kräver en godkänd bedömning (bedömnings-UI = fas B).

-- ── 1. Certifikat överlever deltagarradering som REVOKERAD handling ──
-- GDPR-raderingen (fas 7) revokerar + anonymiserar certifikatet; raden får inte
-- kaskad-raderas (en utfärdad handling ska gå att slå upp som återkallad, SPEC §2.12).
alter table public.certificates alter column user_id drop not null;
alter table public.certificates drop constraint certificates_user_id_fkey;
alter table public.certificates
  add constraint certificates_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- ── 2. _cert_requirement_met v2: + log_threshold, upload_sections; approval_type-match ──
create or replace function public._cert_requirement_met(
  p_tenant uuid, p_course uuid, p_user uuid, p_type text, p_config jsonb
) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  incomplete int;
  threshold int;
  v_starts date;
  v_weeks int;
  v_min int;
  v_logtype text;
  v_days int;
  v_win_start date;
begin
  if p_type = 'sections_complete' then
    select count(*) into incomplete
    from public.sections s
    join public.modules m on m.id = s.module_id
    where m.course_id = p_course
      and (
        (coalesce((s.requirements->>'checkoff')::boolean, false)
           and not exists (select 1 from public.section_progress sp
                           where sp.user_id = p_user and sp.section_id = s.id))
        or ((s.requirements->>'quiz_id') is not null
           and not exists (select 1 from public.quiz_attempts qa
                           where qa.user_id = p_user
                             and qa.quiz_id = (s.requirements->>'quiz_id')::uuid
                             and qa.passed))
        or (coalesce((s.requirements->>'upload_required')::boolean, false)
           and not exists (select 1 from public.uploads u
                           where u.user_id = p_user and u.section_id = s.id))
      );
    return incomplete = 0;

  elsif p_type = 'final_quiz_pass' then
    threshold := coalesce((p_config->>'threshold')::int, 80);
    return exists (
      select 1 from public.quiz_attempts qa
      join public.quizzes q on q.id = qa.quiz_id
      where qa.user_id = p_user and q.course_id = p_course and q.is_final
        and qa.score >= threshold
    );

  elsif p_type = 'attestation' then
    return exists (
      select 1 from public.attestations a
      where a.user_id = p_user and a.course_id = p_course
        and a.type = coalesce(p_config->>'type', 'live_session_honor')
    );

  elsif p_type = 'log_threshold' then
    -- Fönstren ankras i AKTIVA enrollmentens starts_at (godkända specen §3.1 —
    -- eftersläntrare får egna fönster; flytt = nya fönster). Annat ankare än
    -- enrollment_starts_at är inte byggt → fail-closed.
    if coalesce(p_config->>'window_anchor', 'enrollment_starts_at') <> 'enrollment_starts_at' then
      return false;
    end if;
    select e.starts_at into v_starts
      from public.enrollments e
     where e.user_id = p_user and e.course_id = p_course and e.status = 'active'
     limit 1;
    if v_starts is null then
      return false; -- ingen aktiv enrollment ⇒ inga fönster
    end if;
    v_weeks   := coalesce((p_config->>'weeks')::int, 6);
    v_min     := coalesce((p_config->>'min_days_per_week')::int, 5);
    v_logtype := coalesce(p_config->>'log_type', 'practice_day');
    for i in 1..v_weeks loop
      -- Dispens (spårbart beslut i approvals) räknas som uppfyllt fönster.
      if exists (
        select 1 from public.approvals ap
        where ap.user_id = p_user and ap.course_id = p_course
          and ap.approval_type = 'log_threshold_dispens' and ap.passed
          and (ap.target->>'window_index')::int = i
      ) then
        continue;
      end if;
      v_win_start := v_starts + (i - 1) * 7;
      select count(distinct al.logged_date) into v_days
        from public.activity_logs al
       where al.user_id = p_user and al.course_id = p_course
         and al.log_type = v_logtype
         and al.logged_date between v_win_start and v_win_start + 6;
      if v_days < v_min then
        return false;
      end if;
    end loop;
    return true;

  elsif p_type = 'upload_sections' then
    -- MINST min_per_section uppladdningar i VAR OCH EN av sektionerna (nio versioner
    -- av samma övning uppfyller INTE kravet — datamodellens semantik). Tom
    -- sektionslista ⇒ fail-closed (felkonfiguration ska aldrig ge certifikat).
    v_min := coalesce((p_config->>'min_per_section')::int, 1);
    if jsonb_array_length(coalesce(p_config->'section_ids', '[]'::jsonb)) = 0 then
      return false;
    end if;
    return not exists (
      select 1
      from jsonb_array_elements_text(p_config->'section_ids') as req(section_id)
      where (
        select count(*) from public.uploads u
        where u.user_id = p_user and u.section_id = req.section_id::uuid
      ) < v_min
    );

  elsif p_type = 'manual_approval' then
    -- Skärpt mot fas 5: matchar configens approval_type (MG: certifieringssession).
    return exists (
      select 1 from public.approvals ap
      where ap.user_id = p_user and ap.course_id = p_course and ap.passed
        and (p_config->>'approval_type' is null
             or ap.approval_type = p_config->>'approval_type')
    );

  else
    return false; -- fail-closed: okänd kravtyp ger aldrig certifikat
  end if;
end $$;

revoke execute on function public._cert_requirement_met(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
