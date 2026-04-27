import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEnterpriseRestaurant, useEnterpriseContext } from "@/hooks/useEnterpriseAdmin";

// ─── Sanitization ─────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const sanitizeEmail = (v: string) => v.trim().toLowerCase();
const isValidEmail = (v: string) => EMAIL_RE.test(v);

export default function EnterpriseAddRestaurant() {
  const navigate = useNavigate();
  const { groupId } = useEnterpriseContext();
  const createMutation = useCreateEnterpriseRestaurant(groupId);

  const [form, setForm] = useState({
    admin_full_name: "",
    admin_email: "",
    admin_phone: "",
    admin_password: "",
    restaurant_name: "",
    restaurant_phone: "",
    restaurant_address: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((c) => ({ ...c, [k]: e.target.value }));

  const cleanEmail = sanitizeEmail(form.admin_email);
  const emailOk = isValidEmail(cleanEmail);
  const formOk =
    form.admin_full_name.trim().length >= 2 &&
    emailOk &&
    form.admin_password.length >= 6 &&
    form.restaurant_name.trim().length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) { toast.error("Enterprise group এখনো প্রস্তুত নয়।"); return; }
    if (!formOk) { toast.error("সকল প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন।"); return; }

    try {
      await createMutation.mutateAsync({
        group_id: groupId,
        admin_full_name: form.admin_full_name.trim(),
        admin_email: cleanEmail,
        admin_phone: form.admin_phone.trim(),
        admin_password: form.admin_password,
        restaurant_name: form.restaurant_name.trim(),
        restaurant_phone: form.restaurant_phone.trim(),
        restaurant_address: form.restaurant_address.trim(),
      });
      toast.success("রেস্টুরেন্ট ও Branch Admin সফলভাবে তৈরি হয়েছে।");
      navigate("/enterprise/restaurants");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "রেস্টুরেন্ট তৈরি করা যায়নি।");
    }
  };

  return (
    <DashboardLayout role="group_owner" title="রেস্টুরেন্ট যোগ করুন">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>নতুন পরিচালিত রেস্টুরেন্ট যোগ করুন</CardTitle>
            <p className="text-sm text-muted-foreground">
              Admin account এবং রেস্টুরেন্ট একসাথে তৈরি হবে। Admin সরাসরি login করতে পারবে।
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 md:grid-cols-2">

                {/* Admin info */}
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Branch Admin-এর তথ্য
                  </p>

                  <div className="space-y-1.5">
                    <Label>পুরো নাম *</Label>
                    <Input
                      value={form.admin_full_name}
                      onChange={set("admin_full_name")}
                      placeholder="যেমন: মোঃ রহিম উদ্দিন"
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>ইমেইল * (Login ID)</Label>
                    <Input
                      type="email"
                      value={form.admin_email}
                      onChange={set("admin_email")}
                      placeholder="admin@restaurant.com"
                      maxLength={320}
                      required
                    />
                    {form.admin_email.length > 0 && !emailOk && (
                      <p className="text-xs text-destructive">সঠিক ইমেইল ঠিকানা লিখুন</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>ফোন নম্বর</Label>
                    <Input
                      value={form.admin_phone}
                      onChange={set("admin_phone")}
                      placeholder="01XXXXXXXXX"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>পাসওয়ার্ড * (কমপক্ষে ৬ অক্ষর)</Label>
                    <Input
                      type="password"
                      minLength={6}
                      maxLength={128}
                      value={form.admin_password}
                      onChange={set("admin_password")}
                      placeholder="শক্তিশালী পাসওয়ার্ড দিন"
                      required
                    />
                    {form.admin_password.length > 0 && form.admin_password.length < 6 && (
                      <p className="text-xs text-destructive">কমপক্ষে ৬ অক্ষর দিন</p>
                    )}
                  </div>
                </div>

                {/* Restaurant info */}
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    রেস্টুরেন্টের তথ্য
                  </p>

                  <div className="space-y-1.5">
                    <Label>রেস্টুরেন্টের নাম *</Label>
                    <Input
                      value={form.restaurant_name}
                      onChange={set("restaurant_name")}
                      placeholder="যেমন: পান্শি রেস্টুরেন্ট - ধানমন্ডি শাখা"
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>রেস্টুরেন্টের ফোন</Label>
                    <Input
                      value={form.restaurant_phone}
                      onChange={set("restaurant_phone")}
                      placeholder="01XXXXXXXXX"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>রেস্টুরেন্টের ঠিকানা</Label>
                    <Textarea
                      value={form.restaurant_address}
                      onChange={set("restaurant_address")}
                      placeholder="সম্পূর্ণ ঠিকানা লিখুন"
                      rows={6}
                      maxLength={500}
                    />
                  </div>
                </div>
              </div>

              {/* Info note */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">তৈরি হওয়ার পর:</p>
                <p>• Admin সরাসরি দেওয়া email ও password দিয়ে login করতে পারবে</p>
                <p>• Admin শুধু এই রেস্টুরেন্টের dashboard দেখতে পাবে</p>
                <p>• আপনি যেকোনো সময় এই রেস্টুরেন্টের তথ্য পরিবর্তন করতে পারবেন</p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/enterprise/restaurants")}
                >
                  বাতিল
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !formOk}
                  className="gap-2"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> তৈরি হচ্ছে...</>
                  ) : "রেস্টুরেন্ট তৈরি করুন"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
