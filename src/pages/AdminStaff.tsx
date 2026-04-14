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

type StaffRole = "admin" | "waiter" | "kitchen";
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
  const [inviteFullName, setInviteFullName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
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
      if (!normalizedEmail) throw new Error("ইমেইল দিন।");

      const check = checkBeforeInvite();
      if (!check.allowed) {
        throw new Error(upgradeMessage || "Staff limit reached. Please upgrade to add more staff.");
      }

      const body: Record<string, string> = {
        email: normalizedEmail,
        role: inviteRole,
        restaurant_id: restaurantId,
      };

      if (inviteFullName.trim()) body.full_name = inviteFullName.trim();
      if (invitePassword.trim()) body.password = invitePassword.trim();

      const { data, error } = await supabase.functions.invoke("create-staff", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { already_exists?: boolean; role_updated?: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });

      if (result?.already_exists) {
        toast.success("এই স্টাফ ইতিমধ্যেই যুক্ত আছেন।");
      } else if (result?.role_updated) {
        toast.success("স্টাফের রোল আপডেট হয়েছে।");
      } else {
        toast.success("স্টাফ সফলভাবে যোগ হয়েছে।");
      }

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteFullName("");
      setInvitePassword("");
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
              <DialogTitle>স্টাফ যোগ করুন</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                inviteMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label>ইমেইল *</Label>
                <Input
                  type="email"
                  placeholder="staff@example.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
              </div>

              <div>
                <Label>পুরো নাম (ঐচ্ছিক)</Label>
                <Input
                  type="text"
                  placeholder="যেমন: Rahim Uddin"
                  value={inviteFullName}
                  onChange={(event) => setInviteFullName(event.target.value)}
                />
              </div>

              <div>
                <Label>পাসওয়ার্ড</Label>
                <Input
                  type="password"
                  placeholder="নতুন স্টাফ হলে পাসওয়ার্ড দিন"
                  value={invitePassword}
                  onChange={(event) => setInvitePassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  স্টাফের আগে থেকে অ্যাকাউন্ট থাকলে পাসওয়ার্ড লাগবে না। নতুন হলে পাসওয়ার্ড দিন — অ্যাকাউন্ট তৈরি হয়ে যাবে।
                </p>
              </div>

              <div>
                <Label>ভূমিকা</Label>
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as StaffRole)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="waiter">ওয়েটার — অর্ডার ও টেবিল পরিচালনা</option>
                  <option value="kitchen">কিচেন — রান্নাঘরের ডিসপ্লে দেখতে পারবে</option>
                  <option value="admin">অ্যাডমিন — সব ফিচারে পূর্ণ অ্যাক্সেস</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? "যোগ হচ্ছে..." : "স্টাফ যোগ করুন"}
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
                এখনো কোনো স্টাফ নেই। স্টাফ যোগ করুন।
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
