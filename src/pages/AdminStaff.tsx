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

      // Step 1: fetch staff rows
      const { data: staffRows, error: staffErr } = await supabase
        .from("staff_restaurants")
        .select("id, user_id, restaurant_id, created_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (staffErr) throw staffErr;
      if (!staffRows || staffRows.length === 0) return [];

      const userIds = staffRows.map((r) => r.user_id);

      // Step 2: fetch profiles (RLS policy "Admins can view staff profiles" allows this)
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesErr) {
        console.error("profiles fetch error:", profilesErr);
      }

      // Step 3: fetch roles
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (roleErr) {
        console.error("user_roles fetch error:", roleErr);
      }

      // Step 4: try RPC as best-effort for email (gets from auth.users directly)
      let rpcEmailMap: Record<string, string> = {};
      try {
        const { data: rpcRows, error: rpcError } = await (supabase as any)
          .rpc("get_restaurant_staff", { _restaurant_id: restaurantId });
        if (!rpcError && rpcRows) {
          for (const row of rpcRows) {
            if (row.email) rpcEmailMap[row.user_id] = row.email;
          }
        } else if (rpcError) {
          console.error("get_restaurant_staff RPC error:", rpcError);
        }
      } catch (e) {
        console.error("RPC call failed:", e);
      }

      const allowedRoles = ["admin", "waiter", "kitchen"] as const;
      const roleMap = new Map(
        (roleRows || [])
          .filter((r) => allowedRoles.includes(r.role as any))
          .map((r) => [r.user_id, r.role])
      );

      return staffRows.map((row) => {
        const profile = profiles?.find((p) => p.id === row.user_id);
        const email = profile?.email || rpcEmailMap[row.user_id] || null;
        const fullName = profile?.full_name || null;
        return {
          ...row,
          role: (roleMap.get(row.user_id) as string) || "waiter",
          users: email || fullName
            ? { id: row.user_id, full_name: fullName, email }
            : null,
        };
      });
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

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">স্টাফ রোলের বিবরণ</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Admin */}
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-purple-700">অ্যাডমিন</span>
                </div>
                <ul className="text-xs text-purple-800 space-y-1">
                  <li>✓ মেনু ও টেবিল ম্যানেজমেন্ট</li>
                  <li>✓ স্টাফ যোগ/বাদ দেওয়া</li>
                  <li>✓ অর্ডার ও অ্যানালিটিক্স</li>
                  <li>✓ বিলিং ও সেটিংস</li>
                </ul>
              </CardContent>
            </Card>

            {/* Waiter */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-semibold text-blue-700">ওয়েটার</span>
                </div>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>✓ অর্ডার গ্রহণ ও পরিচালনা</li>
                  <li>✓ টেবিল ও সিট ম্যানেজমেন্ট</li>
                  <li>✓ বিল ও পেমেন্ট গ্রহণ</li>
                  <li>✓ সার্ভিস রিকোয়েস্ট দেখা</li>
                </ul>
              </CardContent>
            </Card>

            {/* Kitchen */}
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="font-semibold text-orange-700">কিচেন</span>
                </div>
                <ul className="text-xs text-orange-800 space-y-1">
                  <li>✓ কিচেন ডিসপ্লে দেখা</li>
                  <li>✓ অর্ডার স্ট্যাটাস আপডেট</li>
                  <li>✓ রান্না সম্পন্ন মার্ক করা</li>
                  <li className="text-orange-400">✗ বিলিং ও স্টাফ অ্যাক্সেস নেই</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminStaff;
