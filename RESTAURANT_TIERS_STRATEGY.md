# 🏪 QR Manager - Restaurant Tiers Strategy

## 📊 Business Model Overview

আপনার QR Manager project এ **3টি tier** implement করার সম্পূর্ণ plan।

---

## 🎯 Tier Breakdown

### 💡 Low Smart Restaurant (Basic Tier)
**Monthly Price:** ৳500-1000  
**Target:** ছোট রেস্টুরেন্ট, street food, নতুন business

#### Features:
- ✅ QR code ordering (basic)
- ✅ Up to 5 tables
- ✅ Basic menu management
- ✅ Order notifications (SMS only)
- ✅ Cash payment tracking
- ✅ Simple daily reports
- ❌ No analytics
- ❌ No multiple staff
- ❌ No integrations

---

### 🌟 Medium Smart Restaurant (Standard Tier)
**Monthly Price:** ৳2000-3000  
**Target:** মাঝারি রেস্টুরেন্ট, established business

#### Features:
- ✅ All Low Smart features +
- ✅ Up to 20 tables
- ✅ Multi-staff management (5 users)
- ✅ Advanced analytics & reports
- ✅ WhatsApp notifications
- ✅ Online payment (bKash, Nagad)
- ✅ Customer feedback system
- ✅ Kitchen display system
- ✅ Inventory tracking (basic)
- ✅ Email support

---

### 🚀 High Smart Restaurant (Premium Tier)
**Monthly Price:** ৳5000-10000  
**Target:** বড় রেস্টুরেন্ট, chain restaurants, premium dining

#### Features:
- ✅ All Medium Smart features +
- ✅ Unlimited tables
- ✅ Unlimited staff
- ✅ AI-powered recommendations
- ✅ Predictive analytics
- ✅ Multi-location support
- ✅ Custom branding
- ✅ API access
- ✅ Advanced inventory management
- ✅ CRM integration
- ✅ Loyalty program
- ✅ Priority support (24/7)
- ✅ Custom reports
- ✅ White-label option

---

## 💰 Pricing Strategy

### Option A: Fixed Monthly Fee (Recommended)
```
Low Smart:    ৳800/month  (flat rate)
Medium Smart: ৳2500/month (flat rate)
High Smart:   ৳6000/month (flat rate)
```

✅ **Pros:** Simple, predictable, easy to sell  
❌ **Cons:** May not scale with usage

---

### Option B: Usage-Based Pricing
```
Low Smart:    ৳500 + ৳50/table/month
Medium Smart: ৳1500 + ৳80/table/month
High Smart:   ৳3000 + ৳100/table/month
```

✅ **Pros:** Fair for different sizes  
❌ **Cons:** Complex billing, unpredictable

---

### Option C: Hybrid Model (BEST!)
```
Low Smart:    ৳800/month  (up to 5 tables)
Medium Smart: ৳2500/month (up to 20 tables) + ৳100 for each extra table
High Smart:   ৳6000/month (unlimited tables + all features)
```

✅ **Pros:** Simple base, scalable, attracts all sizes  
✅ **This is my recommendation!**

---

## 🎨 Feature Implementation Priority

### Phase 1: Core Features (DONE ✅)
- QR code generation
- Basic ordering
- Payment tracking
- Admin dashboard

### Phase 2: Tier Differentiation (NEXT - 2 weeks)
1. **Week 1:**
   - Table limit enforcement
   - User role restrictions
   - Feature gating in code

2. **Week 2:**
   - Analytics dashboard (Medium+)
   - WhatsApp integration (Medium+)
   - Multi-location (High only)

### Phase 3: Premium Features (Month 2)
- AI recommendations
- Advanced analytics
- CRM integration
- Custom branding

---

## 📋 Database Schema Changes Needed

### 1. Add to `restaurants` table:
```sql
ALTER TABLE restaurants 
ADD COLUMN tier TEXT DEFAULT 'low_smart' 
CHECK (tier IN ('low_smart', 'medium_smart', 'high_smart'));

ALTER TABLE restaurants
ADD COLUMN max_tables INTEGER DEFAULT 5;

ALTER TABLE restaurants
ADD COLUMN max_staff INTEGER DEFAULT 1;
```

### 2. Add feature flags table:
```sql
CREATE TABLE restaurant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  feature_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  UNIQUE(restaurant_id, feature_name)
);
```

