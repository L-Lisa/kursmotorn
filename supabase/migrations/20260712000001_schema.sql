-- Kursmotorn v1 — schema (fas 1)
-- Källa: ../datamodell.md + docs/SPEC-guide-funktioner.md §2 (båda godkända).
-- Princip 1: tenant_id på ALLT + RLS (RLS i nästa migration). Princip 2: inget varumärkes-/affärsbundet hårdkodat.
-- Postgres 17 (Supabase, eu-north-1). Alla värdemängder som CHECK (lättare att evolvera än enum).

create extension if not exists pgcrypto;

-- ── Plattformsroll (Lisa) — SEPARAT från tenant-data (datamodell: aldrig i tenant-data) ──
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── updated_at-trigger ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Tenancy & brand ──
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  custom_domain text unique,
  status        text not null default 'active'       check (status in ('active','paused','ejected')),
  plan          text not null default 'subscription' check (plan in ('subscription','frikop')),
  created_at    timestamptz not null default now()
);

create table public.tenant_brands (
  tenant_id  uuid primary key references public.tenants(id) on delete cascade,
  brand_spec jsonb not null default '{}'::jsonb,   -- schema = system/templates/brand-spec.md
  version    int   not null default 1,
  updated_at timestamptz not null default now()
);
create trigger tenant_brands_updated_at before update on public.tenant_brands
  for each row execute function public.set_updated_at();

-- ── Användare & roller ──
create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  role       text not null check (role in ('owner','admin','participant')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- ── Kursstruktur (innehåll i DB, importeras från markdown) ──
create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  work_name         text not null,
  display_name      text not null,                 -- fält (namnbytes-säkert)
  certificate_title text,                          -- fält (namnbytes-säkert)
  description       text,
  unlock_mode       text not null default 'self_paced' check (unlock_mode in ('self_paced','scheduled')),
  status            text not null default 'draft'      check (status in ('draft','published')),
  language          text not null default 'sv',
  created_at        timestamptz not null default now()
);

create table public.modules (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position  int  not null,
  title     text not null,
  intro     text,
  unique (course_id, position)
);

create table public.sections (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  module_id          uuid not null references public.modules(id) on delete cascade,
  position           int  not null,
  title              text not null,
  content            text,                          -- markdown, redigerbar i admin
  media_url          text,                          -- kursvideo ELLER ljud (nullable: text-only ska funka)
  media_duration_sec int,                           -- för auto-praxisloggens >=90 %-mätning
  requirements       jsonb not null default '{"checkoff": true, "quiz_id": null, "upload_required": false}'::jsonb,
  drip_offset_days   int,                           -- scheduled-läget; räknas från kohortens start_date
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id),
  unique (module_id, position)
);
create trigger sections_updated_at before update on public.sections
  for each row execute function public.set_updated_at();

create table public.content_images (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  section_id   uuid not null references public.sections(id) on delete cascade,
  storage_path text not null,
  alt          text,
  created_at   timestamptz not null default now()
);

-- ── Prov-motorn ──
create table public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  section_id     uuid references public.sections(id) on delete cascade,   -- null => t.ex. slutprov
  title          text not null,
  pass_threshold int  not null default 80 check (pass_threshold between 0 and 100),
  max_attempts   int  check (max_attempts is null or max_attempts > 0),   -- null = obegränsat
  is_final       boolean not null default false
);

create table public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  position      int  not null,
  question      text not null,
  options       jsonb not null,
  correct_index int  not null,
  explanation   text,
  unique (quiz_id, position)
);

create table public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  answers    jsonb not null,
  score      int  not null,
  passed     boolean not null,
  created_at timestamptz not null default now()
);

-- ── Kohorter & enrollments (motorkärna) ──
create table public.cohorts (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  course_id                 uuid not null references public.courses(id) on delete cascade,
  name                      text not null,
  leader_membership_id      uuid references public.memberships(id) on delete set null,  -- null = plattformsägaren leder
  start_date                date not null,
  end_date                  date,
  price_per_participant_sek int  not null,           -- kohorten är prisets hem tills betalfasen
  status                    text not null default 'planned' check (status in ('planned','active','completed','cancelled')),
  sold_by                   text not null default 'platform' check (sold_by in ('platform','leader')),
  delivered_by              text not null default 'platform' check (delivered_by in ('platform','leader')),
  created_at                timestamptz not null default now()
);

create table public.enrollments (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  cohort_id                uuid not null references public.cohorts(id) on delete cascade,
  course_id                uuid not null references public.courses(id) on delete cascade,  -- denormaliserad: backar server-regeln nedan
  status                   text not null default 'active' check (status in ('active','paused','dropped','completed')),
  starts_at                date not null,            -- ankaret för certfönstren (default = kohortens start_date)
  company                  text,
  price_override_sek       int,
  invoiced_at              timestamptz,              -- MANUELL markering (ingen betalväxel)
  paid_at                  timestamptz,              -- MANUELL markering
  moved_from_enrollment_id uuid references public.enrollments(id),
  created_at               timestamptz not null default now(),
  unique (user_id, cohort_id)
);
-- Högst en AKTIV enrollment per user och kurs (backar serverfunktionen; direkt-API-dubblett avvisas i DB)
create unique index enrollments_one_active_per_course
  on public.enrollments (user_id, course_id) where status = 'active';

