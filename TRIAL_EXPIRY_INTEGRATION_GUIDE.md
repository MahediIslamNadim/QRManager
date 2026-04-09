# Trial Expiry Integration Guide

## 🎯 Goal: Add trial expiry checks and warnings to your app

---

## ✅ Files Created:

```
1. src/hooks/useTrialStatus.ts - Hook to check trial status
2. src/components/TrialWarningBanner.tsx - Warning banner (shows at top)
3. src/components/TrialExpiredModal.tsx - Blocking modal (when expired)
```

---

## 📋 Step 1: Update DashboardLayout

**Location:** `src/components/DashboardLayout.tsx`

**Add imports at top:**
```typescript
import { useTrialStatus } from '@/hooks/useTrialStatus';
import TrialWarningBanner from '@/components/TrialWarningBanner';
import TrialExpiredModal from '@/components/TrialExpiredModal';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
```

**Inside DashboardLayout component:**
```typescript
export default function DashboardLayout({ children, role, title }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { restaurantId } = useAuth(); // Assuming you have this
  
  // ✅ Add trial status check
  const {
    isExpired,
    daysRemaining,
    showWarning,
    showCriticalWarning,
    tier,
    subscriptionStatus,
    canUseApp,
    loading: trialLoading
  } = useTrialStatus(restaurantId);

  // Handler for upgrade click
  const handleUpgradeClick = () => {
    // TODO: Navigate to upgrade/payment page
    toast.info('Upgrade feature coming soon!');
    // navigate('/upgrade');
  };

  // Handler for logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Rest of your existing DashboardLayout code...
  
  return (
    <div className="min-h-screen bg-background">
      {/* ✅ Trial Warning Banner - Show at top when trial is ending */}
      {showWarning && !isExpired && (
        <TrialWarningBanner
          daysRemaining={daysRemaining}
          isCritical={showCriticalWarning}
          tier={tier}
          onUpgradeClick={handleUpgradeClick}
        />
      )}

      {/* ✅ Trial Expired Modal - Block access when expired */}
      <TrialExpiredModal
        open={isExpired && !trialLoading}
        tier={tier}
        onUpgradeClick={handleUpgradeClick}
        onLogoutClick={handleLogout}
      />

      {/* Your existing layout code */}
      <div className="flex">
        {/* Sidebar */}
        <aside>...</aside>
        
        {/* Main content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## 📋 Step 2: Alternative - Protect Individual Pages

If you don't want to modify DashboardLayout, protect individual admin pages:

**Example: AdminDashboard.tsx**
```typescript
import { useCanAccessApp } from '@/hooks/useTrialStatus';
import TrialExpiredModal from '@/components/TrialExpiredModal';

export default function AdminDashboard() {
  const { restaurantId } = useAuth();
  const { canAccess, isExpired, loading } = useCanAccessApp(restaurantId);

  const handleUpgrade = () => {
    // Navigate to upgrade page
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <TrialExpiredModal
        open={!canAccess}
        tier={tier}
        onUpgradeClick={handleUpgrade}
        onLogoutClick={handleLogout}
      />
      
      {/* Your dashboard content */}
      <div>...</div>
    </>
  );
}
```

---

## 📋 Step 3: Update tiers.ts with Helper Functions

The helper functions are already in `src/constants/tiers.ts`:

```typescript
// These functions are already available:
export const getTrialEndDate = (tierName: TierName, startDate: Date = new Date()): Date
export const isTrialExpired = (trialEndDate: Date): boolean
export const getDaysRemainingInTrial = (trialEndDate: Date): number
```

---

## 🎨 Customization Options:

### Change Warning Threshold:
In `useTrialStatus.ts`, modify:
```typescript
showWarning: daysRemaining <= 7 && daysRemaining > 0,  // Change 7 to whatever
showCriticalWarning: daysRemaining <= 3 && daysRemaining > 0,  // Change 3
```

### Change Banner Style:
Edit `TrialWarningBanner.tsx` for different colors/styles

### Change Modal Behavior:
Edit `TrialExpiredModal.tsx` - currently blocks all access, but you could:
- Allow read-only access
- Show different messages for different tiers
- Add "Extend Trial" option

---

## 🚀 Testing:

### Test Trial Warning (7 days left):
```sql
-- In Supabase SQL Editor
UPDATE restaurants
SET trial_end_date = now() + INTERVAL '7 days'
WHERE id = 'YOUR_RESTAURANT_ID';
```

### Test Critical Warning (2 days left):
```sql
UPDATE restaurants
SET trial_end_date = now() + INTERVAL '2 days'
WHERE id = 'YOUR_RESTAURANT_ID';
```

### Test Expired:
```sql
UPDATE restaurants
SET 
  trial_end_date = now() - INTERVAL '1 day',
  subscription_status = 'trial'
WHERE id = 'YOUR_RESTAURANT_ID';
```

### Test Active Subscription:
```sql
UPDATE restaurants
SET subscription_status = 'active'
WHERE id = 'YOUR_RESTAURANT_ID';
```

---

## ✅ Checklist:

- [ ] Import components in DashboardLayout
- [ ] Add useTrialStatus hook
- [ ] Add TrialWarningBanner at top
- [ ] Add TrialExpiredModal
- [ ] Add handleUpgradeClick handler
- [ ] Add handleLogout handler
- [ ] Test with different trial dates
- [ ] Test with active subscription
- [ ] Test with expired subscription

---

## 🎯 What This Does:

1. **7+ days left:** No warning
2. **3-7 days left:** Yellow warning banner at top
3. **1-3 days left:** Red critical warning banner
4. **Expired:** Full-screen modal blocking access
5. **Active subscription:** No warnings, full access

---

**File:** C:\Users\hhnad\OneDrive\Desktop\NexCore\QRManager\TRIAL_EXPIRY_INTEGRATION_GUIDE.md

**Next:** Integrate into DashboardLayout and test!
