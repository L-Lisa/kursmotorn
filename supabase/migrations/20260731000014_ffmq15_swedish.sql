-- Kursmotorn v1 — FFMQ-korrigeringen (Lisas beslut, FFMQ-BESLUT 30/31 jul):
-- svensk FFMQ-15 ur sajtens självtest ERSÄTTER 39-versionen (migration ..13).
--
-- Items (q1–q15, svenska lydelser) bor i app-libbet (kopierade ordagrant ur sajtens
-- data/testQuestions.ts). Scoringen HÄR speglar sajtens evaluateFFMQAnswers exakt:
--   adjusted = reverseScored ? 6 − raw : raw · total = summan (15–75) ·
--   facetter (3 items var) med score/min/max/average (2 decimaler).
-- Vändlistan (reverseScored i sajtens fil): q3, q4, q7, q8, q9, q13, q14.
-- Facettmappningen (sajtens facet-strängar, ordagrant):
--   Observera: q1,q6,q11 · Beskriva: q2,q7,q12 · Agera med medvetenhet: q3,q8,q13 ·
--   Icke-dömande: q4,q9,q14 · Icke-reaktivitet: q5,q10,q15.
-- Svaren lagras som sajtens AnswerMap ({"q1": 1..5, ...}) — samma id:n som sajten
-- så före/efter-data förblir jämförbar över system.
-- Tidslåset oförändrat: pre t.o.m. dagen före fönster 2; post från fönster 6.

-- 39-versionens data är ogiltig efter korrigeringen (fel instrument): rader vars
-- answers är en ARRAY (39-formatet + gamla fas 1-seedens placeholder) rensas.
delete from public.mg_ffmq_responses where jsonb_typeof(answers) = 'array';

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

revoke execute on function public.submit_ffmq(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_ffmq(uuid, text, jsonb) to authenticated;
