-- Kursmotorn v1 — fas 2: publik brand-lookup (åtgärdar öppet fynd 4 ur fas 0–1-reviewen).
-- Den publika, tenant-brandade landnings-/login-sidan (och /verify i fas 5) måste kunna
-- läsa en tenants slug + brand-tokens INNAN inloggning. anon har noll RLS-läsning på
-- tenants/tenant_brands (avsiktligt). Lösningen är en SMAL SECURITY DEFINER-funktion som
-- tar EN slug och returnerar bara det som är säkert att visa publikt (namn + brand-spec) —
-- ALDRIG en bred anon-SELECT som skulle exponera hela tenant-listan.
--
-- Vad som INTE läcker: funktionen tar en känd slug och returnerar en rad; den kan inte
-- lista tenants, och brand_spec innehåller bara visuella tokens + publika namn/texter
-- (samma sak som ändå renderas på den publika sidan). Deltagardata rörs aldrig.

create or replace function public.tenant_public_brand(p_slug text)
returns table (tenant_id uuid, slug text, status text, brand_spec jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.status, coalesce(tb.brand_spec, '{}'::jsonb)
  from public.tenants t
  left join public.tenant_brands tb on tb.tenant_id = t.id
  where t.slug = p_slug
    and t.status <> 'paused'   -- pausade tenants renderas inte publikt
  limit 1;
$$;

comment on function public.tenant_public_brand(text) is
  'Fas 2, fynd 4: smal publik lookup av EN tenants slug + brand-tokens för den obrandade '
  'login-/landningssidan. Ersätter behovet av bred anon-SELECT på tenants/tenant_brands.';

grant execute on function public.tenant_public_brand(text) to anon, authenticated;
