-- Kursmotorn v1 — fas 5: certifiering (breathworks-beviset).
--
-- Integritetskrav (samma klass som prov-motorn): en deltagare får ALDRIG kunna fejka
-- ett certifikat. certificates-RLS tillåter bara admin att skriva (cert_write); själva
-- utfärdandet sker därför i issue_certificate() (SECURITY DEFINER) som RE-VERIFIERAR
-- alla typade krav server-side innan raden skapas. Klientens/serveråtgärdens egen koll
-- är bara UX — den kan aldrig kringgås.
--
-- Publik /verify/<slug>: certificates får INGEN bred anon-SELECT (fynd 4-principen).
-- verify_certificate() är en smal SECURITY DEFINER-lookup (som tenant_public_brand):
-- den avslöjar bara innehav/kurs/utfärdare/status + brand för EN slug, inga persondata
-- utöver namnet.
--
-- Kravutvärderingen (_cert_requirement_met) samlas i EN funktion som både status- och
-- utfärdandevägen anropar → samma sanning på ett ställe. sections_complete-predikatet är
-- ordningsfritt (en sektion är "klar" när dess egna villkor är uppfyllda) och kan därför
-- ligga i plpgsql utan att divergera från gating.ts sekvenslogik (som avgör upplåsnings-
-- ORDNING, inte completion). Fail-closed: okända/ännu-ej-byggda kravtyper ger false.

-- ── 1. Kravpredikat (internt; anropas bara av definer-funktionerna nedan) ──
create or replace function public._cert_requirement_met(
  p_tenant uuid, p_course uuid, p_user uuid, p_type text, p_config jsonb
) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  incomplete int;
  threshold int;
begin
  if p_type = 'sections_complete' then
    -- Antal sektioner i kursen vars EGNA villkor inte är uppfyllda för användaren.
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

  elsif p_type = 'manual_approval' then
    return exists (
      select 1 from public.approvals ap
      where ap.user_id = p_user and ap.course_id = p_course and ap.passed
    );

  -- upload_sections (min_per_section) och log_threshold är MG-typer → fas 7.
  -- Fail-closed tills de byggs: inget MG-certifikat får utfärdas på tomhet.
  else
    return false;
  end if;
end $$;
-- Internt: får ALDRIG anropas direkt av en klient (den är SECURITY DEFINER och skulle
-- annars låta en deltagare probea en ANNAN användares progress). Supabase grantar
-- default execute till anon+authenticated på nya public-funktioner → återkalla explicit
-- (revoke från enbart PUBLIC räcker inte). Definer-funktionerna nedan äger anropet som
-- postgres och påverkas inte.
revoke execute on function public._cert_requirement_met(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ── 2. Certifikatstatus (per krav + ev. befintligt certifikat) — för UI + eligibility ──
create or replace function public.certificate_status(p_course_id uuid, p_user uuid default auth.uid())
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  crs record;
  req record;
  reqs jsonb := '[]'::jsonb;
  all_met boolean := true;
  n_reqs int := 0;
  met boolean;
  cert record;
begin
  select * into crs from public.courses where id = p_course_id;
  if crs.id is null or not public.is_tenant_member(crs.tenant_id) then
    return null;
  end if;
  -- Bara den berörda användaren själv eller en tenant-admin får se statusen.
  if p_user <> auth.uid() and not public.is_tenant_admin(crs.tenant_id) then
    return null;
  end if;

  for req in
    select * from public.course_certificate_requirements
    where course_id = p_course_id order by position
  loop
    n_reqs := n_reqs + 1;
    met := public._cert_requirement_met(crs.tenant_id, p_course_id, p_user, req.type, req.config);
    if not met then all_met := false; end if;
    reqs := reqs || jsonb_build_object(
      'position', req.position, 'type', req.type, 'config', req.config, 'met', met);
  end loop;

  -- Inget kravset ⇒ aldrig "klar" (ett tomt kravset får inte ge gratis-certifikat).
  if n_reqs = 0 then all_met := false; end if;

  select * into cert from public.certificates
    where course_id = p_course_id and user_id = p_user and revoked_at is null
    order by issued_at desc limit 1;

  return jsonb_build_object(
    'all_met', all_met,
    'requirements', reqs,
    'certificate', case when cert.id is null then null else jsonb_build_object(
      'id', cert.id, 'verify_slug', cert.verify_slug,
      'issued_at', cert.issued_at, 'holder_name', cert.holder_name) end
  );
end $$;
grant execute on function public.certificate_status(uuid, uuid) to authenticated;

-- ── 3. Attestation (heder-och-samvete) — versionerad, ordagrann, server-styrd lydelse ──
-- Lydelsen bor i EN funktion (attestation_statement) som både förhandsvisningen i UI:t
-- och submit läser → ingen divergens mellan visad och sparad text. Deltagaren kan aldrig
-- attestera med ändrad lydelse. Ny lydelse = ny version (bumpa markören); redan sparade
-- attestationer behåller sin text.
create or replace function public.attestation_statement(p_type text)
returns text
language sql immutable
as $$
  select case p_type
    when 'live_session_honor' then
      'Jag intygar på heder och samvete att jag har genomfört och lett minst en '
      || 'fullständig live-session i enlighet med kursens upplägg, och att de uppgifter '
      || 'jag har lämnat är riktiga. (Lydelse v1, 2026-07)'
    else null
  end;
$$;
grant execute on function public.attestation_statement(text) to anon, authenticated;

create or replace function public.submit_attestation(p_course_id uuid, p_type text default 'live_session_honor')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  crs record;
  stmt text;
  existing record;
  new_id uuid;
begin
  select * into crs from public.courses where id = p_course_id;
  if crs.id is null or not public.is_tenant_member(crs.tenant_id) then
    raise exception 'ej behörig';
  end if;

  stmt := public.attestation_statement(p_type);
  if stmt is null then
    raise exception 'okänd attestationstyp: %', p_type;
  end if;

  -- Idempotent per (user, course, type): återanvänd befintlig attestation.
  select * into existing from public.attestations
    where user_id = uid and course_id = p_course_id and type = p_type
    order by attested_at desc limit 1;
  if existing.id is not null then
    return jsonb_build_object('id', existing.id, 'statement_text', existing.statement_text,
                              'attested_at', existing.attested_at, 'reused', true);
  end if;

  insert into public.attestations (tenant_id, user_id, course_id, type, statement_text)
  values (crs.tenant_id, uid, p_course_id, p_type, stmt)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'statement_text', stmt, 'reused', false);
