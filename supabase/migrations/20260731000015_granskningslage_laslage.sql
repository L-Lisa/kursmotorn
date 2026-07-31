-- Kursmotorn — granskningsläget är ett rent LÄSLÄGE (2026-07-31, Lisas beslut).
--
-- Bakgrund (buggen): granskningskontot (tenant-admin) möttes av deltagarvyn och
-- kunde bocka av sektioner — dvs. skriva progress som aldrig ska finnas på ett
-- gransknings-/adminkonto. UI-fixen (granskningsläge i kursvyn) löser synligheten;
-- den här migrationen rättar GRUNDORSAKEN så nollställning aldrig behövs igen:
--
--   Regel: ett konto där is_tenant_admin(tenant) är sant (tenant-admin, owner,
--   plattformsadmin) kan ALDRIG skriva egen progress — varken via RLS-vägarna
--   eller via SECURITY DEFINER-funktionerna (som kringgår RLS).
--   Admin-hantering av ANDRAS rader (rättelser, nollställning åt en deltagare)
--   består, men aldrig mot egen user_id.
--
-- Deltagarnas vägar är oförändrade (ingen gating-ändring här).

-- ── 1) Egna skrivvägar via RLS: admin exkluderas ─────────────────────────────
drop policy if exists sp_insert_own on public.section_progress;
create policy sp_insert_own on public.section_progress for insert
  with check (user_id = auth.uid()
              and public.is_tenant_member(tenant_id)
              and not public.is_tenant_admin(tenant_id));

drop policy if exists up_insert_own on public.uploads;
create policy up_insert_own on public.uploads for insert
  with check (user_id = auth.uid()
              and public.is_tenant_member(tenant_id)
              and not public.is_tenant_admin(tenant_id));

drop policy if exists at_insert_own on public.attestations;
create policy at_insert_own on public.attestations for insert
  with check (user_id = auth.uid()
              and public.is_tenant_member(tenant_id)
              and not public.is_tenant_admin(tenant_id));

-- ── 2) Admin-policyerna: hantera andras rader, aldrig egen ───────────────────
-- (using styr select/update/delete; with check styr insert/update-nya-rader.
--  Admin kan alltså fortfarande radera/rätta deltagares rader — och radera
--  egna kvarhäng — men aldrig skapa progress åt sig själv.)
drop policy if exists sp_admin on public.section_progress;
create policy sp_admin on public.section_progress for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id) and user_id <> auth.uid());

drop policy if exists up_admin on public.uploads;
create policy up_admin on public.uploads for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id) and user_id <> auth.uid());

drop policy if exists al_admin on public.activity_logs;
create policy al_admin on public.activity_logs for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id) and user_id <> auth.uid());

drop policy if exists qa_admin on public.quiz_attempts;
create policy qa_admin on public.quiz_attempts for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id) and user_id <> auth.uid());

drop policy if exists at_admin on public.attestations;
create policy at_admin on public.attestations for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id) and user_id <> auth.uid());

drop policy if exists ff_admin on public.mg_ffmq_responses;
create policy ff_admin on public.mg_ffmq_responses for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id) and user_id <> auth.uid());

-- ── 3) SECURITY DEFINER-funktionerna (kringgår RLS ⇒ egen grind krävs) ───────
-- Samma fyra deltagarskrivvägar som appen använder. Funktionskropparna är
-- oförändrade förutom läslägesgrinden (markerad LÄSLÄGE nedan).

-- 3a) log_activity (senaste versionen = v2 ur ..11, + grind)
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
  -- LÄSLÄGE: gransknings-/adminkonton loggar aldrig egen aktivitet.
  if is_tenant_admin(v_def.tenant_id) then
    raise exception 'granskningsläget är ett läsläge — ingen progress skrivs' using errcode = '42501';
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

-- 3b) submit_quiz_attempt (ur ..07, + grind)
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  uid uuid := auth.uid();
  used int;
  total int;
  correct int := 0;
  rec record;
  chosen text;
  s int;
  did_pass boolean;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if q.id is null or not public.is_tenant_member(q.tenant_id) then
    raise exception 'ej behörig';
  end if;
  -- LÄSLÄGE: gransknings-/adminkonton skriver aldrig egna provförsök.
  if public.is_tenant_admin(q.tenant_id) then
    raise exception 'granskningsläget är ett läsläge — ingen progress skrivs' using errcode = '42501';
  end if;

  select count(*) into used from public.quiz_attempts where quiz_id = p_quiz_id and user_id = uid;
  if q.max_attempts is not null and used >= q.max_attempts then
    raise exception 'max_attempts nått';
  end if;

  select count(*) into total from public.quiz_questions where quiz_id = p_quiz_id;
  if total = 0 then raise exception 'provet saknar frågor'; end if;

  for rec in select id, correct_index from public.quiz_questions where quiz_id = p_quiz_id loop
    chosen := p_answers ->> rec.id::text;
    if chosen is not null and chosen ~ '^\d+$' and chosen::int = rec.correct_index then
      correct := correct + 1;
    end if;
  end loop;

  s := floor(100.0 * correct / total);
  did_pass := s >= q.pass_threshold;

  insert into public.quiz_attempts (tenant_id, quiz_id, user_id, answers, score, passed)
  values (q.tenant_id, p_quiz_id, uid, p_answers, s, did_pass);

  return jsonb_build_object(
    'score', s, 'correct', correct, 'total', total, 'passed', did_pass,
    'attempts_used', used + 1, 'max_attempts', q.max_attempts, 'pass_threshold', q.pass_threshold
  );
