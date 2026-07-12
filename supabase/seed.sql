-- Kursmotorn v1 — seed (fas 1). ENDAST FIKTIVA deltagare (repo-CLAUDE.md #8).
-- Två tenants på samma motor + fyra användare för RLS-isolationstestet.
-- Lösenord för alla testkonton: Testlosen123!  (byts före riktiga deltagare — go-live-grinden)
-- Fasta UUID:n så RLS-testet kan referera dem.

-- ── Auth-användare (login-kapabla: users + identities) ──
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('Testlosen123!', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
       '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'lisa@kursmotorn.test'),
  ('dddddddd-0000-0000-0000-000000000004'::uuid, 'admin1@andning.test'),
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'anna@andning.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'bengt@andning.test'),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'cecilia@mind.test')
) as u(id, email);

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('lisa@kursmotorn.test','admin1@andning.test','anna@andning.test','bengt@andning.test','cecilia@mind.test');

-- ── Plattformsadmin (Lisa) ──
insert into public.platform_admins (user_id) values ('11111111-1111-1111-1111-111111111111');

-- ── Tenants + brand ──
insert into public.tenants (id, slug, status, plan) values
  ('10000000-0000-0000-0000-000000000001', 'andningskursen',   'active', 'subscription'),
  ('20000000-0000-0000-0000-000000000002', 'mindfulnessguiden','active', 'subscription');

insert into public.tenant_brands (tenant_id, brand_spec) values
  ('10000000-0000-0000-0000-000000000001', '{"display_name":"Andningskursen","colors":{"accent":"#2F5D62"}}'::jsonb),
  ('20000000-0000-0000-0000-000000000002', '{"display_name":"Mindfulnessguiden","colors":{"accent":"#3A4A3F"}}'::jsonb);

-- ── Memberships ──
insert into public.memberships (user_id, tenant_id, role) values
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000002', 'owner'),
  ('dddddddd-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'admin'),        -- tenant1-admin, EJ plattformsadmin
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'participant'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'participant'),
  ('cccccccc-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'participant');

-- ── Kurser ──
insert into public.courses (id, tenant_id, work_name, display_name, certificate_title, unlock_mode, status) values
  ('1c000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'andning-v1', 'Andningskursen', 'Certifierad andningsguide', 'self_paced', 'published'),
  ('2c000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'mg-v1', 'Mindfulnessguiden', 'Certifierad mindfulnessguide', 'self_paced', 'published');

-- Moduler + sektioner (tenant 1)
insert into public.modules (id, tenant_id, course_id, position, title) values
  ('1d000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 1, 'Modul 1 — Grund');
insert into public.sections (id, tenant_id, module_id, position, title, content, requirements) values
  ('15000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000001', 1, 'Sektion 1', 'Text 1', '{"checkoff": true, "quiz_id": null, "upload_required": false}'::jsonb),
  ('15000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000001', 2, 'Sektion 2', 'Text 2', '{"checkoff": false, "quiz_id": null, "upload_required": true}'::jsonb);

-- Modul + sektion (tenant 2)
insert into public.modules (id, tenant_id, course_id, position, title) values
  ('2d000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 1, 'Vecka 1');
insert into public.sections (id, tenant_id, module_id, position, title, content) values
  ('25000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '2d000000-0000-0000-0000-000000000002', 1, 'V1', 'MG text');

-- Prov (tenant 1, slutprov)
insert into public.quizzes (id, tenant_id, course_id, section_id, title, pass_threshold, max_attempts, is_final) values
  ('19000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', null, 'Slutprov', 80, 3, true);
insert into public.quiz_questions (tenant_id, quiz_id, position, question, options, correct_index) values
  ('10000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 1, 'Fråga 1?', '["a","b","c"]'::jsonb, 0),
  ('10000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 2, 'Fråga 2?', '["a","b","c"]'::jsonb, 2);

-- Certifikatvillkor (tenant 1, breathworks-trion)
insert into public.course_certificate_requirements (tenant_id, course_id, position, type, config) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 1, 'sections_complete', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 2, 'final_quiz_pass', '{"threshold": 80}'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 3, 'attestation', '{"type": "live_session_honor"}'::jsonb);

-- Loggtyper
insert into public.log_type_defs (tenant_id, course_id, log_type, label, daily_unique) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'practice_day', 'Övningsdag', true),
  ('20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 'practice_day', 'Praxisdag', true),
  ('20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 'guide_session', 'Guidesession', false);

-- Kohorter
insert into public.cohorts (id, tenant_id, course_id, name, start_date, price_per_participant_sek, status) values
  ('1a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'Andning kull 1', '2026-06-01', 4900, 'active'),
  ('2a000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 'Grundarkohorten', '2026-06-01', 11500, 'active');

-- Enrollments (starts_at = kohortstart)
insert into public.enrollments (tenant_id, user_id, cohort_id, course_id, starts_at, company) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '2026-06-01', 'Acme AB'),
  ('10000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '2026-06-01', 'Beta AB'),
  ('20000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', '2026-06-01', null);

-- Deltagardata (tenant 1): Anna (A) och Bengt (B) — testar isolation A<->B
insert into public.section_progress (tenant_id, user_id, section_id) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');
insert into public.quiz_attempts (tenant_id, quiz_id, user_id, answers, score, passed) values
  ('10000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '[0,2]'::jsonb, 100, true),
  ('10000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '[1,1]'::jsonb, 40, false);
insert into public.uploads (tenant_id, user_id, section_id, storage_path, size_bytes) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001/aaaaaaaa-0000-0000-0000-000000000001/15000000-0000-0000-0000-000000000002/rec.mp4', 1048576);
insert into public.activity_logs (tenant_id, user_id, course_id, cohort_id, log_type, logged_date, source) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'practice_day', '2026-06-02', 'auto'),
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'practice_day', '2026-06-03', 'manual');
insert into public.attestations (tenant_id, user_id, course_id, type, statement_text) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'live_session_honor', 'Jag intygar att jag genomfört en live-session.');
insert into public.certificates (tenant_id, user_id, course_id, holder_name, verify_slug) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'Anna Andersson', 'anna-andning-0001');

-- Deltagardata (tenant 2): Cecilia (C)
insert into public.mg_guide_status (tenant_id, user_id, level) values
  ('20000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 'deltagare');
insert into public.mg_ffmq_responses (tenant_id, user_id, cohort_id, occasion, answers, total_score) values
  ('20000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', 'pre', '{"q1":3}'::jsonb, 45);