---

## 🔧 Code Implementation

### 1. Create `src/constants/tiers.ts`:
```typescript
export const TIERS = {
  LOW_SMART: {
    name: 'Low Smart',
    price: 800,
    maxTables: 5,
    maxStaff: 1,
    features: ['qr_ordering', 'basic_menu', 'sms_notify']
  },
  MEDIUM_SMART: {
    name: 'Medium Smart',
    price: 2500,
    maxTables: 20,
    maxStaff: 5,
    features: ['qr_ordering', 'analytics', 'whatsapp', 'online_payment']
  },
  HIGH_SMART: {
    name: 'High Smart',
    price: 6000,
    maxTables: -1, // unlimited
    maxStaff: -1,  // unlimited
    features: ['all', 'ai_recommendations', 'api_access', 'white_label']
  }
};
```

### 2. Create feature check hook:
```typescript
// src/hooks/useFeature.ts
export const useFeature = (featureName: string) => {
  const { restaurant } = useAuth();
  
  const hasFeature = () => {
    if (!restaurant) return false;
    const tier = TIERS[restaurant.tier.toUpperCase()];
    return tier.features.includes(featureName) || 
           tier.features.includes('all');
  };
  
  return { hasFeature: hasFeature() };
};
```

### 3. Use in components:
```typescript
const { hasFeature } = useFeature('analytics');

{hasFeature && (
  <AnalyticsDashboard />
)}
```

---

## 📈 Marketing Strategy

### Messaging:
```
Low Smart:    "শুরু করুন স্মার্ট অর্ডারিং - শুধু ৳800/মাস"
Medium Smart: "আপনার ব্যবসা বাড়ান - ৳2500/মাস এ সব features"
High Smart:   "সম্পূর্ণ automation - ৳6000/মাস এ premium experience"
```

### Free Trial:
- Low Smart: 14 days free
- Medium Smart: 14 days free
- High Smart: 7 days free + demo call

---

## 🎯 Recommendation

### আমার পরামর্শ:

**✅ DO:**
1. Start with **3 clear tiers** (Low/Medium/High)
2. Use **Hybrid pricing** (fixed base + extras)
3. Implement **feature flags** properly
4. Focus on **value differentiation** not just features
5. Make **upgrade path easy**

**❌ DON'T:**
1. Too many tiers (confusing)
2. Complex per-table pricing
3. Hidden features
4. Hard limits that frustrate users

---

## 📊 Expected Revenue (Year 1)

### Conservative Estimate:
```
Low Smart:    50 customers × ৳800  = ৳40,000/month
Medium Smart: 20 customers × ৳2500 = ৳50,000/month
High Smart:   5 customers  × ৳6000 = ৳30,000/month

Total Revenue: ৳1,20,000/month = ৳14,40,000/year
```

### Growth Target (Year 2):
```
Low Smart:    100 × ৳800  = ৳80,000
Medium Smart: 50  × ৳2500 = ৳1,25,000
High Smart:   15  × ৳6000 = ৳90,000

Total: ৳2,95,000/month = ৳35,40,000/year
```

---

## 🚀 Next Steps

### This Week:
1. ✅ Review this strategy
2. ⬜ Finalize pricing
3. ⬜ Design tier comparison page
4. ⬜ Update database schema

### Next Week:
1. ⬜ Implement feature flags
2. ⬜ Add tier selection in signup
3. ⬜ Create upgrade flow
4. ⬜ Test tier restrictions

### Month 1:
1. ⬜ Launch Medium Smart features
2. ⬜ Beta test with 5 restaurants
3. ⬜ Get feedback
4. ⬜ Adjust pricing if needed

---

## 💭 Questions to Consider:

1. **কোন tier দিয়ে launch করবেন?**
   - Suggestion: সবগুলো একসাথে, তবে Low Smart focus করে marketing

2. **Existing customers কী করবেন?**
   - Suggestion: Grandfather them into Medium Smart (loyalty reward)

3. **Annual discount দেবেন?**
   - Suggestion: 2 months free on annual payment

4. **What if customer outgrows tier?**
   - Suggestion: Auto-suggest upgrade, easy migration

---

## 📞 Support

Questions? এই strategy নিয়ে কোন doubt থাকলে জানান!

---

**Created:** April 8, 2026  
**For:** QR Manager Project Expansion  
**Status:** Strategy Planning Phase
