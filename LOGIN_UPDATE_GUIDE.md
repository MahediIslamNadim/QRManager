# Login.tsx Update Guide - Add Tier Selection

## 🎯 Goal: Add tier selection to signup flow

---

## Step 1: Import TierSelection Component

**Location:** Top of Login.tsx (around line 10)

**Add this import:**
```typescript
import TierSelection from '@/components/TierSelection';
import { TierName, BillingCycle } from '@/constants/tiers';
```

---

## Step 2: Add State for Tier Selection

**Location:** Inside Login component, after existing useState declarations (around line 35-45)

**Add these states:**
```typescript
const [selectedTier, setSelectedTier] = useState<TierName>('medium_smart');
const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('yearly');
const [showTierSelection, setShowTierSelection] = useState(false);
```

---

## Step 3: Add Tier Selection Handler

**Location:** After the waitForSession function, before handleSubmit (around line 75)

**Add this function:**
```typescript
const handleTierSelect = (tier: TierName, billingCycle: BillingCycle) => {
  setSelectedTier(tier);
  setSelectedBillingCycle(billingCycle);
  setShowTierSelection(false); // Hide tier selection, show form
  toast.success(`${tier === 'medium_smart' ? 'Medium Smart' : 'High Smart'} package selected!`);
};
```

---

## Step 4: Update RPC Call to Include Tier

**Location:** Inside handleSubmit function, find the RPC call (around line 130)

**Find this:**
```typescript
const { data: setupData, error: setupError } = await supabase.rpc(
  "complete_admin_signup" as any,
  {
    p_restaurant_name: restaurantName.trim(),
    p_address: restaurantAddress.trim() || null,
    p_phone: restaurantPhone.trim() || null,
    p_trial_days: FREE_TRIAL_DAYS,
  } as any,
);
```

**Replace with:**
```typescript
const { data: setupData, error: setupError } = await supabase.rpc(
  "complete_admin_signup" as any,
  {
    p_restaurant_name: restaurantName.trim(),
    p_address: restaurantAddress.trim() || null,
    p_phone: restaurantPhone.trim() || null,
    p_trial_days: FREE_TRIAL_DAYS,
    p_tier: selectedTier,  // ✅ NEW: Pass selected tier
    p_billing_cycle: selectedBillingCycle,  // ✅ NEW: Pass billing cycle
  } as any,
);
```

---

## Step 5: Update complete_admin_signup RPC Function

**Location:** Supabase Dashboard → SQL Editor

**Run this SQL to update the function:**

```sql
-- Drop old function
DROP FUNCTION IF EXISTS complete_admin_signup(text, text, text, integer);

-- Create updated function with tier parameters
CREATE OR REPLACE FUNCTION complete_admin_signup(
  p_restaurant_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_trial_days INTEGER DEFAULT 14,
  p_tier TEXT DEFAULT 'medium_smart',
  p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_restaurant_id UUID;
  v_trial_end TIMESTAMPTZ;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: User must be logged in';
  END IF;

  -- Calculate trial end date
  v_trial_end := now() + (p_trial_days || ' days')::INTERVAL;

  -- Create restaurant with tier info
  INSERT INTO restaurants (
    name, 
    address, 
    phone,
    tier,
    billing_cycle,
    subscription_status,
    trial_start_date,
    trial_end_date
  )
  VALUES (
    p_restaurant_name,
    p_address,
    p_phone,
    p_tier,
    p_billing_cycle,
    'trial',
    now(),
    v_trial_end
  )
  RETURNING id INTO v_restaurant_id;

  -- Assign admin role
  INSERT INTO user_roles (user_id, restaurant_id, role)
  VALUES (v_user_id, v_restaurant_id, 'admin');

  -- Return restaurant info
  RETURN json_build_object(
    'restaurant_id', v_restaurant_id,
    'tier', p_tier,
    'billing_cycle', p_billing_cycle,
    'trial_end_date', v_trial_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Step 6: Add Tier Selection UI to Form

**Location:** Inside the form section, where mode === "signup" (around line 350)

**Find this section:**
```typescript
{mode === "signup" && (
  <>
    <div>
      <label style={labelStyle}>আপনার নাম</label>
      ...
```

**Add BEFORE the existing signup fields:**
```typescript
{mode === "signup" && !showTierSelection && (
  <div style={{ marginBottom: 24 }}>
    <TierSelection
      onSelect={handleTierSelect}
      selectedTier={selectedTier}
      selectedBillingCycle={selectedBillingCycle}
    />
  </div>
)}

{mode === "signup" && showTierSelection && (
  <>
    {/* EXISTING SIGNUP FIELDS GO HERE */}
```

**ALTERNATIVE SIMPLER APPROACH:**

Just show tier selection at the TOP of signup, before restaurant name field:

```typescript
{mode === "signup" && (
  <>
    {/* Tier Selection - Show First */}
    <div style={{ marginBottom: 32, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(201,168,76,0.1)' }}>
      <h4 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', marginBottom: 16 }}>
        Choose Your Package
      </h4>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => {
            setSelectedTier('medium_smart');
            setSelectedBillingCycle('yearly');
          }}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 12,
            border: selectedTier === 'medium_smart' ? '2px solid #4F46E5' : '1px solid rgba(201,168,76,0.2)',
            background: selectedTier === 'medium_smart' ? 'rgba(79,70,229,0.1)' : 'rgba(255,255,255,0.04)',
            color: '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Medium Smart</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>৳1,500/month</div>
        </button>
        
        <button
          type="button"
          onClick={() => {
            setSelectedTier('high_smart');
            setSelectedBillingCycle('yearly');
          }}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 12,
            border: selectedTier === 'high_smart' ? '2px solid #9333EA' : '1px solid rgba(201,168,76,0.2)',
            background: selectedTier === 'high_smart' ? 'rgba(147,51,234,0.1)' : 'rgba(255,255,255,0.04)',
            color: '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>High Smart</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>৳3,500/month</div>
        </button>
      </div>
      
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12, textAlign: 'center' }}>
        🎁 30 days FREE trial • Switch anytime
      </p>
    </div>

    {/* THEN REST OF SIGNUP FIELDS */}
    <div>
      <label style={labelStyle}>আপনার নাম</label>
      ...
```

---

## ✅ Summary of Changes:

1. **Import:** TierSelection component + types
2. **State:** selectedTier, selectedBillingCycle
3. **Handler:** handleTierSelect function
4. **RPC:** Pass tier to complete_admin_signup
5. **SQL:** Update RPC function to accept tier parameters
6. **UI:** Add tier selection buttons (simple version)

---

## 🎯 Testing:

1. Go to signup page
2. Select a tier (Medium or High Smart)
3. Fill in restaurant details
4. Submit
5. Check database: `SELECT tier, billing_cycle FROM restaurants;`

---

**File:** C:\Users\hhnad\OneDrive\Desktop\NexCore\QRManager\LOGIN_UPDATE_GUIDE.md

**Use the SIMPLER version with buttons - easier to integrate!**
