-- ============================================================
-- Branch Invitations: Policy Fix
-- Run this in Supabase SQL Editor
-- Date: April 26, 2026
-- ============================================================

-- Step 1: Drop existing policies (safe — IF EXISTS guards against errors)
DROP POLICY IF EXISTS "group_owner_manage_invitations" ON branch_invitations;
DROP POLICY IF EXISTS "super_admin_all_invitations" ON branch_invitations;

-- Step 2: group_owner can manage their own group's invitations
CREATE POLICY "group_owner_manage_invitations"
  ON branch_invitations
  FOR ALL
  TO authenticated
  USING (
    group_id IN (
      SELECT id FROM restaurant_groups
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT id FROM restaurant_groups
      WHERE owner_id = auth.uid()
    )
  );

-- Step 3: super_admin can manage ALL invitations (WITH CHECK added — was missing before)
CREATE POLICY "super_admin_all_invitations"
  ON branch_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );
