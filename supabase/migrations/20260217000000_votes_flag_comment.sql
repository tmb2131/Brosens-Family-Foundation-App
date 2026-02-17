-- Optional comment when a member flags a discretionary proposal for discussion.
alter table votes
  add column if not exists flag_comment text;

comment on column votes.flag_comment is 'Optional comment when choice is flagged (discretionary proposals).';
