-- Brosens Family Foundation schema
-- Matches PRD entities and business rules.

create extension if not exists pgcrypto;

create type app_role as enum ('member', 'oversight', 'admin', 'manager');
create type proposal_status as enum ('to_review', 'approved', 'sent', 'declined');
create type proposal_type as enum ('joint', 'discretionary');
create type allocation_mode as enum ('average', 'sum');
create type vote_choice as enum ('yes', 'no');

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null default 'member',
  individual_approval_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  charity_navigator_score numeric(5,2),
  cause_area text,
  created_at timestamptz not null default now()
);

create table if not exists grants_master (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cause_area text,
  organization_id uuid references organizations(id) on delete set null,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  budget_year int not null unique,
  annual_fund_size numeric(14,2) not null check (annual_fund_size >= 0),
  rollover_from_previous_year numeric(14,2) not null default 0 check (rollover_from_previous_year >= 0),
  joint_ratio numeric(4,3) not null default 0.750,
  discretionary_ratio numeric(4,3) not null default 0.250,
  meeting_reveal_enabled boolean not null default false,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  check (joint_ratio >= 0 and discretionary_ratio >= 0),
  check (abs((joint_ratio + discretionary_ratio) - 1.0) < 0.0001)
);

create table if not exists grant_proposals (
  id uuid primary key default gen_random_uuid(),
  grant_master_id uuid not null references grants_master(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  proposer_id uuid not null references user_profiles(id),
  budget_year int not null,
  proposal_type proposal_type not null,
  allocation_mode allocation_mode not null default 'average',
  status proposal_status not null default 'to_review',
  reveal_votes boolean not null default false,
  final_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint grant_proposals_budget_fk
    foreign key (budget_year) references budgets(budget_year)
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references grant_proposals(id) on delete cascade,
  voter_id uuid not null references user_profiles(id) on delete cascade,
  choice vote_choice not null,
  allocation_amount numeric(14,2) not null default 0 check (allocation_amount >= 0),
  created_at timestamptz not null default now(),
  unique (proposal_id, voter_id)
);

create index if not exists idx_grant_proposals_budget_year on grant_proposals (budget_year);
create index if not exists idx_grant_proposals_status on grant_proposals (status);
create index if not exists idx_votes_proposal on votes (proposal_id);

create or replace view proposal_vote_progress as
select
  gp.id as proposal_id,
  count(v.id)::int as votes_submitted,
  sum(case when v.choice = 'yes' then 1 else 0 end)::int as yes_votes,
  sum(case when v.choice = 'no' then 1 else 0 end)::int as no_votes,
  round(avg(v.allocation_amount), 2) as avg_allocation,
  round(sum(v.allocation_amount), 2) as sum_allocation
from grant_proposals gp
left join votes v on v.proposal_id = gp.id
group by gp.id;

create or replace function compute_proposal_final_amount(target_proposal_id uuid)
returns numeric
language sql
stable
as $$
  select
    case
      when gp.proposal_type = 'joint' and gp.allocation_mode = 'average' then coalesce(p.avg_allocation, 0)
      when gp.proposal_type = 'joint' and gp.allocation_mode = 'sum' then coalesce(p.sum_allocation, 0)
      when gp.proposal_type = 'discretionary' then coalesce(p.sum_allocation, 0)
      else 0
    end
  from grant_proposals gp
  left join proposal_vote_progress p on p.proposal_id = gp.id
  where gp.id = target_proposal_id;
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on user_profiles;
create trigger trg_user_profiles_updated_at
before update on user_profiles
for each row execute procedure touch_updated_at();

alter table user_profiles enable row level security;
alter table organizations enable row level security;
alter table grants_master enable row level security;
alter table budgets enable row level security;
alter table grant_proposals enable row level security;
alter table votes enable row level security;

-- Members can read shared data.
drop policy if exists "read shared foundation tables" on organizations;
create policy "read shared foundation tables"
on organizations for select
using (auth.role() = 'authenticated');

drop policy if exists "read grants master" on grants_master;
create policy "read grants master"
on grants_master for select
using (auth.role() = 'authenticated');

drop policy if exists "read budgets" on budgets;
create policy "read budgets"
on budgets for select
using (auth.role() = 'authenticated');

drop policy if exists "read proposals" on grant_proposals;
create policy "read proposals"
on grant_proposals for select
using (auth.role() = 'authenticated');

drop policy if exists "read all votes" on votes;
create policy "read all votes"
on votes for select
using (auth.role() = 'authenticated');

-- Members can create proposals and votes.
drop policy if exists "members insert proposals" on grant_proposals;
create policy "members insert proposals"
on grant_proposals for insert
with check (auth.uid() = proposer_id);

drop policy if exists "members insert own votes" on votes;
create policy "members insert own votes"
on votes for insert
with check (auth.uid() = voter_id);

drop policy if exists "members update own votes" on votes;
create policy "members update own votes"
on votes for update
using (auth.uid() = voter_id)
with check (auth.uid() = voter_id);

-- Admin and oversight workflow updates can be handled via service role or edge functions.
