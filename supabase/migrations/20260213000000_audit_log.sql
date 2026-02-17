create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_actor on audit_log (actor_id);
create index if not exists idx_audit_log_entity on audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_created_at on audit_log (created_at desc);

alter table audit_log enable row level security;

create policy "service role full access"
on audit_log for all
using (true)
with check (true);
