import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Crown, Mail, Trash2, UserPlus,
  Users, ChefHat, RefreshCw, Search, Calendar,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  role: StaffRole;
  users: { id: string; full_name: string | null; email: string | null } | null;
};

const ROLES: { value: StaffRole; label: string; icon: any; color: string; bg: string; desc: string }[] = [
  {
    value: "admin",
    label: "\u0985\u09cd\u09af\u09be\u09a1\u09ae\u09bf\u09a8",
    icon: Crown,
    color: "text-purple-500",
    bg: "bg-purple-500/15 text-purple-500 border-purple-500/30",
    desc: "\u09b8\u09ac \u09ab\u09bf\u099a\u09be\u09b0\u09c7 \u09aa\u09c2\u09b0\u09cd\u09a3 \u0985\u09cd\u09af\u09be\u0995\u09cd\u09b8\u09c7\u09b8",
  },
  {
    value: "waiter",
    label: "\u0993\u09af\u09bc\u09c7\u099f\u09be\u09b0",
    icon: Users,
    color: "text-primary",
    bg: "bg-primary/15 text-primary border-primary/30",
    desc: "\u0985\u09b0\u09cd\u09a1\u09be\u09b0, \u099f\u09c7\u09ac\u09bf\u09b2 \u0993 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f",
  },
  {
    value: "kitchen",
    label: "\u0995\u09bf\u099a\u09c7\u09a8",
    icon: ChefHat,
    color: "text-warning",
    bg: "bg-warning/15 text-warning border-warning/30",
    desc: "\u0995\u09bf\u099a\u09c7\u09a8 \u09a1\u09bf\u09b8\u09aa\u09cd\u09b2\u09c7 \u0993 \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u09b8\u09cd\u099f\u09cd\u09af\u09be\u099f\u09be\u09b8",
  },
];

const getRoleConfig = (role: string) =>
  ROLES.find(r => r.value === role) || ROLES[1];

const avatarInitials = (staff: StaffMember) => {
  const name = staff.users?.full_name || staff.users?.email || "U";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  "from-purple-500/60 to-purple-600/40",
  "from-primary/60 to-primary/40",
  "from-success/60 to-success/40",
  "from-warning/60 to-warning/40",
  "from-blue-500/60 to-blue-600/40",
];

