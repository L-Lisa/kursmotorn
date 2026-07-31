-- Kursmotorn v1 — fas 7-komplettering (2026-07-31): FFMQ + kursmedia.
--
-- FFMQ: Lisas beslut 2026-07-31 — instrumentet är Baers original-FFMQ (39 items,
-- fem facetter) återgivet ordagrant ur FFMQ-eng.pdf, med attribution till Ruth A. Baer
-- och hänvisning till den svenska versionen (Lunds universitet). Ersätter spec:ens
-- FFMQ-15-från-sajten. Testet säljs inte — det återges med källhänvisning i kursen.
--
-- Tidslåset (godkända specen §7) enforce:as HÄR: pre kan lämnas/ändras tills fönster 2
-- börjar (starts_at + 7 dagar); post först från fönster 6 (starts_at + 35 dagar).
-- Direktskrivning för deltagare tas bort — submit_ffmq är enda skrivvägen
-- (samma mönster som prov-motorn och log_activity). Admin-override via ff_admin består.

drop policy if exists ff_insert_own on public.mg_ffmq_responses;
drop policy if exists ff_update_own on public.mg_ffmq_responses;

-- Scoring bor i EN funktion (server-side, samma princip som certvillkoren):
-- vändning (R-items: 1↔5, 2↔4) och facettsummor enligt Baers scoringinstruktion.
create or replace function public.submit_ffmq(
  p_cohort_id uuid,
  p_occasion text,
  p_answers jsonb  -- array med 39 heltal 1–5, i itemordning
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_enr record;
  v_val int;
  v_scored int[] := array_fill(0, array[39]);
  v_reverse int[] := array[3,5,8,10,12,13,14,16,17,18,22,23,25,28,30,34,35,38,39];
  v_facets jsonb;
  v_total int := 0;
  v_lock date;
  i int;
begin
  if v_uid is null then
    raise exception 'ej inloggad' using errcode = '42501';
  end if;
  if p_occasion not in ('pre','post') then
    raise exception 'ogiltig occasion' using errcode = '23514';
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 39 then
    raise exception 'svaren ska vara 39 värden' using errcode = '23514';
  end if;

  select e.starts_at, e.tenant_id into v_enr
    from enrollments e
   where e.user_id = v_uid and e.cohort_id = p_cohort_id and e.status = 'active';
  if not found then
    raise exception 'ingen aktiv kursplats i kohorten' using errcode = '23514';
  end if;

  -- Tidslåset: pre t.o.m. dagen innan fönster 2; post tidigast fönster 6.
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

  -- Vändning + validering.
  for i in 1..39 loop
    v_val := (p_answers->(i-1))::int;
    if v_val is null or v_val < 1 or v_val > 5 then
      raise exception 'item % saknar giltigt svar (1–5)', i using errcode = '23514';
    end if;
    if i = any(v_reverse) then
      v_val := 6 - v_val;
    end if;
    v_scored[i] := v_val;
    v_total := v_total + v_val;
  end loop;

  v_facets := jsonb_build_object(
    'observing',        v_scored[1]+v_scored[6]+v_scored[11]+v_scored[15]+v_scored[20]+v_scored[26]+v_scored[31]+v_scored[36],
    'describing',       v_scored[2]+v_scored[7]+v_scored[12]+v_scored[16]+v_scored[22]+v_scored[27]+v_scored[32]+v_scored[37],
    'acting_awareness', v_scored[5]+v_scored[8]+v_scored[13]+v_scored[18]+v_scored[23]+v_scored[28]+v_scored[34]+v_scored[38],
    'nonjudging',       v_scored[3]+v_scored[10]+v_scored[14]+v_scored[17]+v_scored[25]+v_scored[30]+v_scored[35]+v_scored[39],
    'nonreactivity',    v_scored[4]+v_scored[9]+v_scored[19]+v_scored[21]+v_scored[24]+v_scored[29]+v_scored[33]
  );

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

-- ── Kursmedia (meditationsljud) — fynd 6:s sista bucket ──
-- Path-kontrakt: <tenant_id>/<valfri underväg>/<fil>. Medlemmar LÄSER sin tenants
-- media (spelaren); endast admin/ägare skriver (uppladdning sker via skript/admin).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-media', 'course-media', false, 209715200,
        array['audio/mp4','audio/x-m4a','audio/aac','audio/mpeg','video/mp4'])
on conflict (id) do nothing;

create policy course_media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'course-media'
    and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

create policy course_media_write on storage.objects for all to authenticated
  using (
    bucket_id = 'course-media'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'course-media'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );
