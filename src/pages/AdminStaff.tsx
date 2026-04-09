// AdminStaff.tsx - Staff Management Page
import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useCanInviteStaff } from '@/hooks/useStaffLimit';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Mail, Trash2, Crown, Users, Shield, AlertTriangle } from 'lucide-react';

const AdminStaff = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();

  // Staff limit check
  const {
    canAdd: canInviteStaff,
    currentCount: staffCount,
    maxStaff,
    tier,
    isAtLimit,
    upgradeMessage,
    loading: limitLoading,
    checkBeforeInvite
  } = useCanInviteStaff(restaurantId);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'waiter' | 'kitchen'>('waiter');

  // Fetch staff members
  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ['staff', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      
      const { data, error } = await supabase
        .from('staff_restaurants')
        .select(`
          *,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId
  });

  // Invite staff mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No restaurant');
      
      // Check limit before inviting
      const check = checkBeforeInvite();
      if (!check.allowed) {
        throw new Error(upgradeMessage || 'Staff limit reached. Please upgrade to add more staff.');
      }

      // TODO: In production, this should:
      // 1. Send an email invitation
      // 2. Create a pending invitation record
      // 3. User accepts and creates account
      // For now, we'll just show a placeholder

      // Placeholder: Just insert a dummy record
      // In real implementation, you'd have an invitations table
      const { error } = await supabase
        .from('staff_restaurants')
        .insert({
          restaurant_id: restaurantId,
          user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
          role: inviteRole
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', restaurantId] });
      toast.success('Invitation sent! (Placeholder - real email invitation coming soon)');
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('waiter');
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  // Remove staff mutation
  const removeMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from('staff_restaurants')
        .delete()
        .eq('id', staffId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', restaurantId] });
      toast.success('Staff member removed');
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown;
      case 'waiter': return Users;
      case 'kitchen': return Shield;
      default: return Users;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-purple-600 bg-purple-100';
      case 'waiter': return 'text-blue-600 bg-blue-100';
      case 'kitchen': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <DashboardLayout role="admin" title="Staff Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              Manage your restaurant staff and their roles
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
              {staffCount}/{maxStaff} staff members
            </span>
            <Button
              onClick={() => setShowInviteDialog(true)}
              disabled={!canInviteStaff || limitLoading}
              variant="hero"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Staff
            </Button>
          </div>
        </div>

        {/* Limit Warning */}
        {isAtLimit && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <span className="font-semibold text-warning">Staff Limit Reached!</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {upgradeMessage || `You've reached the maximum of ${maxStaff} staff members for your current tier.`}
            </p>
            {tier === 'medium_smart' && (
              <Button
                variant="default"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  toast.info('Upgrade feature coming soon!');
                }}
              >
                Upgrade to High Smart → Unlimited Staff
              </Button>
            )}
          </div>
        )}

        {/* Invite Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="staff@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  An invitation email will be sent to this address
                </p>
              </div>

              <div>
                <Label>Role</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="waiter">Waiter - Can take orders & manage tables</option>
                  <option value="kitchen">Kitchen - Can view & update order status</option>
                  <option value="admin">Admin - Full access to all features</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Staff List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading staff members...
          </div>
        ) : staffMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No staff members yet. Invite your team to get started!
              </p>
              <Button onClick={() => setShowInviteDialog(true)} variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite First Staff Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {staffMembers.map((staff: any) => {
              const RoleIcon = getRoleIcon(staff.role);
              const roleColor = getRoleColor(staff.role);

              return (
                <Card key={staff.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold text-lg">
                          {staff.users?.full_name?.[0]?.toUpperCase() || staff.users?.email?.[0]?.toUpperCase() || 'U'}
                        </div>

                        {/* Info */}
                        <div>
                          <h3 className="font-semibold text-lg">
                            {staff.users?.full_name || 'Unknown User'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {staff.users?.email || 'No email'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Role Badge */}
                        <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${roleColor}`}>
                          <RoleIcon className="w-4 h-4" />
                          <span className="text-xs font-medium capitalize">{staff.role}</span>
                        </div>

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remove ${staff.users?.full_name || 'this staff member'}?`)) {
                              removeMutation.mutate(staff.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-900">Staff Roles Explained</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p><strong>👑 Admin:</strong> Full access - can manage menu, tables, staff, and view all analytics</p>
            <p><strong>👥 Waiter:</strong> Can take orders, manage tables, view kitchen status</p>
            <p><strong>🍳 Kitchen:</strong> Can view incoming orders and update cooking status</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminStaff;
