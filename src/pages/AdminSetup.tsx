import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UtensilsCrossed, ArrowRight, Loader2 } from "lucide-react";
import { FREE_TRIAL_DAYS } from "@/constants/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminSetup = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("invite");
  
  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If user already has a restaurant, redirect
    if (!loading && user && role === "admin") {
      supabase.rpc("get_user_restaurant_id", { _user_id: user.id }).then(({ data }) => {
        if (data) {
          navigate("/admin", { replace: true });
        } else {
          setChecking(false);
        }
      });
    } else if (!loading && !user) {
      navigate("/login", { replace: true });
    } else if (!loading) {
      setChecking(false);
    }
  }, [user, role, loading, navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !user) return;
    setSubmitting(true);

    try {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + FREE_TRIAL_DAYS);

      const { error: restError } = await supabase
        .from("restaurants")
        .insert({
          name: restaurantName.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          plan: "basic",
          owner_id: user.id,
          status: "active",
          trial_ends_at: trialEndsAt.toISOString(),
        });

      if (restError) throw restError;

      // Update invite status if came from invite
      if (inviteId) {
        await supabase
          .from("admin_invites" as any)
          .update({ status: "accepted", accepted_at: new Date().toISOString(), restaurant_name: restaurantName.trim() } as any)
          .eq("id", inviteId);
      }

      toast.success("রেস্টুরেন্ট সেটআপ সম্পন্ন!");
      window.location.href = "/admin";
    } catch (err: any) {
      toast.error(err.message || "সেটআপ করতে সমস্যা হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-fade-up">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">রেস্টুরেন্ট সেটআপ</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">আপনার রেস্টুরেন্টের তথ্য দিন</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label>রেস্টুরেন্টের নাম <span className="text-destructive">*</span></Label>
              <Input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} placeholder="আপনার রেস্টুরেন্টের নাম" required />
            </div>
            <div className="space-y-2">
              <Label>ঠিকানা</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="ঠিকানা" />
            </div>
            <div className="space-y-2">
              <Label>ফোন নম্বর</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+880..." />
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success">
              ✦ Basic প্ল্যান — ৭ দিনের ফ্রি ট্রায়াল অটোমেটিক শুরু হবে
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {submitting ? "সেটআপ হচ্ছে..." : "সেটআপ সম্পন্ন করুন"}
              {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;
