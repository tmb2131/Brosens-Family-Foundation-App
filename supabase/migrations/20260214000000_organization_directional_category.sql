alter table organizations
add column if not exists directional_category text not null default 'other';

alter table organizations
add column if not exists directional_category_source text not null default 'fallback';

alter table organizations
add column if not exists directional_category_confidence numeric(4,3);

alter table organizations
add column if not exists directional_category_locked boolean not null default false;

alter table organizations
add column if not exists directional_category_updated_at timestamptz not null default now();

alter table organizations
drop constraint if exists organizations_directional_category_check;

alter table organizations
add constraint organizations_directional_category_check
check (
  directional_category in (
    'education',
    'health',
    'environment',
    'housing',
    'food_security',
    'arts_culture',
    'international_aid',
    'other'
  )
);

alter table organizations
drop constraint if exists organizations_directional_category_source_check;

alter table organizations
add constraint organizations_directional_category_source_check
check (
  directional_category_source in ('rule', 'ai', 'manual', 'fallback')
);

alter table organizations
drop constraint if exists organizations_directional_category_confidence_check;

alter table organizations
add constraint organizations_directional_category_confidence_check
check (
  directional_category_confidence is null
  or (
    directional_category_confidence >= 0
    and directional_category_confidence <= 1
  )
);

create table if not exists organization_category_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  status text not null default 'pending',
  attempt_count int not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('pending', 'processing', 'completed', 'failed'))
);

create index if not exists idx_org_category_jobs_status_next_attempt
on organization_category_jobs (status, next_attempt_at);

drop trigger if exists trg_organization_category_jobs_updated_at on organization_category_jobs;
create trigger trg_organization_category_jobs_updated_at
before update on organization_category_jobs
for each row execute procedure touch_updated_at();

alter table organization_category_jobs enable row level security;

insert into organization_category_jobs (organization_id)
select id
from organizations
on conflict (organization_id) do nothing;
