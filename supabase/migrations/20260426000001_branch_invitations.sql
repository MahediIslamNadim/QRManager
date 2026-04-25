-- Branch Admin Invitation System
-- Created: April 26, 2026
-- Purpose: Track invitations sent by head office (group_owner) to branch admins

CREATE TABLE IF NOT EXISTS branch_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES restaurant_groups(id) ON DELETE CASCADE,
  restaurant_id   uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  invited_email   text        NOT NULL,
  invited_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,

  -- Prevent duplicate invitations for same email + branch
  UNIQUE (restaurant_id, invited_email)
);

-- Index for fast lookup by group
CREATE INDEX IF NOT EXISTS idx_branch_invitations_group_id
  ON branch_invitations (group_id);

-- Index for fast lookup by restaurant
CREATE INDEX IF NOT EXISTS idx_branch_invitations_restaurant_id
  ON branch_invitations (restaurant_id);

-- Enable RLS
ALTER TABLE branch_invitations ENABLE ROW LEVEL SECURITY;

-- group_owner can manage invitations for their own groups
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

-- super_admin can see and manage all invitations
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
  );

-- Auto-expire pending invitations older than 7 days
-- (handled by a simple check in the app, no cron needed)

COMMENT ON TABLE branch_invitations IS
  'Tracks branch admin invitations sent by head office (group_owner) to manage specific branches';
