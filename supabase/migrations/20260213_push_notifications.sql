do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'notification_event_type'
  ) then
    create type notification_event_type as enum (
      'proposal_created',
      'proposal_ready_for_meeting',
      'proposal_status_changed',
      'policy_update_published',
      'proposal_approved_for_admin'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'notification_delivery_status'
  ) then
    create type notification_delivery_status as enum (
      'pending',
      'sent',
      'failed',
      'permanent_failure'
    );
  end if;
end
$$;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_preferences (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  proposal_created boolean not null default true,
  proposal_ready_for_meeting boolean not null default true,
  proposal_status_changed boolean not null default true,
  policy_update_published boolean not null default true,
  proposal_approved_for_admin boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type notification_event_type not null,
  actor_user_id uuid references user_profiles(id) on delete set null,
  entity_id uuid,
  idempotency_key text not null unique,
  title text not null,
  body text not null,
  link_path text not null default '/',
  payload jsonb not null default '{}'::jsonb,
  recipient_user_ids uuid[] not null default '{}'::uuid[],
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references notification_events(id) on delete cascade,
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  status notification_delivery_status not null default 'pending',
  attempt_count int not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_response_code int,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, subscription_id)
);

create index if not exists idx_push_subscriptions_user_active
  on push_subscriptions (user_id, is_active);

create index if not exists idx_notification_events_processed_created
  on notification_events (processed_at, created_at);

create index if not exists idx_notification_deliveries_status_next_attempt
  on notification_deliveries (status, next_attempt_at);

create index if not exists idx_notification_deliveries_event
  on notification_deliveries (event_id);

drop trigger if exists trg_push_subscriptions_updated_at on push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on push_subscriptions
for each row execute procedure touch_updated_at();

drop trigger if exists trg_notification_preferences_updated_at on notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on notification_preferences
for each row execute procedure touch_updated_at();

drop trigger if exists trg_notification_deliveries_updated_at on notification_deliveries;
create trigger trg_notification_deliveries_updated_at
before update on notification_deliveries
for each row execute procedure touch_updated_at();

alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;
alter table notification_events enable row level security;
alter table notification_deliveries enable row level security;

drop policy if exists "read own push subscriptions" on push_subscriptions;
create policy "read own push subscriptions"
on push_subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "insert own push subscriptions" on push_subscriptions;
create policy "insert own push subscriptions"
on push_subscriptions for insert
with check (auth.uid() = user_id);

drop policy if exists "update own push subscriptions" on push_subscriptions;
create policy "update own push subscriptions"
on push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own push subscriptions" on push_subscriptions;
create policy "delete own push subscriptions"
on push_subscriptions for delete
using (auth.uid() = user_id);

drop policy if exists "read own notification preferences" on notification_preferences;
create policy "read own notification preferences"
on notification_preferences for select
using (auth.uid() = user_id);

drop policy if exists "insert own notification preferences" on notification_preferences;
create policy "insert own notification preferences"
on notification_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "update own notification preferences" on notification_preferences;
create policy "update own notification preferences"
on notification_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "read own notification events" on notification_events;
create policy "read own notification events"
on notification_events for select
using (auth.uid() = any(recipient_user_ids));
