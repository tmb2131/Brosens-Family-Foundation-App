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

revoke execute on function public.get_foundation_page_data(int, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.get_foundation_page_data(int, uuid, boolean)
  to service_role;

revoke execute on function public.touch_last_accessed_at(uuid)
  from public, anon, authenticated;
grant execute on function public.touch_last_accessed_at(uuid)
  to service_role;

revoke execute on function public.get_distinct_frank_deenie_years()
  from public, anon, authenticated;
grant execute on function public.get_distinct_frank_deenie_years()
  to service_role;

revoke execute on function public.get_distinct_children_years()
  from public, anon, authenticated;
grant execute on function public.get_distinct_children_years()
  to service_role;

revoke execute on function public.get_distinct_frank_deenie_giving_years()
  from public, anon, authenticated;
grant execute on function public.get_distinct_frank_deenie_giving_years()
  to service_role;

revoke execute on function public.get_distinct_children_giving_years()
  from public, anon, authenticated;
grant execute on function public.get_distinct_children_giving_years()
  to service_role;

-- The year RPCs were created without a fixed search_path. A SECURITY DEFINER
-- function without one resolves unqualified names against the caller's
-- search_path, so pin it the way the other definer functions already do.
alter function public.get_distinct_frank_deenie_years() set search_path = public;
alter function public.get_distinct_children_years() set search_path = public;
alter function public.get_distinct_frank_deenie_giving_years() set search_path = public;
alter function public.get_distinct_children_giving_years() set search_path = public;
