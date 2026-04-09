// useTrialStatus Hook - Check trial expiry and show warnings
// Usage: Monitor trial status and show warnings/blocks

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getDaysRemainingInTrial, isTrialExpired } from '@/constants/tiers';
import { TierName, SubscriptionStatus } from '@/constants/tiers';

interface TrialStatusResult {
  isExpired: boolean;
  daysRemaining: number;
  showWarning: boolean; // Show warning when < 7 days left
  showCriticalWarning: boolean; // Show critical warning when < 3 days left
  tier: TierName;
  subscriptionStatus: SubscriptionStatus;
  trialEndDate: Date | null;
  canUseApp: boolean; // false if expired and not paid
}

export const useTrialStatus = (restaurantId: string | undefined) => {
  const [status, setStatus] = useState<TrialStatusResult>({
    isExpired: false,
    daysRemaining: 30,
    showWarning: false,
    showCriticalWarning: false,
    tier: 'medium_smart',
    subscriptionStatus: 'trial',
    trialEndDate: null,
    canUseApp: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const checkTrialStatus = async () => {
      try {
        setLoading(true);

        // Get restaurant subscription info
        const { data: restaurant, error } = await supabase
          .from('restaurants')
          .select('tier, subscription_status, trial_end_date')
          .eq('id', restaurantId)
          .single();

        if (error) throw error;

        const tier = (restaurant?.tier || 'medium_smart') as TierName;
        const subscriptionStatus = (restaurant?.subscription_status || 'trial') as SubscriptionStatus;
        const trialEndDate = restaurant?.trial_end_date ? new Date(restaurant.trial_end_date) : null;

        // If subscription is active or cancelled, trial doesn't matter
        if (subscriptionStatus === 'active') {
          setStatus({
            isExpired: false,
            daysRemaining: 999, // Paid user
            showWarning: false,
            showCriticalWarning: false,
            tier,
            subscriptionStatus,
            trialEndDate,
            canUseApp: true
          });
          setLoading(false);
          return;
        }

        // If subscription is expired or cancelled, block access
        if (subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled') {
          setStatus({
            isExpired: true,
            daysRemaining: 0,
            showWarning: false,
            showCriticalWarning: false,
            tier,
            subscriptionStatus,
            trialEndDate,
            canUseApp: false // BLOCK ACCESS
          });
          setLoading(false);
          return;
        }

        // For trial users, calculate days remaining
        if (!trialEndDate) {
          // No trial end date set - shouldn't happen, but handle gracefully
          console.warn('No trial_end_date found for trial user');
          setStatus({
            isExpired: false,
            daysRemaining: 30,
            showWarning: false,
            showCriticalWarning: false,
            tier,
            subscriptionStatus,
            trialEndDate: null,
            canUseApp: true
          });
          setLoading(false);
          return;
        }

        const daysRemaining = getDaysRemainingInTrial(trialEndDate);
        const expired = isTrialExpired(trialEndDate);

        setStatus({
          isExpired: expired,
          daysRemaining,
          showWarning: daysRemaining <= 7 && daysRemaining > 0,
          showCriticalWarning: daysRemaining <= 3 && daysRemaining > 0,
          tier,
          subscriptionStatus,
          trialEndDate,
          canUseApp: !expired // Can use app if not expired
        });

      } catch (err) {
        console.error('Error checking trial status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkTrialStatus();

    // Recheck every 5 minutes
    const interval = setInterval(checkTrialStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  return { ...status, loading };
};

// Helper hook to just check if user can access the app
export const useCanAccessApp = (restaurantId: string | undefined) => {
  const { canUseApp, isExpired, subscriptionStatus, loading } = useTrialStatus(restaurantId);
  
  return {
    canAccess: canUseApp,
    isExpired,
    subscriptionStatus,
    loading,
    blockReason: !canUseApp 
      ? subscriptionStatus === 'expired' 
        ? 'Subscription expired. Please renew.'
        : subscriptionStatus === 'cancelled'
        ? 'Subscription cancelled. Please reactivate.'
        : 'Trial expired. Please upgrade to continue.'
      : null
  };
};
