export type TierType = "medium_smart" | "high_smart" | "high_smart_enterprise";
export type BillingCycle = "monthly" | "yearly";

export interface TierConfig {
  name: string;
  name_bn: string;
  description: string;
  description_bn: string;
  price_monthly: number;
  price_yearly: number;
  maxTables: number;
  maxStaff: number;
  maxBranches?: number;
  maxGroups?: number;
  features: string[];
  color: string;
}

export const TIERS: Record<TierType, TierConfig> = {
  medium_smart: {
    name: "Medium Smart",
    name_bn: "Medium Smart",
    description: "Complete QR ordering system with analytics and payments",
    description_bn: "QR ordering, analytics, and payment tools for a single restaurant",
    price_monthly: 999,
    price_yearly: 9590,
    maxTables: 20,
    maxStaff: 5,
    maxBranches: 0,
    maxGroups: 0,
    features: [
      "qr_ordering",
      "menu_management",
      "table_management",
      "order_management",
      "kitchen_display",
      "analytics_dashboard",
      "sales_reports",
      "whatsapp_notifications",
      "email_notifications",
      "online_payments",
      "cash_tracking",
      "basic_inventory",
      "customer_feedback",
      "multi_staff",
    ],
    color: "blue",
  },
  high_smart: {
    name: "High Smart",
    name_bn: "High Smart",
    description: "Premium single-restaurant package with AI and advanced branding",
    description_bn: "AI, premium branding, and advanced analytics for one restaurant",
    price_monthly: 1999,
    price_yearly: 19190,
    maxTables: -1,
    maxStaff: -1,
    maxBranches: 0,
    maxGroups: 0,
    features: [
      "all_medium_features",
      "unlimited_tables",
      "unlimited_staff",
      "ai_recommendations",
      "predictive_analytics",
      "custom_branding",
      "api_access",
      "advanced_analytics",
      "custom_reports",
      "priority_support",
    ],
    color: "purple",
  },
  high_smart_enterprise: {
    name: "High Smart Enterprise",
    name_bn: "High Smart Enterprise",
    description: "For multi-location restaurant operations with central control",
    description_bn: "Central dashboard, shared menus, notices, and analytics across locations",
    price_monthly: 0,
    price_yearly: 0,
    maxTables: -1,
    maxStaff: -1,
    maxBranches: -1,
    maxGroups: -1,
    features: [
      "all_high_smart_features",
      "multi_location",
      "unlimited_groups",
      "unlimited_branches",
      "white_label",
      "custom_integrations",
      "sla_support",
      "custom_reports_advanced",
      "api_access_full",
      "data_export",
    ],
    color: "gold",
  },
};

export const FEATURE_DESCRIPTIONS: Record<string, { name: string; name_bn: string; description: string }> = {
  qr_ordering: {
    name: "QR Code Ordering",
    name_bn: "QR Code Ordering",
    description: "Customers scan QR to order directly",
  },
  analytics_dashboard: {
    name: "Analytics Dashboard",
    name_bn: "Analytics Dashboard",
    description: "Sales insights and business metrics",
  },
  whatsapp_notifications: {
    name: "WhatsApp Notifications",
    name_bn: "WhatsApp Notifications",
    description: "Real-time order alerts via WhatsApp",
  },
  online_payments: {
    name: "Online Payments",
    name_bn: "Online Payments",
    description: "bKash and Nagad integration",
  },
  multi_location: {
    name: "Multi-Location Support",
    name_bn: "Multi-Location Support",
    description: "Manage multiple restaurant locations from one enterprise workspace",
  },
  ai_recommendations: {
    name: "AI Recommendations",
    name_bn: "AI Recommendations",
    description: "Smart menu suggestions for customers",
  },
  custom_branding: {
    name: "Custom Branding",
    name_bn: "Custom Branding",
    description: "Your logo and brand colors",
  },
  unlimited_groups: {
    name: "Unlimited Restaurant Groups",
    name_bn: "Unlimited Restaurant Groups",
    description: "Manage enterprise restaurant structures",
  },
  unlimited_branches: {
    name: "Unlimited Branches",
    name_bn: "Unlimited Branches",
    description: "No limit on the number of managed restaurant locations",
  },
  white_label: {
    name: "White Label",
    name_bn: "White Label",
    description: "Fully branded experience with your identity",
  },
  sla_support: {
    name: "SLA Support 24/7",
    name_bn: "SLA Support 24/7",
    description: "Guaranteed response time support",
  },
  custom_integrations: {
    name: "Custom Integrations",
    name_bn: "Custom Integrations",
    description: "POS, ERP, and third-party integrations",
  },
};

