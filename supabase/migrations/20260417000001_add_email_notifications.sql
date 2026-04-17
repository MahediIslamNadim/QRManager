-- Add email notification settings to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notification_email TEXT DEFAULT NULL;
