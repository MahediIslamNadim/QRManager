import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Store, Save, Loader2, CreditCard, Check, Crown, Copy, AlertCircle, Smartphone, MessageSquare, Bell, Palette, Upload, X, Eye, Lock } from "lucide-react";
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { useAuth } from "@/hooks/useAuth";

// ── BrandingGate: High Smart only wrapper ──
const BrandingGate = ({ restaurantId, children }: { restaurantId: string | undefined; children: React.ReactNode }) => {
  const { hasAccess, loading } = useFeatureGate('custom_branding', restaurantId);
  if (loading) return <div className="animate-pulse bg-muted rounded-2xl h-40" />;
  if (hasAccess) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border-2 border-dashed border-muted rounded-2xl">
      <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
        <Lock className="w-8 h-8 text-purple-500" />
      </div>
      <div>
        <p className="font-display font-semibold text-lg text-foreground">কাস্টম ব্র্যান্ডিং</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">লোগো, রং এবং ফন্ট কাস্টমাইজ করতে <strong>High Smart</strong> প্ল্যানে আপগ্রেড করুন।</p>
      </div>
      <a href="/settings" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity">
        👑 High Smart এ আপগ্রেড করুন
      </a>
    </div>
  );
};
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TIERS, formatPrice, type TierName, type BillingCycle } from "@/constants/tiers";

const BKASH_NUMBER = import.meta.env.VITE_BKASH_NUMBER || "01786130439";

