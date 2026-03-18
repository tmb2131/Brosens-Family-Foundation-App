-- Efficient RPC functions to retrieve distinct years without full table scans.

CREATE OR REPLACE FUNCTION get_distinct_frank_deenie_years()
RETURNS TABLE(year int) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT EXTRACT(YEAR FROM donation_date)::int AS year
  FROM frank_deenie_donations
  WHERE donation_date IS NOT NULL
  ORDER BY year;
$$;

CREATE OR REPLACE FUNCTION get_distinct_children_years()
RETURNS TABLE(year int) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT
    EXTRACT(YEAR FROM COALESCE(
      CASE WHEN status = 'sent' THEN sent_at END,
      created_at
    ))::int AS year
  FROM grant_proposals
  WHERE status IN ('sent', 'approved')
  ORDER BY year;
$$;
