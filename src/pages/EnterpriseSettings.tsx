import { useEffect, useState } from "react";
import { Building2, Eye, EyeOff, Lock, Save, Bell, Store, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useEnterpriseContext, useEnterpriseRestaurants } from "@/hooks/useEnterpriseAdmin";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function EnterpriseSettings() {
  const { group, groupId, headOffice, restaurantId, user } = useEnterpriseContext();
  const restaurantsQuery = useEnterpriseRestaurants(groupId);
  const queryClient = useQueryClient();

  // ── Group & head office info ─────────────────────────────────────────────
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Password change ──────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    setGroupName(group?.name || "");
    setGroupDescription(group?.description || "");
    setRestaurantName(headOffice?.name || "");
    setRestaurantPhone(headOffice?.phone || "");
    setRestaurantAddress(headOffice?.address || "");
    setNotificationEmail(headOffice?.notification_email || "");
    setNotifyEmail(!!headOffice?.notify_email);
  }, [group, headOffice]);

  // ── Status toggle mutation ───────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const next = status === "inactive" ? "active" : "inactive";
      const { error } = await supabase
        .from("restaurants")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurants", groupId] });
      toast.success("রেস্টুরেন্টের অবস্থা পরিবর্তন হয়েছে।");
    },
    onError: () => toast.error("অবস্থা পরিবর্তন করা যায়নি।"),
  });

  // ── Save group + head office info ────────────────────────────────────────
  const handleSaveInfo = async () => {
    if (!groupId || !restaurantId) { toast.error("Enterprise setup অসম্পূর্ণ।"); return; }
    setSavingInfo(true);
    try {
      const [gr, rr] = await Promise.all([
        supabase
          .from("restaurant_groups")
          .update({ name: groupName.trim(), description: groupDescription.trim() || null, updated_at: new Date().toISOString() })
          .eq("id", groupId),
        (supabase.from("restaurants") as any)
          .update({
            name: restaurantName.trim(),
            phone: restaurantPhone.trim() || null,
            address: restaurantAddress.trim() || null,
            notification_email: notificationEmail.trim() || null,
            notify_email: notifyEmail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", restaurantId),
      ]);
      if (gr.error) throw gr.error;
      if (rr.error) throw rr.error;
      toast.success("সেটিংস সেভ হয়েছে।");
      queryClient.invalidateQueries({ queryKey: ["enterprise-head-office"] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-group"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "সেভ করা যায়নি।");
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।"); return; }
    if (newPassword !== confirmPassword) { toast.error("নতুন পাসওয়ার্ড দুটি মিলছে না।"); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে।");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "পাসওয়ার্ড পরিবর্তন করা যায়নি।");
    } finally {
      setChangingPw(false);
    }
  };

  const restaurants = restaurantsQuery.data ?? [];

  return (
    <DashboardLayout role="group_owner" title="এন্টারপ্রাইজ সেটিংস">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* ── Group & Head Office ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              গ্রুপ ও হেড অফিসের তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>গ্রুপের নাম</Label>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="যেমন: পান্শি গ্রুপ" />
              </div>
              <div className="space-y-2">
                <Label>হেড অফিসের নাম</Label>
                <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="যেমন: পান্শি হেড অফিস" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>গ্রুপের বিবরণ</Label>
                <Textarea rows={3} value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="গ্রুপ সম্পর্কে সংক্ষিপ্ত বিবরণ" />
              </div>
            </div>

            <Separator />

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> হেড অফিস ফোন</Label>
                <Input value={restaurantPhone} onChange={(e) => setRestaurantPhone(e.target.value)} placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> নোটিফিকেশন ইমেইল</Label>
                <Input type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>হেড অফিসের ঠিকানা</Label>
                <Textarea rows={3} value={restaurantAddress} onChange={(e) => setRestaurantAddress(e.target.value)} placeholder="সম্পূর্ণ ঠিকানা লিখুন" />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                  <div>
                    <p className="font-medium flex items-center gap-1.5"><Bell className="h-4 w-4" /> নোটিস ইমেইলে পাঠান</p>
                    <p className="text-sm text-muted-foreground">
                      In-app নোটিস সবসময় যাবে। ইমেইল শুধু যখন এটি চালু থাকবে এবং ইমেইল configure করা থাকবে।
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveInfo} disabled={savingInfo} className="gap-2">
                <Save className="h-4 w-4" />
                {savingInfo ? "সেভ হচ্ছে..." : "তথ্য সেভ করুন"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Account info ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-500" />
              অ্যাকাউন্ট ও নিরাপত্তা
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border p-4 bg-secondary/20">
              <p className="text-sm font-medium">লগইন ইমেইল</p>
              <p className="text-sm text-muted-foreground mt-1">{user?.email || "—"}</p>
              <Badge variant="outline" className="mt-2 text-[10px]">Enterprise Admin</Badge>
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="font-medium text-sm">পাসওয়ার্ড পরিবর্তন করুন</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</Label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowNewPw((v) => !v)}
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>নতুন পাসওয়ার্ড নিশ্চিত করুন</Label>
                  <Input
                    type={showCurrentPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="আবার পাসওয়ার্ড লিখুন"
                  />
                </div>
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPw || !newPassword || !confirmPassword}
                variant="outline"
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                {changingPw ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Package & Billing info ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-amber-500" />
              প্যাকেজ ও বিলিং তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-lg">High Smart Enterprise</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    সীমাহীন রেস্টুরেন্ট • সীমাহীন স্টাফ • AI অ্যানালিটিক্স • কেন্দ্রীয় নিয়ন্ত্রণ
                  </p>
                </div>
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-400/30 border">সক্রিয়</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">সাপোর্টের জন্য যোগাযোগ করুন</p>
              <p>• WhatsApp: <a href="https://wa.me/8801XXXXXXXXX" className="text-primary hover:underline">+880 1XXX-XXXXXX</a></p>
              <p>• ইমেইল: <a href="mailto:support@nexcoreltd.com" className="text-primary hover:underline">support@nexcoreltd.com</a></p>
              <p>• প্যাকেজ আপগ্রেড বা পেমেন্ট সংক্রান্ত যেকোনো প্রশ্নে আমাদের সাথে যোগাযোগ করুন।</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Restaurant activate/deactivate management ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              রেস্টুরেন্ট সক্রিয়/নিষ্ক্রিয় ব্যবস্থাপনা
            </CardTitle>
            <Badge variant="outline">{restaurants.length}টি</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {restaurantsQuery.isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>
            ) : restaurants.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">কোনো রেস্টুরেন্ট নেই।</div>
            ) : (
              restaurants.map((r) => {
                const isActive = r.status !== "inactive";
                return (
                  <div
                    key={r.restaurant_id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{r.name}</p>
                        {r.branch_code && (
                          <Badge variant="outline" className="text-[10px]">{r.branch_code}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{r.address || "ঠিকানা নেই"}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}
                      </span>
                      <Switch
                        checked={isActive}
                        disabled={statusMutation.isPending}
                        onCheckedChange={() => statusMutation.mutate({ id: r.restaurant_id, status: r.status })}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
