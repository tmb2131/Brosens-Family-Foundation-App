do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'policy_notification_status'
  ) then
    create type policy_notification_status as enum ('pending', 'acknowledged', 'flagged');
  end if;
end;
$$;

create table if not exists policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  version int not null default 1 check (version >= 1),
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policy_changes (
  id uuid primary key default gen_random_uuid(),
  policy_document_id uuid not null references policy_documents(id) on delete cascade,
  version int not null check (version >= 2),
  previous_content jsonb not null,
  next_content jsonb not null,
  changed_by uuid references user_profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (policy_document_id, version)
);

create table if not exists policy_change_notifications (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references policy_changes(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  status policy_notification_status not null default 'pending',
  flag_reason text,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (change_id, user_id)
);

create index if not exists idx_policy_documents_slug on policy_documents (slug);
create index if not exists idx_policy_changes_policy on policy_changes (policy_document_id, version desc);
create index if not exists idx_policy_notifications_user_status
  on policy_change_notifications (user_id, status);

drop trigger if exists trg_policy_documents_updated_at on policy_documents;
create trigger trg_policy_documents_updated_at
before update on policy_documents
for each row execute procedure touch_updated_at();

alter table policy_documents enable row level security;
alter table policy_changes enable row level security;
alter table policy_change_notifications enable row level security;

drop policy if exists "read policy documents" on policy_documents;
create policy "read policy documents"
on policy_documents for select
using (auth.role() = 'authenticated');

drop policy if exists "read policy changes" on policy_changes;
create policy "read policy changes"
on policy_changes for select
using (auth.role() = 'authenticated');

drop policy if exists "read own policy notifications" on policy_change_notifications;
create policy "read own policy notifications"
on policy_change_notifications for select
using (auth.uid() = user_id);

drop policy if exists "update own policy notifications" on policy_change_notifications;
create policy "update own policy notifications"
on policy_change_notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
