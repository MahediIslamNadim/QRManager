# 💳 Upgrade & Payment Integration Guide

## 🎯 Files Created

```
✅ 1. UpgradePage.tsx - Main upgrade/payment page
   C:\Users\hhnad\OneDrive\Desktop\NexCore\QRManager\src\pages\UpgradePage.tsx

✅ 2. UpgradeButton.tsx - Reusable upgrade CTA component
   C:\Users\hhnad\OneDrive\Desktop\NexCore\QRManager\src\components\UpgradeButton.tsx
```

---

## 📋 Step 1: Add Route

**File:** Your router (App.tsx or similar)

```typescript
import UpgradePage from '@/pages/UpgradePage';

// Add route:
<Route path="/upgrade" element={<UpgradePage />} />
```

---

## 📋 Step 2: Add to Navigation

**In DashboardLayout sidebar:**

```typescript
{
  name: 'Upgrade',
  href: '/upgrade',
  icon: Zap,
  badge: 'Premium',
  current: location.pathname === '/upgrade'
}
```

---

## 📋 Step 3: Use UpgradeButton Throughout App

**Example 1: In AdminTables when limit reached**

```typescript
import UpgradeButton from '@/components/UpgradeButton';

{isAtLimit && (
  <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
    <p className="mb-3">Table limit reached!</p>
    <UpgradeButton 
      currentTier={tier} 
      feature="Unlimited Tables"
      variant="default"
    />
  </div>
)}
```

**Example 2: In AdminStaff when limit reached**

```typescript
<UpgradeButton 
  currentTier={tier} 
  feature="Unlimited Staff"
  variant="hero"
/>
```

**Example 3: In TrialWarningBanner**

```typescript
<UpgradeButton 
  variant="destructive"
  size="sm"
/>
```

---

## 💳 Step 4: Payment Integration (TODO)

Currently, UpgradePage has **placeholder payment**. Here's how to add real payment:

### Option A: bKash Payment Gateway

```typescript
// Install bKash SDK
npm install bkash-payment-gateway

// In UpgradePage.tsx
import { BkashPayment } from 'bkash-payment-gateway';

const handleBkashPayment = async () => {
  const payment = new BkashPayment({
    amount: TIERS[selectedTier].priceMonthly,
    merchantInvoiceNumber: `INV-${Date.now()}`,
    callbackURL: `${window.location.origin}/payment/callback`
  });
  
  const result = await payment.createPayment();
  if (result.paymentID) {
    window.location.href = result.bkashURL;
  }
};
```

### Option B: Nagad Payment Gateway

```typescript
// Similar to bKash
const handleNagadPayment = async () => {
  // Nagad payment integration
};
```

### Option C: Stripe (International)

```typescript
// Install Stripe
npm install @stripe/stripe-js

// Create Stripe checkout session
const handleStripePayment = async () => {
  const stripe = await loadStripe('YOUR_PUBLISHABLE_KEY');
  
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({
      tier: selectedTier,
      billingCycle: selectedBillingCycle,
      restaurantId
    })
  });
  
  const session = await response.json();
  stripe.redirectToCheckout({ sessionId: session.id });
};
```

---

## 📋 Step 5: Payment Callback Handler

**Create:** `src/pages/PaymentCallback.tsx`

```typescript
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const processPayment = async () => {
      const status = searchParams.get('status');
      const transactionId = searchParams.get('transactionId');
      
      if (status === 'success') {
        // Verify payment with backend
        // Update subscription in database
        // Show success message
        navigate('/admin?payment=success');
      } else {
        // Show error
        navigate('/upgrade?payment=failed');
      }
    };

    processPayment();
  }, []);

  return <div>Processing payment...</div>;
}
```

---

## 📋 Step 6: Backend Payment Verification

**Create:** Supabase Edge Function or API endpoint

