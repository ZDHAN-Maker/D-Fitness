-- 001_extensions.sql
-- Extensions, private schema and shared helpers.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;   -- fuzzy / typo-tolerant search
create extension if not exists unaccent with schema extensions;
-- Hosted Supabase already grants this; stated explicitly so fresh/local setups behave identically.
grant usage on schema extensions to anon, authenticated, service_role;

-- "private" is NOT exposed through the Supabase Data API. It holds ownership
-- helpers used by RLS policies and internal trigger functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
