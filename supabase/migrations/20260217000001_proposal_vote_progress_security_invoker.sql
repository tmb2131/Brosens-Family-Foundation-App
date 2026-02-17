-- Fix Security Definer warning: make proposal_vote_progress run as the querying user
-- so RLS on grant_proposals and votes is enforced (no bypass of row-level security).
-- Requires PostgreSQL 15+ (Supabase default).
alter view proposal_vote_progress set (security_invoker = on);