export const getTierConfig = (tier: TierType): TierConfig => TIERS[tier];

export const getTierPrice = (tier: TierType, cycle: BillingCycle): number => {
  const config = TIERS[tier];
  return cycle === "monthly" ? config.price_monthly : config.price_yearly;
};

export const getMonthlyEquivalent = (tier: TierType, cycle: BillingCycle): number => {
  const config = TIERS[tier];
  if (cycle === "monthly") return config.price_monthly;
  return Math.round(config.price_yearly / 12);
};

export const getSavings = (tier: TierType): number => {
  const config = TIERS[tier];
  return config.price_monthly * 12 - config.price_yearly;
};

export const getSavingsPercentage = (tier: TierType): number => {
  const config = TIERS[tier];
  const monthlyTotal = config.price_monthly * 12;
  return Math.round(((monthlyTotal - config.price_yearly) / monthlyTotal) * 100);
};

export const canAddTable = (currentCount: number, tier: TierType): boolean => {
  const config = TIERS[tier];
  return config.maxTables === -1 || currentCount < config.maxTables;
};

export const canAddStaff = (currentCount: number, tier: TierType): boolean => {
  const config = TIERS[tier];
  return config.maxStaff === -1 || currentCount < config.maxStaff;
};

export const getMaxBranches = (tier: TierType): number => {
  if (tier === "high_smart_enterprise") return -1;
  return 0;
};

export const getMaxGroups = (tier: TierType): number => {
  if (tier === "high_smart_enterprise") return -1;
  return 0;
};

export const isEnterpriseTier = (tier: TierType): boolean => tier === "high_smart_enterprise";

export const hasFeature = (tier: TierType, feature: string): boolean => {
  if (tier === "high_smart_enterprise") return true;
  if (tier === "high_smart" && TIERS.medium_smart.features.includes(feature)) return true;
  return TIERS[tier]?.features.includes(feature) ?? false;
};

export const TRIAL_CONFIG = {
  duration_days: 14,
  tier: "medium_smart" as TierType,
  features_included: TIERS.medium_smart.features,
};

export type TierName = TierType;
export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

export const formatPrice = (amount: number): string => `à§³${amount.toLocaleString("en-BD")}`;

export const formatTierPrice = (tier: TierType, cycle: BillingCycle): string => {
  if (tier === "high_smart_enterprise") return "Custom";
  return formatPrice(getTierPrice(tier, cycle));
};

export const getPricingDisplay = (tier: TierType, cycle: BillingCycle) => {
  if (tier === "high_smart_enterprise") {
    return { price: 0, formatted: "Custom", monthly_equivalent: 0, isCustom: true };
  }

  const config = TIERS[tier];
  const price = cycle === "monthly" ? config.price_monthly : config.price_yearly;

  return {
    price,
    formatted: formatPrice(price),
    monthly_equivalent: cycle === "yearly" ? Math.round(config.price_yearly / 12) : config.price_monthly,
    isCustom: false,
  };
};

export const getDaysRemainingInTrial = (trialEndDate: Date): number => {
  const now = new Date();
  const diff = trialEndDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const isTrialExpired = (trialEndDate: Date): boolean => new Date() > trialEndDate;

export const LAUNCH_OFFER = {
  enabled: true,
  max_customers: 50,
  discount_percentage: 20,
  medium_yearly_price: 9590,
  high_yearly_price: 19190,
};
