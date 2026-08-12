-- Migration drift check — paste into the Supabase SQL Editor.
--
-- Answers the same question as `supabase db push --dry-run` without needing the
-- CLI linked, and answers it better: the dry run only compares filenames against
-- the CLI's ledger, so anything applied by hand in the SQL Editor reads as
-- "pending" and anything dropped later still reads as "applied". Query 2 checks
-- the catalog for the objects themselves, which is what actually matters.
--
-- Regenerate query 1's version list from the repo with:
--   ls supabase/migrations/*.sql | sed 's|.*/||; s|\.sql$||'


-- ---------------------------------------------------------------------------
-- 1. Repo migrations vs the CLI's ledger.
--    NOT RECORDED = the CLI has no record of it. It may still have been applied
--    by hand — cross-check against query 2 before re-running anything.
-- ---------------------------------------------------------------------------
with repo(version, name) as (
  values
    ('20260211000000', 'initial_schema'),
    ('20260211000001', 'auth_profile_and_blind_vote_policies'),
    ('20260212000000', 'discretionary_vote_choices'),
    ('20260212000001', 'mandate_policy_notifications'),
    ('20260212000002', 'proposal_sent_at'),
    ('20260213000000', 'audit_log'),
    ('20260213000001', 'email_notifications'),
    ('20260213000002', 'frank_deenie_donations'),
    ('20260213000003', 'organization_charity_navigator_url'),
    ('20260213000004', 'push_notifications'),
    ('20260214000000', 'organization_directional_category'),
    ('20260214000001', 'ntee_broad_category_rebucket'),
    ('20260215000000', 'email_introduction_type'),
    ('20260215000001', 'proposal_detail_snapshots'),
    ('20260217000000', 'votes_flag_comment'),
    ('20260217000001', 'proposal_vote_progress_security_invoker'),
    ('20260217100000', 'mandate_comments'),
    ('20260217100001', 'mandate_comment_replies'),
    ('20260217100002', 'mandate_comment_resolved'),
    ('20260218000000', 'proposal_submitted_confirmation_type'),
    ('20260218100000', 'user_profiles_last_accessed_at'),
    ('20260219100000', 'user_access_notification'),
    ('20260307000000', 'frank_deenie_donation_change_notification'),
    ('20260308000000', 'mandate_oversight_wording'),
    ('20260318000000', 'check_returns'),
    ('20260318100000', 'foundation_events'),
    ('20260318200000', 'available_years_rpc'),
    ('20260319000000', 'original_sent_at'),
    ('20260319100000', 'giving_year_rpcs'),
    ('20260322000000', 'wrap_rls_auth_calls'),
    ('20260322100000', 'get_foundation_page_data'),
    ('20260329100000', 'proposal_drafts'),
    ('20260410000000', 'proposal_decision_notification'),
    ('20260812000000', 'restrict_security_definer_rpc_grants')
)
select
  coalesce(repo.version, m.version)                   as version,
  coalesce(repo.name, '(not in repo)')                as migration,
  case
    when repo.version is null then 'IN DB, NOT IN REPO'
    when m.version is null    then 'NOT RECORDED'
    else 'applied'
  end                                                 as ledger
from repo
full outer join supabase_migrations.schema_migrations m on m.version = repo.version
order by 1;


-- ---------------------------------------------------------------------------
-- 2. Do the objects the recent migrations create actually exist?
--    This is the drift-proof check — it reads the catalog, not the ledger.
-- ---------------------------------------------------------------------------
select item, introduced_by, case when present then 'ok' else 'MISSING' end as state
from (
  values
    ('table foundation_events', '20260318100000_foundation_events',
     to_regclass('public.foundation_events') is not null),

    ('table proposal_drafts', '20260329100000_proposal_drafts',
     to_regclass('public.proposal_drafts') is not null),

    ('table proposal_detail_snapshots', '20260215000001_proposal_detail_snapshots',
     to_regclass('public.proposal_detail_snapshots') is not null),

    ('table mandate_comments', '20260217100000_mandate_comments',
     to_regclass('public.mandate_comments') is not null),

    ('column grant_proposals.returned_at', '20260318000000_check_returns',
     exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'grant_proposals'
               and column_name = 'returned_at')),

    ('column grant_proposals.original_sent_at', '20260319000000_original_sent_at',
     exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'grant_proposals'
               and column_name = 'original_sent_at')),

    ('column user_profiles.last_accessed_at', '20260218100000_user_profiles_last_accessed_at',
     exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'user_profiles'
               and column_name = 'last_accessed_at')),

    ('column mandate_comments.resolved_at', '20260217100002_mandate_comment_resolved',
     exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'mandate_comments'
               and column_name = 'resolved_at')),

    ('fn get_foundation_page_data', '20260322100000_get_foundation_page_data',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_foundation_page_data')),

    ('fn get_distinct_frank_deenie_years', '20260318200000_available_years_rpc',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_distinct_frank_deenie_years')),

    ('fn get_distinct_children_years', '20260318200000_available_years_rpc',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_distinct_children_years')),

    -- Known missing in production, and called by nothing in the app.
    ('fn get_distinct_frank_deenie_giving_years', '20260319100000_giving_year_rpcs',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_distinct_frank_deenie_giving_years')),

    ('fn get_distinct_children_giving_years', '20260319100000_giving_year_rpcs',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'get_distinct_children_giving_years')),

    ('enum email_notification_type.proposal_decision', '20260410000000_proposal_decision_notification',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
             where t.typname = 'email_notification_type' and e.enumlabel = 'proposal_decision')),

    ('enum email_notification_type.frank_deenie_donation_change', '20260307000000_frank_deenie_donation_change_notification',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
             where t.typname = 'email_notification_type' and e.enumlabel = 'frank_deenie_donation_change')),

    ('enum email_notification_type.user_access_notification', '20260219100000_user_access_notification',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
             where t.typname = 'email_notification_type' and e.enumlabel = 'user_access_notification')),

    ('enum vote_choice.flagged', '20260212000000_discretionary_vote_choices',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
             where t.typname = 'vote_choice' and e.enumlabel = 'flagged'))
) as t(item, introduced_by, present)
order by present, item;


-- ---------------------------------------------------------------------------
-- 3. Did the RPC lock-down take? Every row should show anon=f, authenticated=f,
--    service_role=t, with search_path pinned. Trigger functions are excluded on
--    purpose and will not appear.
-- ---------------------------------------------------------------------------
-- to_regrole guards keep this from erroring on a database that lacks the
-- Supabase roles (a bare local Postgres); on Supabase all three always exist.
select
  p.oid::regprocedure as fn,
  case when to_regrole('anon') is null then null
       else has_function_privilege('anon', p.oid, 'EXECUTE') end          as anon,
  case when to_regrole('authenticated') is null then null
       else has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated,
  case when to_regrole('service_role') is null then null
       else has_function_privilege('service_role', p.oid, 'EXECUTE') end  as service_role,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.prorettype <> 'trigger'::regtype
order by 1;
