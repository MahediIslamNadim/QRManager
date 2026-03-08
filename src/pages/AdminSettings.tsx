import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Store, Save, Loader2, CreditCard, Check, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const plans = [
  {
    id: "basic",
    name: "বেসিক",
    monthlyPrice: 499,
    yearlyPrice: 4999,
    features: ["৫০ টি মেনু আইটেম", "৫ টি টেবিল", "QR কোড মেনু", "বেসিক রিপোর্ট"],
  },
  {
    id: "premium",
    name: "প্রিমিয়াম",
    monthlyPrice: 999,
    yearlyPrice: 9999,
    popular: true,
    features: ["আনলিমিটেড মেনু আইটেম", "২০ টি টেবিল", "রিয়েলটাইম অর্ডার", "অ্যাডভান্সড অ্যানালিটিক্স", "ওয়েটার ম্যানেজমেন্ট"],
  },
  {
    id: "enterprise",
    name: "এন্টারপ্রাইজ",
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    features: ["সব প্রিমিয়াম ফিচার", "আনলিমিটেড টেবিল", "মাল্টি-ব্রাঞ্চ সাপোর্ট", "ডেডিকেটেড সাপোর্ট", "কাস্টম ব্র্যান্ডিং"],
  },
];

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

  // Payment dialog
  const [payDialog, setPayDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [payMethod, setPayMethod] = useState("bkash");
  const [transactionId, setTransactionId] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

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
      toast.success("প্রোফাইল আপডেট হয়েছে");
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
      toast.success("রেস্টুরেন্ট তথ্য আপডেট হয়েছে");
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
    setPayDialog(true);
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
        payment_method: payMethod,
        transaction_id: transactionId.trim(),
        phone_number: payPhone.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে! অনুমোদনের জন্য অপেক্ষা করুন।");
      setPayDialog(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPaySubmitting(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="সেটিংস">
      <div className="max-w-4xl space-y-6 animate-fade-up">
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2"><User className="w-4 h-4" /> প্রোফাইল</TabsTrigger>
            <TabsTrigger value="restaurant" className="flex items-center gap-2"><Store className="w-4 h-4" /> রেস্টুরেন্ট</TabsTrigger>
            <TabsTrigger value="plan" className="flex items-center gap-2"><Crown className="w-4 h-4" /> প্ল্যান</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">অ্যাকাউন্ট প্রোফাইল</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>পুরো নাম</Label><Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="আপনার নাম" /></div>
                <div className="space-y-2"><Label>ইমেইল</Label><Input value={profileEmail} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">ইমেইল পরিবর্তন করা যায় না</p></div>
                <div className="space-y-2"><Label>ফোন নম্বর</Label><Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+880..." /></div>
                <Button variant="hero" onClick={saveProfile} disabled={profileSaving} className="w-full">
                  {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {profileSaving ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="restaurant">
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">রেস্টুরেন্ট তথ্য</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>রেস্টুরেন্টের নাম</Label><Input value={restName} onChange={e => setRestName(e.target.value)} /></div>
                <div className="space-y-2"><Label>ঠিকানা</Label><Input value={restAddress} onChange={e => setRestAddress(e.target.value)} /></div>
                <div className="space-y-2"><Label>ফোন নম্বর</Label><Input value={restPhone} onChange={e => setRestPhone(e.target.value)} /></div>
                <Button variant="hero" onClick={saveRestaurant} disabled={restSaving} className="w-full">
                  {restSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {restSaving ? "সেভ হচ্ছে..." : "রেস্টুরেন্ট তথ্য সেভ করুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan">
            <div className="space-y-6">
              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${billingCycle === "monthly" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground"}`}
                >
                  মাসিক
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${billingCycle === "yearly" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground"}`}
                >
                  বার্ষিক <span className="text-xs ml-1 opacity-80">(১৭% সেভ)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                  const isCurrentPlan = currentPlan === plan.id;
                  return (
                    <Card key={plan.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${plan.popular ? "border-primary/50 shadow-primary/10 shadow-lg" : ""} ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}>
                      {plan.popular && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                      )}
                      {isCurrentPlan && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          বর্তমান
                        </div>
                      )}
                      <CardContent className="p-6 text-center">
                        <h3 className="font-display font-bold text-lg text-foreground mb-1">{plan.name}</h3>
                        <div className="mb-4">
                          <span className="text-3xl font-display font-bold text-foreground">৳{price}</span>
                          <span className="text-sm text-muted-foreground">/{billingCycle === "monthly" ? "মাস" : "বছর"}</span>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-success flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant={plan.popular ? "hero" : "outline"}
                          className="w-full"
                          disabled={isCurrentPlan}
                          onClick={() => openPayment(plan.id)}
                        >
                          {isCurrentPlan ? "অ্যাক্টিভ" : "আপগ্রেড করুন"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">পেমেন্ট করুন</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-accent/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">নির্বাচিত প্ল্যান</p>
              <p className="font-display font-bold text-lg text-foreground capitalize">{selectedPlan} — {billingCycle === "monthly" ? "মাসিক" : "বার্ষিক"}</p>
              <p className="text-2xl font-bold text-primary mt-1">
                ৳{plans.find(p => p.id === selectedPlan)?.[billingCycle === "monthly" ? "monthlyPrice" : "yearlyPrice"]}
              </p>
            </div>
            <div className="space-y-2">
              <Label>পেমেন্ট মাধ্যম</Label>
              <div className="grid grid-cols-3 gap-2">
                {["bkash", "nagad", "rocket"].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} className={`py-2 rounded-lg text-sm font-medium transition-all border ${payMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {m === "bkash" ? "বিকাশ" : m === "nagad" ? "নগদ" : "রকেট"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Transaction ID *</Label><Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="TXN123456" /></div>
            <div className="space-y-2"><Label>ফোন নম্বর (ঐচ্ছিক)</Label><Input value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="01XXXXXXXXX" /></div>
            <Button variant="hero" className="w-full" onClick={submitPayment} disabled={paySubmitting || !transactionId.trim()}>
              {paySubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
              {paySubmitting ? "পাঠানো হচ্ছে..." : "পেমেন্ট রিকোয়েস্ট পাঠান"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminSettings;
