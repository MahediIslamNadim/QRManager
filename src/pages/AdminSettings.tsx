import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Store, Save, Loader2, CreditCard, Check, Crown, Copy, AlertCircle, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLANS_LIST } from "@/constants/pricing";

// ✅ আপনার bKash নম্বর এখানে দিন
const BKASH_NUMBER = "01786130439";

const plans = PLANS_LIST;

const AdminSettings = () => {
  const { user, restaurantId } = useAuth();

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [restName, setRestName] = useState("");
  const [restAddress, setRestAddress] = useState("");
  const [restPhone, setRestPhone] = useState("");
  const [currentPlan, setCurrentPlan] = useState("basic");
  const [restSaving, setRestSaving] = useState(false);

  const [payDialog, setPayDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [transactionId, setTransactionId] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payStep, setPayStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setProfileName(data.full_name || "");
        setProfileEmail(data.email || "");
        setProfilePhone(data.phone || "");
      }
    });
    if (restaurantId) {
      supabase.from("restaurants").select("*").eq("id", restaurantId).single().then(({ data }) => {
        if (data) {
          setRestName(data.name || "");
          setRestAddress(data.address || "");
          setRestPhone(data.phone || "");
          setCurrentPlan(data.plan || "basic");
        }
      });
    }
  }, [user, restaurantId]);

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: profileName, phone: profilePhone, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("প্রোফাইল আপডেট হয়েছে ✅");
    } catch (err: any) {
      toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveRestaurant = async () => {
    if (!restaurantId) return;
    setRestSaving(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ name: restName, address: restAddress, phone: restPhone, updated_at: new Date().toISOString() })
        .eq("id", restaurantId);
      if (error) throw error;
      toast.success("রেস্টুরেন্ট তথ্য আপডেট হয়েছে ✅");
    } catch (err: any) {
      toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setRestSaving(false);
    }
  };

  const openPayment = (planId: string) => {
    setSelectedPlan(planId);
    setTransactionId("");
    setPayPhone("");
    setPayStep(1);
    setPayDialog(true);
  };

  const copyBkashNumber = () => {
    navigator.clipboard.writeText(BKASH_NUMBER);
    toast.success("bKash নম্বর কপি হয়েছে! 📋");
  };

  const submitPayment = async () => {
    if (!user || !restaurantId || !transactionId.trim()) return;
    setPaySubmitting(true);
    const plan = plans.find(p => p.id === selectedPlan);
    const amount = billingCycle === "monthly" ? plan?.monthlyPrice : plan?.yearlyPrice;
    try {
      const { error } = await supabase.from("payment_requests" as any).insert({
        user_id: user.id,
        restaurant_id: restaurantId,
        plan: selectedPlan,
        billing_cycle: billingCycle,
        amount: amount || 0,
        payment_method: "bkash",
        transaction_id: transactionId.trim(),
        phone_number: payPhone.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("✅ পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে! ২৪ ঘন্টার মধ্যে অনুমোদন হবে।");
      setPayDialog(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPaySubmitting(false);
    }
  };

  const selectedPlanData = plans.find(p => p.id === selectedPlan);
  const selectedAmount = billingCycle === "monthly" ? selectedPlanData?.monthlyPrice : selectedPlanData?.yearlyPrice;

  return (
    <DashboardLayout role="admin" title="সেটিংস">
      <div className="max-w-4xl space-y-6 animate-fade-up">
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2"><User className="w-4 h-4" /> প্রোফাইল</TabsTrigger>
            <TabsTrigger value="restaurant" className="flex items-center gap-2"><Store className="w-4 h-4" /> রেস্টুরেন্ট</TabsTrigger>
            <TabsTrigger value="plan" className="flex items-center gap-2"><Crown className="w-4 h-4" /> প্ল্যান</TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">অ্যাকাউন্ট প্রোফাইল</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>পুরো নাম</Label><Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="আপনার নাম" /></div>
                <div className="space-y-2">
                  <Label>ইমেইল</Label>
                  <Input value={profileEmail} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">ইমেইল পরিবর্তন করা যায় না</p>
                </div>
                <div className="space-y-2"><Label>ফোন নম্বর</Label><Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+880..." /></div>
                <Button variant="hero" onClick={saveProfile} disabled={profileSaving} className="w-full">
                  {profileSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {profileSaving ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Restaurant Tab ── */}
          <TabsContent value="restaurant">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">রেস্টুরেন্ট তথ্য</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>রেস্টুরেন্টের নাম</Label><Input value={restName} onChange={e => setRestName(e.target.value)} /></div>
                <div className="space-y-2"><Label>ঠিকানা</Label><Input value={restAddress} onChange={e => setRestAddress(e.target.value)} /></div>
                <div className="space-y-2"><Label>ফোন নম্বর</Label><Input value={restPhone} onChange={e => setRestPhone(e.target.value)} /></div>
                <Button variant="hero" onClick={saveRestaurant} disabled={restSaving} className="w-full">
                  {restSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {restSaving ? "সেভ হচ্ছে..." : "রেস্টুরেন্ট তথ্য সেভ করুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Plan Tab ── */}
          <TabsContent value="plan">
            <div className="space-y-6">
              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setBillingCycle("monthly")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${billingCycle === "monthly" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground"}`}>
                  মাসিক
                </button>
                <button onClick={() => setBillingCycle("yearly")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${billingCycle === "yearly" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground"}`}>
                  বার্ষিক <span className="text-xs ml-1 opacity-80">(১৭% সেভ)</span>
                </button>
              </div>

              {/* Plan cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {plans.map((plan) => {
                  const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                  const isCurrentPlan = currentPlan === plan.id;
                  return (
                    <Card key={plan.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${plan.popular ? "border-primary/50 shadow-primary/10 shadow-lg" : ""} ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}>
                      {plan.popular && <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />}
                      {plan.popular && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold whitespace-nowrap">
                          জনপ্রিয়
                        </div>
                      )}
                      {isCurrentPlan && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">বর্তমান</div>
                      )}
                      <CardContent className="p-5 sm:p-6 text-center">
                        <h3 className="font-display font-bold text-lg text-foreground mb-1 mt-4">{plan.name}</h3>
                        <div className="mb-4">
                          <span className="text-3xl font-display font-bold text-foreground">৳{price}</span>
                          <span className="text-sm text-muted-foreground">/{billingCycle === "monthly" ? "মাস" : "বছর"}</span>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-success flex-shrink-0" />{f}
                            </li>
                          ))}
                        </ul>
                        <Button variant={plan.popular ? "hero" : "outline"} className="w-full"
                          disabled={isCurrentPlan} onClick={() => openPayment(plan.id)}>
                          {isCurrentPlan ? "✅ অ্যাক্টিভ" : "আপগ্রেড করুন"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* bKash info banner */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20">
                <Smartphone className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">bKash এ পেমেন্ট করুন</p>
                  <p className="text-xs text-muted-foreground mt-0.5">প্ল্যান সিলেক্ট করুন → bKash এ Send Money করুন → Transaction ID দিন → ২৪ ঘন্টায় অ্যাক্টিভ হবে</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Payment Dialog ── */}
      <Dialog open={payDialog} onOpenChange={v => { setPayDialog(v); if (!v) setPayStep(1); }}>
        <DialogContent className="max-w-sm mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-pink-500" />
              </div>
              bKash পেমেন্ট
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Plan summary */}
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">নির্বাচিত প্ল্যান</p>
              <p className="font-display font-bold text-lg text-foreground capitalize">
                {selectedPlanData?.name} — {billingCycle === "monthly" ? "মাসিক" : "বার্ষিক"}
              </p>
              <p className="text-3xl font-bold text-pink-500 mt-1">৳{selectedAmount}</p>
            </div>

            {payStep === 1 ? (
              <>
                {/* Step 1: Show bKash number */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-5 h-5 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center font-bold">১</div>
                    <p className="text-sm font-semibold text-foreground">এই নম্বরে Send Money করুন</p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-pink-500/10 border-2 border-pink-500/30">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">bKash নম্বর</p>
                      <p className="text-2xl font-bold text-pink-500 font-mono">{BKASH_NUMBER}</p>
                    </div>
                    <button onClick={copyBkashNumber}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-500 text-white text-xs font-semibold hover:bg-pink-600 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> কপি
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <p className="text-xs font-semibold text-foreground">পেমেন্ট করার নিয়ম:</p>
                    <ol className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2"><span className="text-pink-500 font-bold flex-shrink-0">১.</span> bKash app খুলুন</li>
                      <li className="flex items-start gap-2"><span className="text-pink-500 font-bold flex-shrink-0">২.</span> "Send Money" সিলেক্ট করুন</li>
                      <li className="flex items-start gap-2"><span className="text-pink-500 font-bold flex-shrink-0">৩.</span> উপরের নম্বরে <span className="font-semibold text-foreground mx-1">৳{selectedAmount}</span> পাঠান</li>
                      <li className="flex items-start gap-2"><span className="text-pink-500 font-bold flex-shrink-0">৪.</span> Transaction ID টি সংরক্ষণ করুন</li>
                    </ol>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
                    <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">পেমেন্ট করার পর "পরবর্তী ধাপ" বাটনে ক্লিক করুন এবং Transaction ID দিন।</p>
                  </div>

                  <Button variant="hero" className="w-full h-11" onClick={() => setPayStep(2)}>
                    পেমেন্ট করেছি — পরবর্তী ধাপ →
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Enter TXN ID */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-5 h-5 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center font-bold">২</div>
                    <p className="text-sm font-semibold text-foreground">Transaction ID দিন</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Transaction ID *</Label>
                    <Input value={transactionId} onChange={e => setTransactionId(e.target.value)}
                      placeholder="যেমন: 8A6D2F1K9X" className="h-10 font-mono text-sm" />
                    <p className="text-xs text-muted-foreground">bKash SMS এ Transaction ID পাবেন</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">আপনার bKash নম্বর (ঐচ্ছিক)</Label>
                    <Input value={payPhone} onChange={e => setPayPhone(e.target.value)}
                      placeholder="01XXXXXXXXX" className="h-10 text-sm" />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="h-10 px-4" onClick={() => setPayStep(1)}>
                      ← পেছনে
                    </Button>
                    <Button variant="hero" className="flex-1 h-10"
                      onClick={submitPayment}
                      disabled={paySubmitting || !transactionId.trim()}>
                      {paySubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                      {paySubmitting ? "পাঠানো হচ্ছে..." : "রিকোয়েস্ট পাঠান"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminSettings;
