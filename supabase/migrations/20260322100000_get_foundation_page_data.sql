-- Single RPC that returns all foundation page data in one database round-trip.
-- Replaces ~22 individual HTTP calls per page load.

create or replace function get_foundation_page_data(
  p_budget_year int default null,
  p_user_id uuid default null,
  p_include_all_years boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resolved_year int;
begin
  -- Resolve the active budget year (mirrors getBudgetForYearOrDefault logic):
  --   1) Use p_budget_year when explicitly provided
  --   2) Try the current calendar year
  --   3) Fall back to the most recent budget year
  if p_budget_year is not null then
    v_resolved_year := p_budget_year;
  else
    v_resolved_year := extract(year from now())::int;
    if not exists (select 1 from budgets where budget_year = v_resolved_year) then
      select budget_year into v_resolved_year
      from budgets order by budget_year desc limit 1;
    end if;
  end if;

  return (
    with

    budget_data as (
      select id, budget_year, annual_fund_size, rollover_from_previous_year,
             joint_ratio, discretionary_ratio, meeting_reveal_enabled
      from budgets
      where budget_year = v_resolved_year
      limit 1
    ),

    avail_years as (
      select distinct yr from (
        select budget_year as yr from budgets
        union
        select budget_year as yr from grant_proposals
        union
        select p_budget_year as yr where p_budget_year is not null
      ) t
      where yr is not null
    ),

    voting_members as (
      select id from user_profiles where role in ('member', 'oversight')
    ),

    main_proposals as (
      select id, grant_master_id, organization_id, proposer_id, budget_year,
             proposal_type, allocation_mode, status, reveal_votes, final_amount,
             notes, sent_at, returned_at, proposal_title, proposal_description,
             proposal_website, proposal_charity_navigator_url, created_at
      from grant_proposals
      where case
        when p_include_all_years then true
        when v_resolved_year is not null then budget_year = v_resolved_year
        else false
      end
    ),

    hist_proposals as (
      select id, grant_master_id, organization_id, proposer_id, budget_year,
             proposal_type, allocation_mode, status, reveal_votes, final_amount,
             notes, sent_at, returned_at, proposal_title, proposal_description,
             proposal_website, proposal_charity_navigator_url, created_at
      from grant_proposals
      where status in ('approved', 'sent')
    ),

    pending_proposals as (
      select id, grant_master_id, organization_id, proposer_id, budget_year,
             proposal_type, allocation_mode, status, reveal_votes, final_amount,
             notes, sent_at, returned_at, proposal_title, proposal_description,
             proposal_website, proposal_charity_navigator_url, created_at
      from grant_proposals
      where status in ('to_review', 'approved')
    ),

    user_own_votes as (
      select id, proposal_id, voter_id, choice, allocation_amount, created_at, flag_comment
      from votes
      where p_user_id is not null and voter_id = p_user_id
    ),

    user_submitted as (
      select id, grant_master_id, organization_id, proposer_id, budget_year,
             proposal_type, allocation_mode, status, reveal_votes, final_amount,
             notes, sent_at, returned_at, proposal_title, proposal_description,
             proposal_website, proposal_charity_navigator_url, created_at
      from grant_proposals
      where p_user_id is not null and proposer_id = p_user_id
    ),

    user_voted_props as (
      select id, grant_master_id, organization_id, proposer_id, budget_year,
             proposal_type, allocation_mode, status, reveal_votes, final_amount,
             notes, sent_at, returned_at, proposal_title, proposal_description,
             proposal_website, proposal_charity_navigator_url, created_at
      from grant_proposals
      where id in (select distinct proposal_id from user_own_votes)
    ),

    all_prop_ids as (
      select id from main_proposals
      union
      select id from hist_proposals
      union
      select id from pending_proposals
      union
      select id from user_submitted
      union
      select id from user_voted_props
    ),

    all_grants as (
      select g.id, g.title, g.description
      from grants_master g
      where g.id in (
        select distinct gp.grant_master_id
        from grant_proposals gp
        where gp.id in (select id from all_prop_ids)
      )
    ),

    all_orgs as (
      select o.id, o.name, o.website, o.charity_navigator_score,
             o.charity_navigator_url, o.cause_area, o.directional_category,
             o.directional_category_source, o.directional_category_confidence,
             o.directional_category_locked, o.directional_category_updated_at
      from organizations o
      where o.id in (
        select distinct gp.organization_id
        from grant_proposals gp
        where gp.id in (select id from all_prop_ids)
          and gp.organization_id is not null
      )
    ),

    all_votes as (
      select v.id, v.proposal_id, v.voter_id, v.choice, v.allocation_amount,
             v.created_at, v.flag_comment
      from votes v
      where v.proposal_id in (select id from all_prop_ids)
    ),

    voter_profs as (
      select distinct up.id, up.full_name, up.email
      from user_profiles up
      where up.id in (select distinct voter_id from all_votes)
    ),

    proposer_profs as (
      select distinct up.id, up.email
      from user_profiles up
      where up.id in (
        select distinct gp.proposer_id
        from grant_proposals gp
        where gp.id in (select id from all_prop_ids)
      )
    )

    select jsonb_build_object(
      'budget',
      (select jsonb_build_object(
         'id', b.id,
         'budget_year', b.budget_year,
         'annual_fund_size', b.annual_fund_size,
         'rollover_from_previous_year', b.rollover_from_previous_year,
         'joint_ratio', b.joint_ratio,
         'discretionary_ratio', b.discretionary_ratio,
         'meeting_reveal_enabled', b.meeting_reveal_enabled
       ) from budget_data b),

      'availableBudgetYears',
      coalesce(
        (select jsonb_agg(yr order by yr desc) from avail_years),
        jsonb_build_array(extract(year from now())::int)
      ),

      'votingMemberIds',
      coalesce((select jsonb_agg(id) from voting_members), '[]'::jsonb),

      'proposals',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'grant_master_id', p.grant_master_id,
        'organization_id', p.organization_id, 'proposer_id', p.proposer_id,
        'budget_year', p.budget_year, 'proposal_type', p.proposal_type,
        'allocation_mode', p.allocation_mode, 'status', p.status,
        'reveal_votes', p.reveal_votes, 'final_amount', p.final_amount,
        'notes', p.notes, 'sent_at', p.sent_at, 'returned_at', p.returned_at,
        'proposal_title', p.proposal_title,
        'proposal_description', p.proposal_description,
        'proposal_website', p.proposal_website,
        'proposal_charity_navigator_url', p.proposal_charity_navigator_url,
        'created_at', p.created_at
      ) order by p.created_at desc) from main_proposals p), '[]'::jsonb),

      'pendingProposals',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'grant_master_id', p.grant_master_id,
        'organization_id', p.organization_id, 'proposer_id', p.proposer_id,
        'budget_year', p.budget_year, 'proposal_type', p.proposal_type,
        'allocation_mode', p.allocation_mode, 'status', p.status,
        'reveal_votes', p.reveal_votes, 'final_amount', p.final_amount,
        'notes', p.notes, 'sent_at', p.sent_at, 'returned_at', p.returned_at,
        'proposal_title', p.proposal_title,
        'proposal_description', p.proposal_description,
        'proposal_website', p.proposal_website,
        'proposal_charity_navigator_url', p.proposal_charity_navigator_url,
        'created_at', p.created_at
      ) order by p.budget_year desc, p.created_at desc) from pending_proposals p), '[]'::jsonb),

      'grants',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', g.id, 'title', g.title, 'description', g.description
      )) from all_grants g), '[]'::jsonb),

      'organizations',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'website', o.website,
        'charity_navigator_score', o.charity_navigator_score,
        'charity_navigator_url', o.charity_navigator_url,
        'cause_area', o.cause_area,
        'directional_category', o.directional_category,
        'directional_category_source', o.directional_category_source,
        'directional_category_confidence', o.directional_category_confidence,
        'directional_category_locked', o.directional_category_locked,
        'directional_category_updated_at', o.directional_category_updated_at
      )) from all_orgs o), '[]'::jsonb),

      'votes',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'proposal_id', v.proposal_id, 'voter_id', v.voter_id,
        'choice', v.choice, 'allocation_amount', v.allocation_amount,
        'created_at', v.created_at, 'flag_comment', v.flag_comment
      )) from all_votes v), '[]'::jsonb),

      'voterProfiles',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', vp.id, 'full_name', vp.full_name, 'email', vp.email
      )) from voter_profs vp), '[]'::jsonb),

      'proposerProfiles',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', pp.id, 'email', pp.email
      )) from proposer_profs pp), '[]'::jsonb),

      'historyProposals',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', hp.id, 'grant_master_id', hp.grant_master_id,
        'organization_id', hp.organization_id, 'proposer_id', hp.proposer_id,
        'budget_year', hp.budget_year, 'proposal_type', hp.proposal_type,
        'allocation_mode', hp.allocation_mode, 'status', hp.status,
        'reveal_votes', hp.reveal_votes, 'final_amount', hp.final_amount,
        'notes', hp.notes, 'sent_at', hp.sent_at, 'returned_at', hp.returned_at,
        'proposal_title', hp.proposal_title,
        'proposal_description', hp.proposal_description,
        'proposal_website', hp.proposal_website,
        'proposal_charity_navigator_url', hp.proposal_charity_navigator_url,
        'created_at', hp.created_at
      )) from hist_proposals hp), '[]'::jsonb),

      'userVotes',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', uv.id, 'proposal_id', uv.proposal_id, 'voter_id', uv.voter_id,
        'choice', uv.choice, 'allocation_amount', uv.allocation_amount,
        'created_at', uv.created_at, 'flag_comment', uv.flag_comment
      ) order by uv.created_at desc) from user_own_votes uv), '[]'::jsonb),

      'userSubmittedProposals',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', us.id, 'grant_master_id', us.grant_master_id,
        'organization_id', us.organization_id, 'proposer_id', us.proposer_id,
        'budget_year', us.budget_year, 'proposal_type', us.proposal_type,
        'allocation_mode', us.allocation_mode, 'status', us.status,
        'reveal_votes', us.reveal_votes, 'final_amount', us.final_amount,
        'notes', us.notes, 'sent_at', us.sent_at, 'returned_at', us.returned_at,
        'proposal_title', us.proposal_title,
        'proposal_description', us.proposal_description,
        'proposal_website', us.proposal_website,
        'proposal_charity_navigator_url', us.proposal_charity_navigator_url,
        'created_at', us.created_at
      ) order by us.created_at desc) from user_submitted us), '[]'::jsonb),

      'userVotedProposals',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', uvp.id, 'grant_master_id', uvp.grant_master_id,
        'organization_id', uvp.organization_id, 'proposer_id', uvp.proposer_id,
        'budget_year', uvp.budget_year, 'proposal_type', uvp.proposal_type,
        'allocation_mode', uvp.allocation_mode, 'status', uvp.status,
        'reveal_votes', uvp.reveal_votes, 'final_amount', uvp.final_amount,
        'notes', uvp.notes, 'sent_at', uvp.sent_at, 'returned_at', uvp.returned_at,
        'proposal_title', uvp.proposal_title,
        'proposal_description', uvp.proposal_description,
        'proposal_website', uvp.proposal_website,
        'proposal_charity_navigator_url', uvp.proposal_charity_navigator_url,
        'created_at', uvp.created_at
      )) from user_voted_props uvp), '[]'::jsonb)
    )
  );
end;
$$;
