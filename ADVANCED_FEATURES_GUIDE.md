# 🎨 Advanced Features Integration Guide

## 📊 **Features Created**

```
✅ Feature #8: Billing History Page (BillingPage.tsx)
✅ Feature #9: Feature Gates System (useFeatureGate + FeatureGate component)
✅ Feature #10: Email Notifications (emailTemplates + sendEmail)
✅ Feature #11: Invoice PDF Generation (generateInvoice)
```

---

## 📋 **Feature #8: Billing History Page**

### Files Created:
- `src/pages/BillingPage.tsx`

### Integration Steps:

#### 1. Add Route
```typescript
import BillingPage from '@/pages/BillingPage';

// Add route:
<Route path="/billing" element={<BillingPage />} />
```

#### 2. Add to Navigation
```typescript
{
  name: 'Billing',
  href: '/billing',
  icon: Receipt,
  current: pathname === '/billing'
}
```

#### 3. Test
- Navigate to `/billing`
- Should see current subscription
- Should see billing history
- Can cancel subscription

---

## 🔒 **Feature #9: Feature Gates System**

### Files Created:
- `src/hooks/useFeatureGate.ts`
- `src/components/FeatureGate.tsx`

### Usage Examples:

#### Example 1: Wrap Entire Feature
```typescript
import FeatureGate from '@/components/FeatureGate';

<FeatureGate feature="advanced_analytics">
  <AdvancedAnalyticsDashboard />
</FeatureGate>
```

#### Example 2: Inline Check
```typescript
import { InlineFeatureGate } from '@/components/FeatureGate';

<InlineFeatureGate feature="api_access">
  <Button>API Settings</Button>
</InlineFeatureGate>
```

#### Example 3: Feature Badge
```typescript
import { FeatureBadge } from '@/components/FeatureGate';

<div className="flex items-center gap-2">
  <span>Advanced Analytics</span>
  <FeatureBadge feature="advanced_analytics" />
</div>
```

#### Example 4: Custom Check
```typescript
import { useFeatureGate } from '@/hooks/useFeatureGate';

const { hasAccess, upgradeMessage } = useFeatureGate('ai_recommendations', restaurantId);

{!hasAccess && <div className="alert">{upgradeMessage}</div>}
```

### Available Features:
```typescript
// Basic (all tiers, trial OK)
- qr_ordering
- menu_management
- table_management

// Medium Smart (requires paid subscription)
- basic_analytics
- whatsapp_notifications
- payment_integration
- basic_inventory

// High Smart only
- advanced_analytics
- ai_recommendations
- custom_branding
- api_access
- multi_location
- priority_support
- advanced_inventory
```

### Testing:
```sql
-- Test as Medium Smart user (should NOT have advanced_analytics)
UPDATE restaurants SET tier = 'medium_smart', subscription_status = 'active';

-- Test as High Smart user (should have everything)
UPDATE restaurants SET tier = 'high_smart', subscription_status = 'active';

-- Test expired (should NOT have features requiring active sub)
UPDATE restaurants SET subscription_status = 'expired';
```

---

## 📧 **Feature #10: Email Notifications**

### Files Created:
- `src/lib/emailTemplates.ts`
- `src/lib/sendEmail.ts`

### Integration Steps:

#### 1. Install Email Service (Resend - Recommended)
```bash
npm install resend
```

#### 2. Add Environment Variable
```env
# .env
RESEND_API_KEY=re_your_api_key_here
```

#### 3. Create Supabase Edge Function
```bash
# In Supabase project
supabase functions new send-email
```

**Function code:**
```typescript
// supabase/functions/send-email/index.ts
import { Resend } from 'resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  const { to, subject, html } = await req.json();
  
  const { data, error } = await resend.emails.send({
    from: 'QR Manager <noreply@qrmanager.com>',
    to,
    subject,
    html
  });

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, data }));
});
```

#### 4. Update sendEmail Function
```typescript
// In src/lib/sendEmail.ts
export const sendEmail = async (options: EmailOptions) => {
  const response = await supabase.functions.invoke('send-email', {
    body: options
  });
  
  if (response.error) throw response.error;
  return response.data;
};
```

#### 5. Trigger Emails at Key Events

**After signup:**
```typescript
// In Login.tsx after successful signup
import { sendWelcomeEmail } from '@/lib/sendEmail';

await sendWelcomeEmail(email, restaurantName, FREE_TRIAL_DAYS);
```

**Trial expiring (cron job):**
```sql
-- Create cron function
CREATE OR REPLACE FUNCTION notify_expiring_trials()
RETURNS void AS $$
BEGIN
  -- Find trials expiring in 7 days
  -- Send emails via Edge Function
END;
$$ LANGUAGE plpgsql;

-- Schedule daily
SELECT cron.schedule('notify-trials', '0 9 * * *', 'SELECT notify_expiring_trials()');
```

