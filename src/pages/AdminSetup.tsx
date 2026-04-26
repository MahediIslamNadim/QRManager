import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UtensilsCrossed, ArrowRight, Loader2, Building2 } from "lucide-react";
import { FREE_TRIAL_DAYS } from "@/constants/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminSetup = () => {
  const navigate = useNavigate();
  const { user, role, loading, refetchUserData } = useAuth();
  const [searchParams] = useSearchParams();

  // Normal invite (old flow)
  const inviteId = searchParams.get("invite");
  // Branch admin invite (new flow) — restaurant already exists in DB
  const branchRestaurantId = searchParams.get("branch_restaurant_id");
  const groupId = searchParams.get("group_id");

  const isBranchInvite = !!branchRestaurantId;

  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [branchInfo, setBranchInfo] = useState<{ name: string; address: string | null } | null>(null);

  // If this is a branch invite, load the branch restaurant info
  useEffect(() => {
    if (isBranchInvite && branchRestaurantId) {
      supabase
        .from("restaurants")
        .select("name, address")
        .eq("id", branchRestaurantId)
        .single()
        .then(({ data }) => {
          if (data) setBranchInfo({ name: data.name, address: data.address });
        });
    }
  }, [isBranchInvite, branchRestaurantId]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (role === "super_admin") {
      navigate("/super-admin", { replace: true });
      return;
    }

    if (role === "group_owner") {
      navigate("/enterprise/dashboard", { replace: true });
      return;
    }

    // For branch invite flow — if user already has role "admin" and is linked to a restaurant,
    // just redirect to /admin (they're already set up)
    if (role === "admin") {
      supabase.rpc("get_user_restaurant_id", { _user_id: user.id })
        .then(async ({ data, error }) => {
          if (error) { console.warn("RPC error:", error); setChecking(false); return; }
          if (data) {
            // Already set up — accept invite and redirect
            if (inviteId) {
              await supabase
                .from("admin_invites" as any)
                .update({ status: "accepted", accepted_at: new Date().toISOString() } as any)
                .eq("id", inviteId);
            }
            navigate("/admin", { replace: true });
          } else {
            setChecking(false);
          }
        })
        .catch((err: any) => {
          console.warn("Restaurant ID check failed:", err);
          setChecking(false);
        });
    } else {
      setChecking(false);
    }
  }, [user, role, loading, navigate, inviteId, isBranchInvite]);

  // Branch invite flow: user is already linked to the restaurant via edge function.
  // We just need to confirm and redirect them to their admin dashboard.
  const handleBranchSetupComplete = async () => {
    if (!user || !branchRestaurantId) return;
    setSubmitting(true);
    try {
      // Ensure the role is properly set in user_roles (edge function may have done this,
      // but we double-check here for reliability)
      await supabase.from("user_roles" as any).upsert(
        { user_id: user.id, role: "admin" },
        { onConflict: "user_id,role" }
      );

      // Ensure profile is linked to this restaurant
      await supabase.from("profiles" as any).upsert(
        { id: user.id, restaurant_id: branchRestaurantId },
        { onConflict: "id" }
      );

      // Update branch invitation status
      if (branchInfo) {
        try {
          await (supabase.from("branch_invitations") as any)
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("restaurant_id", branchRestaurantId)
            .eq("invited_email", user.email);
        } catch {
          // Ignore
        }
      }

      // Refetch auth context so the new role takes effect
      await refetchUserData(user.id);

      toast.success("সেটআপ সম্পন্ন! আপনার Branch Dashboard-এ যাচ্ছেন...");
      navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "সেটআপ করতে সমস্যা হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  // Normal setup flow (new restaurant)
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !user) return;
    setSubmitting(true);

    try {
      const { data: setupData, error: setupError } = await supabase.rpc(
        "complete_admin_signup" as any,
        {
          p_restaurant_name: restaurantName.trim(),
          p_address: address.trim() || null,
          p_phone: phone.trim() || null,
          p_trial_days: FREE_TRIAL_DAYS,
        } as any,
      );

      if (setupError && !setupError.message.includes("already_setup")) {
        throw new Error("সেটআপ ব্যর্থ: " + setupError.message);
      }

      // Mark invite accepted if this setup came from an invite link
      if (inviteId) {
        await supabase
          .from("admin_invites" as any)
          .update({ status: "accepted", accepted_at: new Date().toISOString(), restaurant_name: restaurantName.trim() } as any)
          .eq("id", inviteId)
          .eq("email", user.email)
          .eq("status", "pending");
      }

      toast.success("রেস্টুরেন্ট সেটআপ সম্পন্ন!");
      navigate("/admin");
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

  // ── Branch invite UI ──────────────────────────────────────────
  if (isBranchInvite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-up">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Branch Admin হিসেবে যোগ দিন</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              আপনাকে একটি শাখার Admin হিসেবে আমন্ত্রণ জানানো হয়েছে
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {branchInfo && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">আপনার শাখা</p>
                <p className="font-semibold text-lg">{branchInfo.name}</p>
                {branchInfo.address && (
                  <p className="text-sm text-muted-foreground">{branchInfo.address}</p>
                )}
              </div>
            )}

            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success">
              ✦ আপনার account তৈরি হয়ে গেছে। নিচের বাটনে ক্লিক করলেই Dashboard দেখতে পাবেন।
            </div>

            <Button
              onClick={handleBranchSetupComplete}
              className="w-full gap-2"
              disabled={submitting}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> সেটআপ হচ্ছে...</>
                : <>Branch Dashboard-এ যান <ArrowRight className="w-4 h-4" /></>
              }
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Normal new restaurant setup UI ───────────────────────────
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
              ✦ Basic প্ল্যান — {FREE_TRIAL_DAYS} দিনের ফ্রি ট্রায়াল অটোমেটিক শুরু হবে
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
