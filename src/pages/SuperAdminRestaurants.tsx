import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Store, Plus, Search, Edit, Trash2, Loader2,
  Building2, Eye, EyeOff, CheckCircle2, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: string;
  plan: string;
  owner_id: string | null;
  created_at: string;
  trial_ends_at: string | null;
  tier: string;
  subscription_status: string;
  trial_end_date: string | null;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  medium_smart:         { label: 'মিডিয়াম স্মার্ট',      color: 'bg-blue-500/10 text-blue-500',       icon: '⚡' },
  high_smart:           { label: 'হাই স্মার্ট',            color: 'bg-purple-500/10 text-purple-500',   icon: '👑' },
  high_smart_enterprise:{ label: 'হাই স্মার্ট এন্টারপ্রাইজ', color: 'bg-amber-500/10 text-amber-600', icon: '🏢' },
};

const SUB_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: '✅ অ্যাক্টিভ',    color: 'bg-success/10 text-success' },
  trial:     { label: '🎯 ট্রায়াল',      color: 'bg-blue-500/10 text-blue-500' },
  expired:   { label: '⏰ মেয়াদ শেষ',   color: 'bg-destructive/10 text-destructive' },
  cancelled: { label: '❌ বাতিল',        color: 'bg-muted text-muted-foreground' },
};

