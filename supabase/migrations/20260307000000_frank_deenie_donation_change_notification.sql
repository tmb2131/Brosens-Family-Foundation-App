-- Add 'frank_deenie_donation_change' to email_notification_type enum
-- (oversight notification when non-oversight users modify F&D donations)
alter type email_notification_type add value if not exists 'frank_deenie_donation_change';
