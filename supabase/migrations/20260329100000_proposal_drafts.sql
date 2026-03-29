-- Per-user new-proposal form drafts (server-backed, synced across devices).

create table if not exists proposal_drafts (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_proposal_drafts_updated_at on proposal_drafts;
create trigger trg_proposal_drafts_updated_at
before update on proposal_drafts
for each row execute procedure touch_updated_at();

alter table proposal_drafts enable row level security;

drop policy if exists "read own proposal draft" on proposal_drafts;
create policy "read own proposal draft"
on proposal_drafts for select
using ((select auth.uid()) = user_id);

drop policy if exists "insert own proposal draft" on proposal_drafts;
create policy "insert own proposal draft"
on proposal_drafts for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "update own proposal draft" on proposal_drafts;
create policy "update own proposal draft"
on proposal_drafts for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "delete own proposal draft" on proposal_drafts;
create policy "delete own proposal draft"
on proposal_drafts for delete
using ((select auth.uid()) = user_id);
