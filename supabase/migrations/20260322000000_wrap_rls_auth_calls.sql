-- Wrap all auth.uid() and auth.role() calls in (select ...) so Postgres
-- evaluates them once per statement instead of once per row, improving
-- RLS performance and query-plan caching.

-- ============================================================
-- From initial_schema: organizations, grants_master, budgets,
-- grant_proposals, votes
-- ============================================================

drop policy if exists "read shared foundation tables" on organizations;
create policy "read shared foundation tables"
on organizations for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "read grants master" on grants_master;
create policy "read grants master"
on grants_master for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "read budgets" on budgets;
create policy "read budgets"
on budgets for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "read proposals" on grant_proposals;
create policy "read proposals"
on grant_proposals for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "members insert proposals" on grant_proposals;
create policy "members insert proposals"
on grant_proposals for insert
with check ((select auth.uid()) = proposer_id);

drop policy if exists "members insert own votes" on votes;
create policy "members insert own votes"
on votes for insert
with check ((select auth.uid()) = voter_id);

drop policy if exists "members update own votes" on votes;
create policy "members update own votes"
on votes for update
using ((select auth.uid()) = voter_id)
with check ((select auth.uid()) = voter_id);

-- ============================================================
-- From auth_profile_and_blind_vote_policies: user_profiles, votes
-- ============================================================

drop policy if exists "read own profile" on user_profiles;
create policy "read own profile"
on user_profiles for select
using ((select auth.uid()) = id);

drop policy if exists "update own profile" on user_profiles;
create policy "update own profile"
on user_profiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "read own votes" on votes;
create policy "read own votes"
on votes for select
using ((select auth.uid()) = voter_id);

-- ============================================================
-- From mandate_policy_notifications: policy_documents,
-- policy_changes, policy_change_notifications
-- ============================================================

drop policy if exists "read policy documents" on policy_documents;
create policy "read policy documents"
on policy_documents for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "read policy changes" on policy_changes;
create policy "read policy changes"
on policy_changes for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "read own policy notifications" on policy_change_notifications;
create policy "read own policy notifications"
on policy_change_notifications for select
using ((select auth.uid()) = user_id);

drop policy if exists "update own policy notifications" on policy_change_notifications;
create policy "update own policy notifications"
on policy_change_notifications for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- ============================================================
-- From email_notifications: email_notifications, email_deliveries
-- ============================================================

drop policy if exists "read own email notifications" on email_notifications;
create policy "read own email notifications"
on email_notifications for select
using ((select auth.uid()) = any(recipient_user_ids));

drop policy if exists "read own email deliveries" on email_deliveries;
create policy "read own email deliveries"
on email_deliveries for select
using ((select auth.uid()) = user_id);

-- ============================================================
-- From frank_deenie_donations
-- ============================================================

drop policy if exists "read frank deenie donations" on frank_deenie_donations;
create policy "read frank deenie donations"
on frank_deenie_donations for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "insert frank deenie donations" on frank_deenie_donations;
create policy "insert frank deenie donations"
on frank_deenie_donations for insert
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
);

drop policy if exists "update frank deenie donations" on frank_deenie_donations;
create policy "update frank deenie donations"
on frank_deenie_donations for update
using (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
);

drop policy if exists "delete frank deenie donations" on frank_deenie_donations;
create policy "delete frank deenie donations"
on frank_deenie_donations for delete
using (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
);

-- ============================================================
-- From push_notifications: push_subscriptions,
-- notification_preferences, notification_events
-- ============================================================

drop policy if exists "read own push subscriptions" on push_subscriptions;
create policy "read own push subscriptions"
on push_subscriptions for select
using ((select auth.uid()) = user_id);

drop policy if exists "insert own push subscriptions" on push_subscriptions;
create policy "insert own push subscriptions"
on push_subscriptions for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "update own push subscriptions" on push_subscriptions;
create policy "update own push subscriptions"
on push_subscriptions for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "delete own push subscriptions" on push_subscriptions;
create policy "delete own push subscriptions"
on push_subscriptions for delete
using ((select auth.uid()) = user_id);

drop policy if exists "read own notification preferences" on notification_preferences;
create policy "read own notification preferences"
on notification_preferences for select
using ((select auth.uid()) = user_id);

drop policy if exists "insert own notification preferences" on notification_preferences;
create policy "insert own notification preferences"
on notification_preferences for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "update own notification preferences" on notification_preferences;
create policy "update own notification preferences"
on notification_preferences for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "read own notification events" on notification_events;
create policy "read own notification events"
on notification_events for select
using ((select auth.uid()) = any(recipient_user_ids));

-- ============================================================
-- From mandate_comments
-- ============================================================

drop policy if exists "read mandate comments" on mandate_comments;
create policy "read mandate comments"
on mandate_comments for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "insert own mandate comments" on mandate_comments;
create policy "insert own mandate comments"
on mandate_comments for insert
with check ((select auth.uid()) = author_id);

drop policy if exists "delete own mandate comments" on mandate_comments;
create policy "delete own mandate comments"
on mandate_comments for delete
using ((select auth.uid()) = author_id);

-- ============================================================
-- From foundation_events
-- ============================================================

drop policy if exists "read foundation events" on foundation_events;
create policy "read foundation events"
on foundation_events for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "insert foundation events" on foundation_events;
create policy "insert foundation events"
on foundation_events for insert
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
);

drop policy if exists "update foundation events" on foundation_events;
create policy "update foundation events"
on foundation_events for update
using (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
);

drop policy if exists "delete foundation events" on foundation_events;
create policy "delete foundation events"
on foundation_events for delete
using (
  exists (
    select 1
    from user_profiles up
    where up.id = (select auth.uid())
      and up.role in ('oversight', 'admin', 'manager')
  )
);
