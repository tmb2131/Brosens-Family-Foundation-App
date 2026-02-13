alter table user_profiles
  add column if not exists timezone text not null default 'America/New_York';

update user_profiles
set timezone = 'America/New_York'
where timezone is null or btrim(timezone) = '';

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_notification_type'
  ) then
    create type email_notification_type as enum (
      'action_required',
      'weekly_action_reminder',
      'proposal_sent_fyi'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'email_delivery_status'
  ) then
    create type email_delivery_status as enum (
      'pending',
      'sent',
      'failed'
    );
  end if;
end
$$;

create table if not exists email_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_type email_notification_type not null,
  actor_user_id uuid references user_profiles(id) on delete set null,
  entity_id uuid,
  idempotency_key text not null unique,
  subject text not null,
  html_body text not null,
  text_body text not null,
  primary_link_path text not null default '/',
  primary_link_label text not null default 'Open',
  payload jsonb not null default '{}'::jsonb,
  recipient_user_ids uuid[] not null default '{}'::uuid[],
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists email_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references email_notifications(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  email text not null,
  status email_delivery_status not null default 'pending',
  attempt_count int not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, user_id)
);

create table if not exists email_weekly_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  week_key text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, week_key)
);

create index if not exists idx_email_notifications_processed_created
  on email_notifications (processed_at, created_at);

create index if not exists idx_email_deliveries_status_next_attempt
  on email_deliveries (status, next_attempt_at);

create index if not exists idx_email_deliveries_notification
  on email_deliveries (notification_id);

create index if not exists idx_email_weekly_reminders_user_week
  on email_weekly_reminders (user_id, week_key);

drop trigger if exists trg_email_deliveries_updated_at on email_deliveries;
create trigger trg_email_deliveries_updated_at
before update on email_deliveries
for each row execute procedure touch_updated_at();

alter table email_notifications enable row level security;
alter table email_deliveries enable row level security;
alter table email_weekly_reminders enable row level security;

drop policy if exists "read own email notifications" on email_notifications;
create policy "read own email notifications"
on email_notifications for select
using (auth.uid() = any(recipient_user_ids));

drop policy if exists "read own email deliveries" on email_deliveries;
create policy "read own email deliveries"
on email_deliveries for select
using (auth.uid() = user_id);
