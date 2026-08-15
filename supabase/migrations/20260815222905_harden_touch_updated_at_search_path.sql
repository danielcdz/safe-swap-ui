-- A function without a fixed search_path can be hijacked: a caller sets a
-- search_path pointing at their own schema and the function resolves an
-- unqualified name to their object instead. Pinning it to empty closes that —
-- pg_catalog is always searched implicitly, so now() still resolves.
--
-- Flagged by the Supabase security linter (0011_function_search_path_mutable).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
