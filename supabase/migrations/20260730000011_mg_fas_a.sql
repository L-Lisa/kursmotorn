-- Kursmotorn v1 — fas 7 (MG fas A), motorkärnedelen.
--
-- 1) FYND 5-BESLUTET (Lisa 2026-07-30): practice_day-dagsunikheten scopas PER KURS.
--    Datamodellens ursprungliga index var (user_id, log_type, logged_date) — globalt.
--    En deltagare i två kurser med praxislogg (MG + breathworks) hade blockerats
--    tvärkurs. Avsteget från datamodellens indexdefinition är loggat i DECISIONS.
drop index if exists public.activity_logs_practice_day_unique;
create unique index activity_logs_practice_day_unique
  on public.activity_logs (user_id, course_id, log_type, logged_date)
  where log_type = 'practice_day';

-- 2) Manuellt bakåtfönster per loggtyp (generiskt konfigval, inte MG-hårdkodning):
--    manual_window_days = hur många dagar bakåt en manuell logg får dateras
--    (null = obegränsat). MG:s praxislogg: 7 (godkända specen §3.1).
alter table public.log_type_defs add column if not exists manual_window_days int;
update public.log_type_defs set manual_window_days = 7 where log_type = 'practice_day';

--    config = typens UI-konfiguration (t.ex. guidesessionens formatlista — kursens
--    egna ord bor i DB, aldrig i motorkod; namnbytes-säkerheten gäller även formater).
alter table public.log_type_defs add column if not exists config jsonb not null default '{}'::jsonb;

-- 3) Sektionsmedia (förberedelse för auto-loggningen — [L] ljudfilerna väntar på Lisa):
--    media_path = Storage-path till sektionens meditationsljud; media_duration_sec
--    sätts vid import. Spelaren + ≥90 %-mätningen byggs när filerna finns.
alter table public.sections add column if not exists media_path text;
alter table public.sections add column if not exists media_duration_sec int;

-- 4) log_activity v2: datumregler + auto-idempotens.
--    - Framtida datum avvisas (alla källor).
--    - Manuell logg utanför typens bakåtfönster avvisas (8 dagar bakåt ⇒ nej för MG).
--    - Dagtypsdubblett: source='auto' är IDEMPOTENT (två spelade meditationer samma
--      dag ⇒ fortfarande EN rad, inget fel — §3.4); source='manual' ger fel (UI visar).
create or replace function public.log_activity(
  p_course_id uuid,
  p_log_type text,
  p_logged_date date,
  p_source text default 'manual',
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_def record;
  v_cohort uuid;
  v_existing uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'ej inloggad' using errcode = '42501';
  end if;
  if p_source not in ('auto','manual') then
    raise exception 'ogiltig källa' using errcode = '23514';
  end if;

  select d.log_type, d.daily_unique, d.manual_window_days, c.tenant_id
    into v_def
    from log_type_defs d
    join courses c on c.id = d.course_id
   where d.course_id = p_course_id and d.log_type = p_log_type;
  if not found then
    raise exception 'loggtypen % finns inte för kursen', p_log_type using errcode = '23514';
  end if;
  if not is_tenant_member(v_def.tenant_id) then
    raise exception 'ej medlem i tenanten' using errcode = '42501';
  end if;

  if p_logged_date > current_date then
    raise exception 'datum i framtiden kan inte loggas' using errcode = '23514';
  end if;
  if p_source = 'manual' and v_def.manual_window_days is not null
     and p_logged_date < current_date - v_def.manual_window_days then
    raise exception 'manuell loggning når högst % dagar bakåt', v_def.manual_window_days
      using errcode = '23514';
  end if;

  if v_def.daily_unique then
    select id into v_existing from activity_logs
     where user_id = v_uid and course_id = p_course_id
       and log_type = p_log_type and logged_date = p_logged_date;
    if v_existing is not null then
      if p_source = 'auto' then
        return v_existing; -- idempotent: dagen är redan loggad, det är hela poängen
      end if;
      raise exception 'dagen är redan loggad' using errcode = '23505';
    end if;
  end if;

  select cohort_id into v_cohort
    from enrollments
   where user_id = v_uid and course_id = p_course_id and status = 'active'
   limit 1;

  insert into activity_logs (tenant_id, user_id, course_id, cohort_id, log_type, logged_date, source, metadata)
  values (v_def.tenant_id, v_uid, p_course_id, v_cohort, p_log_type, p_logged_date, p_source, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
