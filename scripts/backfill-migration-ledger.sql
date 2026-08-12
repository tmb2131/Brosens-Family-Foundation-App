-- Backfill the Supabase CLI's migration ledger.
--
-- Paste the whole file into the Supabase SQL Editor and Run. It is the
-- equivalent of `supabase migration repair --status applied <every version>`,
-- done in SQL so it needs no CLI link, access token or database password.
--
-- Why it is needed: supabase_migrations.schema_migrations does not exist on this
-- project, because the CLI has never pushed here — all 33 migrations were applied
-- by hand. Without the ledger, `npm run db:push` treats every one as pending and
-- replays them from 20260211000000 against a database that already holds the
-- objects. This writes the record the CLI would have written, so push only ever
-- runs genuinely new migrations.
--
-- Safe to re-run: the insert is ON CONFLICT DO NOTHING, and the pre-flight below
-- aborts the whole thing (the editor runs it in one transaction) if the database
-- does not actually contain what the ledger would be claiming.


-- ---------------------------------------------------------------------------
-- Pre-flight. Refuses to write a ledger that would lie about the schema.
-- ---------------------------------------------------------------------------
do $$
declare
  missing text[];
begin
  select array_agg(label order by label) into missing
  from (values
    -- 20260211000000_initial_schema
    (to_regclass('public.user_profiles')   is not null, 'table user_profiles — 20260211000000'),
    (to_regclass('public.organizations')   is not null, 'table organizations — 20260211000000'),
    (to_regclass('public.grants_master')   is not null, 'table grants_master — 20260211000000'),
    (to_regclass('public.budgets')         is not null, 'table budgets — 20260211000000'),
    (to_regclass('public.grant_proposals') is not null, 'table grant_proposals — 20260211000000'),
    (to_regclass('public.votes')           is not null, 'table votes — 20260211000000'),

    -- 20260211000001_auth_profile_and_blind_vote_policies
    (coalesce((select true from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname='handle_new_auth_user' limit 1), false),
     'fn handle_new_auth_user — 20260211000001'),
    (coalesce((select true from pg_policies
               where schemaname='public' and tablename='votes'
                 and policyname='read own votes' limit 1), false),
     'policy "read own votes" on votes — 20260211000001'),

    -- 20260212000000_discretionary_vote_choices
    (coalesce((select true from pg_enum e join pg_type t on t.oid=e.enumtypid
               where t.typname='vote_choice' and e.enumlabel='acknowledged' limit 1), false),
     'enum vote_choice.acknowledged — 20260212000000'),

    -- 20260212000001_mandate_policy_notifications
    (to_regclass('public.policy_documents')            is not null, 'table policy_documents — 20260212000001'),
    (to_regclass('public.policy_changes')              is not null, 'table policy_changes — 20260212000001'),
    (to_regclass('public.policy_change_notifications') is not null, 'table policy_change_notifications — 20260212000001'),

    -- 20260212000002_proposal_sent_at
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='grant_proposals' and column_name='sent_at' limit 1), false),
     'column grant_proposals.sent_at — 20260212000002'),

    -- 20260213000000..4
    (to_regclass('public.audit_log')               is not null, 'table audit_log — 20260213000000'),
    (to_regclass('public.email_notifications')     is not null, 'table email_notifications — 20260213000001'),
    (to_regclass('public.email_deliveries')        is not null, 'table email_deliveries — 20260213000001'),
    (to_regclass('public.frank_deenie_donations')  is not null, 'table frank_deenie_donations — 20260213000002'),
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='organizations' and column_name='charity_navigator_url' limit 1), false),
     'column organizations.charity_navigator_url — 20260213000003'),
    (to_regclass('public.push_subscriptions')      is not null, 'table push_subscriptions — 20260213000004'),
    (to_regclass('public.notification_events')     is not null, 'table notification_events — 20260213000004'),
    (to_regclass('public.notification_deliveries') is not null, 'table notification_deliveries — 20260213000004'),
    (to_regclass('public.notification_preferences') is not null, 'table notification_preferences — 20260213000004'),

    -- 20260214000000_organization_directional_category
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='organizations' and column_name='directional_category' limit 1), false),
     'column organizations.directional_category — 20260214000000'),
    (to_regclass('public.organization_category_jobs') is not null, 'table organization_category_jobs — 20260214000000'),

    -- 20260215000000 / 20260218000000 / 20260219100000 / 20260307000000 / 20260410000000
    (coalesce((select true from pg_enum e join pg_type t on t.oid=e.enumtypid
               where t.typname='email_notification_type' and e.enumlabel='introduction' limit 1), false),
     'enum email_notification_type.introduction — 20260215000000'),
    (coalesce((select true from pg_enum e join pg_type t on t.oid=e.enumtypid
               where t.typname='email_notification_type' and e.enumlabel='proposal_submitted_confirmation' limit 1), false),
     'enum email_notification_type.proposal_submitted_confirmation — 20260218000000'),
    (coalesce((select true from pg_enum e join pg_type t on t.oid=e.enumtypid
               where t.typname='email_notification_type' and e.enumlabel='user_access_notification' limit 1), false),
     'enum email_notification_type.user_access_notification — 20260219100000'),
    (coalesce((select true from pg_enum e join pg_type t on t.oid=e.enumtypid
               where t.typname='email_notification_type' and e.enumlabel='frank_deenie_donation_change' limit 1), false),
     'enum email_notification_type.frank_deenie_donation_change — 20260307000000'),
    (coalesce((select true from pg_enum e join pg_type t on t.oid=e.enumtypid
               where t.typname='email_notification_type' and e.enumlabel='proposal_decision' limit 1), false),
     'enum email_notification_type.proposal_decision — 20260410000000'),

    -- 20260215000001_proposal_detail_snapshots (adds columns, creates no table)
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='grant_proposals' and column_name='proposal_title' limit 1), false),
     'column grant_proposals.proposal_title — 20260215000001'),

    -- 20260217*
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='votes' and column_name='flag_comment' limit 1), false),
     'column votes.flag_comment — 20260217000000'),
    (coalesce((select c.reloptions::text like '%security_invoker%' from pg_class c
               join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relname='proposal_vote_progress' limit 1), false),
     'view proposal_vote_progress with security_invoker — 20260217000001'),
    (to_regclass('public.mandate_comments') is not null, 'table mandate_comments — 20260217100000'),
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='mandate_comments' and column_name='parent_id' limit 1), false),
     'column mandate_comments.parent_id — 20260217100001'),
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='mandate_comments' and column_name='resolved_at' limit 1), false),
     'column mandate_comments.resolved_at — 20260217100002'),

    -- 20260218100000 / 20260219100000
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='user_profiles' and column_name='last_accessed_at' limit 1), false),
     'column user_profiles.last_accessed_at — 20260218100000'),
    (coalesce((select true from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname='touch_last_accessed_at' limit 1), false),
     'fn touch_last_accessed_at — 20260219100000'),

    -- 20260318* / 20260319000000
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='grant_proposals' and column_name='returned_at' limit 1), false),
     'column grant_proposals.returned_at — 20260318000000'),
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='frank_deenie_donations' and column_name='return_group_id' limit 1), false),
     'column frank_deenie_donations.return_group_id — 20260318000000'),
    (to_regclass('public.foundation_events') is not null, 'table foundation_events — 20260318100000'),
    (coalesce((select true from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname='get_distinct_frank_deenie_years' limit 1), false),
     'fn get_distinct_frank_deenie_years — 20260318200000'),
    (coalesce((select true from information_schema.columns where table_schema='public'
               and table_name='grant_proposals' and column_name='original_sent_at' limit 1), false),
     'column grant_proposals.original_sent_at — 20260319000000'),

    -- 20260322000000_wrap_rls_auth_calls — the wrapped form renders in the
    -- policy expression as "( SELECT auth.uid() AS uid)".
    (coalesce((select true from pg_policies
               where schemaname='public' and qual ~ 'SELECT auth\.uid\(\)' limit 1), false),
     'RLS policies wrapping auth.uid() in a subselect — 20260322000000'),

    -- 20260322100000 / 20260329100000
    (coalesce((select true from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname='get_foundation_page_data' limit 1), false),
     'fn get_foundation_page_data — 20260322100000'),
    (to_regclass('public.proposal_drafts') is not null, 'table proposal_drafts — 20260329100000'),

    -- 20260812000000_restrict_security_definer_rpc_grants
    (coalesce((select not has_function_privilege('anon', p.oid, 'EXECUTE')
               from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname='get_foundation_page_data' limit 1), false),
     'anon EXECUTE revoked on get_foundation_page_data — 20260812000000')
  ) as t(ok, label)
  where not ok;

  if missing is not null then
    raise exception E'Ledger NOT backfilled. % item(s) the ledger would claim are absent:\n  %\nApply the migration(s) that create them first, or remove those versions from the insert below.',
      array_length(missing, 1), array_to_string(missing, E'\n  ');
  end if;

  raise notice 'Pre-flight passed — schema matches all 33 migrations.';
