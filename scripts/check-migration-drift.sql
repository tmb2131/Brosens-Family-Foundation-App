-- Database state check — paste the whole file into the Supabase SQL Editor and Run.
--
-- The editor only renders the result of the LAST statement, so everything is
-- folded into one final SELECT. Rows needing attention sort to the top of each
-- section.
--
-- The three sections:
--   1. objects     — do the things the migrations create actually exist?
--   2. rpc grants  — did the SECURITY DEFINER lock-down take? state must be 'ok'
--   3. ledger      — repo migrations vs the CLI's record (this project has none)
--
--   ⚠ DO NOT RUN `npm run db:push` AGAINST THIS PROJECT.
--
-- schema_migrations does not exist here, so the CLI has never pushed and every
-- migration was applied by hand. With no ledger the CLI treats all 34 as pending
-- and replays them from 20260211000000 against a database that already holds
-- most of the objects. See the backfill note at the bottom before using it.

-- The ledger table may not exist, and plain SQL resolves table names at parse
-- time — so no guard written inside the query could run. Keeping the reference
-- dynamic inside a pg_temp function is what makes section 3 safe. pg_temp
-- objects vanish with the session.
create or replace function pg_temp.migration_ledger()
returns table (item text, detail text, state text)
language plpgsql
as $fn$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    return query select
      '(no ledger)'::text,
      'the CLI has never pushed here; every migration was applied by hand'::text,
      'NO LEDGER'::text;
    return;
  end if;

  return query execute $q$
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
      coalesce(repo.version, m.version),
      coalesce(repo.name, '(not in repo)'),
      case
        when repo.version is null then 'IN DB, NOT IN REPO'
        when m.version is null    then 'NOT RECORDED'
        else 'applied'
      end
    from repo
    full outer join supabase_migrations.schema_migrations m on m.version = repo.version
  $q$;
end
$fn$;


with objects(item, detail, present) as (
  values
    ('table foundation_events', '20260318100000_foundation_events',
     to_regclass('public.foundation_events') is not null),
    ('table proposal_drafts', '20260329100000_proposal_drafts',
     to_regclass('public.proposal_drafts') is not null),
    ('table proposal_detail_snapshots', '20260215000001_proposal_detail_snapshots',
     to_regclass('public.proposal_detail_snapshots') is not null),
    ('table mandate_comments', '20260217100000_mandate_comments',
     to_regclass('public.mandate_comments') is not null),
    ('table audit_log', '20260213000000_audit_log',
     to_regclass('public.audit_log') is not null),
    ('table email_notifications', '20260213000001_email_notifications',
     to_regclass('public.email_notifications') is not null),
    ('table push_subscriptions', '20260213000004_push_notifications',
     to_regclass('public.push_subscriptions') is not null),
    ('table frank_deenie_donations', '20260213000002_frank_deenie_donations',
     to_regclass('public.frank_deenie_donations') is not null),
    ('table policy_documents', '20260212000001_mandate_policy_notifications',
     to_regclass('public.policy_documents') is not null),

    ('column grant_proposals.returned_at', '20260318000000_check_returns',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='grant_proposals' and column_name='returned_at')),
    ('column grant_proposals.original_sent_at', '20260319000000_original_sent_at',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='grant_proposals' and column_name='original_sent_at')),
    ('column grant_proposals.sent_at', '20260212000002_proposal_sent_at',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='grant_proposals' and column_name='sent_at')),
    ('column user_profiles.last_accessed_at', '20260218100000_user_profiles_last_accessed_at',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='user_profiles' and column_name='last_accessed_at')),
    ('column votes.flag_comment', '20260217000000_votes_flag_comment',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='votes' and column_name='flag_comment')),
    ('column mandate_comments.resolved_at', '20260217100002_mandate_comment_resolved',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='mandate_comments' and column_name='resolved_at')),
    ('column organizations.directional_category', '20260214000000_organization_directional_category',
     exists (select 1 from information_schema.columns where table_schema='public'
             and table_name='organizations' and column_name='directional_category')),

    ('fn get_foundation_page_data', '20260322100000_get_foundation_page_data',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='get_foundation_page_data')),
    ('fn touch_last_accessed_at', '20260219100000_user_access_notification',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='touch_last_accessed_at')),
    ('fn get_distinct_frank_deenie_years', '20260318200000_available_years_rpc',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='get_distinct_frank_deenie_years')),
    ('fn get_distinct_children_years', '20260318200000_available_years_rpc',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='get_distinct_children_years')),
    -- Expected absent, and called by nothing in the app.
    ('fn get_distinct_frank_deenie_giving_years', '20260319100000_giving_year_rpcs (unused)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='get_distinct_frank_deenie_giving_years')),
    ('fn get_distinct_children_giving_years', '20260319100000_giving_year_rpcs (unused)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='get_distinct_children_giving_years')),

    ('enum email_notification_type.proposal_decision', '20260410000000_proposal_decision_notification',
     exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
             where t.typname='email_notification_type' and e.enumlabel='proposal_decision')),
    ('enum email_notification_type.frank_deenie_donation_change', '20260307000000_frank_deenie_donation_change_notification',
     exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
             where t.typname='email_notification_type' and e.enumlabel='frank_deenie_donation_change')),
    ('enum email_notification_type.user_access_notification', '20260219100000_user_access_notification',
     exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
             where t.typname='email_notification_type' and e.enumlabel='user_access_notification')),
    ('enum email_notification_type.proposal_submitted_confirmation', '20260218000000_proposal_submitted_confirmation_type',
     exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
             where t.typname='email_notification_type' and e.enumlabel='proposal_submitted_confirmation')),
    ('enum vote_choice.flagged', '20260212000000_discretionary_vote_choices',
     exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
             where t.typname='vote_choice' and e.enumlabel='flagged'))
),

