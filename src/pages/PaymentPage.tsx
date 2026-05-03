// PaymentPage.tsx - Payment form and confirmation
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { TIERS, formatPrice, TierName, BillingCycle } from '@/constants/tiers';
import { CreditCard, Lock, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { restaurantId } = useAuth();

  const tier = (searchParams.get('tier') || 'medium_smart') as TierName;
  const billingCycle = (searchParams.get('billing') || 'yearly') as BillingCycle;

  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'card'>('bkash');
  
  // Payment form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const tierConfig = TIERS[tier];
  const amount = billingCycle === 'monthly' ? tierConfig.price_monthly : tierConfig.price_yearly;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!restaurantId) {
      toast.error('Restaurant not found');
      return;
    }

    setProcessing(true);

    try {
      // TODO: In production, integrate with real payment gateway:
      // - bKash Payment API
      // - Nagad Payment API  
      // - Stripe/SSLCommerz for cards
      
      // For now, simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date();
      if (billingCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Update restaurant subscription
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          tier,
          billing_cycle: billingCycle,
          subscription_status: 'active',
          subscription_start_date: startDate.toISOString(),
          subscription_end_date: endDate.toISOString(),
          next_billing_date: endDate.toISOString()
        })
        .eq('id', restaurantId);

      if (updateError) throw updateError;

      // Create subscription record
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          restaurant_id: restaurantId,
          tier,
          billing_cycle: billingCycle,
          amount,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          payment_method: paymentMethod,
          transaction_id: `TXN-${Date.now()}`, // Placeholder
          notes: `Activated ${tierConfig.name} - ${billingCycle}`
        });

      if (subscriptionError) throw subscriptionError;

      toast.success('Payment successful! Your subscription is now active.');
      navigate('/payment/result?status=success&tier=' + tier);

    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Complete Payment">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/upgrade')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Plans
        </Button>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Payment Form */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Secure Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePayment} className="space-y-6">
                  {/* Payment Method Selection */}
                  <div>
                    <Label className="mb-3 block">Select Payment Method</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bkash')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          paymentMethod === 'bkash'
                            ? 'border-pink-600 bg-pink-50'
                            : 'border-border hover:border-pink-300'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-bold text-pink-600">bKash</div>
                          <div className="text-xs text-muted-foreground">Mobile Payment</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('nagad')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          paymentMethod === 'nagad'
                            ? 'border-orange-600 bg-orange-50'
                            : 'border-border hover:border-orange-300'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-bold text-orange-600">Nagad</div>
                          <div className="text-xs text-muted-foreground">Mobile Payment</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          paymentMethod === 'card'
                            ? 'border-primary bg-blue-50'
                            : 'border-border hover:border-blue-300'
                        }`}
                      >
                        <div className="text-center">
                          <CreditCard className="w-6 h-6 mx-auto mb-1 text-primary" />
                          <div className="text-xs text-muted-foreground">Credit/Debit</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* bKash/Nagad Form */}
                  {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                    <div>
                      <Label>Mobile Number</Label>
                      <Input
                        type="tel"
                        placeholder="01XXXXXXXXX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                        maxLength={11}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        You will receive a payment request on your {paymentMethod} app
                      </p>
                    </div>
                  )}

                  {/* Card Form */}
                  {paymentMethod === 'card' && (
                    <>
                      <div>
                        <Label>Card Number</Label>
                        <Input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          required
                          maxLength={19}
                        />
                      </div>

                      <div>
                        <Label>Cardholder Name</Label>
                        <Input
                          type="text"
                          placeholder="John Doe"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Expiry Date</Label>
                          <Input
                            type="text"
                            placeholder="MM/YY"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            required
                            maxLength={5}
                          />
                        </div>
                        <div>
                          <Label>CVV</Label>
                          <Input
                            type="text"
                            placeholder="123"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value)}
                            required
                            maxLength={3}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Security Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-900">
                        Your payment information is encrypted and secure. We never store your card details.
                      </p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    size="lg"
                    disabled={processing}
                  >
                    {processing ? (
                      <>Processing...</>
                    ) : (
                      <>
                        Pay {formatPrice(amount)}
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By completing this purchase, you agree to our Terms of Service
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Selected Plan</div>
                  <div className="font-bold text-lg">{tierConfig.name}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">Billing Cycle</div>
                  <div className="font-semibold capitalize">{billingCycle}</div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Subtotal</span>
                    <span className="font-semibold">{formatPrice(amount)}</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="flex justify-between items-center text-success text-sm mb-2">
                      <span>Annual Savings (20%)</span>
                      <span className="font-semibold">
                        -{formatPrice(tierConfig.price_monthly * 12 - tierConfig.price_yearly)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-xl">{formatPrice(amount)}</span>
                  </div>
                </div>

                {/* Features Included */}
                <div className="border-t pt-4">
                  <div className="text-sm font-semibold mb-3">What's Included:</div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      <span>
                        {tierConfig.maxTables === -1 ? 'Unlimited' : `Up to ${tierConfig.maxTables}`} tables
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      <span>
                        {tierConfig.maxStaff === -1 ? 'Unlimited' : `Up to ${tierConfig.maxStaff}`} staff
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      <span>All core features</span>
                    </li>
                    {tier === 'high_smart' && (
                      <>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-success flex-shrink-0" />
                          <span>AI recommendations</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-success flex-shrink-0" />
                          <span>Priority support 24/7</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Money Back Guarantee */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-green-900 text-sm">30-Day Money-Back Guarantee</div>
                      <p className="text-xs text-green-700 mt-1">
                        Not satisfied? Get a full refund within 30 days.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
