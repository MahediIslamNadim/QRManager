-- Add daily report notification flag to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS notify_daily_report BOOLEAN DEFAULT FALSE;

-- Enable pg_cron and pg_net extensions (if not already enabled)
-- Note: These must be enabled in Supabase Dashboard → Database → Extensions first
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily report at 9:00 PM Bangladesh time (3:00 PM UTC = 15:00 UTC)
-- Uncomment after enabling extensions:
/*
SELECT cron.schedule(
  'daily-sales-report',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ulkihqfffnrboqjmrcbk.supabase.co/functions/v1/daily-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
*/