const SuperAdminRestaurants = () => {
  const queryClient = useQueryClient();

  // --- Filter / search state ---
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // --- Edit dialog state ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formPlan, setFormPlan] = useState("medium_smart");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // --- Enterprise create dialog state ---
  const [entOpen, setEntOpen] = useState(false);
  const [entEmail, setEntEmail] = useState("");
  const [entPassword, setEntPassword] = useState("");
  const [entShowPass, setEntShowPass] = useState(false);
  const [entFullName, setEntFullName] = useState("");
  const [entRestName, setEntRestName] = useState("");
  const [entPhone, setEntPhone] = useState("");
  const [entAddress, setEntAddress] = useState("");
  const [entBilling, setEntBilling] = useState<"monthly" | "yearly">("yearly");
  const [entSuccess, setEntSuccess] = useState<{ email: string; password: string; restaurantId: string } | null>(null);

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["all-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Restaurant[];
    },
  });

  const filtered = restaurants.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.address || "").toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === "all" || r.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const resetForm = () => {
    setFormName(""); setFormAddress(""); setFormPhone("");
    setFormStatus("active"); setFormPlan("medium_smart"); setEditingId(null);
  };

  const resetEntForm = () => {
    setEntEmail(""); setEntPassword(""); setEntFullName("");
    setEntRestName(""); setEntPhone(""); setEntAddress("");
    setEntBilling("yearly"); setEntSuccess(null);
  };

  const openAdd = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (r: Restaurant) => {
    setEditingId(r.id);
    setFormName(r.name);
    setFormAddress(r.address || "");
    setFormPhone(r.phone || "");
    setFormStatus(r.status);
    setFormPlan(r.tier || r.plan || "medium_smart");
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingId && formPlan === "high_smart_enterprise") {
        throw new Error("Use the dedicated Enterprise create flow for a brand new enterprise account.");
      }

      if (editingId) {
        const { error } = await supabase
          .from("restaurants")
          .update({
            name: formName, address: formAddress, phone: formPhone,
            status: formStatus, tier: formPlan, updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) throw error;
        if (formPlan === "high_smart_enterprise") {
          const { error: bootstrapError } = await supabase.functions.invoke("bootstrap-enterprise-restaurant", {
            body: { restaurant_id: editingId, group_name: formName },
          });
          if (bootstrapError) throw new Error(bootstrapError.message);
        }
      } else {
        const { data, error } = await supabase
          .from("restaurants")
          .insert({
            name: formName, address: formAddress, phone: formPhone,
            status: formStatus, tier: formPlan, subscription_status: "trial",
          })
          .select("id")
          .single();
        if (error) throw error;
        if (formPlan === "high_smart_enterprise" && data?.id) {
          const { error: bootstrapError } = await supabase.functions.invoke("bootstrap-enterprise-restaurant", {
            body: { restaurant_id: data.id, group_name: formName },
          });
          if (bootstrapError) throw new Error(bootstrapError.message);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "রেস্টুরেন্ট আপডেট হয়েছে" : "রেস্টুরেন্ট যোগ করা হয়েছে");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["all-restaurants"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("রেস্টুরেন্ট মুছে ফেলা হয়েছে");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["all-restaurants"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // --- Enterprise create mutation ---
  const createEntMutation = useMutation({
    mutationFn: async () => {
      if (!entEmail.trim() || !entPassword.trim() || !entFullName.trim() || !entRestName.trim()) {
        throw new Error("সব প্রয়োজনীয় তথ্য পূরণ করুন");
      }
      if (entPassword.length < 6) throw new Error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে");

      const { data, error } = await supabase.functions.invoke("create-enterprise-account", {
        body: {
          email: entEmail.trim(),
          password: entPassword,
          full_name: entFullName.trim(),
          restaurant_name: entRestName.trim(),
          phone: entPhone.trim() || undefined,
          address: entAddress.trim() || undefined,
          billing_cycle: entBilling,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setEntSuccess({
        email: entEmail.trim(),
        password: entPassword,
        restaurantId: data.restaurant_id,
      });
      queryClient.invalidateQueries({ queryKey: ["all-restaurants"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <DashboardLayout role="super_admin" title="রেস্টুরেন্ট ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="রেস্টুরেন্ট খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-secondary/50"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[200px] bg-secondary/50">
                <SelectValue placeholder="টিয়ার ফিল্টার" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব টিয়ার</SelectItem>
                <SelectItem value="medium_smart">⚡ মিডিয়াম স্মার্ট</SelectItem>
                <SelectItem value="high_smart">👑 হাই স্মার্ট</SelectItem>
                <SelectItem value="high_smart_enterprise">🏢 এন্টারপ্রাইজ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {/* Enterprise create button */}
            <Button
              variant="outline"
              className="gap-2 border-amber-400/50 text-amber-600 hover:bg-amber-50"
              onClick={() => { resetEntForm(); setEntOpen(true); }}
            >
              <Building2 className="w-4 h-4" />
              🏢 Enterprise তৈরি করুন
            </Button>
            <Button variant="hero" onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" /> নতুন রেস্টুরেন্ট
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}

        {/* Restaurant table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">রেস্টুরেন্ট</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden md:table-cell">ঠিকানা</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden sm:table-cell">ফোন</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">টিয়ার</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden lg:table-cell">সাবস্ক্রিপশন</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">স্ট্যাটাস</th>
                    <th className="text-right p-4 font-medium text-muted-foreground text-sm">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && !isLoading && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">কোনো রেস্টুরেন্ট নেই</td></tr>
                  )}
                  {filtered.map((r) => {
                    const tier = TIER_CONFIG[r.tier] || TIER_CONFIG.medium_smart;
                    const sub = SUB_CONFIG[r.subscription_status] || SUB_CONFIG.trial;
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                              <Store className="w-5 h-5 text-accent-foreground" />
                            </div>
                            <span className="font-medium text-foreground">{r.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm hidden md:table-cell">{r.address || "—"}</td>
                        <td className="p-4 text-muted-foreground text-sm hidden sm:table-cell">{r.phone || "—"}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tier.color}`}>
                            {tier.icon} {tier.label}
                          </span>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sub.color}`}>
                            {sub.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            r.status === 'active' || r.status === 'active_paid'
                              ? 'bg-success/10 text-success'
                              : r.status === 'pending'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {r.status === 'active' || r.status === 'active_paid' ? 'সক্রিয়' :
                             r.status === 'pending' ? 'পেন্ডিং' : 'নিষ্ক্রিয়'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {deleteConfirm === r.id ? (
                              <div className="flex items-center gap-1">
                                <Button variant="destructive" size="sm"
                                  onClick={() => deleteMutation.mutate(r.id)}
                                  disabled={deleteMutation.isPending}>
                                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "হ্যাঁ"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>না</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" className="text-destructive"
                                onClick={() => setDeleteConfirm(r.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Edit / Add Restaurant Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "রেস্টুরেন্ট সম্পাদনা" : "নতুন রেস্টুরেন্ট যোগ করুন"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>রেস্টুরেন্টের নাম *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="নাম লিখুন" />
            </div>
            <div className="space-y-2">
              <Label>ঠিকানা</Label>
              <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="ঠিকানা লিখুন" />
            </div>
            <div className="space-y-2">
              <Label>ফোন</Label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+880..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>স্ট্যাটাস</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">সক্রিয় (ট্রায়াল)</SelectItem>
                    <SelectItem value="active_paid">সক্রিয় (পেইড)</SelectItem>
                    <SelectItem value="pending">পেন্ডিং</SelectItem>
                    <SelectItem value="inactive">নিষ্ক্রিয়</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>টিয়ার</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medium_smart">⚡ মিডিয়াম স্মার্ট</SelectItem>
                    <SelectItem value="high_smart">👑 হাই স্মার্ট</SelectItem>
                    <SelectItem value="high_smart_enterprise">🏢 এন্টারপ্রাইজ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" variant="hero"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formName.trim()}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {saveMutation.isPending ? "সেভ হচ্ছে..." : editingId ? "আপডেট করুন" : "যোগ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Enterprise Create Dialog ── */}
      <Dialog open={entOpen} onOpenChange={(v) => { setEntOpen(v); if (!v) resetEntForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              🏢 Enterprise অ্যাকাউন্ট তৈরি করুন
            </DialogTitle>
          </DialogHeader>

          {entSuccess ? (
            /* ── Success Screen ── */
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mx-auto">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-success">সফলভাবে তৈরি হয়েছে!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Customer এখনই login করতে পারবে এবং নিজের info update করতে পারবে।
                </p>
              </div>

              {/* Login credentials box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Login তথ্য — Customer-কে পাঠান</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs text-muted-foreground">ইমেইল</p>
                      <p className="text-sm font-mono font-semibold">{entSuccess.email}</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(entSuccess.email); toast.success("কপি হয়েছে"); }}
                      className="p-1.5 hover:bg-gray-100 rounded">
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs text-muted-foreground">পাসওয়ার্ড</p>
                      <p className="text-sm font-mono font-semibold">{entSuccess.password}</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(entSuccess.password); toast.success("কপি হয়েছে"); }}
                      className="p-1.5 hover:bg-gray-100 rounded">
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-amber-600">
                  ⚠️ এই পাসওয়ার্ড এখনই সংরক্ষণ করুন। পরে দেখা যাবে না।
                </p>
              </div>

              {/* What customer can do */}
              <div className="bg-primary/5 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Customer login করলে পারবে:</p>
                <p>✓ Settings থেকে নাম, ফোন, রেস্টুরেন্ট info আপডেট করতে</p>
                <p>✓ Group Dashboard থেকে শাখা তৈরি করতে</p>
                <p>✓ Branch admin invite করতে</p>
                <p>✓ Shared menu তৈরি করতে</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { resetEntForm(); }}>
                  আরেকটি তৈরি করুন
                </Button>
                <Button variant="hero" className="flex-1" onClick={() => { setEntOpen(false); resetEntForm(); }}>
                  সম্পন্ন
                </Button>
              </div>
            </div>
          ) : (
            /* ── Create Form ── */
            <div className="space-y-4 pt-2">
              {/* Info */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
                <p className="font-semibold">এটি করলে:</p>
                <p>• নতুন user account তৈরি হবে (email + password)</p>
                <p>• Restaurant তৈরি হবে Enterprise tier-এ</p>
                <p>• group_owner role automatically assign হবে</p>
                <p>• Customer সরাসরি login করতে পারবে</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Group Admin-এর তথ্য</p>

                <div className="space-y-1.5">
                  <Label className="text-sm">পুরো নাম *</Label>
                  <Input
                    placeholder="যেমন: মোঃ রহিম উদ্দিন"
                    value={entFullName}
                    onChange={e => setEntFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">ইমেইল * (Login ID)</Label>
                  <Input
                    type="email"
                    placeholder="customer@email.com"
                    value={entEmail}
                    onChange={e => setEntEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">পাসওয়ার্ড * (কমপক্ষে ৬ অক্ষর)</Label>
                  <div className="relative">
                    <Input
                      type={entShowPass ? "text" : "password"}
                      placeholder="শক্তিশালী পাসওয়ার্ড দিন"
                      value={entPassword}
                      onChange={e => setEntPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setEntShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {entShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">ফোন নম্বর</Label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={entPhone}
                    onChange={e => setEntPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">রেস্টুরেন্ট তথ্য</p>

                <div className="space-y-1.5">
                  <Label className="text-sm">রেস্টুরেন্ট / চেইনের নাম *</Label>
                  <Input
                    placeholder="যেমন: পান্শি রেস্টুরেন্ট গ্রুপ"
                    value={entRestName}
                    onChange={e => setEntRestName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">ঠিকানা</Label>
                  <Input
                    placeholder="সিলেট, বাংলাদেশ"
                    value={entAddress}
                    onChange={e => setEntAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">বিলিং সাইকেল</Label>
                  <Select value={entBilling} onValueChange={v => setEntBilling(v as "monthly" | "yearly")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yearly">বার্ষিক (১ বছর) — সাশ্রয়ী</SelectItem>
                      <SelectItem value="monthly">মাসিক (১ মাস)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => createEntMutation.mutate()}
                disabled={
                  createEntMutation.isPending ||
                  !entEmail.trim() || !entPassword.trim() ||
                  !entFullName.trim() || !entRestName.trim()
                }
              >
                {createEntMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> তৈরি হচ্ছে...</>
                  : <><Building2 className="w-4 h-4" /> Enterprise অ্যাকাউন্ট তৈরি করুন</>
                }
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SuperAdminRestaurants;
