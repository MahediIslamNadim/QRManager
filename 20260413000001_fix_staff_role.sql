-- Fix Staff Management Role Column Issue
-- Run this in Supabase SQL Editor

-- Add role column to staff_restaurants table
ALTER TABLE staff_restaurants 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'waiter' 
CHECK (role IN ('admin', 'waiter', 'kitchen'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_restaurants_role 
ON staff_restaurants(role);

-- Update existing records to have default role
UPDATE staff_restaurants 
SET role = 'waiter' 
WHERE role IS NULL;

SELECT 'Staff role column added successfully!' AS result;
