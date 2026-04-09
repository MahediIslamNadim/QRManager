# Upgrade/Payment Flow Integration Guide

## 🎯 Goal: Complete upgrade and payment system

---

## ✅ Files Created:

```
1. UpgradePage.tsx - Tier comparison and selection
2. PaymentPage.tsx - Payment form with bKash/Nagad/Card
3. PaymentSuccessPage.tsx - Success confirmation
```

---

## 📋 Step 1: Add Routes

**Location:** Your router file (probably `src/App.tsx`)

**Add these routes:**
```typescript
import UpgradePage from '@/pages/UpgradePage';
import PaymentPage from '@/pages/PaymentPage';
import PaymentSuccessPage from '@/pages/PaymentSuccessPage';

// In your routes:
<Route path="/admin/upgrade" element={<UpgradePage />} />
<Route path="/admin/payment" element={<PaymentPage />} />
<Route path="/admin/payment-success" element={<PaymentSuccessPage />} />
```

---

## 📋 Step 2: Update Navigation Links

### Update TrialExpiredModal:
**File:** `src/components/TrialExpiredModal.tsx`

Find `onUpgradeClick` and update:
```typescript
// In AdminDashboard or wherever TrialExpiredModal is used:
const handleUpgradeClick = () => {
  navigate('/admin/upgrade');
};
```

### Update TrialWarningBanner:
**File:** Wherever you use TrialWarningBanner

```typescript
const handleUpgradeClick = () => {
  navigate('/admin/upgrade');
};
```

### Update AdminTables limit message:
**File:** `src/pages/AdminTables.tsx`

Find the "Upgrade to High Smart" button and update:
```typescript
onClick={() => navigate('/admin/upgrade')}
```

### Update AdminStaff limit message:
**File:** `src/pages/AdminStaff.tsx`

Find the "Upgrade to High Smart" button and update:
```typescript
onClick={() => navigate('/admin/upgrade')}
```

---

## 📋 Step 3: Add to Sidebar (Optional)

**Add "Upgrade" link to sidebar for easy access:**

```typescript
// In DashboardLayout sidebar:
{
  name: 'Upgrade Plan',
  href: '/admin/upgrade',
  icon: Zap, // or Crown
  current: location.pathname === '/admin/upgrade',
  badge: tier === 'medium_smart' ? 'Premium' : null // Optional badge
}
```

---

## 📋 Step 4: Payment Integration (Future)

**Currently:** Payment is simulated (placeholder)

**To integrate real payments:**

### For bKash:
1. Get bKash Merchant API credentials
2. Install bKash SDK
3. Update `PaymentPage.tsx`:
```typescript
// In handlePayment function:
if (paymentMethod === 'bkash') {
  const bkashResponse = await fetch('https://api.bkash.com/checkout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${BKASH_TOKEN}` },
    body: JSON.stringify({
      amount,
      merchantInvoiceNumber: `INV-${Date.now()}`,
      customerMobile: phoneNumber
    })
  });
  // Handle response...
}
```

### For Nagad:
Similar to bKash - use Nagad Payment API

### For Cards (Stripe/SSLCommerz):
```typescript
import { loadStripe } from '@stripe/stripe-js';

// In component:
const stripe = await loadStripe(STRIPE_PUBLIC_KEY);
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: cardName }
  }
});
```

---

## 📋 Step 5: Test Flow

### Test Upgrade Flow:
1. Navigate to `/admin/upgrade`
2. Select a tier
3. Click "Upgrade Now"
4. Fill payment form
5. Submit payment
6. Verify redirect to success page
7. Check database: `subscription_status = 'active'`

### Test SQL:
```sql
-- Check restaurant subscription
SELECT tier, billing_cycle, subscription_status, trial_end_date, subscription_end_date
FROM restaurants
WHERE id = 'YOUR_RESTAURANT_ID';

-- Check subscription records
SELECT * FROM subscriptions
WHERE restaurant_id = 'YOUR_RESTAURANT_ID'
ORDER BY created_at DESC;
```

---

## 🎨 Customization Options:

### Change Payment Methods:
Edit `PaymentPage.tsx` - add/remove payment options

### Change Pricing Display:
Edit `UpgradePage.tsx` - modify tier cards, add discounts

### Change Success Message:
Edit `PaymentSuccessPage.tsx` - customize confirmation

### Add Email Notifications:
After payment success, send email:
```typescript
// In PaymentPage after successful payment:
await supabase.functions.invoke('send-payment-confirmation', {
  body: {
    email: userEmail,
    tier,
    amount,
    transactionId
  }
});
```

---

## 🔄 Downgrade Flow (Optional)

**To allow downgrade from High to Medium:**

Add this function:
```typescript
const handleDowngrade = async () => {
  if (!confirm('Downgrade to Medium Smart? You will lose unlimited features.')) {
    return;
  }

  const { error } = await supabase
    .from('restaurants')
    .update({
      tier: 'medium_smart',
      // Keep billing cycle and status
    })
    .eq('id', restaurantId);

  if (error) {
    toast.error(error.message);
  } else {
    toast.success('Downgraded to Medium Smart');
    navigate('/admin');
  }
};
```

---

## ✅ Complete Flow:

```
Trial User →
  ↓
Sees warning banner (7 days left) →
  ↓
Clicks "Upgrade" →
  ↓
/admin/upgrade (tier comparison) →
  ↓
Selects tier + billing cycle →
  ↓
/admin/payment (payment form) →
  ↓
Enters payment details →
  ↓
Payment processed →
  ↓
Database updated (subscription_status = 'active') →
  ↓
/admin/payment-success →
  ↓
Redirect to dashboard (full access unlocked!)
```

---

## 🎯 Checklist:

- [ ] Add routes for upgrade, payment, payment-success
- [ ] Update all "Upgrade" button links to navigate to `/admin/upgrade`
- [ ] Test tier selection
- [ ] Test payment form (placeholder)
- [ ] Verify database updates after payment
- [ ] Test trial expiry → upgrade flow
- [ ] Add sidebar link (optional)
- [ ] Plan for real payment integration (bKash/Nagad/Stripe)

---

## 🚀 Next Steps:

**After testing:**
1. Integrate real payment gateways
2. Add email confirmations
3. Create invoice generation
4. Add subscription management page
5. Build billing history page

---

**File:** C:\Users\hhnad\OneDrive\Desktop\NexCore\QRManager\UPGRADE_PAYMENT_INTEGRATION_GUIDE.md

**Ready to integrate and test!** 🎉
