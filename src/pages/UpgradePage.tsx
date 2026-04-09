// UpgradePage.tsx - Tier upgrade and payment page
import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Zap, Crown, ArrowRight, Clock, Shield } from 'lucide-react';
import { TIERS, TierName, BillingCycle, formatPrice, getPricingDisplay } from '@/constants/tiers';
import TierSelection from '@/components/TierSelection';

const UpgradePage = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedTier, setSelectedTier] = useState<TierName>('medium_smart');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('yearly');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Get current subscription info
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

  // Get trial status
  const {
    isExpired,
    daysRemaining,
    subscriptionStatus,
    tier: currentTier
  } = useTrialStatus(restaurantId);

  // Upgrade mutation (placeholder - real payment integration needed)
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No restaurant');

      // TODO: Real payment integration (bKash, Nagad, Stripe, etc.)
      // For now, just update the database directly
      
      const { error } = await supabase
        .from('restaurants')
        .update({
          tier: selectedTier,
          billing_cycle: selectedBillingCycle,
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: selectedBillingCycle === 'monthly'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          next_billing_date: selectedBillingCycle === 'monthly'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', restaurantId);

      if (error) throw error;

      // Also create a subscription record
      const tierConfig = TIERS[selectedTier];
      const amount = selectedBillingCycle === 'monthly' 
        ? tierConfig.priceMonthly 
        : tierConfig.priceYearly;

      await supabase
        .from('subscriptions')
        .insert({
          restaurant_id: restaurantId,
          tier: selectedTier,
          billing_cycle: selectedBillingCycle,
          amount,
          start_date: new Date().toISOString(),
          end_date: selectedBillingCycle === 'monthly'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          payment_method: 'manual', // TODO: Real payment method
          transaction_id: `TXN-${Date.now()}` // TODO: Real transaction ID
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-subscription', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      toast.success('Subscription activated! Welcome to ' + TIERS[selectedTier].displayName + '! 🎉');
      setShowPaymentForm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Upgrade failed');
    }
  });

  const handleTierSelect = (tier: TierName, billingCycle: BillingCycle) => {
    setSelectedTier(tier);
    setSelectedBillingCycle(billingCycle);
    setShowPaymentForm(true);
  };

  const handleConfirmPayment = () => {
    // TODO: Show actual payment form (bKash, Nagad, Stripe, etc.)
    // For now, just confirm
    if (confirm(`Confirm upgrade to ${TIERS[selectedTier].displayName} (${selectedBillingCycle})?`)) {
      upgradeMutation.mutate();
    }
  };

  return (
    <DashboardLayout role="admin" title="Upgrade Your Plan">
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
                      {subscriptionStatus === 'active' && TIERS[currentTier as TierName]?.displayName}
                      {subscriptionStatus === 'expired' && 'Trial Expired'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionStatus === 'trial' && `${daysRemaining} days remaining`}
                      {subscriptionStatus === 'active' && `${restaurant.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'} subscription`}
                      {subscriptionStatus === 'expired' && 'Please upgrade to continue'}
                    </p>
                  </div>
                </div>

                {subscriptionStatus !== 'active' && (
                  <Button variant="hero" size="lg">
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Form */}
        {showPaymentForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Upgrade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Plan Summary */}
              <div className="bg-muted rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-xl">{TIERS[selectedTier].displayName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedBillingCycle === 'monthly' ? 'Monthly billing' : 'Annual billing (Save 20%)'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {formatPrice(
                        selectedBillingCycle === 'monthly' 
                          ? TIERS[selectedTier].priceMonthly 
                          : TIERS[selectedTier].priceYearly
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedBillingCycle === 'monthly' ? '/month' : '/year'}
                    </p>
                  </div>
                </div>

                {selectedBillingCycle === 'yearly' && (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm text-success">
                    🎉 You're saving {formatPrice(TIERS[selectedTier].priceMonthly * 12 - TIERS[selectedTier].priceYearly)} per year!
                    (2 months FREE)
                  </div>
                )}
              </div>

              {/* Payment Method (Placeholder) */}
              <div className="space-y-4">
                <h4 className="font-semibold">Select Payment Method</h4>
                
                <div className="grid gap-3">
                  <button className="w-full p-4 border-2 border-primary rounded-lg text-left hover:bg-primary/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pink-100 rounded flex items-center justify-center">
                        <span className="text-pink-600 font-bold">bK</span>
                      </div>
                      <div>
                        <div className="font-semibold">bKash</div>
                        <div className="text-xs text-muted-foreground">Pay with bKash mobile wallet</div>
                      </div>
                    </div>
                  </button>

                  <button className="w-full p-4 border-2 border-border rounded-lg text-left hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                        <span className="text-orange-600 font-bold">N</span>
                      </div>
                      <div>
                        <div className="font-semibold">Nagad</div>
                        <div className="text-xs text-muted-foreground">Pay with Nagad mobile wallet</div>
                      </div>
                    </div>
                  </button>

                  <button className="w-full p-4 border-2 border-border rounded-lg text-left hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                        <span className="text-blue-600 font-bold">💳</span>
                      </div>
                      <div>
                        <div className="font-semibold">Credit/Debit Card</div>
                        <div className="text-xs text-muted-foreground">Visa, Mastercard, Amex</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Placeholder Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-1">⚠️ Development Mode</p>
                  <p className="text-blue-700">
                    Payment integration is in development. Clicking "Confirm Payment" will activate your subscription
                    without actual payment. Real payment gateway integration coming soon!
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPaymentForm(false)}
                >
                  ← Back to Plans
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={handleConfirmPayment}
                  disabled={upgradeMutation.isPending}
                >
                  {upgradeMutation.isPending ? 'Processing...' : 'Confirm Payment'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Tier Selection */
          <TierSelection
            onSelect={handleTierSelect}
            selectedTier={selectedTier}
            selectedBillingCycle={selectedBillingCycle}
          />
        )}

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Can I change my plan later?</h4>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade at any time. When upgrading, you'll be charged the prorated difference.
                When downgrading, the change takes effect at your next billing date.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">What happens when my trial ends?</h4>
              <p className="text-muted-foreground">
                When your trial ends, you'll need to choose a paid plan to continue using QR Manager. All your data
                will be preserved, and you can resume immediately after payment.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Do you offer refunds?</h4>
              <p className="text-muted-foreground">
                Yes! We offer a 30-day money-back guarantee on annual plans. If you're not satisfied, contact support
                within 30 days for a full refund.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">How do I cancel?</h4>
              <p className="text-muted-foreground">
                You can cancel anytime from your account settings. Your access will continue until the end of your
                current billing period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UpgradePage;
