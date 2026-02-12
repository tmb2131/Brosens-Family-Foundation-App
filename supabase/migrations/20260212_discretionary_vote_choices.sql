-- Extend vote choices for discretionary meeting signaling.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'vote_choice'
      and e.enumlabel = 'acknowledged'
  ) then
    alter type vote_choice add value 'acknowledged';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'vote_choice'
      and e.enumlabel = 'flagged'
  ) then
    alter type vote_choice add value 'flagged';
  end if;
end
$$;

create or replace view proposal_vote_progress as
select
  gp.id as proposal_id,
  count(v.id)::int as votes_submitted,
  sum(case when v.choice::text = 'yes' then 1 else 0 end)::int as yes_votes,
  sum(case when v.choice::text = 'no' then 1 else 0 end)::int as no_votes,
  round(avg(v.allocation_amount), 2) as avg_allocation,
  round(sum(v.allocation_amount), 2) as sum_allocation,
  sum(case when v.choice::text = 'acknowledged' then 1 else 0 end)::int as acknowledged_votes,
  sum(case when v.choice::text = 'flagged' then 1 else 0 end)::int as flagged_votes
from grant_proposals gp
left join votes v on v.proposal_id = gp.id
group by gp.id;
