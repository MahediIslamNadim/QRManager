// QR Manager - Tier Definitions
// Created: April 8, 2026

export type TierType = 'medium_smart' | 'high_smart';
export type BillingCycle = 'monthly' | 'yearly';

export interface TierConfig {
  name: string;
  name_bn: string; // Bangla name
  description: string;
  description_bn: string;
  price_monthly: number;
  price_yearly: number;
  maxTables: number; // -1 means unlimited
  maxStaff: number;  // -1 means unlimited
  features: string[];
  color: string; // For UI badges
}

export const TIERS: Record<TierType, TierConfig> = {
  medium_smart: {
    name: 'Medium Smart',
    name_bn: 'মিডিয়াম স্মার্ট',
    description: 'Complete QR ordering system with analytics and payments',
    description_bn: 'সম্পূর্ণ QR ordering সিস্টেম analytics এবং payments সহ',
    price_monthly: 999,
    price_yearly: 9590, // ~20% discount (2 months free)
    maxTables: 20,
    maxStaff: 5,
    features: [
      'qr_ordering',
      'menu_management',
      'table_management',
      'order_management',
      'kitchen_display',
      'analytics_dashboard',
      'sales_reports',
      'whatsapp_notifications',
      'email_notifications',
      'online_payments', // bKash, Nagad
      'cash_tracking',
      'basic_inventory',
      'customer_feedback',
      'multi_staff'
    ],
    color: 'blue'
  },
  
  high_smart: {
    name: 'High Smart',
    name_bn: 'হাই স্মার্ট',
    description: 'Premium features with unlimited tables, AI, and multi-location',
    description_bn: 'প্রিমিয়াম features unlimited tables, AI এবং multi-location সহ',
    price_monthly: 1999,
    price_yearly: 19190, // ~20% discount (2 months free)
    maxTables: -1, // unlimited
    maxStaff: -1,  // unlimited
    features: [
      'all_medium_features', // Includes all Medium Smart features
      'unlimited_tables',
      'unlimited_staff',
      'multi_location',
      'ai_recommendations',
      'predictive_analytics',
      'custom_branding',
      'api_access',
      'advanced_analytics',
      'custom_reports',
      'priority_support',
      'dedicated_manager'
    ],
    color: 'purple'
  }
};

// Feature descriptions for UI
export const FEATURE_DESCRIPTIONS: Record<string, { name: string; name_bn: string; description: string }> = {
  qr_ordering: {
    name: 'QR Code Ordering',
    name_bn: 'QR কোড অর্ডারিং',
    description: 'Customers scan QR to order directly'
  },
  analytics_dashboard: {
    name: 'Analytics Dashboard',
    name_bn: 'Analytics Dashboard',
    description: 'Sales insights and business metrics'
  },
  whatsapp_notifications: {
    name: 'WhatsApp Notifications',
    name_bn: 'WhatsApp Notifications',
    description: 'Real-time order alerts via WhatsApp'
  },
  online_payments: {
    name: 'Online Payments',
    name_bn: 'Online Payments',
    description: 'bKash and Nagad integration'
  },
  multi_location: {
    name: 'Multi-Location Support',
    name_bn: 'মাল্টি-লোকেশন সাপোর্ট',
    description: 'Manage multiple restaurant locations'
  },
  ai_recommendations: {
    name: 'AI Recommendations',
    name_bn: 'AI সুপারিশ',
    description: 'Smart menu suggestions for customers'
  },
  custom_branding: {
    name: 'Custom Branding',
    name_bn: 'কাস্টম ব্র্যান্ডিং',
    description: 'Your logo and colors'
  }
};

// Helper functions
export const getTierConfig = (tier: TierType): TierConfig => {
  return TIERS[tier];
};

export const getTierPrice = (tier: TierType, cycle: BillingCycle): number => {
  const config = TIERS[tier];
  return cycle === 'monthly' ? config.price_monthly : config.price_yearly;
};

export const getMonthlyEquivalent = (tier: TierType, cycle: BillingCycle): number => {
  const config = TIERS[tier];
  if (cycle === 'monthly') return config.price_monthly;
  return Math.round(config.price_yearly / 12);
};

export const getSavings = (tier: TierType): number => {
  const config = TIERS[tier];
  const monthlyTotal = config.price_monthly * 12;
  return monthlyTotal - config.price_yearly;
};

export const getSavingsPercentage = (tier: TierType): number => {
  const config = TIERS[tier];
  const monthlyTotal = config.price_monthly * 12;
  return Math.round(((monthlyTotal - config.price_yearly) / monthlyTotal) * 100);
};

export const canAddTable = (currentCount: number, tier: TierType): boolean => {
  const config = TIERS[tier];
  if (config.maxTables === -1) return true; // unlimited
  return currentCount < config.maxTables;
};

export const canAddStaff = (currentCount: number, tier: TierType): boolean => {
  const config = TIERS[tier];
  if (config.maxStaff === -1) return true; // unlimited
  return currentCount < config.maxStaff;
};

export const hasFeature = (tier: TierType, feature: string): boolean => {
  const config = TIERS[tier];
  
  // High Smart has all Medium Smart features
  if (tier === 'high_smart' && TIERS.medium_smart.features.includes(feature)) {
    return true;
  }
  
  return config.features.includes(feature);
};

// Trial configuration
export const TRIAL_CONFIG = {
  duration_days: 30, // Sylhet special: 30 days
  tier: 'medium_smart' as TierType, // Trial gives Medium Smart features
  features_included: TIERS.medium_smart.features
};

// Type aliases and additional types
export type TierName = TierType;
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

// Formatting helpers
export const formatPrice = (amount: number): string => {
  return `৳${amount.toLocaleString('en-BD')}`;
};

export const getPricingDisplay = (tier: TierType, cycle: BillingCycle) => {
  const config = TIERS[tier];
  const price = cycle === 'monthly' ? config.price_monthly : config.price_yearly;
  return {
    price,
    formatted: formatPrice(price),
    monthly_equivalent: cycle === 'yearly' ? Math.round(config.price_yearly / 12) : config.price_monthly
  };
};

// Trial helper functions
export const getDaysRemainingInTrial = (trialEndDate: Date): number => {
  const now = new Date();
  const diff = trialEndDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const isTrialExpired = (trialEndDate: Date): boolean => {
  return new Date() > trialEndDate;
};

// Launch offer (first 50 customers)
export const LAUNCH_OFFER = {
  enabled: true,
  max_customers: 50,
  discount_percentage: 20, // 2 months free
  medium_yearly_price: 9590,  // Original: 999 * 12 = 11988
  high_yearly_price: 19190    // Original: 1999 * 12 = 23988
};
