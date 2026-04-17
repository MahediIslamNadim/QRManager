// React Hook for Advanced AI Recommendations
import { useState, useEffect, useCallback, useRef } from 'react';
import { getMenuRecommendations } from '@/lib/ai/geminiClient';
import { trackUserBehavior, trackRecommendationPerformance } from '@/lib/ai/recommendationEngine';

interface RecommendationOptions {
  restaurantId: string;
  menuItems: any[];
  userId?: string;
  currentItemId?: string;
  userPreferences?: string;
  strategy?: 'balanced' | 'popular' | 'personalized' | 'similar';
}

export function useAIRecommendations(options: RecommendationOptions) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [explanations, setExplanations] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState('');
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random()}`);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMenuRecommendations(
        options.restaurantId,
        options.menuItems,
        {
          userId: options.userId,
          sessionId,
          currentItemId: options.currentItemId,
          userPreferences: options.userPreferences
        }
      );

      setRecommendations(result.items);
      setExplanations(result.explanations);
      setStrategy(result.strategy);

      // Track that we showed recommendations
      if (result.items.length > 0) {
        await trackRecommendationPerformance(
          options.restaurantId,
          sessionId,
          result.items.map(i => i.id)
        );
      }
    } catch (error) {
      console.error('Recommendation loading error:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.restaurantId, options.currentItemId, options.userId]);

  // Track user behavior
  const trackView = async (itemId: string) => {
    await trackUserBehavior(options.restaurantId, {
      sessionId,
      userId: options.userId,
      views: [itemId],
      timeOfDay: getCurrentTimeOfDay()
    });
  };

  const trackClick = async (itemId: string) => {
    // Track that user clicked on a recommended item
    await trackRecommendationPerformance(
      options.restaurantId,
      sessionId,
      recommendations.map(i => i.id),
      itemId
    );
  };

  const trackOrder = async (itemId: string) => {
    // Track that user ordered a recommended item
    await trackRecommendationPerformance(
      options.restaurantId,
      sessionId,
      recommendations.map(i => i.id),
      undefined,
      itemId
    );

    await trackUserBehavior(options.restaurantId, {
      sessionId,
      userId: options.userId,
      orders: [itemId],
      timeOfDay: getCurrentTimeOfDay()
    });
  };

  // Stable reference for menuItems length — avoids re-running on every
  // render when the caller passes a new array instance with the same content.
  const menuItemsLengthRef = useRef(options.menuItems.length);
  menuItemsLengthRef.current = options.menuItems.length;

  useEffect(() => {
    if (menuItemsLengthRef.current > 0) {
      loadRecommendations();
    }
  // loadRecommendations is already memoised on the three scalar deps below;
  // adding it here is safe and satisfies exhaustive-deps.
  }, [loadRecommendations]);

  return {
    recommendations,
    explanations,
    loading,
    strategy,
    sessionId,
    trackView,
    trackClick,
    trackOrder,
    refresh: loadRecommendations
  };
}

function getCurrentTimeOfDay(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}
