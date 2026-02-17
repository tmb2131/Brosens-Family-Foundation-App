-- Oversight can mark a comment thread (root) as resolved; resolved threads are hidden.
alter table mandate_comments
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references user_profiles(id) on delete set null;

create index if not exists idx_mandate_comments_resolved
  on mandate_comments (resolved_at) where resolved_at is not null;
