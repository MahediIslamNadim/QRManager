import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionStatus, TierName } from "@/constants/tiers";

export const FEATURES = {
  qr_ordering: {
    name: "QR Ordering",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: false,
  },
  menu_management: {
    name: "Menu Management",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: false,
  },
  table_management: {
    name: "Table Management",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: false,
  },
  basic_analytics: {
    name: "Basic Analytics",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  whatsapp_notifications: {
    name: "WhatsApp Notifications",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  payment_integration: {
    name: "Payment Integration",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  basic_inventory: {
    name: "Basic Inventory",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  advanced_analytics: {
    name: "Advanced Analytics",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  ai_recommendations: {
    name: "AI Recommendations",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  custom_branding: {
    name: "Custom Branding",
    tiers: ["medium_smart", "high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: false,
  },
  api_access: {
    name: "API Access",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  multi_location: {
    name: "Multi-Location Support",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  priority_support: {
    name: "Priority Support 24/7",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  advanced_inventory: {
    name: "Advanced Inventory",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  custom_reports: {
    name: "Custom Reports",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  predictive_analytics: {
    name: "Predictive Analytics",
    tiers: ["high_smart", "high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  unlimited_groups: {
    name: "Unlimited Restaurant Groups",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  unlimited_branches: {
    name: "Unlimited Branches",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  white_label: {
    name: "White Label",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  sla_support: {
    name: "SLA Support 24/7",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  custom_integrations: {
    name: "Custom Integrations",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
  data_export: {
    name: "Full Data Export",
    tiers: ["high_smart_enterprise"] as TierName[],
    requiresActiveSub: true,
  },
} as const;

export type FeatureName = keyof typeof FEATURES;

interface FeatureGateResult {
  hasAccess: boolean;
  tier: TierName;
  subscriptionStatus: SubscriptionStatus;
  requiresUpgrade: boolean;
  upgradeMessage?: string;
  requiredTier?: TierName;
}

const getTierLabel = (tier: TierName) => {
  if (tier === "high_smart_enterprise") return "High Smart Enterprise";
  if (tier === "high_smart") return "High Smart";
  return "Medium Smart";
};

export const useFeatureGate = (featureName: FeatureName, restaurantId: string | undefined) => {
  const [result, setResult] = useState<FeatureGateResult>({
    hasAccess: false,
    tier: "medium_smart",
    subscriptionStatus: "trial",
    requiresUpgrade: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const checkFeatureAccess = async () => {
      try {
        setLoading(true);

        const { data: restaurant, error } = await supabase
          .from("restaurants")
          .select("tier, subscription_status")
          .eq("id", restaurantId)
          .single();

        if (error) throw error;

        const tier = (restaurant?.tier || "medium_smart") as TierName;
        const subscriptionStatus = (restaurant?.subscription_status || "trial") as SubscriptionStatus;
        const feature = FEATURES[featureName];

        if (tier === "high_smart_enterprise" && subscriptionStatus === "active") {
          setResult({ hasAccess: true, tier, subscriptionStatus, requiresUpgrade: false });
          return;
        }

        const hasTier = feature.tiers.includes(tier);
        const hasActiveSub = subscriptionStatus === "active" || !feature.requiresActiveSub;
        const hasAccess = hasTier && hasActiveSub;

        let upgradeMessage: string | undefined;
        let requiredTier: TierName | undefined;

        if (!hasAccess) {
          if (!hasTier) {
            requiredTier = feature.tiers[feature.tiers.length - 1];
            upgradeMessage = `${feature.name} requires ${getTierLabel(requiredTier)} plan. Upgrade to unlock.`;
          } else if (!hasActiveSub) {
            upgradeMessage = `${feature.name} requires an active subscription.`;
          }
        }

        setResult({
          hasAccess,
          tier,
          subscriptionStatus,
          requiresUpgrade: !hasAccess,
          upgradeMessage,
          requiredTier,
        });
      } catch (error) {
        console.error("Error checking feature access:", error);
      } finally {
        setLoading(false);
      }
    };

    checkFeatureAccess();
  }, [featureName, restaurantId]);

  return { ...result, loading };
};

export const useFeatureGates = (features: FeatureName[], restaurantId: string | undefined) => {
  const [results, setResults] = useState<Record<FeatureName, boolean>>({} as Record<FeatureName, boolean>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const checkFeatures = async () => {
      try {
        setLoading(true);

        const { data: restaurant, error } = await supabase
          .from("restaurants")
          .select("tier, subscription_status")
          .eq("id", restaurantId)
          .single();

        if (error) throw error;

        const tier = (restaurant?.tier || "medium_smart") as TierName;
        const subscriptionStatus = (restaurant?.subscription_status || "trial") as SubscriptionStatus;
        const featureAccess = {} as Record<FeatureName, boolean>;

        if (tier === "high_smart_enterprise" && subscriptionStatus === "active") {
          features.forEach((feature) => {
            featureAccess[feature] = true;
          });
          setResults(featureAccess);
          return;
        }

        features.forEach((featureName) => {
          const feature = FEATURES[featureName];
          const hasTier = feature.tiers.includes(tier);
          const hasActiveSub = subscriptionStatus === "active" || !feature.requiresActiveSub;
          featureAccess[featureName] = hasTier && hasActiveSub;
        });

        setResults(featureAccess);
      } catch (error) {
        console.error("Error checking features:", error);
      } finally {
        setLoading(false);
      }
    };

    checkFeatures();
  }, [features, restaurantId]);

  return { features: results, loading };
};
