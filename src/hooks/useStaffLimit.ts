// useStaffLimit Hook - Enforce tier-based staff limits
// Similar to useTableLimit but for staff members

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { canAddStaff, TIERS, TierType } from '@/constants/tiers';

type TierName = TierType;

const getStaffLimit = (tier: TierName): number | string => {
  const max = TIERS[tier].maxStaff;
  return max === -1 ? 'Unlimited' : max;
};

interface StaffLimitResult {
  canAdd: boolean;
  currentCount: number;
  maxStaff: number;  // -1 = unlimited, otherwise the limit
  maxStaffDisplay: string; // "আনলিমিটেড" or the number as string
  tier: TierName;
  remainingSlots: number;
  isAtLimit: boolean;
  upgradeMessage?: string;
}

export const useStaffLimit = (restaurantId: string | undefined) => {
  const [result, setResult] = useState<StaffLimitResult>({
    canAdd: true,
    currentCount: 0,
    maxStaff: 5,
    maxStaffDisplay: '5',
    tier: 'medium_smart',
    remainingSlots: 5,
    isAtLimit: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchStaffLimit = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get restaurant tier
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('tier')
          .eq('id', restaurantId)
          .single();

        if (restaurantError) throw restaurantError;

        const tier = (restaurant?.tier || 'medium_smart') as TierName;

        // Get current staff count for this restaurant
        const { count, error: countError } = await supabase
          .from('staff_restaurants')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId);

        if (countError) throw countError;

        const currentCount = count || 0;
        const maxStaff = TIERS[tier].maxStaff;
        const isUnlimited = maxStaff === -1;
        
        const canAdd = isUnlimited ? true : canAddStaff(currentCount, tier);
        const remainingSlots = isUnlimited ? Infinity : Math.max(0, maxStaff - currentCount);
        const isAtLimit = !canAdd;

        let upgradeMessage: string | undefined;
        if (isAtLimit && tier === 'medium_smart') {
          upgradeMessage = 'আপনি Medium Smart এর limit এ পৌঁছে গেছেন। High Smart এ upgrade করুন unlimited staff এর জন্য!';
        }

        setResult({
          canAdd,
          currentCount,
          maxStaff: isUnlimited ? Infinity : maxStaff,
          maxStaffDisplay: isUnlimited ? 'আনলিমিটেড' : String(maxStaff),
          tier,
          remainingSlots: isUnlimited ? Infinity : remainingSlots,
          isAtLimit,
          upgradeMessage
        });
      } catch (err) {
        console.error('Error fetching staff limit:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStaffLimit();
  }, [restaurantId, refreshIndex]);

  const refetch = () => setRefreshIndex((current) => current + 1);

  return { ...result, loading, error, refetch };
};

// Helper hook to check before inviting staff
export const useCanInviteStaff = (restaurantId: string | undefined) => {
  const limit = useStaffLimit(restaurantId);
  
  const checkBeforeInvite = () => {
    if (!limit.canAdd) {
      return {
        allowed: false,
        message: limit.upgradeMessage || 'Staff limit reached'
      };
    }
    return {
      allowed: true,
      message: `${limit.remainingSlots === Infinity ? 'Unlimited' : limit.remainingSlots} slots remaining`
    };
  };

  return {
    ...limit,
    checkBeforeInvite,
    refetch: limit.refetch,
  };
};
