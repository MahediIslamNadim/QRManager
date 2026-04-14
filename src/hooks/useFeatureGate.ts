// useFeatureGate.ts - Feature gate hook for tier-based feature access
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TierName, SubscriptionStatus } from '@/constants/tiers';

// Define all features and their tier requirements
export const FEATURES = {
  // Basic features (all tiers)
  qr_ordering: {
    name: 'QR Ordering',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: false // Available in trial
  },
  menu_management: {
    name: 'Menu Management',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: false
  },
  table_management: {
    name: 'Table Management',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: false
  },
  
  // Medium Smart features
  basic_analytics: {
    name: 'Basic Analytics',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: true // Requires paid subscription
  },
  whatsapp_notifications: {
    name: 'WhatsApp Notifications',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: true
  },
  payment_integration: {
    name: 'Payment Integration',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: true
  },
  basic_inventory: {
    name: 'Basic Inventory',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: true
  },
  
  // High Smart only features
  advanced_analytics: {
    name: 'Advanced Analytics',
    tiers: ['high_smart'] as TierName[],
    requiresActiveSub: true
  },
  ai_recommendations: {
    name: 'AI Recommendations',
    tiers: ['high_smart'] as TierName[],
    requiresActiveSub: true
  },
  custom_branding: {
    name: 'Custom Branding',
    tiers: ['medium_smart', 'high_smart'] as TierName[],
    requiresActiveSub: false
  },
  api_access: {
    name: 'API Access',
    tiers: ['high_smart'] as TierName[],
    requiresActiveSub: true
  },
  multi_location: {
    name: 'Multi-Location Support',
    tiers: ['high_smart'] as TierName[],
    requiresActiveSub: true
  },
  priority_support: {
    name: 'Priority Support 24/7',
    tiers: ['high_smart'] as TierName[],
    requiresActiveSub: true
  },
  advanced_inventory: {
    name: 'Advanced Inventory',
    tiers: ['high_smart'] as TierName[],
    requiresActiveSub: true
  }
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

export const useFeatureGate = (
  featureName: FeatureName,
  restaurantId: string | undefined
) => {
  const [result, setResult] = useState<FeatureGateResult>({
    hasAccess: false,
    tier: 'medium_smart',
    subscriptionStatus: 'trial',
    requiresUpgrade: false
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
          .from('restaurants')
          .select('tier, subscription_status')
          .eq('id', restaurantId)
          .single();

        if (error) throw error;

        const tier = (restaurant?.tier || 'medium_smart') as TierName;
        const subscriptionStatus = (restaurant?.subscription_status || 'trial') as SubscriptionStatus;
        const feature = FEATURES[featureName];

        // Check tier requirement
        const hasTier = feature.tiers.includes(tier);
        
        // Check subscription requirement
        const hasActiveSub = subscriptionStatus === 'active' || !feature.requiresActiveSub;

        const hasAccess = hasTier && hasActiveSub;

        let upgradeMessage: string | undefined;
        let requiredTier: TierName | undefined;

        if (!hasAccess) {
          if (!hasTier) {
            // Need to upgrade tier
            requiredTier = feature.tiers[feature.tiers.length - 1]; // Highest tier that has this feature
            upgradeMessage = `${feature.name} requires ${requiredTier === 'high_smart' ? 'High Smart' : 'Medium Smart'} plan. Upgrade to unlock!`;
          } else if (!hasActiveSub) {
            // Need to activate subscription
            upgradeMessage = `${feature.name} requires an active subscription. Please upgrade to continue using this feature.`;
          }
        }

        setResult({
          hasAccess,
          tier,
          subscriptionStatus,
          requiresUpgrade: !hasAccess,
          upgradeMessage,
          requiredTier
        });
      } catch (err) {
        console.error('Error checking feature access:', err);
      } finally {
        setLoading(false);
      }
    };

    checkFeatureAccess();
  }, [featureName, restaurantId]);

  return { ...result, loading };
};

// Hook to check multiple features at once
export const useFeatureGates = (
  features: FeatureName[],
  restaurantId: string | undefined
) => {
  const [results, setResults] = useState<Record<FeatureName, boolean>>({} as any);
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
          .from('restaurants')
          .select('tier, subscription_status')
          .eq('id', restaurantId)
          .single();

        if (error) throw error;

        const tier = (restaurant?.tier || 'medium_smart') as TierName;
        const subscriptionStatus = (restaurant?.subscription_status || 'trial') as SubscriptionStatus;

        const featureAccess: Record<FeatureName, boolean> = {} as any;

        features.forEach(featureName => {
          const feature = FEATURES[featureName];
          const hasTier = feature.tiers.includes(tier);
          const hasActiveSub = subscriptionStatus === 'active' || !feature.requiresActiveSub;
          featureAccess[featureName] = hasTier && hasActiveSub;
        });

        setResults(featureAccess);
      } catch (err) {
        console.error('Error checking features:', err);
      } finally {
        setLoading(false);
      }
    };

    checkFeatures();
  }, [features, restaurantId]);

  return { features: results, loading };
};
