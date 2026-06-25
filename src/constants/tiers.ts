// QR Manager - Tier Definitions
// Created: April 8, 2026

export type TierType = 'medium_smart' | 'high_smart';

export interface TierConfig {
  name: string;
  name_bn: string;
  description: string;
  description_bn: string;
  price_yearly: number;
  maxTables: number;
  maxStaff: number;
  features: string[];
  color: string;
}

export const TIERS: Record<TierType, TierConfig> = {
  medium_smart: {
    name: 'Medium Smart',
    name_bn: 'মিডিয়াম স্মার্ট',
    description: 'Complete QR ordering system with analytics and payments',
    description_bn: 'সম্পূর্ণ QR ordering সিস্টেম analytics এবং payments সহ',
    price_yearly: 9590,
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
      'online_payments',
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
    description: 'Premium features with unlimited tables, staff, and AI',
    description_bn: 'প্রিমিয়াম features unlimited tables, staff এবং AI সহ',
    price_yearly: 19190,
    maxTables: -1,
    maxStaff: -1,
    features: [
      'all_medium_features',
      'unlimited_tables',
      'unlimited_staff',
      'ai_recommendations',
      'ai_analytics',
      'predictive_analytics',
      'custom_branding',
      'api_access',
      'advanced_analytics',
      'custom_reports',
      'priority_support'
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
  ai_recommendations: {
    name: 'AI Recommendations',
    name_bn: 'AI সুপারিশ',
    description: 'Smart menu suggestions for customers'
  },
  ai_analytics: {
    name: 'AI Analytics',
    name_bn: 'AI অ্যানালিটিক্স',
    description: 'AI powered restaurant analytics and forecasts'
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

export const getTierPrice = (tier: TierType): number => {
  return TIERS[tier].price_yearly;
};

export const getMonthlyEquivalent = (tier: TierType): number => {
  return Math.round(TIERS[tier].price_yearly / 12);
};

export const getSavings = (tier: TierType): number => {
  const config = TIERS[tier];
  const monthlyEquivalent = Math.round(config.price_yearly / 12);
  return monthlyEquivalent * 12 - config.price_yearly;
};

export const getSavingsPercentage = (tier: TierType): number => {
  const config = TIERS[tier];
  const monthlyEquivalent = Math.round(config.price_yearly / 12);
  return Math.round(((monthlyEquivalent * 12 - config.price_yearly) / (monthlyEquivalent * 12)) * 100);
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
  
  if (tier === 'high_smart' && TIERS.medium_smart.features.includes(feature)) {
    return true;
  }
  
  return config.features.includes(feature);
};

export const TRIAL_CONFIG = {
  duration_days: 30,
  tier: 'medium_smart' as TierType,
  features_included: TIERS.medium_smart.features
};

export type TierName = TierType;
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

// Formatting helpers
export const formatPrice = (amount: number): string => {
  return `৳${amount.toLocaleString('en-BD')}`;
};

export const getPricingDisplay = (tier: TierType) => {
  const config = TIERS[tier];
  return {
    price: config.price_yearly,
    formatted: formatPrice(config.price_yearly),
    monthly_equivalent: Math.round(config.price_yearly / 12)
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

export const LAUNCH_OFFER = {
  enabled: true,
  max_customers: 50,
  medium_yearly_price: 9590,
  high_yearly_price: 19190
};
