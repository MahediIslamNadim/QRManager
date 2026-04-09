# 📋 QR Manager - Package Planning & Decision Tracker

## 🎯 Final Decision (Fill This Out!)

### Package Structure Decision:
```
□ Option 1: 2 Tiers Only (Medium + High) ✅ RECOMMENDED
□ Option 2: 3 Tiers (Low + Medium + High)
□ Option 3: Custom (specify below)

Your Choice: _________________
Date Decided: _________________
```

---

## 💰 Pricing Confirmation

### Medium Smart Package:
```
Monthly Price: ৳_______ (suggested: ৳2500)
Features:
  □ Up to ___ tables (suggested: 20)
  □ Up to ___ staff (suggested: 5)
  □ QR ordering ✅
  □ Analytics ✅
  □ Online payments ✅
  □ WhatsApp notifications ✅
  □ Other: _________________
```

### High Smart Package:
```
Monthly Price: ৳_______ (suggested: ৳6000)
Features:
  □ Unlimited tables ✅
  □ Unlimited staff ✅
  □ All Medium features ✅
  □ AI recommendations ✅
  □ Multi-location support ✅
  □ API access ✅
  □ Other: _________________
```

---

## 🎁 Trial Strategy Decision

### Free Trial Duration:
```
□ 7 days
□ 14 days ✅ RECOMMENDED
□ 30 days
□ Custom: ___ days

Which package for trial:
□ Medium Smart ✅ RECOMMENDED
□ High Smart
□ Let customer choose
```

### Trial to Paid Conversion:
```
□ Auto-convert with payment
□ Manual approval required
□ Send reminder on Day ___

Discount for first month:
□ No discount
□ 10% off
□ 20% off ✅ RECOMMENDED
□ 50% off
□ Custom: ___% off
```

---

## 📊 Feature Breakdown Checklist

### Core Features (Both Packages):
```
✅ QR code ordering
✅ Menu management  
✅ Order notifications
✅ Table management
✅ Basic reports
✅ Cash payment tracking
```

### Medium Smart Only:
```
□ Analytics dashboard
□ WhatsApp notifications
□ Online payments (bKash, Nagad)
□ Multi-staff (up to 5)
□ Kitchen display
□ Customer feedback
□ Inventory tracking (basic)
□ Email support
```

### High Smart Only:
```
□ AI-powered recommendations
□ Multi-location support
□ Advanced analytics
□ API access
□ Custom branding
□ Priority support (24/7)
□ Dedicated account manager
□ White-label option
□ CRM integration
```

---

## 🚀 Implementation Checklist

### Phase 1: Database Setup
```
□ Update restaurants table schema
  □ Add tier column
  □ Add max_tables column
  □ Add max_staff column
  
□ Create feature_flags table
  □ restaurant_id
  □ feature_name
  □ enabled
  
Status: ⬜ Not Started | 🔄 In Progress | ✅ Done
Date: _________________
```

### Phase 2: Feature Gating
```
□ Create TIERS constant file
□ Create useFeature hook
□ Add tier check in components
  □ Analytics component
  □ Payment component
  □ WhatsApp settings
  □ Staff management
  
Status: ⬜ Not Started | 🔄 In Progress | ✅ Done
Date: _________________
```

### Phase 3: Signup Flow
```
□ Add tier selection in signup
□ Update complete_admin_signup RPC
□ Add trial period logic
□ Create upgrade/downgrade flow
  
Status: ⬜ Not Started | 🔄 In Progress | ✅ Done
Date: _________________
```

### Phase 4: Payment Integration
```
□ Create subscription table
□ Add payment tracking
□ Implement trial expiry logic
□ Add upgrade prompts
  
Status: ⬜ Not Started | 🔄 In Progress | ✅ Done
Date: _________________
```

### Phase 5: Admin Panel
```
□ Tier comparison page
□ Upgrade flow UI
□ Feature locked state UI
□ Billing page
  
Status: ⬜ Not Started | 🔄 In Progress | ✅ Done
Date: _________________
```

---

## 💡 Key Decisions Tracker

### Decision 1: Number of Tiers
```
Decision: _________________
Reason: _________________
Decided by: _________________
Date: _________________
```

### Decision 2: Trial Package
```
Decision: _________________
Reason: _________________
Decided by: _________________
Date: _________________
```

### Decision 3: Pricing
```
Medium Smart: ৳_______
High Smart: ৳_______
Reason: _________________
Decided by: _________________
Date: _________________
```

### Decision 4: Must-Have Features for Launch
```
1. _________________
2. _________________
3. _________________
4. _________________
5. _________________
```

### Decision 5: Nice-to-Have (Can Launch Without)
```
1. _________________
2. _________________
3. _________________
```

---

## 📅 Timeline Planning

### Week 1: Planning & Design
```
□ Finalize package structure
□ Finalize pricing
□ Design comparison page mockup
□ Write feature descriptions
□ Decide on trial strategy

Target completion: _________________
Actual completion: _________________
```

### Week 2: Database & Backend
```
□ Database schema updates
□ RPC function updates
□ Feature flag system
□ Trial logic implementation

Target completion: _________________
Actual completion: _________________
```

### Week 3: Frontend Implementation
```
□ Tier selection UI
□ Feature gating
□ Upgrade flow
□ Billing page

Target completion: _________________
Actual completion: _________________
```

### Week 4: Testing & Launch
```
□ Test all features
□ Test trial flow
□ Test upgrade/downgrade
□ Beta launch with 5 restaurants
□ Full launch

Target completion: _________________
Actual completion: _________________
```

---

## 🎯 Success Metrics

### Target for Month 1:
```
Total signups: ___ (target: 10)
Medium Smart: ___ (target: 7)
High Smart: ___ (target: 3)
Trial to Paid: ___% (target: 50%)
MRR: ৳_______ (target: ৳35,000)
```

### Target for Month 3:
```
Total customers: ___ (target: 30)
Medium Smart: ___ (target: 21)
High Smart: ___ (target: 9)
MRR: ৳_______ (target: ৳1,06,500)
Churn rate: ___% (target: <10%)
```

---

## 📝 Notes & Ideas

### Feature Ideas for Future:
```
- _________________
- _________________
- _________________
```

### Pricing Adjustments Needed:
```
- _________________
- _________________
```

### Customer Feedback:
```
Date: _________ | Customer: _________ | Feedback: _________________
Date: _________ | Customer: _________ | Feedback: _________________
Date: _________ | Customer: _________ | Feedback: _________________
```

---

## ✅ Final Approval

```
Planning Complete: □ Yes □ No
Approved by: _________________
Date: _________________

Ready for Implementation: □ Yes □ No
Start Date: _________________

Notes: _________________
_________________
_________________
```

---

## 🔄 Update Log

```
Date: _________ | Changed: _________ | Reason: _________________
Date: _________ | Changed: _________ | Reason: _________________
Date: _________ | Changed: _________ | Reason: _________________
```

---

**Created:** April 8, 2026  
**Project:** QR Manager  
**Status:** 📋 Planning Phase

**Next Action:** Fill out "Final Decision" section at the top!