const plans = [
  {
    id: 'medium_smart' as TierName,
    name: TIERS.medium_smart.name_bn,
    monthlyPrice: TIERS.medium_smart.price_monthly,
    yearlyPrice: TIERS.medium_smart.price_yearly,
    popular: true,
    maxTables: TIERS.medium_smart.maxTables,
    maxStaff: TIERS.medium_smart.maxStaff,
    features: [
      'QR কোড অর্ডারিং',
      'মেনু ম্যানেজমেন্ট',
      'টেবিল ম্যানেজমেন্ট (২০টি)',
      'অর্ডার ম্যানেজমেন্ট',
      'কিচেন ডিসপ্লে',
      'অ্যানালিটিক্স ড্যাশবোর্ড',
      'সেলস রিপোর্ট',
      'WhatsApp নোটিফিকেশন',
      'ইমেইল নোটিফিকেশন',
      'bKash/Nagad পেমেন্ট',
      'ক্যাশ ট্র্যাকিং',
      'বেসিক ইনভেন্টরি',
      'কাস্টমার ফিডব্যাক',
      '৫ জন স্টাফ',
    ],
  },
  {
    id: 'high_smart' as TierName,
    name: TIERS.high_smart.name_bn,
    monthlyPrice: TIERS.high_smart.price_monthly,
    yearlyPrice: TIERS.high_smart.price_yearly,
    popular: false,
    maxTables: -1,
    maxStaff: -1,
    features: [
      'মিডিয়াম স্মার্টের সব ফিচার',
      'আনলিমিটেড টেবিল',
      'আনলিমিটেড স্টাফ',
      'মাল্টি-লোকেশন সাপোর্ট',
      'AI রেকমেন্ডেশন (Gemini)',
      'প্রেডিক্টিভ অ্যানালিটিক্স',
      'কাস্টম ব্র্যান্ডিং',
      'অ্যাডভান্সড অ্যানালিটিক্স',
      'কাস্টম রিপোর্ট',
      'প্রায়োরিটি সাপোর্ট ২৪/৭',
      'ডেডিকেটেড ম্যানেজার',
    ],
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
  const [currentPlan, setCurrentPlan] = useState<string>("medium_smart");
  const [restSaving, setRestSaving] = useState(false);

  // ── Branding state ──
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);
  const [brandPrimary, setBrandPrimary] = useState("#f97316");
  const [brandSecondary, setBrandSecondary] = useState("#fb923c");
  const [brandFont, setBrandFont] = useState("default");
  const [brandSaving, setBrandSaving] = useState(false);
  const [showBrandPreview, setShowBrandPreview] = useState(false);

  const [wapiKey, setWapiKey] = useState("");
  const [notifyNewOrder, setNotifyNewOrder] = useState(false);
  const [notifyDailyReport, setNotifyDailyReport] = useState(false);
  const [wapiSaving, setWapiSaving] = useState(false);

  const [payDialog, setPayDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [transactionId, setTransactionId] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payStep, setPayStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!user) return;
    Promise.resolve(supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).then(({ data }) => {
      if (data) {
        setProfileName(data.full_name || "");
        setProfileEmail(data.email || "");
        setProfilePhone(data.phone || "");
      }
    }).catch(console.error);
    if (restaurantId) {
      Promise.resolve(supabase.from("restaurants").select("*").eq("id", restaurantId).maybeSingle()).then(({ data }) => {
        if (data) {
          setRestName(data.name || "");
          setRestAddress(data.address || "");
          setRestPhone(data.phone || "");
          setCurrentPlan(data.plan || "medium_smart");
          setBrandLogo(data.logo_url || null);
          setBrandPrimary(data.brand_primary || "#f97316");
          setBrandSecondary(data.brand_secondary || "#fb923c");
          setBrandFont(data.brand_font || "default");
          setWapiKey(data.whatsapp_api_key || "");
          setNotifyNewOrder(!!data.notify_new_order);
          setNotifyDailyReport(!!data.notify_daily_report);
        }
      }).catch(console.error);
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

  const saveWhatsApp = async () => {
    if (!restaurantId) return;
    setWapiSaving(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ whatsapp_api_key: wapiKey.trim() || null, notify_new_order: notifyNewOrder, notify_daily_report: notifyDailyReport })
        .eq("id", restaurantId);
      if (error) throw error;
      toast.success("WhatsApp সেটিংস সেভ হয়েছে ✅");
    } catch (err: any) {
      toast.error(err.message || "সেভ করতে সমস্যা হয়েছে");
    } finally {
      setWapiSaving(false);
    }
  };

  const openPayment = (planId: string) => {
    setSelectedPlan(planId);
    setTransactionId("");
    setPayPhone("");
    setPayStep(1);
    setPayDialog(true);
  };

  const handleLogoUpload = async (file: File) => {
    if (!restaurantId) return;
    const ext = file.name.split('.').pop();
    const path = `${restaurantId}/logo.${ext}`;
    const { error } = await supabase.storage
      .from('restaurant-logos')
      .upload(path, file, { upsert: true });
    if (error) { toast.error('লোগো আপলোড হয়নি: ' + error.message); return null; }
    const { data: { publicUrl } } = supabase.storage
      .from('restaurant-logos')
      .getPublicUrl(path);
    return publicUrl;
  };

  const saveBranding = async () => {
    if (!restaurantId) return;
    setBrandSaving(true);
    try {
      let logoUrl = brandLogo;
      if (brandLogoFile) {
        const uploaded = await handleLogoUpload(brandLogoFile);
        if (uploaded) { logoUrl = uploaded; setBrandLogo(uploaded); setBrandLogoFile(null); }
      }
      const { error } = await supabase
        .from('restaurants')
        .update({
          logo_url: logoUrl,
          brand_primary: brandPrimary,
          brand_secondary: brandSecondary,
          brand_font: brandFont,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);
      if (error) throw error;
      toast.success('ব্র্যান্ডিং সেভ হয়েছে ✅');
    } catch (err: any) {
      toast.error(err.message || 'সেভ করতে সমস্যা হয়েছে');
    } finally {
      setBrandSaving(false);
    }
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
      setTransactionId("");
      setPayPhone("");
      setPayStep(1);
    } catch (err: any) {
      toast.error(err.message);
      setPaySubmitting(false);
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="flex items-center gap-2"><User className="w-4 h-4" /><span className="hidden sm:inline">প্রোফাইল</span></TabsTrigger>
            <TabsTrigger value="restaurant" className="flex items-center gap-2"><Store className="w-4 h-4" /><span className="hidden sm:inline">রেস্টুরেন্ট</span></TabsTrigger>
            <TabsTrigger value="plan" className="flex items-center gap-2"><Crown className="w-4 h-4" /><span className="hidden sm:inline">প্ল্যান</span></TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2"><Palette className="w-4 h-4" /><span className="hidden sm:inline">ব্র্যান্ডিং</span></TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="w-4 h-4" /><span className="hidden sm:inline">নোটিফিকেশন</span></TabsTrigger>
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

          {/* ── Custom Branding Tab ── */}
          <TabsContent value="branding" className="space-y-4 mt-4">
            <BrandingGate restaurantId={restaurantId}><>
              {/* Logo Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" /> রেস্টুরেন্ট লোগো
                  </CardTitle>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-secondary/30 overflow-hidden flex-shrink-0">
                    {brandLogo || brandLogoFile ? (
                      <img
                        src={brandLogoFile ? URL.createObjectURL(brandLogoFile) : brandLogo!}
                        alt="Logo" className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                        <p className="text-[10px] text-muted-foreground">লোগো নেই</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4" /> লোগো আপলোড করুন
                      </div>
                    </Label>
                    <input id="logo-upload" type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setBrandLogoFile(f); }} />
                    {(brandLogo || brandLogoFile) && (
                      <button onClick={() => { setBrandLogo(null); setBrandLogoFile(null); }}
                        className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80">
                        <X className="w-3.5 h-3.5" /> লোগো মুছুন
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG — সর্বোচ্চ ২MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Color Pickers */}
            <Card>
              <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /> ব্র্যান্ড রং</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>প্রাইমারি রং</Label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={brandPrimary}
                        onChange={e => setBrandPrimary(e.target.value)}
                        className="w-12 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background" />
                      <Input value={brandPrimary} onChange={e => setBrandPrimary(e.target.value)}
                        placeholder="#f97316" className="font-mono text-sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">বাটন, হাইলাইট রং</p>
                  </div>
                  <div className="space-y-2">
                    <Label>সেকেন্ডারি রং</Label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={brandSecondary}
                        onChange={e => setBrandSecondary(e.target.value)}
                        className="w-12 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background" />
                      <Input value={brandSecondary} onChange={e => setBrandSecondary(e.target.value)}
                        placeholder="#fb923c" className="font-mono text-sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">গ্রেডিয়েন্ট, accent রং</p>
                  </div>
                </div>

                {/* Quick color presets */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">দ্রুত রং বেছে নিন:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'অরেঞ্জ', p: '#f97316', s: '#fb923c' },
                      { label: 'গ্রিন',  p: '#22c55e', s: '#4ade80' },
                      { label: 'ব্লু',   p: '#3b82f6', s: '#60a5fa' },
                      { label: 'পার্পল', p: '#a855f7', s: '#c084fc' },
                      { label: 'রেড',    p: '#ef4444', s: '#f87171' },
                      { label: 'টিল',    p: '#14b8a6', s: '#2dd4bf' },
                    ].map(preset => (
                      <button key={preset.label}
                        onClick={() => { setBrandPrimary(preset.p); setBrandSecondary(preset.s); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:border-primary/50 bg-secondary/30 hover:bg-secondary transition-all text-xs font-medium">
                        <span className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0" style={{ background: preset.p }} />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Font Family */}
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">ফন্ট স্টাইল</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'default', label: 'ডিফল্ট',    sample: 'আমাদের মেনু', style: {} },
                    { id: 'serif',   label: 'ক্লাসিক',   sample: 'আমাদের মেনু', style: { fontFamily: 'Georgia, serif' } },
                    { id: 'mono',    label: 'মডার্ন',    sample: 'আমাদের মেনু', style: { fontFamily: 'monospace' } },
                    { id: 'rounded', label: 'রাউন্ডেড', sample: 'আমাদের মেনু', style: { fontFamily: 'system-ui, sans-serif', fontWeight: 700 } },
                  ].map(font => (
                    <button key={font.id}
                      onClick={() => setBrandFont(font.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        brandFont === font.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-secondary/30 hover:border-primary/30'
                      }`}>
                      <p className="text-xs text-muted-foreground mb-1">{font.label}</p>
                      <p className="text-base font-semibold" style={font.style}>{font.sample}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Live Preview */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" /> লাইভ প্রিভিউ
                </CardTitle>
                <button onClick={() => setShowBrandPreview(v => !v)}
                  className="text-xs text-primary font-medium">
                  {showBrandPreview ? 'লুকান' : 'দেখান'}
                </button>
              </CardHeader>
              {showBrandPreview && (
                <CardContent className="p-0">
                  <div className="bg-background border-t border-border">
                    {/* Mock menu header */}
                    <div className="p-4 flex items-center gap-3"
                      style={{ background: `linear-gradient(135deg, ${brandPrimary}15, ${brandSecondary}10)` }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border-2"
                        style={{ borderColor: brandPrimary, background: `${brandPrimary}20` }}>
                        {brandLogo || brandLogoFile ? (
                          <img src={brandLogoFile ? URL.createObjectURL(brandLogoFile) : brandLogo!}
                            alt="logo" className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <span style={{ color: brandPrimary, fontSize: 20 }}>🍽️</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-foreground"
                          style={{
                            fontFamily: brandFont === 'serif' ? 'Georgia, serif' :
                              brandFont === 'mono' ? 'monospace' : 'inherit'
                          }}>
                          {restName || 'আপনার রেস্টুরেন্ট'}
                        </p>
                        <p className="text-xs" style={{ color: brandPrimary }}>● লাইভ মেনু</p>
                      </div>
                    </div>
                    {/* Mock menu item */}
                    <div className="p-4 space-y-3">
                      <div className="rounded-xl border p-3 flex items-center justify-between"
                        style={{ borderColor: `${brandPrimary}30` }}>
                        <div>
                          <p className="font-semibold text-sm text-foreground"
                            style={{ fontFamily: brandFont === 'serif' ? 'Georgia, serif' : 'inherit' }}>
                            চিকেন বিরিয়ানি
                          </p>
                          <p className="text-xs text-muted-foreground">সুগন্ধি বাসমতি চাল</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm" style={{ color: brandPrimary }}>৳৩৫০</span>
                          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` }}>
                            + যোগ
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            <Button variant="hero" onClick={saveBranding} disabled={brandSaving} className="w-full">
              {brandSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {brandSaving ? 'সেভ হচ্ছে...' : 'ব্র্যান্ডিং সেভ করুন'}
            </Button>

            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-warning mb-1">⚠️ DB Migration প্রয়োজন</p>
                <p className="text-xs text-muted-foreground mb-2">Supabase SQL Editor এ এই file টি run করুন:</p>
                <code className="text-xs bg-secondary block p-2 rounded-lg text-foreground">
                  20260411000001_custom_branding.sql
                </code>
                <p className="text-xs text-muted-foreground mt-2">এবং Storage এ <strong>restaurant-logos</strong> নামে একটি public bucket তৈরি করুন।</p>
              </CardContent>
            </Card>
            </></BrandingGate>
          </TabsContent>

          {/* ── WhatsApp Notifications Tab ── */}
          <TabsContent value="notifications" className="space-y-4 mt-4">
            {/* How it works */}
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-success">
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp Notification — কীভাবে কাজ করে
                </div>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>আপনার WhatsApp-এ <strong className="text-foreground">+34 644 66 77 17</strong> নম্বরটি <strong className="text-foreground">CallMeBot</strong> নামে save করুন</li>
                  <li>সেই নম্বরে WhatsApp message করুন: <code className="bg-secondary px-1 rounded text-xs">I allow callmebot to send me messages</code></li>
                  <li>কিছুক্ষণ পর আপনি একটি <strong className="text-foreground">API Key</strong> পাবেন (যেমন: 1234567)</li>
                  <li>নিচে সেই API Key দিন → Save করুন (রেস্টুরেন্টের ফোন নম্বরে notification যাবে)</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-1">✅ সম্পূর্ণ বিনামূল্যে। নতুন অর্ডার আসলেই আপনার WhatsApp-এ message যাবে।</p>
              </CardContent>
            </Card>

            {/* Settings form */}
            <Card>
              <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> নোটিফিকেশন সেটিংস</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>CallMeBot API Key</Label>
                  <Input
                    value={wapiKey}
                    onChange={e => setWapiKey(e.target.value)}
                    placeholder="আপনার CallMeBot API Key (যেমন: 1234567)"
                    type="password"
                  />
                </div>

                {/* Toggle: new order */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">নতুন অর্ডারে notification পাঠাও</p>
                    <p className="text-xs text-muted-foreground">প্রতিটি নতুন order আসলে WhatsApp message যাবে</p>
                  </div>
                  <button
                    onClick={() => setNotifyNewOrder(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifyNewOrder ? "bg-success" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyNewOrder ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* Toggle: daily report */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">দৈনিক সেলস রিপোর্ট পাঠাও</p>
                    <p className="text-xs text-muted-foreground">প্রতিদিন রাত ৯টায় দিনের summary WhatsApp-এ পাবেন</p>
                  </div>
                  <button
                    onClick={() => setNotifyDailyReport(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifyDailyReport ? "bg-success" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyDailyReport ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                <Button variant="hero" onClick={saveWhatsApp} disabled={wapiSaving} className="w-full">
                  {wapiSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {wapiSaving ? "সেভ হচ্ছে..." : "সেটিংস সেভ করুন"}
                </Button>
              </CardContent>
            </Card>

            {/* Deploy reminder */}
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-warning mb-1.5">⚠️ Edge Function Deploy করতে হবে</p>
                <p className="text-xs text-muted-foreground mb-2">Supabase Dashboard থেকে Edge Function deploy করুন এবং Database Webhook সেট করুন:</p>
                <code className="text-xs bg-secondary block p-2 rounded-lg text-foreground whitespace-pre-wrap">
                  {`# Terminal থেকে:\nsupabase functions deploy notify-whatsapp\nsupabase functions deploy daily-report\n\n# Supabase Dashboard → Database → Webhooks:\n# Table: orders, Event: INSERT\n# URL: .../functions/v1/notify-whatsapp\n\n# দৈনিক রিপোর্ট cron → Supabase Dashboard\n# → Edge Functions → Schedules → প্রতিদিন 15:00 UTC`}
                </code>
              </CardContent>
            </Card>
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
