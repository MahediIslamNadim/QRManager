import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Crown, LogOut, CheckCircle, Loader2, Smartphone, Zap, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const paidPlans = [
  { id: "basic", name: "Basic", price: 500, priceText: "৫০০ টাকা/মাস", features: ["মেনু ম্যানেজমেন্ট", "QR কোড", "অর্ডার ম্যানেজমেন্ট"] },
  { id: "premium", name: "Premium", price: 1000, priceText: "১,০০০ টাকা/মাস", features: ["সব Basic ফিচার", "এনালিটিক্স", "স্টাফ ম্যানেজমেন্ট", "প্রায়োরিটি সাপোর্ট"], popular: true },
  { id: "enterprise", name: "Enterprise", price: 2500, priceText: "২,৫০০ টাকা/মাস", features: ["সব Premium ফিচার", "মাল্টি-ব্রাঞ্চ", "কাস্টম ব্র্যান্ডিং", "ডেডিকেটেড সাপোর্ট"] },
];

const BKASH_NUMBER = "01786130439";
const NAGAD_NUMBER = "01786130439";

const TrialExpired = () => {
  const { user, restaurantId, signOut } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("bkash");
  const [transactionId, setTransactionId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trialActivated, setTrialActivated] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);

  const selectedPlanData = paidPlans.find(p => p.id === selectedPlan);

  const handleActivateTrial = async () => {
    if (!user || !restaurantId) return;
    setActivatingTrial(true);
    try {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const { error } = await supabase
        .from("restaurants")
        .update({
          plan: "basic",
          status: "active",
          trial_ends_at: trialEndsAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", restaurantId);

      if (error) throw error;
      toast.success("১৪ দিনের ফ্রি ট্রায়াল সক্রিয় হয়েছে!");
      setTrialActivated(true);
    } catch (err: any) {
      toast.error(err.message || "ট্রায়াল সক্রিয় করতে সমস্যা হয়েছে");
    } finally {
      setActivatingTrial(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!transactionId.trim() || !selectedPlan || !user || !restaurantId) {
      toast.error("সব তথ্য পূরণ করুন");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("payment_requests" as any).insert({
        restaurant_id: restaurantId,
        user_id: user.id,
        plan: selectedPlan,
        amount: selectedPlanData?.price || 0,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim(),
        phone_number: phoneNumber.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে!");
    } catch (err: any) {
      toast.error(err.message || "পেমেন্ট রিকোয়েস্ট ব্যর্থ");
    } finally {
      setSubmitting(false);
    }
  };

  if (trialActivated) {
    return <Navigate to="/admin" replace />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mx-auto">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে!</h1>
          <p className="text-muted-foreground">
            আপনার Transaction ID: <strong className="text-foreground">{transactionId}</strong><br />
            যাচাই করা হলে আপনার অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে সক্রিয় হবে। সাধারণত ১-২ ঘণ্টার মধ্যে যাচাই সম্পন্ন হয়।
          </p>
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" /> লগ আউট
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8 animate-fade-up">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/10 mx-auto">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">প্যাকেজ নির্বাচন করুন</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            ফ্রি ট্রায়াল ব্যবহার করুন অথবা পেইড প্ল্যান বেছে নিন।
          </p>
        </div>

        {/* Trial Card */}
        <Card
          className={`border-2 border-dashed border-success/50 bg-success/5 cursor-pointer transition-all hover:shadow-lg ${
            selectedPlan === "trial" ? "ring-2 ring-success border-success shadow-lg" : ""
          }`}
          onClick={() => setSelectedPlan("trial")}
        >
          <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-6">
            <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center flex-shrink-0">
              <Gift className="w-7 h-7 text-success" />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h3 className="text-xl font-display font-bold text-foreground">ফ্রি ট্রায়াল — ১৪ দিন</h3>
              <p className="text-muted-foreground text-sm">কোনো পেমেন্ট ছাড়াই Basic ফিচার ব্যবহার করুন। মেনু, QR কোড, অর্ডার ম্যানেজমেন্ট সব ফ্রি!</p>
              <p className="text-xs text-success font-medium">✦ কোনো টাকা লাগবে না • স্বয়ংক্রিয়ভাবে সক্রিয় হবে</p>
            </div>
            <Button
              variant="hero"
              size="lg"
              className="bg-success hover:bg-success/90 text-white flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); handleActivateTrial(); }}
              disabled={activatingTrial}
            >
              {activatingTrial ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {activatingTrial ? "সক্রিয় হচ্ছে..." : "ট্রায়াল শুরু করুন"}
            </Button>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground font-medium px-2">অথবা পেইড প্ল্যান বেছে নিন</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Paid Plans */}
        <div className="grid sm:grid-cols-3 gap-4">
          {paidPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative cursor-pointer transition-all ${
                selectedPlan === plan.id ? "border-primary shadow-lg ring-2 ring-primary/20" :
                plan.popular ? "border-primary/50" : ""
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1">
                    <Crown className="w-3 h-3" /> জনপ্রিয়
                  </span>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-display">{plan.name}</CardTitle>
                <p className="text-2xl font-bold text-primary">{plan.priceText}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={selectedPlan === plan.id ? "hero" : "outline"}
                  className="w-full"
                  onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan.id); }}
                >
                  {selectedPlan === plan.id ? "✓ নির্বাচিত" : "নির্বাচন করুন"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Form */}
        {selectedPlan && selectedPlan !== "trial" && (
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Smartphone className="w-5 h-5" /> পেমেন্ট করুন — {selectedPlanData?.name} ({selectedPlanData?.priceText})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-accent/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-foreground">পেমেন্ট নির্দেশনা:</p>
                <p className="text-muted-foreground">১. নিচের যেকোনো একটি নম্বরে <strong className="text-primary">{selectedPlanData?.priceText}</strong> পাঠান</p>
                <div className="grid grid-cols-2 gap-3 my-2">
                  <div className="bg-background rounded-md p-3 text-center border border-border">
                    <p className="font-bold text-primary">bKash</p>
                    <p className="text-foreground font-mono">{BKASH_NUMBER}</p>
                    <p className="text-xs text-muted-foreground">Send Money</p>
                  </div>
                  <div className="bg-background rounded-md p-3 text-center border border-border">
                    <p className="font-bold text-primary">Nagad</p>
                    <p className="text-foreground font-mono">{NAGAD_NUMBER}</p>
                    <p className="text-xs text-muted-foreground">Send Money</p>
                  </div>
                </div>
                <p className="text-muted-foreground">২. Transaction ID নিচে দিন</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>পেমেন্ট মাধ্যম</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>আপনার মোবাইল নম্বর</Label>
                  <Input placeholder="01XXXXXXXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transaction ID <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="যেমন: TXN12345ABC"
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  required
                />
              </div>

              <Button
                variant="hero"
                className="w-full h-12"
                onClick={handleSubmitPayment}
                disabled={submitting || !transactionId.trim()}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {submitting ? "পাঠানো হচ্ছে..." : "পেমেন্ট রিকোয়েস্ট পাঠান"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" /> লগ আউট
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrialExpired;
