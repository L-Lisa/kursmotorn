-- Kursmotorn v1 — seed (fas 1). ENDAST FIKTIVA deltagare (repo-CLAUDE.md #8).
-- Två tenants på samma motor + fyra användare för RLS-isolationstestet.
-- Lösenord för alla testkonton: Testlosen123!  (byts före riktiga deltagare — go-live-grinden)
-- Fasta UUID:n så RLS-testet kan referera dem.

-- ── Auth-användare (login-kapabla: users + identities) ──
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
-- full_name = certifikatets holder_name (fiktivt). Anna får åäö så breathworks-flödets
-- riktiga certifikat exercisar svenska tecken; PDF-testet kör dessutom "Åsa Öhman, Märsta".
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('Testlosen123!', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.name), now(), now(),
       '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'lisa@kursmotorn.test', 'Lisa Ojeland'),
  ('dddddddd-0000-0000-0000-000000000004'::uuid, 'admin1@andning.test',  'Andningskursens admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'anna@andning.test',    'Anna Öberg'),
  ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'bengt@andning.test',   'Bengt Nordin'),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'cecilia@mind.test',    'Cecilia Ahlgren'),
  ('eeeeeeee-0000-0000-0000-000000000005'::uuid, 'granskning@mind.test', 'Lisas granskningskonto')
) as u(id, email, name);

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('lisa@kursmotorn.test','admin1@andning.test','anna@andning.test','bengt@andning.test','cecilia@mind.test','granskning@mind.test');

-- ── Plattformsadmin (Lisa) ──
insert into public.platform_admins (user_id) values ('11111111-1111-1111-1111-111111111111');

-- ── Tenants + brand ──
insert into public.tenants (id, slug, status, plan) values
  ('10000000-0000-0000-0000-000000000001', 'andningskursen',   'active', 'subscription'),
  ('20000000-0000-0000-0000-000000000002', 'mindfulnessguiden','active', 'subscription');

-- Fullständig brand-spec per demo-tenant (schema = system/templates/brand-spec.md).
-- Tokens ordagrant ur ../brand.md (LÅST). Tenant #1 = palett A; tenant #2 = MG Editorial Lugn (återges exakt).
-- primary_dark för MG är en härledd mörkare Ink-nyans (används bara på certifikatytor, fas 5) — noterat i DECISIONS.
insert into public.tenant_brands (tenant_id, brand_spec) values
  ('10000000-0000-0000-0000-000000000001', '{
    "tenant_name": "Andningskursen",
    "display_name": "Andningskursen",
    "course_name": "Andningskursen",
    "certificate_title": "Certifierad andningsguide",
    "tagline": "En lugn, evidensledd väg till medveten andning.",
    "org_info": {"legal_name": "", "org_nr": "", "website": "", "contact": ""},
    "colors": {"bg": "#F6F3ED", "card": "#FFFFFF", "primary": "#1F5F5B", "primary_dark": "#15403D", "text": "#25302E", "muted": "#6E7A76", "accent": "#A8894B", "soft": "#E9E2D3"},
    "fonts": {"serif": "Lora", "sans": "Inter", "mono": "JetBrains Mono"},
    "voice": {"tone_words": ["lugn", "varm", "evidensledd"], "address": "du", "language": "sv", "sample_lines": ["Din inspelning är uppladdad. Nästa modul är upplåst.", "Ta det i din egen takt — andningen väntar."], "avoid": ["hype", "medicinska överdrifter", "esoterik"]},
    "logo_url": null,
    "certificate": {"issuer_text": "Andningskursen", "signature_name": "", "signature_title": "", "expires": null},
    "domain": {"subdomain": "andningskursen", "custom_domain": null}
  }'::jsonb),
  ('20000000-0000-0000-0000-000000000002', '{
    "tenant_name": "Mindfulnessguiden",
    "display_name": "Mindfulnessguiden",
    "course_name": "Certifierad Mindfulnessguide",
    "certificate_title": "Certifierad mindfulnessguide",
    "tagline": "Mindfulness presenterad som en vuxen idé — inte en livsstilsprodukt.",
    "org_info": {"legal_name": "", "org_nr": "", "website": "mindfulnessguiden.se", "contact": ""},
    "mark_svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 320\" role=\"img\" aria-labelledby=\"title desc\"> <title id=\"title\">Mindfulnessguidens symbol</title> <desc id=\"desc\">En stiliserad person i meditation, omsluten av en öppen andningscirkel.</desc> <g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M72 190C48 146 58 93 95 60C111 46 129 37 145 34\" stroke=\"#D7D1F5\" stroke-width=\"18\"/> <path d=\"M175 34C191 37 209 46 225 60C262 93 272 146 248 190\" stroke=\"#D7D1F5\" stroke-width=\"18\"/> <circle cx=\"160\" cy=\"86\" r=\"28\" stroke=\"#0F2647\" stroke-width=\"10\"/> <path d=\"M136 117C111 128 95 153 95 183C95 207 108 226 132 237\" stroke=\"#0F2647\" stroke-width=\"10\"/> <path d=\"M184 117C209 128 225 153 225 183C225 207 212 226 188 237\" stroke=\"#0F2647\" stroke-width=\"10\"/> <path d=\"M132 119L160 166L188 119\" stroke=\"#0F2647\" stroke-width=\"8\"/> <path d=\"M123 208C137 220 148 226 160 226C172 226 183 220 197 208\" stroke=\"#0F2647\" stroke-width=\"9\"/> <path d=\"M160 257C132 228 101 224 65 241C83 269 117 287 160 278C203 287 237 269 255 241C219 224 188 228 160 257Z\" stroke=\"#0F2647\" stroke-width=\"10\"/> </g> </svg>",
    "colors": {"bg": "#FAF8F5", "card": "#FFFFFF", "primary": "#0F2647", "primary_dark": "#081B33", "text": "#0F2647", "muted": "#5B6676", "accent": "#715FC1", "soft": "#E9E4DE"},
    "fonts": {"serif": "Newsreader", "sans": "Manrope", "mono": "Manrope"},
    "voice": {"tone_words": ["grundad", "kompetent", "mänsklig"], "address": "du", "language": "sv", "sample_lines": ["Loggen är kvittot, inte piskan.", "Andas ut. En vecka i taget."], "avoid": ["flummig", "klinisk", "generisk", "streak-ångest", "dark mode"]},
    "logo_url": null,
    "certificate": {"issuer_text": "Mindfulnessguiden", "signature_name": "", "signature_title": "", "expires": null},
    "domain": {"subdomain": "mindfulnessguiden", "custom_domain": null}
  }'::jsonb);