export default function AdminStaff() {
  const { restaurantId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // FIX 1: maxStaffDisplay added
  const {
    canAdd: canInviteStaff,
    currentCount: staffCount,
    maxStaff,
    maxStaffDisplay,
    tier,
    isAtLimit,
    upgradeMessage,
    loading: limitLoading,
    checkBeforeInvite,
    refetch: refetchStaffLimit,
  } = useCanInviteStaff(restaurantId);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail,     setInviteEmail]     = useState("");
  const [inviteFullName,  setInviteFullName]  = useState("");
  const [invitePassword,  setInvitePassword]  = useState("");
  const [inviteRole,      setInviteRole]      = useState<StaffRole>("waiter");
  const [search,          setSearch]          = useState("");
  const [roleFilter,      setRoleFilter]      = useState<StaffRole | "all">("all");
  const [updatingRole,    setUpdatingRole]    = useState<string | null>(null);

  // Fetch staff
  const { data: staffMembers = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      const { data: staffRows, error: staffErr } = await (supabase
        .from("staff_restaurants") as any)
        .select("id, user_id, restaurant_id, created_at, role")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (staffErr) throw staffErr;
      if (!staffRows?.length) return [];

      const userIds = staffRows.map((row: { user_id: string }) => row.user_id);

      const [{ data: profiles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      ]);

      const rpcEmailMap: Record<string, string> = {};
      try {
        const { data: rpcRows } = await (supabase as any).rpc("get_restaurant_staff", { _restaurant_id: restaurantId });
        if (rpcRows) rpcRows.forEach((row: any) => { if (row.email) rpcEmailMap[row.user_id] = row.email; });
      } catch { /* best-effort */ }

      return staffRows.map((row: any) => {
        const profile  = profiles?.find(p => p.id === row.user_id);
        const email    = profile?.email || rpcEmailMap[row.user_id] || null;
        const fullName = profile?.full_name || null;
        return {
          ...row,
          role: (row.role as StaffRole) || "waiter",
          users: email || fullName ? { id: row.user_id, full_name: fullName, email } : null,
        };
      });
    },
    enabled: !!restaurantId,
  });

  // Invite
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");
      const normalizedEmail = inviteEmail.trim().toLowerCase();
      if (!normalizedEmail) throw new Error("\u0987\u09ae\u09c7\u0987\u09b2 \u09a6\u09bf\u09a8\u0964");
      const check = checkBeforeInvite();
      if (!check.allowed) throw new Error(upgradeMessage || "Staff limit reached.");

      const body: Record<string, string> = { email: normalizedEmail, role: inviteRole, restaurant_id: restaurantId };
      if (inviteFullName.trim()) body.full_name = inviteFullName.trim();
      if (invitePassword.trim()) body.password  = invitePassword.trim();

      const { data, error } = await supabase.functions.invoke("create-staff", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { already_exists?: boolean; role_updated?: boolean };
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });
      refetchStaffLimit();
      if (result?.already_exists)  toast.success("\u098f\u0987 \u09b8\u09cd\u099f\u09be\u09ab \u0987\u09a4\u09bf\u09ae\u09a7\u09cd\u09af\u09c7\u0987 \u09af\u09c1\u0995\u09cd\u09a4 \u0986\u099b\u09c7\u09a8\u0964");
      else if (result?.role_updated) toast.success("\u09b8\u09cd\u099f\u09be\u09ab\u09c7\u09b0 \u09b0\u09cb\u09b2 \u0986\u09aa\u09a1\u09c7\u099f \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964");
      else toast.success("\u09b8\u09cd\u099f\u09be\u09ab \u09b8\u09ab\u09b2\u09ad\u09be\u09ac\u09c7 \u09af\u09cb\u0997 \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964");
      setShowInviteDialog(false);
      setInviteEmail(""); setInviteFullName(""); setInvitePassword(""); setInviteRole("waiter");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove
  const removeMutation = useMutation({
    mutationFn: async (staff: Pick<StaffMember, "id" | "user_id">) => {
      if (!restaurantId) throw new Error("No restaurant");
      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: { action: "remove", user_id: staff.user_id, restaurant_id: restaurantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });
      refetchStaffLimit();
      toast.success("\u09b8\u09cd\u099f\u09be\u09ab \u09b8\u09b0\u09be\u09a8\u09cb \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // FIX 2: updateRole — delete old role first, then insert new one with restaurant_id
  const updateRole = async (userId: string, newRole: StaffRole) => {
    if (!restaurantId) return;
    setUpdatingRole(userId);
    try {
      const { error } = await (supabase.from("staff_restaurants") as any)
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });
      refetchStaffLimit();
      toast.success("\u09b0\u09cb\u09b2 \u0986\u09aa\u09a1\u09c7\u099f \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964");
    } catch (err: any) {
      toast.error(err.message || "\u09b0\u09cb\u09b2 \u0986\u09aa\u09a1\u09c7\u099f \u0995\u09b0\u09a4\u09c7 \u09b8\u09ae\u09b8\u09cd\u09af\u09be \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964");
    } finally {
      setUpdatingRole(null);
    }
  };

  // Filtered list
  const filtered = staffMembers.filter(s => {
    const matchSearch = !search ||
      (s.users?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.users?.email || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  const countByRole = (role: StaffRole) => staffMembers.filter(s => s.role === role).length;

  return (
    <DashboardLayout role="admin" title="\u09b8\u09cd\u099f\u09be\u09ab \u09ae\u09cd\u09af\u09be\u09a8\u09c7\u099c\u09ae\u09c7\u09a8\u09cd\u099f">
      <div className="space-y-6 animate-fade-up max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              {"\u09b8\u09cd\u099f\u09be\u09ab \u09ae\u09cd\u09af\u09be\u09a8\u09c7\u099c\u09ae\u09c7\u09a8\u09cd\u099f"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {"\u09b0\u09c7\u09b8\u09cd\u099f\u09c1\u09b0\u09c7\u09a8\u09cd\u099f\u09c7\u09b0 \u099f\u09bf\u09ae \u09ae\u09c7\u09ae\u09cd\u09ac\u09be\u09b0 \u09aa\u09b0\u09bf\u099a\u09be\u09b2\u09a8\u09be \u0995\u09b0\u09c1\u09a8"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full border border-border">
              {/* FIX 1: use maxStaffDisplay instead of checking Infinity */}
              {staffCount} / {maxStaffDisplay} {"\u099c\u09a8 \u09b8\u09cd\u099f\u09be\u09ab"}
            </span>
            <Button onClick={() => setShowInviteDialog(true)} disabled={!canInviteStaff || limitLoading} variant="hero" className="gap-2">
              <UserPlus className="w-4 h-4" /> {"\u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8"}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "\u09ae\u09cb\u099f \u09b8\u09cd\u099f\u09be\u09ab",  value: staffMembers.length, color: "border-border bg-secondary/30" },
            { label: "\u0985\u09cd\u09af\u09be\u09a1\u09ae\u09bf\u09a8",   value: countByRole("admin"),   color: "border-purple-500/20 bg-purple-500/5" },
            { label: "\u0993\u09af\u09bc\u09c7\u099f\u09be\u09b0",    value: countByRole("waiter"),  color: "border-primary/20 bg-primary/5" },
            { label: "\u0995\u09bf\u099a\u09c7\u09a8",      value: countByRole("kitchen"), color: "border-warning/20 bg-warning/5" },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border px-4 py-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Limit warning */}
        {isAtLimit && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-warning text-sm">{"\u09b8\u09cd\u099f\u09be\u09ab \u09b8\u09c0\u09ae\u09be \u09aa\u09c2\u09b0\u09cd\u09a3 \u09b9\u09af\u09bc\u09c7 \u0997\u09c7\u099b\u09c7"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {upgradeMessage || `\u0986\u09aa\u09a8\u09be\u09b0 \u09aa\u09cd\u09b2\u09cd\u09af\u09be\u09a8\u09c7 \u09b8\u09b0\u09cd\u09ac\u09cb\u099a\u09cd\u099a ${maxStaffDisplay} \u099c\u09a8 \u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0995\u09b0\u09be \u09af\u09be\u09ac\u09c7\u0964`}
              </p>
              {tier === "medium_smart" && (
                <Button size="sm" className="mt-2 bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs"
                  onClick={() => navigate("/upgrade")}>
                  {"\u09b9\u09be\u0987 \u09b8\u09cd\u09ae\u09be\u09b0\u09cd\u099f\u09c7 \u0986\u09aa\u0997\u09cd\u09b0\u09c7\u09a1 \u0995\u09b0\u09c1\u09a8"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Invite dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> {"\u09a8\u09a4\u09c1\u09a8 \u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>{"\u0987\u09ae\u09c7\u0987\u09b2"} *</Label>
                <Input type="email" placeholder="staff@example.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{"\u09aa\u09c1\u09b0\u09cb \u09a8\u09be\u09ae"} ({"\u0990\u099a\u09cd\u099b\u09bf\u0995"})</Label>
                <Input placeholder="\u09af\u09c7\u09ae\u09a8: Rahim Uddin"
                  value={inviteFullName} onChange={e => setInviteFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{"\u09aa\u09be\u09b8\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1"}</Label>
                <Input type="password" placeholder="\u09a8\u09a4\u09c1\u09a8 \u09b8\u09cd\u099f\u09be\u09ab \u09b9\u09b2\u09c7 \u09a6\u09bf\u09a8"
                  value={invitePassword} onChange={e => setInvitePassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">{"\u0986\u0997\u09c7 \u0985\u09cd\u09af\u09be\u0995\u09be\u0989\u09a8\u09cd\u099f \u09a5\u09be\u0995\u09b2\u09c7 \u09aa\u09be\u09b8\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1 \u09b2\u09be\u0997\u09ac\u09c7 \u09a8\u09be\u0964"}</p>
              </div>
              <div className="space-y-2">
                <Label>{"\u09ad\u09c2\u09ae\u09bf\u0995\u09be"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => (
                    <button key={r.value} type="button" onClick={() => setInviteRole(r.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        inviteRole === r.value
                          ? `${r.bg} border-current`
                          : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                      }`}>
                      <r.icon className="w-4 h-4" />
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{ROLES.find(r => r.value === inviteRole)?.desc}</p>
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />{"\u09af\u09cb\u0997 \u09b9\u099a\u09cd\u099b\u09c7..."}</>
                  : "\u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Search + filter */}
        {staffMembers.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="\u09a8\u09be\u09ae \u09ac\u09be \u0987\u09ae\u09c7\u0987\u09b2\u09c7 \u0996\u09c1\u0981\u099c\u09c1\u09a8..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              {(["all", ...ROLES.map(r => r.value)] as const).map(f => (
                <button key={f} onClick={() => setRoleFilter(f as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    roleFilter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {f === "all" ? "\u09b8\u09ac\u09be\u0987" : ROLES.find(r => r.value === f)?.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Staff list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-secondary/40 animate-pulse" />)}
          </div>
        ) : staffMembers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-semibold">{"\u098f\u0996\u09a8\u09cb \u0995\u09cb\u09a8\u09cb \u09b8\u09cd\u099f\u09be\u09ab \u09a8\u09c7\u0987"}</p>
                <p className="text-sm text-muted-foreground mt-1">{"\u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0995\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u099f\u09bf\u09ae \u0997\u09dc\u09c1\u09a8\u0964"}</p>
              </div>
              <Button onClick={() => setShowInviteDialog(true)} variant="outline" className="gap-2">
                <UserPlus className="w-4 h-4" /> {"\u09aa\u09cd\u09b0\u09a5\u09ae \u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8"}
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{"\u0995\u09cb\u09a8\u09cb \u09ab\u09b2\u09be\u09ab\u09b2 \u09a8\u09c7\u0987\u0964"}</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((staff, idx) => {
              const rc    = getRoleConfig(staff.role);
              const RIcon = rc.icon;
              const avatarGrad = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const isUpdating = updatingRole === staff.user_id;

              return (
                <Card key={staff.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
                        {avatarInitials(staff)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{staff.users?.full_name || "\u09a8\u09be\u09ae \u09a8\u09c7\u0987"}</p>
                          <Badge className={`text-xs border ${rc.bg} flex items-center gap-1`}>
                            <RIcon className="w-3 h-3" /> {rc.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          {staff.users?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {staff.users.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(staff.created_at).toLocaleDateString("bn-BD", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Desktop role buttons */}
                        <div className="hidden sm:flex gap-1">
                          {ROLES.filter(r => r.value !== staff.role).map(r => (
                            <button key={r.value} disabled={isUpdating}
                              onClick={() => updateRole(staff.user_id, r.value)}
                              title={`${r.label} \u09ac\u09be\u09a8\u09be\u09a8`}
                              className="w-7 h-7 rounded-lg bg-secondary/60 hover:bg-secondary border border-border flex items-center justify-center transition-colors disabled:opacity-50">
                              {isUpdating
                                ? <RefreshCw className="w-3 h-3 animate-spin" />
                                : <r.icon className={`w-3.5 h-3.5 ${r.color}`} />}
                            </button>
                          ))}
                        </div>

                        {/* Mobile role select */}
                        <select
                          className="sm:hidden h-8 rounded-lg border border-border bg-background text-xs px-2"
                          value={staff.role}
                          disabled={isUpdating}
                          onChange={e => updateRole(staff.user_id, e.target.value as StaffRole)}
                        >
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>

                        <Button variant="ghost" size="icon"
                          className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`"${staff.users?.full_name || "\u098f\u0987 \u09b8\u09cd\u099f\u09be\u09ab"}" \u0995\u09c7 \u09b8\u09b0\u09bf\u09af\u09bc\u09c7 \u09a6\u09c7\u09ac\u09c7\u09a8?`)) {
                              removeMutation.mutate({ id: staff.id, user_id: staff.user_id });
                            }
                          }}>
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

        {/* Role descriptions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{"\u09b0\u09cb\u09b2\u09c7\u09b0 \u09ac\u09bf\u09ac\u09b0\u09a3"}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                role: ROLES[0],
                borderClass: "border-purple-500/20",
                perms: ["\u09ae\u09c7\u09a8\u09c1 \u0993 \u099f\u09c7\u09ac\u09bf\u09b2 \u09ae\u09cd\u09af\u09be\u09a8\u09c7\u099c\u09ae\u09c7\u09a8\u09cd\u099f", "\u09b8\u09cd\u099f\u09be\u09ab \u09af\u09cb\u0997 \u0993 \u09ac\u09be\u09a6 \u09a6\u09c7\u0993\u09af\u09bc\u09be", "\u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u0993 \u0985\u09cd\u09af\u09be\u09a8\u09be\u09b2\u09bf\u099f\u09bf\u0995\u09cd\u09b8", "\u09ac\u09bf\u09b2\u09bf\u0982 \u0993 \u09b8\u09c7\u099f\u09bf\u0982\u09b8"],
                blocked: [],
              },
              {
                role: ROLES[1],
                borderClass: "border-primary/20",
                perms: ["\u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u0997\u09cd\u09b0\u09b9\u09a3 \u0993 \u09aa\u09b0\u09bf\u099a\u09be\u09b2\u09a8\u09be", "\u099f\u09c7\u09ac\u09bf\u09b2 \u0993 \u09b8\u09bf\u099f \u09ae\u09cd\u09af\u09be\u09a8\u09c7\u099c\u09ae\u09c7\u09a8\u09cd\u099f", "\u09ac\u09bf\u09b2 \u0993 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f \u0997\u09cd\u09b0\u09b9\u09a3", "\u09b8\u09be\u09b0\u09cd\u09ad\u09bf\u09b8 \u09b0\u09bf\u0995\u09cb\u09af\u09bc\u09c7\u09b8\u09cd\u099f \u09a6\u09c7\u0996\u09be"],
                blocked: ["\u09ae\u09c7\u09a8\u09c1 \u09b8\u09ae\u09cd\u09aa\u09be\u09a6\u09a8\u09be \u09a8\u09c7\u0987"],
              },
              {
                role: ROLES[2],
                borderClass: "border-warning/20",
                perms: ["\u0995\u09bf\u099a\u09c7\u09a8 \u09a1\u09bf\u09b8\u09aa\u09cd\u09b2\u09c7 \u09a6\u09c7\u0996\u09be", "\u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u09b8\u09cd\u099f\u09cd\u09af\u09be\u099f\u09be\u09b8 \u0986\u09aa\u09a1\u09c7\u099f", "\u09b0\u09be\u09a8\u09cd\u09a8\u09be \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8 \u09ae\u09be\u09b0\u09cd\u0995 \u0995\u09b0\u09be"],
                blocked: ["\u09ac\u09bf\u09b2\u09bf\u0982 \u0993 \u09b8\u09cd\u099f\u09be\u09ab \u0985\u09cd\u09af\u09be\u0995\u09cd\u09b8\u09c7\u09b8 \u09a8\u09c7\u0987"],
              },
            ].map(({ role, borderClass, perms, blocked }) => (
              <Card key={role.value} className={borderClass}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg ${role.bg.split(" ")[0]} flex items-center justify-center`}>
                      <role.icon className={`w-3.5 h-3.5 ${role.color}`} />
                    </div>
                    <span className={role.color}>{role.label}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="text-xs space-y-1">
                    {perms.map(p => <li key={p} className="text-muted-foreground">&#10003; {p}</li>)}
                    {blocked.map(b => <li key={b} className="text-muted-foreground/50">&#10007; {b}</li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
