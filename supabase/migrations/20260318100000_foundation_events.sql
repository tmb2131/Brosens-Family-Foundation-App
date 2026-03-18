create table if not exists foundation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('fund_foundation', 'transfer_to_foundation')),
  event_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  memo text,
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_foundation_events_date
on foundation_events (event_date desc);

drop trigger if exists trg_foundation_events_updated_at on foundation_events;
create trigger trg_foundation_events_updated_at
before update on foundation_events
for each row execute procedure touch_updated_at();

alter table foundation_events enable row level security;

drop policy if exists "read foundation events" on foundation_events;
create policy "read foundation events"
on foundation_events for select
using (auth.role() = 'authenticated');

drop policy if exists "insert foundation events" on foundation_events;
create policy "insert foundation events"
on foundation_events for insert
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = auth.uid()
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
    where up.id = auth.uid()
      and up.role in ('oversight', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = auth.uid()
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
    where up.id = auth.uid()
      and up.role in ('oversight', 'admin', 'manager')
  )
);
