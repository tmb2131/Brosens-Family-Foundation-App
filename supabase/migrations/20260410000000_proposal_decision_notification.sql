-- Add 'proposal_decision' to email_notification_type enum
alter type email_notification_type add value if not exists 'proposal_decision';
