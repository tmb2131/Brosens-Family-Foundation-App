-- Add 'proposal_submitted_confirmation' to email_notification_type enum
alter type email_notification_type add value if not exists 'proposal_submitted_confirmation';
