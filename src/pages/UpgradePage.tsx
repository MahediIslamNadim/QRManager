// UpgradePage.tsx - Tier upgrade and payment page
// Updated: April 25, 2026 — Enterprise tier contact flow added
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Clock, Shield, CheckCircle2, Copy, CreditCard, Loader2, Zap } from 'lucide-react';
import { TIERS, TierName, BillingCycle, formatPrice } from '@/constants/tiers';
import TierSelection from '@/components/TierSelection';

const BKASH_NUMBER = import.meta.env.VITE_BKASH_NUMBER ?? "01786130439";
const NAGAD_NUMBER = import.meta.env.VITE_NAGAD_NUMBER ?? "01786130439";

const UpgradePage = () => {
  const { restaurantId, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [selectedTier, setSelectedTier] = useState<TierName>('medium_smart');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('yearly');

  useEffect(() => {
    const tierParam = searchParams.get('tier');
    if (tierParam === 'high_smart') setSelectedTier('high_smart');
    if (tierParam === 'high_smart_enterprise') setSelectedTier('high_smart_enterprise');
  }, [searchParams]);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad">("bkash");
  const [transactionId, setTransactionId] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);
  const [sslLoading, setSslLoading] = useState(false);

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant-subscription', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('restaurants')
        .select('tier, billing_cycle, subscription_status, trial_end_date')
        .eq('id', restaurantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId
  });

  const { daysRemaining, subscriptionStatus, tier: currentTier } = useTrialStatus(restaurantId);
  const { user } = useAuth();

  const handleSSLPay = async () => {
    if (!restaurantId) return;
    setSslLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ssl-init", {
        body: { restaurant_id: restaurantId, plan: selectedTier, billing_cycle: selectedBillingCycle },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      window.location.href = data.gateway_url;
    } catch (err: any) {
      toast.error(err.message || "SSLCommerz শুরু করা যায়নি");
      setSslLoading(false);
    }
  };

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !user) throw new Error('No restaurant');
      if (!transactionId.trim()) throw new Error('Transaction ID দিন');

      const tierConfig = TIERS[selectedTier];
      const amount = selectedBillingCycle === 'monthly'
        ? tierConfig.price_monthly
        : tierConfig.price_yearly;

      const { error } = await (supabase.from('payment_requests') as any).insert({
        user_id: user.id,
        restaurant_id: restaurantId,
        plan: selectedTier,
        billing_cycle: selectedBillingCycle,
        amount,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim(),
        phone_number: payPhone.trim() || null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPaySuccess(true);
      setTransactionId("");
      setPayPhone("");
      queryClient.invalidateQueries({ queryKey: ['restaurant-subscription', restaurantId] });
    },
    onError: (err: any) => toast.error(err.message || 'Submit ব্যর্থ হয়েছে'),
  });

  const handleTierSelect = (tier: TierName, billingCycle: BillingCycle) => {
    // Enterprise = contact sales via WhatsApp, no payment form
    if (tier === 'high_smart_enterprise') {
      const msg = encodeURIComponent('আমি QRManager Enterprise প্যাকেজে আগ্রহী। বিস্তারিত জানতে চাই।');
      window.open('https://wa.me/8801786130439?text=' + msg, '_blank');
      return;
    }
    setSelectedTier(tier);
    setSelectedBillingCycle(billingCycle);
    setShowPaymentForm(true);
    setPaySuccess(false);
  };

  return (
    <DashboardLayout role={(role === 'group_owner' ? 'group_owner' : role === 'super_admin' ? 'super_admin' : 'admin') as any} title="আপগ্রেড করুন">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Current Status Banner */}
        {restaurant && (
          <Card className={`border-2 ${
            subscriptionStatus === 'trial'
              ? 'border-warning bg-warning/5'
              : subscriptionStatus === 'active'
              ? 'border-success bg-success/5'
              : 'border-destructive bg-destructive/5'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    subscriptionStatus === 'trial' ? 'bg-warning/20' :
                    subscriptionStatus === 'active' ? 'bg-success/20' :
                    'bg-destructive/20'
                  }`}>
                    {subscriptionStatus === 'trial' ? (
                      <Clock className="w-6 h-6 text-warning" />
                    ) : subscriptionStatus === 'active' ? (
                      <Shield className="w-6 h-6 text-success" />
                    ) : (
                      <Clock className="w-6 h-6 text-destructive" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {subscriptionStatus === 'trial' && 'Free Trial'}
                      {subscriptionStatus === 'active' && (TIERS[currentTier as TierName]?.name_bn ?? currentTier)}
                      {subscriptionStatus === 'expired' && 'Trial Expired'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionStatus === 'trial' && `${daysRemaining} দিন বাকি`}
                      {subscriptionStatus === 'active' && `${restaurant.billing_cycle === 'monthly' ? 'মাসিক' : 'বার্ষিক'} সাবস্ক্রিপশন`}
                      {subscriptionStatus === 'expired' && 'অনুগ্রহ করে আপগ্রেড করুন'}
                    </p>
                  </div>
                </div>
                {subscriptionStatus !== 'active' && (
                  <Button variant="hero" size="lg">
                    <Zap className="w-4 h-4 mr-2" />
                    এখনই আপগ্রেড করুন
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Form or Tier Selection */}
        {showPaymentForm ? (
          <Card>
            <CardHeader>
              <CardTitle>পেমেন্ট সম্পন্ন করুন</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Plan Summary */}
              <div className="bg-muted rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-xl">{TIERS[selectedTier].name_bn}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedBillingCycle === 'monthly' ? 'মাসিক বিলিং' : 'বার্ষিক বিলিং (২০% ছাড়)'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {formatPrice(
                        selectedBillingCycle === 'monthly'
                          ? TIERS[selectedTier].price_monthly
                          : TIERS[selectedTier].price_yearly
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedBillingCycle === 'monthly' ? '/মাস' : '/বছর'}
                    </p>
                  </div>
                </div>
                {selectedBillingCycle === 'yearly' && (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm text-success">
                    আপনি বছরে {formatPrice(TIERS[selectedTier].price_monthly * 12 - TIERS[selectedTier].price_yearly)} সাশ্রয় করছেন! (২ মাস বিনামূল্যে)
                  </div>
                )}
              </div>

              {paySuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="text-xl font-bold">পেমেন্ট রিকোয়েস্ট জমা হয়েছে!</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    আপনার পেমেন্ট যাচাই করা হচ্ছে। সাধারণত ১–২ কার্যদিবসের মধ্যে সাবস্ক্রিপশন সক্রিয় হবে।
                  </p>
                  <Button variant="outline" onClick={() => { setShowPaymentForm(false); setPaySuccess(false); }}>
                    ← প্ল্যানে ফিরে যান
                  </Button>
                </div>
              ) : (
                <>
                  {/* Payment Method */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">পেমেন্ট মাধ্যম বেছে নিন</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 border-2 border-border rounded-lg opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold flex items-center gap-2">
                              SSLCommerz
                              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">শীঘ্রই আসছে</span>
                            </div>
                            <div className="text-xs text-muted-foreground">কার্ড, মোবাইল ব্যাংকিং</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setPaymentMethod('bkash')}
                          className={`p-4 border-2 rounded-lg text-left transition-colors ${
                            paymentMethod === 'bkash' ? 'border-pink-500 bg-pink-50' : 'border-border hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pink-100 rounded flex items-center justify-center">
                              <span className="text-pink-600 font-bold text-sm">bK</span>
                            </div>
                            <div>
                              <div className="font-semibold">bKash</div>
                              <div className="text-xs text-muted-foreground">মোবাইল ওয়ালেট</div>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setPaymentMethod('nagad')}
                          className={`p-4 border-2 rounded-lg text-left transition-colors ${
                            paymentMethod === 'nagad' ? 'border-orange-500 bg-orange-50' : 'border-border hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                              <span className="text-orange-600 font-bold text-sm">N</span>
                            </div>
                            <div>
                              <div className="font-semibold">Nagad</div>
                              <div className="text-xs text-muted-foreground">মোবাইল ওয়ালেট</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-lg p-5 space-y-3 ${
                    paymentMethod === 'bkash' ? 'bg-pink-50 border border-pink-200' : 'bg-orange-50 border border-orange-200'
                  }`}>
                    <p className={`font-semibold text-sm ${paymentMethod === 'bkash' ? 'text-pink-800' : 'text-orange-800'}`}>
                      {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} নম্বরে Send Money করুন
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold tracking-widest ${
                        paymentMethod === 'bkash' ? 'text-pink-700' : 'text-orange-700'
                      }`}>
                        {paymentMethod === 'bkash' ? BKASH_NUMBER : NAGAD_NUMBER}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(paymentMethod === 'bkash' ? BKASH_NUMBER : NAGAD_NUMBER);
                          toast.success('নম্বর কপি হয়েছে');
                        }}
                        className="p-2 rounded hover:bg-black/10 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <ol className={`text-xs space-y-1 list-decimal list-inside ${
                      paymentMethod === 'bkash' ? 'text-pink-700' : 'text-orange-700'
                    }`}>
                      <li>উপরের নম্বরে <strong>Send Money</strong> করুন</li>
                      <li>Amount: <strong>{formatPrice(selectedBillingCycle === 'monthly' ? TIERS[selectedTier].price_monthly : TIERS[selectedTier].price_yearly)}</strong></li>
                      <li>Transaction ID নিচে লিখুন এবং সাবমিট করুন</li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="txn-id">Transaction ID *</Label>
                      <Input
                        id="txn-id"
                        placeholder="যেমন: 8N7A2B3C4D"
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pay-phone">পেমেন্টে ব্যবহৃত নম্বর (ঐচ্ছিক)</Label>
                      <Input
                        id="pay-phone"
                        placeholder="01XXXXXXXXX"
                        value={payPhone}
                        onChange={e => setPayPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowPaymentForm(false)}>
                      ← পিছনে যান
                    </Button>
                    <Button
                      variant="hero"
                      className="flex-1"
                      onClick={() => paymentMutation.mutate()}
                      disabled={paymentMutation.isPending || !transactionId.trim()}
                    >
                      {paymentMutation.isPending ? 'সাবমিট হচ্ছে...' : 'পেমেন্ট সাবমিট করুন'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <TierSelection
            onSelect={handleTierSelect}
            selectedTier={selectedTier}
            selectedBillingCycle={selectedBillingCycle}
          />
        )}

        {/* FAQ */}
        <Card>
          <CardHeader><CardTitle>প্রায়ই জিজ্ঞাসিত প্রশ্ন</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">পরে প্ল্যান পরিবর্তন করা যাবে?</h4>
              <p className="text-muted-foreground">হ্যাঁ! যেকোনো সময় আপগ্রেড করতে পারবেন।</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Trial শেষ হলে কী হবে?</h4>
              <p className="text-muted-foreground">সব ডেটা সংরক্ষিত থাকবে। পেইড প্ল্যানে আপগ্রেড করলেই আবার access পাবেন।</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Refund পাওয়া যাবে?</h4>
              <p className="text-muted-foreground">বার্ষিক প্ল্যানে ৩০ দিনের মধ্যে সমস্যা হলে সম্পূর্ণ refund দেওয়া হবে।</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Enterprise প্যাকেজ কীভাবে নেবো?</h4>
              <p className="text-muted-foreground">উপরের "যোগাযোগ করুন" বাটনে ক্লিক করুন — WhatsApp-এ আলোচনা করে কাস্টম প্ল্যান ঠিক করা হবে।</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UpgradePage;