```sql
-- Create function to verify and activate subscription
CREATE OR REPLACE FUNCTION activate_subscription(
  p_restaurant_id UUID,
  p_tier TEXT,
  p_billing_cycle TEXT,
  p_transaction_id TEXT,
  p_amount NUMERIC
)
RETURNS JSON AS $$
BEGIN
  -- Verify transaction with payment gateway
  -- Update restaurant subscription
  UPDATE restaurants
  SET 
    tier = p_tier,
    billing_cycle = p_billing_cycle,
    subscription_status = 'active',
    subscription_start_date = now(),
    subscription_end_date = CASE 
      WHEN p_billing_cycle = 'monthly' THEN now() + INTERVAL '30 days'
      ELSE now() + INTERVAL '1 year'
    END
  WHERE id = p_restaurant_id;

  -- Create subscription record
  INSERT INTO subscriptions (
    restaurant_id, tier, billing_cycle, amount,
    start_date, end_date, status, transaction_id
  ) VALUES (
    p_restaurant_id, p_tier, p_billing_cycle, p_amount,
    now(),
    CASE WHEN p_billing_cycle = 'monthly' THEN now() + INTERVAL '30 days'
         ELSE now() + INTERVAL '1 year' END,
    'active', p_transaction_id
  );

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📋 Step 7: Subscription Management

**Add to UpgradePage for existing subscribers:**

```typescript
// Show current subscription details
{subscriptionStatus === 'active' && (
  <Card>
    <CardHeader>
      <CardTitle>Current Subscription</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span>Plan:</span>
          <span className="font-bold">{TIERS[currentTier].displayName}</span>
        </div>
        <div className="flex justify-between">
          <span>Billing:</span>
          <span>{billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}</span>
        </div>
        <div className="flex justify-between">
          <span>Next billing:</span>
          <span>{format(nextBillingDate, 'PP')}</span>
        </div>
        <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
          Cancel Subscription
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

## 📋 Step 8: Auto-Renewal Logic

**Create:** Supabase cron job or edge function

```sql
-- Create function to process renewals
CREATE OR REPLACE FUNCTION process_subscription_renewals()
RETURNS void AS $$
BEGIN
  -- Find subscriptions expiring today
  UPDATE restaurants
  SET subscription_status = 'expired'
  WHERE 
    subscription_status = 'active' AND
    subscription_end_date <= now();

  -- TODO: Trigger payment gateway for auto-renewal
  -- TODO: Send email notifications
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily
-- In Supabase Dashboard > Database > Cron Jobs:
-- SELECT cron.schedule('process-renewals', '0 0 * * *', 'SELECT process_subscription_renewals()');
```

---

## 🎯 Testing Checklist

- [ ] Navigate to /upgrade
- [ ] See current subscription status
- [ ] Select tier and billing cycle
- [ ] See payment form
- [ ] Click "Confirm Payment" (placeholder)
- [ ] Verify subscription activated in database
- [ ] Check trial status updated
- [ ] Verify features unlocked
- [ ] Test upgrade from Medium to High
- [ ] Test downgrade (should happen at next billing)

---

## 🚀 Deployment Checklist

### Development Mode (Current):
- [x] Placeholder payment works
- [x] Subscription database updates
- [x] Features unlock properly

### Production Ready:
- [ ] Real payment gateway integrated
- [ ] Payment verification implemented
- [ ] Webhook handlers created
- [ ] Auto-renewal logic working
- [ ] Email notifications setup
- [ ] Invoice generation ready
- [ ] Refund process documented

---

## 💡 Additional Features to Build

### 1. Billing History Page
```typescript
// Show past invoices, payments, receipts
<BillingHistoryPage />
```

### 2. Invoice Generation
```typescript
// Generate PDF invoices
const generateInvoice = (subscriptionId) => {
  // Use jsPDF or similar
};
```

### 3. Coupon/Promo Codes
```sql
CREATE TABLE promo_codes (
  code TEXT PRIMARY KEY,
  discount_percent NUMERIC,
  valid_until TIMESTAMPTZ,
  max_uses INTEGER
);
```

### 4. Referral Program
```sql
CREATE TABLE referrals (
  referrer_id UUID,
  referred_id UUID,
  reward_amount NUMERIC,
  status TEXT
);
```

---

## 🔒 Security Notes

1. **Never store full payment details** - Use payment gateway tokens
2. **Verify payments server-side** - Don't trust client
3. **Use HTTPS** - Secure all payment endpoints
4. **Log all transactions** - Keep audit trail
5. **Rate limit** - Prevent payment spam

---

**Next:** Test the upgrade flow and integrate real payment gateway!

**Questions?** Check bKash/Nagad merchant documentation or Stripe docs.
