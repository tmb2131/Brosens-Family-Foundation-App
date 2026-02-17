create table if not exists frank_deenie_donations (
  id uuid primary key default gen_random_uuid(),
  donation_date date not null,
  donation_type text not null default 'donation',
  recipient_name text not null,
  memo text,
  split text,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'Gave',
  created_by uuid references user_profiles(id) on delete set null,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_frank_deenie_donations_date
on frank_deenie_donations (donation_date desc);

drop trigger if exists trg_frank_deenie_donations_updated_at on frank_deenie_donations;
create trigger trg_frank_deenie_donations_updated_at
before update on frank_deenie_donations
for each row execute procedure touch_updated_at();

alter table frank_deenie_donations enable row level security;

drop policy if exists "read frank deenie donations" on frank_deenie_donations;
create policy "read frank deenie donations"
on frank_deenie_donations for select
using (auth.role() = 'authenticated');

drop policy if exists "insert frank deenie donations" on frank_deenie_donations;
create policy "insert frank deenie donations"
on frank_deenie_donations for insert
with check (
  exists (
    select 1
    from user_profiles up
    where up.id = auth.uid()
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

drop policy if exists "delete frank deenie donations" on frank_deenie_donations;
create policy "delete frank deenie donations"
on frank_deenie_donations for delete
using (
  exists (
    select 1
    from user_profiles up
    where up.id = auth.uid()
      and up.role in ('oversight', 'admin', 'manager')
  )
);
