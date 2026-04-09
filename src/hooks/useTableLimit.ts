// useTableLimit Hook - Enforce tier-based table limits

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { canAddTable, TIERS, TierType } from '@/constants/tiers';

type TierName = TierType;

interface TableLimitResult {
  canAdd: boolean;
  currentCount: number;
  maxTables: number | string;
  tier: TierName;
  remainingSlots: number;
  isAtLimit: boolean;
  upgradeMessage?: string;
  loading: boolean;
  error: string | null;
  checkBeforeCreate: () => { allowed: boolean; message: string };
}

export const useTableLimit = (restaurantId: string | undefined): TableLimitResult => {
  const [canAdd, setCanAdd] = useState(true);
  const [currentCount, setCurrentCount] = useState(0);
  const [maxTables, setMaxTables] = useState<number | string>(20);
  const [tier, setTier] = useState<TierName>('medium_smart');
  const [remainingSlots, setRemainingSlots] = useState(20);
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchTableLimit = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('tier')
          .eq('id', restaurantId)
          .single();

        if (restaurantError) throw restaurantError;

        const currentTier = (restaurant?.tier || 'medium_smart') as TierName;
        const tierConfig = TIERS[currentTier];

        const { count, error: countError } = await supabase
          .from('restaurant_tables')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId);

        if (countError) throw countError;

        const count_ = count || 0;
        const maxT = tierConfig.maxTables;
        const isUnlimited = maxT === -1;

        const canAdd_ = canAddTable(count_, currentTier);
        const remaining = isUnlimited ? Infinity : Math.max(0, maxT - count_);
        const atLimit = !canAdd_;

        let upgradeMsg: string | undefined;
        if (atLimit && currentTier === 'medium_smart') {
          upgradeMsg = 'আপনি Medium Smart এর table limit এ পৌঁছে গেছেন। High Smart এ upgrade করুন unlimited tables এর জন্য!';
        }

        setCanAdd(canAdd_);
        setCurrentCount(count_);
        setMaxTables(isUnlimited ? 'Unlimited' : maxT);
        setTier(currentTier);
        setRemainingSlots(isUnlimited ? Infinity : remaining);
        setIsAtLimit(atLimit);
        setUpgradeMessage(upgradeMsg);
      } catch (err) {
        console.error('Error fetching table limit:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchTableLimit();
  }, [restaurantId]);

  const checkBeforeCreate = () => {
    if (!canAdd) {
      return {
        allowed: false,
        message: upgradeMessage || 'Table limit reached'
      };
    }
    return {
      allowed: true,
      message: `${remainingSlots === Infinity ? 'Unlimited' : remainingSlots} slots remaining`
    };
  };

  return {
    canAdd,
    currentCount,
    maxTables,
    tier,
    remainingSlots,
    isAtLimit,
    upgradeMessage,
    loading,
    error,
    checkBeforeCreate
  };
};

export const useCanCreateTable = (restaurantId: string | undefined) => {
  return useTableLimit(restaurantId);
};
