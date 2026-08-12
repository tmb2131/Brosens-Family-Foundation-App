-- Lock down the SECURITY DEFINER RPCs.
--
-- Postgres grants EXECUTE on new functions to PUBLIC, and Supabase exposes every
-- function in the `public` schema over PostgREST. Because these functions run as
-- their owner, they bypass RLS — so `anon` (whose key ships in the client bundle
-- as NEXT_PUBLIC_SUPABASE_ANON_KEY) and any signed-in member could call
-- POST /rest/v1/rpc/get_foundation_page_data directly and read every vote row and
-- every member email, defeating the blind-vote policy in
-- 20260211000001_auth_profile_and_blind_vote_policies.sql.
--
-- Every one of these RPCs is only ever called server-side through the service-role
-- client (lib/supabase/admin.ts), so removing the client-facing grants changes no
-- application behavior.
--
-- Driven from pg_proc rather than a hard-coded list of signatures. `revoke` on a
-- function that does not exist raises 42883 and aborts the whole migration, and
-- the repo's migration history is not a reliable guide to what a given database
-- actually has: the giving-year RPCs added in 20260319100000 are absent from
-- production. Reading the catalog skips whatever is missing, tolerates signature
-- drift (regprocedure renders the real argument list), and makes the migration
-- safe to re-run.

do $$
declare
  target regprocedure;
  locked int := 0;
begin
  for target in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_foundation_page_data',
        'touch_last_accessed_at',
        'get_distinct_frank_deenie_years',
        'get_distinct_children_years',
        'get_distinct_frank_deenie_giving_years',
        'get_distinct_children_giving_years'
      )
      -- Trigger functions are invoked through the trigger rather than called by
      -- a client, and revoking EXECUTE on one breaks the triggering write.
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', target);
    execute format('grant execute on function %s to service_role', target);

    -- A SECURITY DEFINER function without a fixed search_path resolves
    -- unqualified names against the caller's search_path. The year RPCs were
    -- created without one; re-setting it on the others is a no-op.
    execute format('alter function %s set search_path = public', target);

    locked := locked + 1;
    raise notice 'locked down %', target;
  end loop;

  raise notice '% function(s) locked down', locked;
end
$$;

-- Verify afterwards — proacl should name only the owner and service_role, with
-- no anon=X or authenticated=X entry:
--
--   select p.oid::regprocedure as fn, p.proacl, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef;
