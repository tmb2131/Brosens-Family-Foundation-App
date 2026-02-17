-- Mandate inline comments: highlight text and add a comment for group review.
create table if not exists mandate_comments (
  id uuid primary key default gen_random_uuid(),
  policy_document_id uuid not null references policy_documents(id) on delete cascade,
  section_key text not null,
  quoted_text text not null,
  start_offset int not null check (start_offset >= 0),
  end_offset int not null check (end_offset >= start_offset),
  body text not null check (char_length(trim(body)) >= 1),
  author_id uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_mandate_comments_policy_section
  on mandate_comments (policy_document_id, section_key);

alter table mandate_comments enable row level security;

create policy "read mandate comments"
  on mandate_comments for select
  using (auth.role() = 'authenticated');

create policy "insert own mandate comments"
  on mandate_comments for insert
  with check (auth.uid() = author_id);

create policy "delete own mandate comments"
  on mandate_comments for delete
  using (auth.uid() = author_id);