-- MG:s tokens = "Stilla kraft" (ersatte Editorial Lugn 2026-07-24, Lisas beslut).
-- Källa: outputs/design-system/mindfulnessguiden/stilla-kraft/01-DESIGN-SYSTEM.md —
-- bg=canvas, card=paper, primary=navy-900, primary_dark=navy-950, text=--color-text,
-- muted=slate-600, accent=lilac-600, soft=stone-200 (linjer/avgränsare).
-- WCAG AA-kontrollerad 2026-07-30 (alla kombinationer ≥4.5:1).

-- ── Memberships ──
insert into public.memberships (user_id, tenant_id, role) values
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000002', 'owner'),
  ('dddddddd-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'admin'),        -- tenant1-admin, EJ plattformsadmin
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'participant'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'participant'),
  ('cccccccc-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'participant'),
  ('eeeeeeee-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'admin');        -- granskningskonto (fas 7): admin ⇒ förhandsgranskar hela kursen

-- ── Kurser ──
insert into public.courses (id, tenant_id, work_name, display_name, certificate_title, unlock_mode, status) values
  ('1c000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'andning-v1', 'Andningskursen', 'Certifierad andningsguide', 'self_paced', 'published'),
  ('2c000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'mg-v1', 'Mindfulnessguiden', 'Certifierad mindfulnessguide', 'self_paced', 'published');

-- Kursinnehåll (moduler/sektioner/prov) SEEDAS INTE här — det importeras ordagrant
-- från kurs/modul-N.md via `npm run import` (fas 3). Seeden ger bara scaffolding
-- (tenants, användare, kurser, kohorter, enrollments, villkor). Andningskursen fylls
-- av importen; MG-kursen (2c…) fylls i fas 7. Så hålls innehållet på ETT ställe.

-- Certifikatvillkor (tenant 1, breathworks-trion)
insert into public.course_certificate_requirements (tenant_id, course_id, position, type, config) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 1, 'sections_complete', '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 2, 'final_quiz_pass', '{"threshold": 80}'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 3, 'attestation', '{"type": "live_session_honor"}'::jsonb);

-- Loggtyper
insert into public.log_type_defs (tenant_id, course_id, log_type, label, daily_unique, manual_window_days, config) values
  ('10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'practice_day', 'Övningsdag', true, 7, '{}'),
  ('20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 'practice_day', 'Praxisdag', true, 7, '{}'),
  -- Formatlistan = kursens egna ord (C-FINAL v9, tre sessionsformat) — konfig i DB, inte motorkod.
  ('20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 'guide_session', 'Guidesession', false, null,
   '{"formats": [{"key": "A", "label": "Mikropausen"}, {"key": "B", "label": "Mindfulness-stunden"}, {"key": "C", "label": "Introduktionsföreläsningen"}, {"key": "annat", "label": "Annat"}], "license_target": 10}');

-- Kohorter
insert into public.cohorts (id, tenant_id, course_id, name, start_date, price_per_participant_sek, status) values
  ('1a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'Andning kull 1', '2026-06-01', 4900, 'active'),
  ('2a000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', 'Grundarkohorten', '2026-06-01', 11500, 'active');

-- Enrollments (starts_at = kohortstart)
insert into public.enrollments (tenant_id, user_id, cohort_id, course_id, starts_at, company) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '2026-06-01', 'Acme AB'),
  ('10000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '2026-06-01', 'Beta AB'),
  ('20000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-000000000002', '2026-06-01', null);

-- Deltagardata (progress, prov, uppladdningar, loggar, certifikat, FFMQ) SEEDAS INTE.
-- RLS-regressionssviten seedar sina egna fiktiva rader vid körning och städar upp efter
-- sig (content-agnostisk isolationstest) — så bryts inget när importen byter kursinnehåll.
-- Import-skriptet kan lägga in en liten demo-progress för Anna (kursvyns skärmdumpar).
