alter table grant_proposals
add column if not exists proposal_title text,
add column if not exists proposal_description text,
add column if not exists proposal_website text,
add column if not exists proposal_charity_navigator_url text;

update grant_proposals as gp
set
  proposal_title = coalesce(nullif(trim(gp.proposal_title), ''), nullif(trim(gm.title), ''), 'Untitled Proposal'),
  proposal_description = coalesce(gp.proposal_description, gm.description, '')
from grants_master as gm
where
  gm.id = gp.grant_master_id
  and (
    gp.proposal_title is null
    or nullif(trim(gp.proposal_title), '') is null
    or gp.proposal_description is null
  );

update grant_proposals as gp
set
  proposal_website = coalesce(gp.proposal_website, org.website),
  proposal_charity_navigator_url = coalesce(gp.proposal_charity_navigator_url, org.charity_navigator_url)
from organizations as org
where
  org.id = gp.organization_id
  and (
    gp.proposal_website is null
    or gp.proposal_charity_navigator_url is null
  );

update grant_proposals
set
  proposal_title = coalesce(nullif(trim(proposal_title), ''), 'Untitled Proposal'),
  proposal_description = coalesce(proposal_description, '')
where
  proposal_title is null
  or nullif(trim(proposal_title), '') is null
  or proposal_description is null;

alter table grant_proposals
alter column proposal_title set default 'Untitled Proposal',
alter column proposal_title set not null,
alter column proposal_description set default '',
alter column proposal_description set not null;
