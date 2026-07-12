-- Kursmotorn v1 — RLS (fas 1). Tenant-isolation = det enda oförhandlingsbara (repo-CLAUDE.md).
-- Hjälpfunktioner är SECURITY DEFINER (ägs av postgres → kringgår RLS på memberships → ingen rekursion).

-- ── Hjälpfunktioner ──
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_tenant_member(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.memberships m where m.tenant_id = tid and m.user_id = auth.uid());
$$;

create or replace function public.is_tenant_admin(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.memberships m
                 where m.tenant_id = tid and m.user_id = auth.uid() and m.role in ('owner','admin'));
$$;

grant execute on function public.is_platform_admin()        to anon, authenticated;
grant execute on function public.is_tenant_member(uuid)     to anon, authenticated;
grant execute on function public.is_tenant_admin(uuid)      to anon, authenticated;

-- authenticated behöver tabellprivilegier (RLS gatar sedan raderna). anon får inget i fas 1.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ── Aktivera RLS på allt ──
alter table public.platform_admins                 enable row level security;
alter table public.tenants                         enable row level security;
alter table public.tenant_brands                   enable row level security;
alter table public.memberships                     enable row level security;
alter table public.courses                         enable row level security;
alter table public.modules                         enable row level security;
alter table public.sections                        enable row level security;
alter table public.content_images                  enable row level security;
alter table public.quizzes                         enable row level security;
alter table public.quiz_questions                  enable row level security;
alter table public.quiz_attempts                   enable row level security;
alter table public.cohorts                         enable row level security;
alter table public.enrollments                     enable row level security;
alter table public.log_type_defs                   enable row level security;
alter table public.activity_logs                   enable row level security;
alter table public.section_progress                enable row level security;
alter table public.uploads                         enable row level security;
alter table public.attestations                    enable row level security;
alter table public.certificates                    enable row level security;
alter table public.course_certificate_requirements enable row level security;
alter table public.approvals                       enable row level security;
alter table public.mg_guide_status                 enable row level security;
alter table public.mg_ffmq_responses               enable row level security;
alter table public.mg_billing_splits               enable row level security;

-- ── platform_admins: bara plattformsadmin ser listan; skrivs endast av service role (seed) ──
create policy pa_read on public.platform_admins for select using (public.is_platform_admin());

-- ── memberships: egen rad + tenant-admin läser; admin skriver ──
create policy m_read  on public.memberships for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy m_write on public.memberships for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ── Config/innehåll (medlem läser, admin skriver) ──
create policy t_read   on public.tenants       for select using (public.is_tenant_member(id));
create policy t_write  on public.tenants       for all    using (public.is_tenant_admin(id))  with check (public.is_tenant_admin(id));

create policy tb_read  on public.tenant_brands for select using (public.is_tenant_member(tenant_id));
create policy tb_write on public.tenant_brands for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy c_read   on public.courses       for select using (public.is_tenant_member(tenant_id));
create policy c_write  on public.courses       for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy mod_read  on public.modules      for select using (public.is_tenant_member(tenant_id));
create policy mod_write on public.modules      for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy sec_read  on public.sections     for select using (public.is_tenant_member(tenant_id));
create policy sec_write on public.sections     for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy ci_read   on public.content_images for select using (public.is_tenant_member(tenant_id));
create policy ci_write  on public.content_images for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy q_read   on public.quizzes       for select using (public.is_tenant_member(tenant_id));
create policy q_write  on public.quizzes       for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy qq_read  on public.quiz_questions for select using (public.is_tenant_member(tenant_id));
create policy qq_write on public.quiz_questions for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy coh_read  on public.cohorts      for select using (public.is_tenant_member(tenant_id));
create policy coh_write on public.cohorts      for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy ltd_read  on public.log_type_defs for select using (public.is_tenant_member(tenant_id));
create policy ltd_write on public.log_type_defs for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy ccr_read  on public.course_certificate_requirements for select using (public.is_tenant_member(tenant_id));
create policy ccr_write on public.course_certificate_requirements for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ── Endast admin (finansiellt) ──
create policy mbs_all on public.mg_billing_splits for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ── Deltagarägd data: egen rad läses/skapas; admin ser/hanterar allt i sin tenant ──
-- quiz_attempts (försök är oföränderliga för deltagaren; admin kan nollställa)
create policy qa_read       on public.quiz_attempts for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy qa_insert_own on public.quiz_attempts for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy qa_admin      on public.quiz_attempts for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- section_progress (avbockning: egen insert + egen delete)
create policy sp_read       on public.section_progress for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy sp_insert_own on public.section_progress for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy sp_delete_own on public.section_progress for delete using (user_id = auth.uid());
create policy sp_admin      on public.section_progress for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- uploads (egen insert + egen delete)
create policy up_read       on public.uploads for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy up_insert_own on public.uploads for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy up_delete_own on public.uploads for delete using (user_id = auth.uid());
create policy up_admin      on public.uploads for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- activity_logs (egen insert; ändring/borttag = admin)
create policy al_read       on public.activity_logs for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy al_insert_own on public.activity_logs for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy al_admin      on public.activity_logs for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- attestations (egen insert; oföränderlig sedan)
create policy at_read       on public.attestations for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy at_insert_own on public.attestations for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy at_admin      on public.attestations for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- mg_ffmq_responses (egen insert + egen update; låsning = applogik, admin kan skriva över)
create policy ff_read       on public.mg_ffmq_responses for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy ff_insert_own on public.mg_ffmq_responses for insert with check (user_id = auth.uid() and public.is_tenant_member(tenant_id));
create policy ff_update_own on public.mg_ffmq_responses for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ff_admin      on public.mg_ffmq_responses for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ── Admin-hanterad deltagardata (ingen deltagar-insert): egen rad läses, admin skriver ──
create policy en_read  on public.enrollments for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy en_write on public.enrollments for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy cert_read  on public.certificates for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy cert_write on public.certificates for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy ap_read  on public.approvals for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy ap_write on public.approvals for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

create policy gs_read  on public.mg_guide_status for select using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy gs_write on public.mg_guide_status for all    using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