end $$;
grant execute on function public.submit_attestation(uuid, text) to authenticated;

-- ── 4. Utfärdande — re-verifierar ALLA krav server-side, skapar certifikatet ──
create or replace function public.issue_certificate(p_course_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  crs record;
  req record;
  n_reqs int := 0;
  holder text;
  slug text;
  existing record;
  new_id uuid;
begin
  select * into crs from public.courses where id = p_course_id;
  if crs.id is null or not public.is_tenant_member(crs.tenant_id) then
    raise exception 'ej behörig';
  end if;

  -- Re-verifiera varje typat krav. Ett enda ouppfyllt krav stoppar utfärdandet.
  for req in select * from public.course_certificate_requirements where course_id = p_course_id loop
    n_reqs := n_reqs + 1;
    if not public._cert_requirement_met(crs.tenant_id, p_course_id, uid, req.type, req.config) then
      raise exception 'villkor ej uppfyllt: %', req.type;
    end if;
  end loop;
  if n_reqs = 0 then
    raise exception 'inga certifikatvillkor konfigurerade';
  end if;

  -- Redan utfärdat (icke-revokerat)? Idempotent — returnera det.
  select * into existing from public.certificates
    where course_id = p_course_id and user_id = uid and revoked_at is null
    order by issued_at desc limit 1;
  if existing.id is not null then
    return jsonb_build_object('id', existing.id, 'verify_slug', existing.verify_slug, 'reused', true);
  end if;

  holder := coalesce(
    nullif(trim((select raw_user_meta_data->>'full_name' from auth.users where id = uid)), ''),
    (select email from auth.users where id = uid));

  -- Unik, URL-säker slug (hex ur gen_random_uuid — kärn-fn, inget pgcrypto-schemaberoende).
  loop
    slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
    exit when not exists (select 1 from public.certificates where verify_slug = slug);
  end loop;

  insert into public.certificates (tenant_id, user_id, course_id, holder_name, verify_slug)
  values (crs.tenant_id, uid, p_course_id, holder, slug)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'verify_slug', slug, 'reused', false);
end $$;
grant execute on function public.issue_certificate(uuid) to authenticated;

-- ── 5. Publik verifiering — smal lookup, ingen bred anon-SELECT på certificates ──
create or replace function public.verify_certificate(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  cert record;
  crs record;
  brand jsonb;
  t record;
begin
  select * into cert from public.certificates where verify_slug = p_slug;
  if cert.id is null then
    return null;
  end if;
  select * into crs from public.courses where id = cert.course_id;
  select brand_spec into brand from public.tenant_brands where tenant_id = cert.tenant_id;
  select slug, status into t from public.tenants where id = cert.tenant_id;

  return jsonb_build_object(
    'holder_name',       cert.holder_name,
    'course_name',       coalesce(crs.display_name, ''),
    'certificate_title', coalesce(crs.certificate_title, ''),
    'issued_at',         cert.issued_at,
    'revoked_at',        cert.revoked_at,
    'status',            case when cert.revoked_at is not null then 'revoked' else 'valid' end,
    'verify_slug',       cert.verify_slug,
    'tenant_slug',       t.slug,
    'brand_spec',        brand   -- för tenant-brandad rendering (samma väg som tenant_public_brand)
  );
end $$;
grant execute on function public.verify_certificate(text) to anon, authenticated;
