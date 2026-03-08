-- Bypass track changes: update mandate wording in place (no new version, no notifications).
-- FROM: "maintains policy, oversees process, and approves or declines discretionary proposals during meetings."
-- TO:   "maintains policy, oversees process, and marks proposals approved or declined during meetings."

-- 1) Update current mandate policy document content (rolesAndResponsibilities section only)
UPDATE policy_documents
SET
  content = jsonb_set(
    content,
    '{rolesAndResponsibilities}',
    to_jsonb(
      replace(
        content->>'rolesAndResponsibilities',
        'approves or declines discretionary proposals',
        'marks proposals approved or declined'
      )
    )
  ),
  updated_at = now()
WHERE slug = 'mandate'
  AND content->>'rolesAndResponsibilities' LIKE '%approves or declines discretionary proposals%';

-- 2) Update existing policy_changes so history/diffs show the new wording (no leftover "track change" for this phrase)
UPDATE policy_changes
SET
  next_content = jsonb_set(
    next_content,
    '{rolesAndResponsibilities}',
    to_jsonb(
      replace(
        next_content->>'rolesAndResponsibilities',
        'approves or declines discretionary proposals',
        'marks proposals approved or declined'
      )
    )
  )
WHERE policy_document_id = (SELECT id FROM policy_documents WHERE slug = 'mandate' LIMIT 1)
  AND next_content->>'rolesAndResponsibilities' LIKE '%approves or declines discretionary proposals%';

UPDATE policy_changes
SET
  previous_content = jsonb_set(
    previous_content,
    '{rolesAndResponsibilities}',
    to_jsonb(
      replace(
        previous_content->>'rolesAndResponsibilities',
        'approves or declines discretionary proposals',
        'marks proposals approved or declined'
      )
    )
  )
WHERE policy_document_id = (SELECT id FROM policy_documents WHERE slug = 'mandate' LIMIT 1)
  AND previous_content->>'rolesAndResponsibilities' LIKE '%approves or declines discretionary proposals%';
