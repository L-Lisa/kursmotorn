-- Kursmotorn v1 — Storage (fas 1). Bucket `recordings` för deltagares MP4-inspelningar.
-- Path-kontrakt: <tenant_id>/<user_id>/<section_id>/<fil>. RLS på path-prefix (datamodell §uploads).
-- Privat bucket → åtkomst endast via signerade URL:er med kort TTL (fas 4). Stora filer via TUS (fas 4).

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- Ladda upp till EGET prefix i en tenant man tillhör
create policy recordings_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

-- Läs egen fil; tenant-admin läser tenantens filer
create policy recordings_read on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );

-- Radera egen fil (GDPR-kaskad hanteras separat); admin raderar tenantens
create policy recordings_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'recordings'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
    )
  );
