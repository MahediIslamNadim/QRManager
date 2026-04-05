import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserPlus, Trash2, Users, Shield, Pencil, Mail, Phone,
  User, Search, ChefHat, UserCheck, AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPlanLimits, formatLimit } from "@/lib/planLimits";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

const AdminStaff = () => {
  const { restaurantId, restaurantPlan } = useAuth();
  const limits = getPlanLimits(restaurantPlan);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "waiter" | "admin">("all");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"waiter" | "admin">("waiter");

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<"waiter" | "admin">("waiter");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      // Get all staff linked to this restaurant
      const { data: staffLinks } = await supabase
        .from("staff_restaurants")
        .select("user_id")
        .eq("restaurant_id", restaurantId);
      if (!staffLinks || staffLinks.length === 0) return [];

      const userIds = staffLinks.map(s => s.user_id);

      // Get profiles and roles in parallel
      const [rolesRes, profilesRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds),
      ]);

      const roles = rolesRes.data || [];
      const profiles = profilesRes.data || [];

      // Merge — one entry per user
      const result = userIds.map(uid => {
        const roleRow = roles.find(r => r.user_id === uid);
        const profile = profiles.find(p => p.id === uid);
        return {
          id: uid,
          name: profile?.full_name || "N/A",
          email: profile?.email || "N/A",
          phone: profile?.phone || "",
          role: roleRow?.role || "waiter",
        };
      }).filter(s => s.role === "waiter" || s.role === "admin");

      return result;
    },
    enabled: !!restaurantId,
  });

  const isAtStaffLimit = staff.length >= limits.maxStaff;

  const addStaffMutation = useMutation({
    mutationFn: async () => {
      if (isAtStaffLimit) throw new Error(`আপনার ${limits.label} প্ল্যানে সর্বোচ্চ ${formatLimit(limits.maxStaff)} জন কর্মী যোগ করা যায়। আপগ্রেড করুন।`);
      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: { email, password, full_name: name, role, restaurant_id: restaurantId },
      });
      if (error) throw new Error(error.message || "কর্মী যোগ করতে সমস্যা হয়েছে");
      if (data?.error) {
        if (data.error.includes("already been registered") || data.error.includes("email_exists")) {
          throw new Error("এই ইমেইল দিয়ে আগেই ইউজার আছে");
        }
        throw new Error(data.error);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("কর্মী সফলভাবে যোগ করা হয়েছে ✅");
      setOpen(false);
      setEmail(""); setName(""); setPassword(""); setPhone(""); setRole("waiter");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: any) => toast.error(err.message || "কর্মী যোগ করতে সমস্যা হয়েছে"),
  });

  const removeStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error: linkError } = await supabase
        .from("staff_restaurants").delete().eq("user_id", userId).eq("restaurant_id", restaurantId);
      if (linkError) throw linkError;
      // Only delete user_roles if user has no other restaurant links
      const { data: remaining } = await supabase
        .from("staff_restaurants").select("id").eq("user_id", userId);
      if (!remaining || remaining.length === 0) {
        const { error: roleError } = await supabase
          .from("user_roles").delete().eq("user_id", userId);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      toast.success("কর্মী সরানো হয়েছে");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editStaffMutation = useMutation({
    mutationFn: async () => {
      if (!editingStaff) return;
      const { error: profileError } = await supabase
        .from("profiles").update({ full_name: editName, phone: editPhone }).eq("id", editingStaff.id);
      if (profileError) throw profileError;
      if (editRole !== editingStaff.role) {
        const { error: roleError } = await supabase
          .from("user_roles").update({ role: editRole }).eq("user_id", editingStaff.id);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      toast.success("কর্মী তথ্য আপডেট হয়েছে ✅");
      setEditOpen(false);
      setEditingStaff(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: any) => toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে"),
  });

  const openEditDialog = (s: StaffMember) => {
    setEditingStaff(s);
    setEditName(s.name);
    setEditPhone(s.phone);
    setEditRole(s.role as "waiter" | "admin");
    setEditOpen(true);
  };

  const filtered = staff
    .filter(s => filterRole === "all" || s.role === filterRole)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()));

  const waiterCount = staff.filter(s => s.role === "waiter").length;
  const adminCount = staff.filter(s => s.role === "admin").length;

  const getRoleColor = (role: string) => role === "admin"
    ? "bg-primary/10 text-primary border-primary/20"
    : "bg-success/10 text-success border-success/20";

  const getRoleLabel = (role: string) => role === "admin" ? "অ্যাডমিন" : "ওয়েটার";
  const getRoleIcon = (role: string) => role === "admin" ? Shield : ChefHat;

  return (
    <DashboardLayout role="admin" title="কর্মী ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">কর্মী তালিকা</h2>
            <p className="text-muted-foreground text-sm">ওয়েটার ও অ্যাডমিন ম্যানেজ করুন</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" className="h-9 sm:h-10 text-sm">
                <UserPlus className="w-4 h-4" /> কর্মী যোগ করুন
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-4 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="font-display">নতুন কর্মী যোগ করুন</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">পুরো নাম *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="কর্মীর নাম" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ইমেইল *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ফোন নম্বর</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+880 1XXX XXXXXX" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">পাসওয়ার্ড *</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="ন্যূনতম ৬ অক্ষর" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ভূমিকা</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as any)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waiter">🍽️ ওয়েটার</SelectItem>
                      <SelectItem value="admin">🛡️ অ্যাডমিন</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full h-10" variant="hero"
                  onClick={() => addStaffMutation.mutate()}
                  disabled={addStaffMutation.isPending || !email || !password || !name}>
                  {addStaffMutation.isPending ? "যোগ হচ্ছে..." : "কর্মী যোগ করুন"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "মোট কর্মী", value: `${staff.length}/${formatLimit(limits.maxStaff)}`, color: "text-primary", bg: "bg-primary/10" },
            { icon: ChefHat, label: "ওয়েটার", value: waiterCount, color: "text-success", bg: "bg-success/10" },
            { icon: Shield, label: "অ্যাডমিন", value: adminCount, color: "text-info", bg: "bg-info/10" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="stat-card text-center p-3">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mx-auto mb-1.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xl font-display font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {isAtStaffLimit && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            ⚠️ আপনার {limits.label} প্ল্যানের কর্মী লিমিট ({formatLimit(limits.maxStaff)}) পূর্ণ হয়েছে। আরো যোগ করতে প্ল্যান আপগ্রেড করুন।
          </div>
        )}

        {/* ── Filter + Search ── */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="নাম বা ইমেইল খুঁজুন..." className="h-9 pl-9 text-sm" />
          </div>
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
            {(["all", "waiter", "admin"] as const).map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filterRole === r ? "gradient-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {r === "all" ? "সব" : r === "waiter" ? "ওয়েটার" : "অ্যাডমিন"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Staff List ── */}
        {isLoading && (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-14 bg-secondary/20 rounded-2xl border border-border/30">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {search || filterRole !== "all" ? "কোনো ফলাফল নেই" : "এখনো কোনো কর্মী যোগ করা হয়নি"}
            </p>
            {!search && filterRole === "all" && (
              <p className="text-sm text-muted-foreground mt-1">উপরে "কর্মী যোগ করুন" বাটনে ক্লিক করুন</p>
            )}
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((s: any) => {
            const RoleIcon = getRoleIcon(s.role);
            const initial = s.name !== "N/A" ? s.name.charAt(0).toUpperCase() : "?";
            return (
              <Card key={s.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-3 sm:p-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0 shadow-md shadow-primary/20">
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{s.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${getRoleColor(s.role)}`}>
                          <RoleIcon className="w-2.5 h-2.5" />
                          {getRoleLabel(s.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {s.email}
                        </p>
                        {s.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {s.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => openEditDialog(s)}
                        className="w-8 h-8 rounded-lg bg-secondary hover:bg-accent flex items-center justify-center transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeleteConfirm(s)}
                        className="w-8 h-8 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Edit Dialog ── */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-sm mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="font-display">কর্মী তথ্য সম্পাদনা</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                  {editingStaff?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{editingStaff?.name}</p>
                  <p className="text-xs text-muted-foreground">{editingStaff?.email}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">পুরো নাম</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ফোন নম্বর</Label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+880 1XXX XXXXXX" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ভূমিকা</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as "waiter" | "admin")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiter">🍽️ ওয়েটার</SelectItem>
                    <SelectItem value="admin">🛡️ অ্যাডমিন</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full h-10" variant="hero"
                onClick={() => editStaffMutation.mutate()}
                disabled={editStaffMutation.isPending || !editName}>
                {editStaffMutation.isPending ? "আপডেট হচ্ছে..." : "আপডেট করুন"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirm Dialog ── */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-xs mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" /> কর্মী সরাবেন?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{deleteConfirm?.name}</span> কে রেস্টুরেন্ট থেকে সরিয়ে দেওয়া হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setDeleteConfirm(null)}>বাতিল</Button>
                <Button variant="destructive" className="flex-1 h-9 text-sm"
                  onClick={() => deleteConfirm && removeStaffMutation.mutate(deleteConfirm.id)}
                  disabled={removeStaffMutation.isPending}>
                  {removeStaffMutation.isPending ? "সরানো হচ্ছে..." : "হ্যাঁ, সরান"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminStaff;