-- to_regrole guards keep this working on a database without the Supabase roles.
grants as (
  select
    p.oid::regprocedure::text as item,
    format(
      'anon=%s authenticated=%s service_role=%s [%s]',
      coalesce(case when to_regrole('anon') is null then null
                    else has_function_privilege('anon', p.oid, 'EXECUTE') end::text, '?'),
      coalesce(case when to_regrole('authenticated') is null then null
                    else has_function_privilege('authenticated', p.oid, 'EXECUTE') end::text, '?'),
      coalesce(case when to_regrole('service_role') is null then null
                    else has_function_privilege('service_role', p.oid, 'EXECUTE') end::text, '?'),
      coalesce(array_to_string(p.proconfig, ','), 'search_path NOT SET')
    ) as detail,
    case
      when to_regrole('anon') is null then 'unknown'
      when has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE') then 'EXPOSED'
      else 'ok'
    end as state
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
),

combined as (
  select '1. objects'::text as section, item, detail,
         case when present then 'ok' else 'MISSING' end as state
  from objects
  union all
  select '2. rpc grants', item, detail, state from grants
  union all
  select '3. ledger', item, detail, state from pg_temp.migration_ledger()
)

select section, state, item, detail
from combined
order by section, (state in ('ok', 'applied')), item;


-- ---------------------------------------------------------------------------
-- What the result should look like
--
--   1. objects     every row 'ok', except the two giving_year functions, which
--                  are expected MISSING and are called by nothing.
--   2. rpc grants  every row 'ok'. Any 'EXPOSED' row means the lock-down
--                  migration has not been applied yet — run
--                  supabase/migrations/20260812000000_restrict_security_definer_rpc_grants.sql
--   3. ledger      one 'NO LEDGER' row on this project, until the backfill below.
--
-- Backfilling the ledger, once you want db:push to be usable:
--
--   npx supabase link --project-ref <ref>
--   npx supabase migration repair --status applied 20260211000000 20260211000001 ...
--   npx supabase migration repair --status reverted 20260319100000
--   npm run db:push:dry-run     # should now list only what is genuinely pending
--
-- Mark applied only what section 1 shows present. Until then, apply new
-- migrations by pasting them into the SQL Editor, as this schema was built.
-- ---------------------------------------------------------------------------
