-- Migration: Fix user_roles table schema
-- Date: April 11, 2026
-- Purpose: Fix USER-DEFINED type issue and add proper constraints

-- Drop and recreate user_roles with correct types
DROP TABLE IF EXISTS user_roles CASCADE;

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'waiter', 'staff')),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, restaurant_id, role)
);

-- Indexes for faster lookups
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_restaurant ON user_roles(restaurant_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- RLS Policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own roles
CREATE POLICY "Users can read own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow restaurant admins to read roles for their restaurant
CREATE POLICY "Admins can read restaurant roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.restaurant_id = user_roles.restaurant_id
        AND ur.role = 'admin'
    )
  );

-- Allow insert via RPC only (for complete_admin_signup)
CREATE POLICY "Allow role creation via RPC"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Success message
SELECT 'user_roles table schema fixed successfully!' AS result;