end $$;

-- 3c) submit_attestation (ur ..09, + grind)
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
  -- LÄSLÄGE: gransknings-/adminkonton lämnar aldrig egen attestation.
  if public.is_tenant_admin(crs.tenant_id) then
    raise exception 'granskningsläget är ett läsläge — ingen progress skrivs' using errcode = '42501';
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

-- 3d) submit_ffmq (senaste versionen = FFMQ-15 ur ..14, + grind)
create or replace function public.submit_ffmq(
  p_cohort_id uuid,
  p_occasion text,
  p_answers jsonb  -- objekt {"q1": 1..5, ..., "q15": 1..5} — sajtens AnswerMap
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_enr record;
  v_total int := 0;
  v_lock date;
  v_bad text;
  v_facets jsonb := '[]'::jsonb;
  f record;
begin
  if v_uid is null then
    raise exception 'ej inloggad' using errcode = '42501';
  end if;
  if p_occasion not in ('pre','post') then
    raise exception 'ogiltig occasion' using errcode = '23514';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'svaren ska vara ett objekt med q1–q15' using errcode = '23514';
  end if;

  select e.starts_at, e.tenant_id into v_enr
    from enrollments e
   where e.user_id = v_uid and e.cohort_id = p_cohort_id and e.status = 'active';
  if not found then
    raise exception 'ingen aktiv kursplats i kohorten' using errcode = '23514';
  end if;
  -- LÄSLÄGE: gransknings-/adminkonton lämnar aldrig egna mätningar.
  if is_tenant_admin(v_enr.tenant_id) then
    raise exception 'granskningsläget är ett läsläge — ingen progress skrivs' using errcode = '42501';
  end if;

  if p_occasion = 'pre' then
    v_lock := v_enr.starts_at + 7;
    if current_date >= v_lock then
      raise exception 'förmätningen är låst — fönster 2 har börjat' using errcode = '23514';
    end if;
  else
    if current_date < v_enr.starts_at + 35 then
      raise exception 'eftermätningen öppnar i fönster 6' using errcode = '23514';
    end if;
    v_lock := null;
  end if;

  -- Validering: alla 15 items måste ha ett heltal 1–5.
  select d.qid into v_bad
    from (values ('q1'),('q2'),('q3'),('q4'),('q5'),('q6'),('q7'),('q8'),('q9'),
                 ('q10'),('q11'),('q12'),('q13'),('q14'),('q15')) as d(qid)
   where jsonb_typeof(p_answers->d.qid) is distinct from 'number'
      or (p_answers->>d.qid)::numeric not between 1 and 5
      or (p_answers->>d.qid)::numeric <> floor((p_answers->>d.qid)::numeric)
   limit 1;
  if v_bad is not null then
    raise exception 'item % saknar giltigt svar (1–5)', v_bad using errcode = '23514';
  end if;

  -- Instrumentdefinitionen (id, vändning, facett, ordning) = sajtens testQuestions.
  -- Facetter i sajtens ordning (första förekomst); score = summa justerade poäng.
  for f in
    with def(qid, rev, facet, ord) as (values
      ('q1',  false, 'Observera', 1),
      ('q2',  false, 'Beskriva', 2),
      ('q3',  true,  'Agera med medvetenhet', 3),
      ('q4',  true,  'Icke-dömande', 4),
      ('q5',  false, 'Icke-reaktivitet', 5),
      ('q6',  false, 'Observera', 6),
      ('q7',  true,  'Beskriva', 7),
      ('q8',  true,  'Agera med medvetenhet', 8),
      ('q9',  true,  'Icke-dömande', 9),
      ('q10', false, 'Icke-reaktivitet', 10),
      ('q11', false, 'Observera', 11),
      ('q12', false, 'Beskriva', 12),
      ('q13', true,  'Agera med medvetenhet', 13),
      ('q14', true,  'Icke-dömande', 14),
      ('q15', false, 'Icke-reaktivitet', 15))
    select d.facet,
           sum(case when d.rev then 6 - (p_answers->>d.qid)::int else (p_answers->>d.qid)::int end) as s,
           count(*)::int as n,
           min(d.ord) as first_ord
      from def d
     group by d.facet
     order by first_ord
  loop
    v_total := v_total + f.s;
    v_facets := v_facets || jsonb_build_object(
      'facet', f.facet,
      'score', f.s,
      'min', f.n * 1,
      'max', f.n * 5,
      'average', round(f.s::numeric / f.n, 2)
    );
  end loop;

  insert into mg_ffmq_responses (tenant_id, user_id, cohort_id, occasion, answers, facet_scores, total_score, completed_at, locked_at)
  values (v_enr.tenant_id, v_uid, p_cohort_id, p_occasion, p_answers, v_facets, v_total, now(),
          case when v_lock is not null then v_lock::timestamptz else null end)
  on conflict (user_id, cohort_id, occasion) do update
    set answers = excluded.answers,
        facet_scores = excluded.facet_scores,
        total_score = excluded.total_score,
        completed_at = excluded.completed_at,
        locked_at = excluded.locked_at;

  return jsonb_build_object('facet_scores', v_facets, 'total_score', v_total);
end $$;

-- Exekveringsrättigheterna är oförändrade (create or replace behåller grants) —
-- fas 5-regeln kontrollerad: alla fyra är redan revoke:ade från public+anon.
