import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Shield, Pencil, Trash2, UserPlus, Mail, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

const ROLE_PRIORITY = ["super_admin", "admin", "waiter", "kitchen"] as const;
const EDITABLE_ROLES = ["admin", "waiter", "kitchen"] as const;

const getRolePriority = (role: string) => {
  const index = ROLE_PRIORITY.indexOf(role as (typeof ROLE_PRIORITY)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const isEditableRole = (role: string): role is (typeof EDITABLE_ROLES)[number] =>
  EDITABLE_ROLES.includes(role as (typeof EDITABLE_ROLES)[number]);

const SuperAdminUsers = () => {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");

  // ✅ Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "invites">("users");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone, created_at");
      if (!profiles) return [];

      const roleMap = new Map<string, string>();
      for (const roleRow of roles || []) {
        const currentRole = roleMap.get(roleRow.user_id);
        if (!currentRole || getRolePriority(roleRow.role) < getRolePriority(currentRole)) {
          roleMap.set(roleRow.user_id, roleRow.role);
        }
      }

      return profiles.map(p => {
        return { ...p, role: roleMap.get(p.id) || "user" };
      });
    },
  });

  // ✅ Fetch invites
  const { data: invites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_invites" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  // ✅ Send invite mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim()) throw new Error("ইমেইল দিন");

      // Check if already invited
      const { data: existing } = await supabase
        .from("admin_invites" as any)
        .select("id, status")
        .eq("email", inviteEmail.trim())
        .eq("status", "pending")
        .maybeSingle();

      if (existing) throw new Error("এই ইমেইলে ইতিমধ্যে একটি pending invite আছে");

      // Create invite record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days valid

      const { data: invite, error } = await supabase
        .from("admin_invites" as any)
        .insert({
          email: inviteEmail.trim(),
          invited_name: inviteName.trim() || null,
          status: "pending",
          expires_at: expiresAt.toISOString(),
        } as any)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Note: sending actual email requires Supabase admin SDK (server-side only)

      // Use resetPasswordForEmail as invite mechanism
      const inviteLink = `${window.location.origin}/login?invite=${(invite as any).id}`;

      // Copy invite link to clipboard as fallback
      await navigator.clipboard.writeText(inviteLink).catch(() => {});

      return invite;
    },
    onSuccess: () => {
      toast.success("ইনভাইট তৈরি হয়েছে! লিংক কপি করা হয়েছে।");
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
    onError: (err: any) => toast.error(err.message || "ইনভাইট পাঠাতে সমস্যা হয়েছে"),
  });

  // ✅ Cancel invite
  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_invites" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ইনভাইট বাতিল করা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
  });

  // ✅ Copy invite link
  const copyInviteLink = (inviteId: string) => {
    const link = `${window.location.origin}/login?invite=${inviteId}`;
    navigator.clipboard.writeText(link);
    toast.success("ইনভাইট লিংক কপি হয়েছে!");
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const updates: Record<string, string> = {
        full_name: editName,
        phone: editPhone,
      };

      if (isEditableRole(editUser.role) && isEditableRole(editRole) && editRole !== editUser.role) {
        updates.role = editRole;
      }

      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "update",
          user_id: editUser.id,
          updates,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("ব্যবহারকারী আপডেট হয়েছে");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err: any) => toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("ব্যবহারকারী মুছে ফেলা হয়েছে");
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err: any) => toast.error(err.message || "মুছতে সমস্যা হয়েছে"),
  });

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditName(user.full_name || "");
    setEditPhone(user.phone || "");
    setEditRole(user.role);
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "সুপার অ্যাডমিন";
      case "admin": return "অ্যাডমিন";
      case "waiter": return "ওয়েটার";
      default: return "ব্যবহারকারী";
    }
  };

  const inviteStatusBadge = (status: string, expiresAt: string) => {
    const expired = new Date(expiresAt) < new Date();
    if (status === "accepted") return { label: "গৃহীত", color: "bg-success/10 text-success border-success/20", icon: CheckCircle };
    if (status === "cancelled") return { label: "বাতিল", color: "bg-muted text-muted-foreground border-border", icon: XCircle };
    if (expired) return { label: "মেয়াদ শেষ", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle };
    return { label: "অপেক্ষমান", color: "bg-warning/10 text-warning border-warning/20", icon: Clock };
  };

  const pendingInvites = (invites as any[]).filter((i: any) => i.status === "pending" && new Date(i.expires_at) > new Date()).length;

  return (
    <DashboardLayout role="super_admin" title="ব্যবহারকারী">
      <div className="space-y-6 animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-2xl font-bold text-foreground">ব্যবহারকারী ম্যানেজমেন্ট</h2>
          <Button variant="hero" onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4" /> নতুন অ্যাডমিন ইনভাইট
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              সকল ব্যবহারকারী ({users.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("invites")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "invites"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              ইনভাইট
              {pendingInvites > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-xs font-bold">{pendingInvites}</span>
              )}
            </span>
          </button>
        </div>

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <div className="grid gap-3">
            {isLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}
            {users.map((u: User) => (
              <Card key={u.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{u.full_name || "N/A"}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.role === "super_admin" ? "default" : "secondary"}>
                      {roleLabel(u.role)}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isLoading && users.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">কোনো ব্যবহারকারী নেই</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── INVITES TAB ── */}
        {activeTab === "invites" && (
          <div className="grid gap-3">
            {invitesLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}
            {!invitesLoading && (invites as any[]).length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <Mail className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">কোনো ইনভাইট নেই</p>
                  <Button variant="hero" className="mt-4" onClick={() => setShowInvite(true)}>
                    <UserPlus className="w-4 h-4" /> প্রথম ইনভাইট পাঠান
                  </Button>
                </CardContent>
              </Card>
            )}
            {(invites as any[]).map((invite: any) => {
              const statusInfo = inviteStatusBadge(invite.status, invite.expires_at);
              const StatusIcon = statusInfo.icon;
              const isPending = invite.status === "pending" && new Date(invite.expires_at) > new Date();
              return (
                <Card key={invite.id}>
                  <CardContent className="flex items-center justify-between p-4 flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{invite.invited_name || invite.email}</p>
                        <p className="text-sm text-muted-foreground">{invite.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(invite.created_at).toLocaleDateString("bn-BD")} •
                          মেয়াদ: {new Date(invite.expires_at).toLocaleDateString("bn-BD")}
                        </p>
                        {invite.restaurant_name && (
                          <p className="text-xs text-success mt-0.5">🏪 {invite.restaurant_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                      {isPending && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.id)}>
                            <Send className="w-3 h-3" /> লিংক কপি
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelInvite.mutate(invite.id)}>
                            <XCircle className="w-3 h-3" /> বাতিল
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">নতুন অ্যাডমিন ইনভাইট করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
              ইনভাইট লিংক তৈরি হবে — লিংকটি admin কে পাঠান। লিংকে click করে signup করলে তার account তৈরি হবে।
            </div>
            <div className="space-y-2">
              <Label>ইমেইল <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="admin@restaurant.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>নাম (ঐচ্ছিক)</Label>
              <Input
                placeholder="রেস্টুরেন্ট অ্যাডমিনের নাম"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
              />
            </div>
            <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-xs text-warning">
              ⚠ ইনভাইট লিংক ৭ দিন valid থাকবে। তারপর expire হবে।
            </div>
            <Button
              variant="hero"
              className="w-full"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
            >
              {inviteMutation.isPending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> তৈরি হচ্ছে...</>
              ) : (
                <><UserPlus className="w-4 h-4" /> ইনভাইট লিংক তৈরি করুন</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">ব্যবহারকারী এডিট করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>নাম</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ফোন</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ভূমিকা</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">সুপার অ্যাডমিন</SelectItem>
                  <SelectItem value="admin">অ্যাডমিন</SelectItem>
                  <SelectItem value="waiter">ওয়েটার</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" variant="hero" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "আপডেট হচ্ছে..." : "আপডেট করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যবহারকারী মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser?.full_name || deleteUser?.email} — এই ব্যবহারকারীকে মুছে ফেললে তার সব তথ্য মুছে যাবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteUser) deleteMutation.mutate(deleteUser.id); }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "মুছছে..." : "মুছে ফেলুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SuperAdminUsers;
