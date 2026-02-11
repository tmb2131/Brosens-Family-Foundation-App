alter table grant_proposals
add column if not exists sent_at date;

create index if not exists idx_grant_proposals_sent_at
on grant_proposals (sent_at);
