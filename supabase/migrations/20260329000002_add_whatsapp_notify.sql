-- Add WhatsApp notification fields to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT,
  ADD COLUMN IF NOT EXISTS notify_new_order BOOLEAN DEFAULT FALSE;
