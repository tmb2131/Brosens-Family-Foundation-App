-- RPC functions for "giving year" (Feb 1 – Jan 31) distinct year extraction.
-- A giving year is derived by subtracting one month: January dates map to the prior year.

CREATE OR REPLACE FUNCTION get_distinct_frank_deenie_giving_years()
RETURNS TABLE(year int) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT EXTRACT(YEAR FROM donation_date - INTERVAL '1 month')::int AS year
  FROM frank_deenie_donations
  WHERE donation_date IS NOT NULL
  ORDER BY year;
$$;

CREATE OR REPLACE FUNCTION get_distinct_children_giving_years()
RETURNS TABLE(year int) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT
    EXTRACT(YEAR FROM COALESCE(
      CASE WHEN status = 'sent' THEN sent_at END,
      created_at
    ) - INTERVAL '1 month')::int AS year
  FROM grant_proposals
  WHERE status IN ('sent', 'approved')
  ORDER BY year;
$$;
