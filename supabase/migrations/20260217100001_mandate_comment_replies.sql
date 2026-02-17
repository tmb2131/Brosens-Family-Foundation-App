-- Allow replies to mandate comments (threaded).
alter table mandate_comments
  add column if not exists parent_id uuid references mandate_comments(id) on delete cascade;

-- Replies don't have their own selection; they inherit context from the parent.
alter table mandate_comments
  alter column section_key drop not null,
  alter column quoted_text drop not null,
  alter column start_offset drop not null,
  alter column end_offset drop not null;

-- Root comments must have section/quoted/offsets; replies have parent_id.
alter table mandate_comments
  add constraint mandate_comments_root_has_section
  check (
    (parent_id is null and section_key is not null and quoted_text is not null and start_offset is not null and end_offset is not null)
    or (parent_id is not null)
  );

create index if not exists idx_mandate_comments_parent
  on mandate_comments (parent_id);
