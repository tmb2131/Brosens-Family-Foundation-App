-- Rebucket legacy directional category values to align with NTEE broad labels.
-- We repurpose:
--   housing       -> Human Services
--   food_security -> Public & Societal Benefit
-- Prior categorization used food_security for human-services style orgs, so move those first.

update organizations
set directional_category = 'housing',
    directional_category_updated_at = now()
where directional_category = 'food_security';
