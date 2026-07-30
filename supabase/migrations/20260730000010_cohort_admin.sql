-- Kursmotorn v1 — fas 6: kohort-admin (enrollment-serverfunktioner + aktivitetsloggens skrivfunktion).
--
-- Serverfunktionerna här är motorns enda skrivvägar för enrollment-skapande/flytt och
-- deltagarloggning. Datamodellens regler (en aktiv enrollment per user+kurs, flytt = ny rad,
-- dagtypsdubbletter avvisas) enforce:as HÄR + av index — aldrig enbart i klienten.

-- ── create_enrollment ────────────────────────────────────────────────────────
-- SECURITY INVOKER: RLS (en_write = admin) gatar skrivningen; funktionen ger atomik
-- + default-starts_at (kohortens start_date — eftersläntrare får eget datum).
create or replace function public.create_enrollment(
  p_cohort_id uuid,
  p_user_id uuid,
  p_starts_at date default null,
  p_company text default null,
  p_price_override_sek int default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_c record;
  v_id uuid;
begin
  select id, tenant_id, course_id, start_date into v_c from cohorts where id = p_cohort_id;
  if not found then
    raise exception 'okänd kohort' using errcode = 'P0002';
  end if;
  if not is_tenant_admin(v_c.tenant_id) then
    raise exception 'endast admin kan hantera enrollments' using errcode = '42501';
  end if;
  if not exists (select 1 from memberships where tenant_id = v_c.tenant_id and user_id = p_user_id) then
    raise exception 'användaren är inte medlem i tenanten' using errcode = '23514';
  end if;

  insert into enrollments (tenant_id, user_id, cohort_id, course_id, starts_at, company, price_override_sek)
  values (v_c.tenant_id, p_user_id, p_cohort_id, v_c.course_id,
          coalesce(p_starts_at, v_c.start_date), p_company, p_price_override_sek)
  returning id into v_id;
  return v_id;
end $$;

-- ── move_enrollment ──────────────────────────────────────────────────────────
-- Flytt = NY rad (moved_from_enrollment_id) + gamla sätts 'dropped' — atomärt i en
-- transaktion. Certfönstren följer nya radens starts_at (datamodellens ankare);
-- company/price_override följer med (personens överenskommelse), invoiced/paid gör
-- det INTE (fakturamarkeringar hör till sin enrollment — historiken består på gamla raden).
create or replace function public.move_enrollment(
  p_enrollment_id uuid,
  p_to_cohort_id uuid,
  p_new_starts_at date default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_old record;
  v_new record;
  v_id uuid;
begin
  select * into v_old from enrollments where id = p_enrollment_id;
  if not found then
    raise exception 'okänd enrollment' using errcode = 'P0002';
  end if;
  if not is_tenant_admin(v_old.tenant_id) then
    raise exception 'endast admin kan flytta deltagare' using errcode = '42501';
  end if;
  if v_old.status <> 'active' then
    raise exception 'endast en aktiv enrollment kan flyttas' using errcode = '23514';
  end if;

  select id, tenant_id, course_id, start_date into v_new from cohorts where id = p_to_cohort_id;
  if not found then
    raise exception 'okänd målkohort' using errcode = 'P0002';
  end if;
  if v_new.id = v_old.cohort_id then
    raise exception 'deltagaren är redan i den kohorten' using errcode = '23514';
  end if;
  if v_new.tenant_id <> v_old.tenant_id or v_new.course_id <> v_old.course_id then
    raise exception 'flytt endast inom samma kurs och tenant' using errcode = '23514';
  end if;

  update enrollments set status = 'dropped' where id = v_old.id;

  insert into enrollments (tenant_id, user_id, cohort_id, course_id, starts_at,
                           company, price_override_sek, moved_from_enrollment_id)
  values (v_old.tenant_id, v_old.user_id, p_to_cohort_id, v_old.course_id,
          coalesce(p_new_starts_at, v_new.start_date),
          v_old.company, v_old.price_override_sek, v_old.id)
  returning id into v_id;
  return v_id;
end $$;

-- ── log_activity ─────────────────────────────────────────────────────────────
-- Aktivitetsloggens ENDA skrivväg för deltagare (SECURITY DEFINER — direktinsert
-- tas bort nedan, samma mönster som prov-motorn). Läser typregistret: okänd typ
-- avvisas; dagtyp (daily_unique) avvisar dubbletter per kurs och dag. Det partiella
-- indexet (practice_day) står kvar som DB-backstopp.
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
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'ej inloggad' using errcode = '42501';
  end if;
  if p_source not in ('auto','manual') then
    raise exception 'ogiltig källa' using errcode = '23514';
  end if;

  select d.log_type, d.daily_unique, c.tenant_id
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

  if v_def.daily_unique and exists (
    select 1 from activity_logs
     where user_id = v_uid and course_id = p_course_id
       and log_type = p_log_type and logged_date = p_logged_date
  ) then
    raise exception 'dagen är redan loggad' using errcode = '23505';
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

-- Direktinsert för deltagare bort — funktionen är enda vägen (typregistret ska aldrig
-- kunna kringgås). Admin-policyn (al_admin) står kvar för rättelser.
drop policy if exists al_insert_own on public.activity_logs;

-- ── tenant_member_names ──────────────────────────────────────────────────────
-- Admin-vyerna behöver namn/e-post (bor i auth.users, oläsbart via PostgREST).
-- Smal SECURITY DEFINER-lookup, admin-gated INUTI funktionen — samma mönster som
-- tenant_public_brand/verify_certificate: aldrig bred åtkomst till auth-schemat.
create or replace function public.tenant_member_names(p_tenant_id uuid)
returns table (user_id uuid, full_name text, email text, member_role text)
language sql stable security definer set search_path = public as $$
  select m.user_id,
         coalesce(u.raw_user_meta_data->>'full_name', u.email) as full_name,
         u.email::text,
         m.role
    from memberships m
    join auth.users u on u.id = m.user_id
   where m.tenant_id = p_tenant_id
     and public.is_tenant_admin(p_tenant_id)
$$;

-- Exekveringsrättigheter (fas 5-lärdomen: Supabase default-grantar public-funktioner
-- till anon+authenticated — dra in uttryckligen).
revoke execute on function public.create_enrollment(uuid, uuid, date, text, int) from public, anon;
revoke execute on function public.move_enrollment(uuid, uuid, date) from public, anon;
revoke execute on function public.log_activity(uuid, text, date, text, jsonb) from public, anon;
revoke execute on function public.tenant_member_names(uuid) from public, anon;
grant execute on function public.create_enrollment(uuid, uuid, date, text, int) to authenticated;
grant execute on function public.move_enrollment(uuid, uuid, date) to authenticated;
grant execute on function public.log_activity(uuid, text, date, text, jsonb) to authenticated;
grant execute on function public.tenant_member_names(uuid) to authenticated;
