-- Kursmotorn v1 — fas 4: prov-motorn (facit-säker).
-- Provintegritet: deltagaren får ALDRIG läsa correct_index/explanation, och får inte
-- själv skriva quiz_attempts (då skulle passed=true kunna fejkas → kringgå certkravet).
-- Deltagaren läser frågor via get_quiz() (utan facit) och rättas i submit_quiz_attempt()
-- (SECURITY DEFINER, läser facit server-side). Admin behåller full åtkomst (rättning/nollställning).

-- 1. Strama åt: bara admin läser quiz_questions direkt (facit). Deltagare → get_quiz().
drop policy if exists qq_read on public.quiz_questions;
create policy qq_read_admin on public.quiz_questions
  for select using (public.is_tenant_admin(tenant_id));

-- 2. Deltagare får inte längre själv-inserta försök. Endast submit_quiz_attempt() (definer)
--    och admin (qa_admin) skriver. qa_read (egen rad + admin) och qa_admin behålls.
drop policy if exists qa_insert_own on public.quiz_attempts;

-- 3. Frågor utan facit, för en medlem i tenanten.
create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q record;
  result jsonb;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if q.id is null or not public.is_tenant_member(q.tenant_id) then
    return null;
  end if;
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'pass_threshold', q.pass_threshold,
    'max_attempts', q.max_attempts,
    'is_final', q.is_final,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', qq.id, 'position', qq.position,
                                  'question', qq.question, 'options', qq.options)
               order by qq.position)
      from public.quiz_questions qq where qq.quiz_id = q.id
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;
grant execute on function public.get_quiz(uuid) to authenticated;

-- 4. Rättning server-side: respekterar max_attempts + pass_threshold, skapar attempt.
--    p_answers = jsonb-objekt { "<question_id>": <valt alternativindex> }.
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
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
