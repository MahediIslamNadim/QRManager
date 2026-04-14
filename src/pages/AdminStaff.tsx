import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Crown, Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCanInviteStaff } from "@/hooks/useStaffLimit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StaffRole = "admin" | "waiter";
type StaffMember = {
  id: string;
  user_id: string;
  restaurant_id: string;
  created_at: string;
  role: string;
  users: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

const AdminStaff = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();

  const {
    canAdd: canInviteStaff,
    currentCount: staffCount,
    maxStaff,
    tier,
    isAtLimit,
    upgradeMessage,
    loading: limitLoading,
    checkBeforeInvite,
  } = useCanInviteStaff(restaurantId);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("waiter");

  const { data: staffMembers = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      let staffRows: Array<{
        id: string;
        user_id: string;
        restaurant_id: string;
        created_at: string;
        role?: string | null;
      }> = [];

      const result = await supabase
        .from("staff_restaurants")
        .select("id, user_id, restaurant_id, role, created_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (result.error) {
        const fallback = await supabase
          .from("staff_restaurants")
          .select("id, user_id, restaurant_id, created_at")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false });

        if (fallback.error) throw fallback.error;
        staffRows = (fallback.data || []).map((row) => ({ ...row, role: null }));
      } else {
        staffRows = result.data || [];
      }

      if (staffRows.length === 0) return [];

      const userIds = staffRows.map((row) => row.user_id);
      const [{ data: profiles }, { data: roleRows, error: roleError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds),
      ]);

      if (roleError) {
        console.warn("Staff role lookup failed:", roleError.message);
      }

      const roleMap = new Map((roleRows || []).map((row) => [row.user_id, row.role]));

      return staffRows.map((row) => ({
        ...row,
        role: row.role || roleMap.get(row.user_id) || "waiter",
        users: profiles?.find((profile) => profile.id === row.user_id) || null,
      }));
    },
    enabled: !!restaurantId,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");

      const normalizedEmail = inviteEmail.trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Please enter an email address.");

      const check = checkBeforeInvite();
      if (!check.allowed) {
        throw new Error(upgradeMessage || "Staff limit reached. Please upgrade to add more staff.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        throw new Error(
          `No QRManager account was found for "${normalizedEmail}". Ask the staff member to sign up first, then add them again here.`,
        );
      }

      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: {
          email: normalizedEmail,
          role: inviteRole,
          restaurant_id: restaurantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { already_exists?: boolean; role_updated?: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });

      if (result?.already_exists) {
        toast.success("This staff member is already linked to your restaurant.");
      } else if (result?.role_updated) {
        toast.success("Staff access was synced and their role was updated.");
      } else {
        toast.success("Staff member added successfully.");
      }

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("waiter");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (staff: Pick<StaffMember, "id" | "user_id">) => {
      if (!restaurantId) throw new Error("No restaurant");

      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: {
          action: "remove",
          user_id: staff.user_id,
          restaurant_id: restaurantId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as {
        link_removed?: boolean;
        role_revoked?: boolean;
        role_preserved_reason?: "super_admin" | "restaurant_owner" | "other_staff_links" | null;
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });

      if (result?.role_revoked) {
        toast.success("Staff member removed and their restaurant staff access was revoked.");
      } else if (result?.role_preserved_reason === "other_staff_links") {
        toast.success("Staff member removed from this restaurant. Their app role was kept because they still belong to another restaurant.");
      } else if (
        result?.role_preserved_reason === "restaurant_owner" ||
        result?.role_preserved_reason === "super_admin"
      ) {
        toast.success("Staff link removed. Elevated access was preserved for this user.");
      } else {
        toast.success("Staff member removed.");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return Crown;
      case "waiter":
        return Users;
      case "kitchen":
        return Shield;
      default:
        return Users;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "text-purple-600 bg-purple-100";
      case "waiter":
        return "text-blue-600 bg-blue-100";
      case "kitchen":
        return "text-orange-600 bg-orange-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <DashboardLayout role="admin" title="Staff Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              Add existing QRManager accounts to your restaurant and manage their roles.
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
              Add Staff
            </Button>
          </div>
        </div>

        {isAtLimit && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <span className="font-semibold text-warning">Staff Limit Reached</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {upgradeMessage || `You've reached the maximum of ${maxStaff} staff members for your current tier.`}
            </p>
            {tier === "medium_smart" && (
              <Button
                variant="default"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  toast.info("Upgrade feature coming soon!");
                }}
              >
                Upgrade to High Smart
              </Button>
            )}
          </div>
        )}

        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault();
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
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This email must already belong to a QRManager account. New staff should sign up first.
                </p>
              </div>

              <div>
                <Label>Role</Label>
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as StaffRole)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="waiter">Waiter - Can take orders and manage tables</option>
                  <option value="admin">Admin - Full access to staff-facing features</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? "Adding..." : "Add Staff Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading staff members...</div>
        ) : staffMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No staff members yet. Add someone who already has a QRManager account to get started.
              </p>
              <Button onClick={() => setShowInviteDialog(true)} variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Staff Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {staffMembers.map((staff) => {
              const RoleIcon = getRoleIcon(staff.role);
              const roleColor = getRoleColor(staff.role);

              return (
                <Card key={staff.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold text-lg">
                          {staff.users?.full_name?.[0]?.toUpperCase() || staff.users?.email?.[0]?.toUpperCase() || "U"}
                        </div>

                        <div>
                          <h3 className="font-semibold text-lg">{staff.users?.full_name || "Unknown User"}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {staff.users?.email || "No email"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${roleColor}`}>
                          <RoleIcon className="w-4 h-4" />
                          <span className="text-xs font-medium capitalize">{staff.role}</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remove ${staff.users?.full_name || "this staff member"}?`)) {
                              removeMutation.mutate({ id: staff.id, user_id: staff.user_id });
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

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-900">Supported Staff Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>Admin:</strong> Full access to menu, tables, staff, billing, and analytics.
            </p>
            <p>
              <strong>Waiter:</strong> Can take orders, manage tables, and view kitchen status.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminStaff;