-- ── Aktivitetslogg (motorkärna, generisk) ──
create table public.log_type_defs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  log_type     text not null,
  label        text not null,
  daily_unique boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (course_id, log_type)
);

create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  cohort_id   uuid references public.cohorts(id) on delete set null,
  log_type    text not null,                        -- måste finnas i log_type_defs (serverfunktion vaktar)
  logged_date date not null,
  source      text not null default 'manual' check (source in ('auto','manual')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
-- v1:s enda dagtyp: max en practice_day per user och dag (guide_session är dagligt icke-unik)
create unique index activity_logs_practice_day_unique
  on public.activity_logs (user_id, log_type, logged_date) where log_type = 'practice_day';

-- ── Progress & uppladdningar ──
create table public.section_progress (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  section_id   uuid not null references public.sections(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, section_id)
);

create table public.uploads (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  section_id   uuid not null references public.sections(id) on delete cascade,
  storage_path text not null,
  size_bytes   bigint,
  duration_sec int,
  created_at   timestamptz not null default now()
);

-- ── Certifiering ──
create table public.attestations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  type           text not null check (type in ('live_session_honor')),
  statement_text text not null,                     -- versionerad ordagrann lydelse
  attested_at    timestamptz not null default now()
);

create table public.certificates (
  id          uuid primary key default gen_random_uuid(),   -- = certifikat-ID
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  holder_name text not null,
  issued_at   timestamptz not null default now(),
  revoked_at  timestamptz,
  pdf_path    text,
  verify_slug text not null unique                  -- publik /verify/<slug>
);

-- Typade certifikatvillkor (ersätter det hårdkodade utfärdandevillkoret)
create table public.course_certificate_requirements (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  position   int  not null,
  type       text not null check (type in ('sections_complete','final_quiz_pass','attestation','upload_sections','log_threshold','manual_approval')),
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

-- Generiskt bedömnings-/dispensarbetsflöde
create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  cohort_id     uuid references public.cohorts(id) on delete set null,
  approval_type text not null,
  target        jsonb,                               -- t.ex. {"window_index": 3} eller {"upload_id": "..."}
  assessed_by   uuid references auth.users(id),
  passed        boolean,                             -- null = inlämnad/öppen
  rubric        jsonb,
  notes         text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ── MG-tenantens tillägg (bakom context-lagret; RLS ändå, isolationen får inte bero på tomhet) ──
create table public.mg_guide_status (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  user_id                     uuid not null references auth.users(id) on delete cascade,
  level                       text not null default 'deltagare' check (level in ('deltagare','certifierad','licensierad')),
  certified_at                timestamptz,
  licensed_at                 timestamptz,
  license_agreement_signed_at timestamptz,           -- manuellt
  co_led_cohort_id            uuid references public.cohorts(id) on delete set null,  -- manuellt
  register_active             boolean not null default false,
  register_consent_version    text,
  register_consent_at         timestamptz,
  notes                       text,
  unique (tenant_id, user_id)
);

create table public.mg_ffmq_responses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  cohort_id    uuid references public.cohorts(id) on delete set null,
  occasion     text not null check (occasion in ('pre','post')),
  answers      jsonb not null,                       -- 15 items (kopieras ordagrant från sajtens FFMQ-15)
  facet_scores jsonb,
  total_score  int,
  completed_at timestamptz,
  locked_at    timestamptz,                          -- pre låses vid fönster 2; post från fönster 6
  unique (user_id, cohort_id, occasion)
);

create table public.mg_billing_splits (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  cohort_id         uuid not null unique references public.cohorts(id) on delete cascade,
  leader_share_pct  int check (leader_share_pct between 0 and 100),
  referral_amount_sek int,
  agreement_ref     text,
  notes             text
  -- flödestypen härleds ur cohorts.sold_by/delivered_by — lagras inte igen
);

-- Prestandaindex på de vanligaste RLS-/filtreringsvägarna
create index idx_memberships_user            on public.memberships (user_id);
create index idx_memberships_tenant          on public.memberships (tenant_id);
create index idx_courses_tenant              on public.courses (tenant_id);
create index idx_modules_course              on public.modules (course_id);
create index idx_sections_module             on public.sections (module_id);
create index idx_quizzes_course              on public.quizzes (course_id);
create index idx_quiz_questions_quiz         on public.quiz_questions (quiz_id);
create index idx_quiz_attempts_user          on public.quiz_attempts (user_id);
create index idx_cohorts_course              on public.cohorts (course_id);
create index idx_enrollments_user            on public.enrollments (user_id);
create index idx_enrollments_cohort          on public.enrollments (cohort_id);
create index idx_activity_logs_user_type     on public.activity_logs (user_id, log_type, logged_date);
create index idx_section_progress_user       on public.section_progress (user_id);
create index idx_uploads_user                on public.uploads (user_id);
create index idx_certificates_user           on public.certificates (user_id);
create index idx_ccr_course                  on public.course_certificate_requirements (course_id);
create index idx_approvals_user              on public.approvals (user_id);
create index idx_mg_ffmq_user                on public.mg_ffmq_responses (user_id);
