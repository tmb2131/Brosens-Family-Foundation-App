-- frank_deenie_donations: return tracking columns
ALTER TABLE frank_deenie_donations
  ADD COLUMN return_group_id uuid,
  ADD COLUMN return_role text,
  ADD COLUMN returned_at date,
  ADD COLUMN return_source_id uuid;

ALTER TABLE frank_deenie_donations
  DROP CONSTRAINT frank_deenie_donations_amount_check;

ALTER TABLE frank_deenie_donations
  ADD CONSTRAINT frank_deenie_donations_amount_check
    CHECK (amount >= 0 OR return_role = 'reversal');

ALTER TABLE frank_deenie_donations
  ADD CONSTRAINT frank_deenie_donations_return_role_check
    CHECK (return_role IS NULL OR return_role IN ('original', 'reversal', 'replacement'));

CREATE INDEX idx_frank_deenie_donations_return_group
  ON frank_deenie_donations (return_group_id) WHERE return_group_id IS NOT NULL;

-- grant_proposals: return tracking columns
ALTER TABLE grant_proposals
  ADD COLUMN returned_at date,
  ADD COLUMN return_group_id uuid;

CREATE INDEX idx_grant_proposals_return_group
  ON grant_proposals (return_group_id) WHERE return_group_id IS NOT NULL;