**After payment:**
```typescript
// In UpgradePage after successful payment
import { sendSubscriptionActivatedEmail } from '@/lib/sendEmail';

await sendSubscriptionActivatedEmail(
  email, restaurantName, tier, billingCycle, amount, nextBillingDate
);
```

### Testing:
```typescript
// Test welcome email
import { sendWelcomeEmail } from '@/lib/sendEmail';
await sendWelcomeEmail('test@example.com', 'Test Restaurant', 30);
```

---

## 📄 **Feature #11: Invoice PDF Generation**

### Files Created:
- `src/lib/generateInvoice.ts`

### Option A: Client-Side PDF (jsPDF)

#### 1. Install Dependencies
```bash
npm install jspdf html2canvas
```

#### 2. Use in BillingPage
```typescript
import { downloadInvoice } from '@/lib/generateInvoice';

const handleDownloadInvoice = async (invoice: any) => {
  const invoiceData = {
    invoiceNumber: `INV-${invoice.id}`,
    date: new Date(invoice.created_at),
    businessName: restaurantName,
    tier: invoice.tier,
    billingCycle: invoice.billing_cycle,
    amount: invoice.amount,
    paymentMethod: invoice.payment_method,
    transactionId: invoice.transaction_id,
    status: 'paid'
  };
  
  await downloadInvoice(invoiceData);
};
```

### Option B: Server-Side PDF (Recommended for Production)

#### 1. Create Supabase Edge Function
```typescript
// supabase/functions/generate-invoice/index.ts
import puppeteer from 'puppeteer';

Deno.serve(async (req) => {
  const invoiceData = await req.json();
  
  const html = generateInvoiceHTML(invoiceData);
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`
    }
  });
});
```

#### 2. Call from Frontend
```typescript
const downloadInvoice = async (invoice: any) => {
  const response = await supabase.functions.invoke('generate-invoice', {
    body: { ...invoice }
  });
  
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${invoice.id}.pdf`;
  a.click();
};
```

---

## 🚀 **Complete Integration Checklist**

### Billing Page:
- [ ] Add route `/billing`
- [ ] Add to navigation
- [ ] Test subscription display
- [ ] Test billing history
- [ ] Test cancel subscription

### Feature Gates:
- [ ] Test FeatureGate component
- [ ] Test InlineFeatureGate
- [ ] Test FeatureBadge
- [ ] Apply gates to analytics
- [ ] Apply gates to premium features
- [ ] Test tier upgrades unlock features

### Email Notifications:
- [ ] Setup Resend account
- [ ] Create Edge Function
- [ ] Add environment variable
- [ ] Test welcome email
- [ ] Test trial expiring email
- [ ] Setup cron jobs

### Invoice PDFs:
- [ ] Choose PDF method (client or server)
- [ ] Install dependencies
- [ ] Test invoice generation
- [ ] Test download
- [ ] Add to email (attach PDF)

---

## 🎯 **Real-World Usage Examples**

### Example 1: Lock Analytics for Expired Trials
```typescript
// In AdminAnalytics.tsx
import FeatureGate from '@/components/FeatureGate';

export default function AdminAnalytics() {
  return (
    <FeatureGate feature="basic_analytics">
      {/* Analytics content */}
      <AnalyticsDashboard />
    </FeatureGate>
  );
}
```

### Example 2: Show AI Features Only for High Smart
```typescript
// In menu or settings
import { InlineFeatureGate } from '@/components/FeatureGate';

<InlineFeatureGate feature="ai_recommendations">
  <Button onClick={() => navigate('/ai-recommendations')}>
    🤖 AI Menu Suggestions
  </Button>
</InlineFeatureGate>
```

### Example 3: Auto-Send Email After Payment
```typescript
// In UpgradePage after successful payment
import { sendPaymentReceivedEmail } from '@/lib/sendEmail';
import { downloadInvoice } from '@/lib/generateInvoice';

const handlePaymentSuccess = async () => {
  // Update database
  await upgradeMutation.mutate();
  
  // Send email with invoice
  await sendPaymentReceivedEmail(
    email, restaurantName, amount, invoiceNumber, new Date()
  );
  
  // Generate PDF invoice
  const invoiceData = { /* ... */ };
  await downloadInvoice(invoiceData);
};
```

---

## 📝 **Next Steps**

1. **Deploy Billing Page** - Add route and test
2. **Apply Feature Gates** - Lock premium features
3. **Setup Email Service** - Resend + Edge Functions
4. **Test Invoice Generation** - Download and verify PDFs
5. **Monitor Usage** - Track which features are gated

---

**All advanced features are ready!** 🎉

**Questions?** Check individual feature files for detailed implementation.
