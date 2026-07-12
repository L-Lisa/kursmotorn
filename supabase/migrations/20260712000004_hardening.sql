-- Kursmotorn v1 — härdning (fas 1). Fixar advisor-varningen function_search_path_mutable.
-- set_updated_at rör bara now() (pg_catalog) → tom search_path är säkrast (tvingar kvalificering).
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