end
$$;


-- ---------------------------------------------------------------------------
-- The ledger table, in the shape the CLI bootstraps. The CLI adds any further
-- columns it needs with ADD COLUMN IF NOT EXISTS, so this stays forward-safe.
-- ---------------------------------------------------------------------------
create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key
);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;


-- ---------------------------------------------------------------------------
-- Every migration in the repo, all of them already applied by hand.
-- `statements` stays null: the CLI only reads it for `migration squash`, and a
-- fabricated body would be worse than none.
-- ---------------------------------------------------------------------------
insert into supabase_migrations.schema_migrations (version, name) values
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
  ('20260322000000', 'wrap_rls_auth_calls'),
  ('20260322100000', 'get_foundation_page_data'),
  ('20260329100000', 'proposal_drafts'),
  ('20260410000000', 'proposal_decision_notification'),
  ('20260812000000', 'restrict_security_definer_rpc_grants')
on conflict (version) do nothing;


-- Result: 33 rows, oldest first.
select version, name from supabase_migrations.schema_migrations order by version;


-- ---------------------------------------------------------------------------
-- Two migrations are data-only and leave no catalog trace, so the pre-flight
-- cannot verify them and the ledger asserts them on the strength of the app
-- running correctly:
--
--   20260214000001_ntee_broad_category_rebucket   remaps category buckets
--   20260308000000_mandate_oversight_wording      in-place mandate wording fix
--
-- Both are idempotent re-runs against current data, so marking them applied
-- costs nothing even in the unlikely case they never ran.
--
-- Afterwards:
--   npx supabase link --project-ref <ref>
--   npm run db:push:dry-run     # expect "Remote database is up to date"
--
-- From then on `npm run db:push` is safe and applies only new migrations.
-- ---------------------------------------------------------------------------
