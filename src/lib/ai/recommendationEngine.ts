// Advanced Recommendation Engine - Like Facebook/YouTube
// Uses multiple algorithms: Collaborative Filtering, Popularity, Time-based, Content-based

import { supabase } from '@/integrations/supabase/client';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  popularity_score?: number;
  view_count?: number;
  order_count?: number;
}

interface UserBehavior {
  userId?: string;
  sessionId: string;
  views: string[]; // item IDs viewed
  orders: string[]; // item IDs ordered
  cartItems: string[]; // items in cart
  timeOfDay: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// Track user behavior for personalization
export async function trackUserBehavior(
  restaurantId: string,
  behavior: Partial<UserBehavior>
) {
  try {
    const { error } = await supabase.from('user_behavior').insert({
      restaurant_id: restaurantId,
      session_id: behavior.sessionId,
      user_id: behavior.userId,
      viewed_items: behavior.views || [],
      ordered_items: behavior.orders || [],
      cart_items: behavior.cartItems || [],
      time_of_day: behavior.timeOfDay,
      timestamp: new Date().toISOString()
    });

    if (error) console.error('Behavior tracking error:', error);
  } catch (err) {
    console.error('Tracking failed:', err);
  }
}

// 1. Collaborative Filtering - "People who ordered X also ordered Y"
async function getCollaborativeRecommendations(
  restaurantId: string,
  itemId: string,
  limit: number = 5
): Promise<string[]> {
  try {
    // Get orders that included this item
    const { data: relatedOrders } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('menu_item_id', itemId)
      .limit(100);

    if (!relatedOrders?.length) return [];

    const orderIds = relatedOrders.map(o => o.order_id);

    // Get other items from those orders
    const { data: coOrderedItems } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity')
      .in('order_id', orderIds)
      .neq('menu_item_id', itemId);

    // Count frequency and score
    const itemScores = new Map<string, number>();
    coOrderedItems?.forEach(item => {
      const current = itemScores.get(item.menu_item_id) || 0;
      itemScores.set(item.menu_item_id, current + item.quantity);
    });

    // Sort by frequency
    return Array.from(itemScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  } catch (error) {
    console.error('Collaborative filtering error:', error);
    return [];
  }
}

// 2. Popularity-based Recommendations - Trending items
async function getPopularityRecommendations(
  restaurantId: string,
  timeWindow: 'hour' | 'day' | 'week' = 'day',
  limit: number = 5
): Promise<MenuItem[]> {
  try {
    const timeMap = {
      hour: 1,
      day: 24,
      week: 168
    };

    const hoursAgo = timeMap[timeWindow];
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    // Get order counts in time window
    const { data: orderStats } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity, orders!inner(created_at)')
      .eq('orders.restaurant_id', restaurantId)
      .gte('orders.created_at', cutoffTime.toISOString());

    // Calculate popularity scores
    const popularity = new Map<string, number>();
    orderStats?.forEach(item => {
      const current = popularity.get(item.menu_item_id) || 0;
      popularity.set(item.menu_item_id, current + item.quantity);
    });

    // Get menu items with scores
    const topItemIds = Array.from(popularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', topItemIds);

    // Add popularity scores
    return (menuItems || []).map(item => ({
      ...item,
      popularity_score: popularity.get(item.id) || 0
    }));
  } catch (error) {
    console.error('Popularity recommendations error:', error);
    return [];
  }
}

// 3. Time-based Recommendations - Breakfast/Lunch/Dinner patterns
async function getTimeBasedRecommendations(
  restaurantId: string,
  currentHour: number,
  limit: number = 5
): Promise<string[]> {
  try {
    // Determine time of day
    let timeOfDay: string;
    if (currentHour >= 6 && currentHour < 11) timeOfDay = 'breakfast';
    else if (currentHour >= 11 && currentHour < 16) timeOfDay = 'lunch';
    else if (currentHour >= 16 && currentHour < 22) timeOfDay = 'dinner';
    else timeOfDay = 'snack';

    // Get popular items for this time of day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: timePatterns } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity, orders!inner(created_at)')
      .eq('orders.restaurant_id', restaurantId)
      .gte('orders.created_at', thirtyDaysAgo.toISOString());

    // Filter by time of day and count
    const timeScores = new Map<string, number>();
    timePatterns?.forEach(item => {
      const orderHour = new Date(item.orders.created_at).getHours();
      let orderTimeOfDay: string;
      
      if (orderHour >= 6 && orderHour < 11) orderTimeOfDay = 'breakfast';
      else if (orderHour >= 11 && orderHour < 16) orderTimeOfDay = 'lunch';
      else if (orderHour >= 16 && orderHour < 22) orderTimeOfDay = 'dinner';
      else orderTimeOfDay = 'snack';

      if (orderTimeOfDay === timeOfDay) {
        const current = timeScores.get(item.menu_item_id) || 0;
        timeScores.set(item.menu_item_id, current + item.quantity);
      }
    });

    return Array.from(timeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  } catch (error) {
    console.error('Time-based recommendations error:', error);
    return [];
  }
}

// 4. Content-based Filtering - Similar items by category/price
function getContentBasedRecommendations(
  menuItems: MenuItem[],
  baseItem: MenuItem,
  limit: number = 5
): MenuItem[] {
  try {
    // Calculate similarity scores
    const scores = menuItems
      .filter(item => item.id !== baseItem.id)
      .map(item => {
        let score = 0;

        // Category match (highest weight)
        if (item.category === baseItem.category) score += 50;

        // Price similarity (within 20%)
        const priceDiff = Math.abs(item.price - baseItem.price) / baseItem.price;
        if (priceDiff < 0.2) score += 30;
        else if (priceDiff < 0.5) score += 15;

        // Name similarity (simple keyword match)
        const baseWords = baseItem.name.toLowerCase().split(' ');
        const itemWords = item.name.toLowerCase().split(' ');
        const commonWords = baseWords.filter(w => itemWords.includes(w));
        score += commonWords.length * 10;

        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scores.map(s => s.item);
  } catch (error) {
    console.error('Content-based recommendations error:', error);
    return [];
  }
}

// 5. Personalized Recommendations - User history based
async function getPersonalizedRecommendations(
  restaurantId: string,
  userId: string,
  menuItems: MenuItem[],
  limit: number = 5
): Promise<MenuItem[]> {
  try {
    // Get user's order history
    const { data: userOrders } = await supabase
      .from('orders')
      .select('id, order_items(menu_item_id, quantity)')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!userOrders?.length) return [];

    // Extract ordered items with frequency
    const orderHistory = new Map<string, number>();
    userOrders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        const current = orderHistory.get(item.menu_item_id) || 0;
        orderHistory.set(item.menu_item_id, current + item.quantity);
      });
    });

    // Get categories user likes
    const likedCategories = new Map<string, number>();
    menuItems.forEach(item => {
      const orderCount = orderHistory.get(item.id) || 0;
      if (orderCount > 0) {
        const current = likedCategories.get(item.category) || 0;
        likedCategories.set(item.category, current + orderCount);
      }
    });

    // Recommend items from liked categories that user hasn't tried
    const recommendations = menuItems
      .filter(item => !orderHistory.has(item.id)) // Not ordered before
      .map(item => {
        const categoryScore = likedCategories.get(item.category) || 0;
        const popularityScore = item.popularity_score || 0;
        return {
          item,
          score: categoryScore * 2 + popularityScore
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.item);

    return recommendations;
  } catch (error) {
    console.error('Personalized recommendations error:', error);
    return [];
  }
}

// 6. MASTER ALGORITHM - Combines all strategies
export async function getAdvancedRecommendations(
  restaurantId: string,
  options: {
    userId?: string;
    itemId?: string; // For "similar items"
    sessionId?: string;
    limit?: number;
    strategy?: 'balanced' | 'popular' | 'personalized' | 'similar';
  }
): Promise<{
  items: MenuItem[];
  explanations: { [itemId: string]: string };
  strategy: string;
}> {
  try {
    const limit = options.limit || 6;
    const currentHour = new Date().getHours();

    // Get all menu items
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('available', true);

    if (!menuItems?.length) {
      return { items: [], explanations: {}, strategy: 'none' };
    }

    let recommendedItems: MenuItem[] = [];
    const explanations: { [itemId: string]: string } = {};
    let strategy = options.strategy || 'balanced';

    // Strategy 1: Similar Items (if itemId provided)
    if (options.itemId && options.strategy === 'similar') {
      const baseItem = menuItems.find(i => i.id === options.itemId);
      if (baseItem) {
        // Combine collaborative + content-based
        const collaborative = await getCollaborativeRecommendations(
          restaurantId,
          options.itemId,
          3
        );
        const contentBased = getContentBasedRecommendations(
          menuItems,
          baseItem,
          3
        );

        const combinedIds = new Set([
          ...collaborative,
          ...contentBased.map(i => i.id)
        ]);

        recommendedItems = menuItems
          .filter(item => combinedIds.has(item.id))
          .slice(0, limit);

        recommendedItems.forEach(item => {
          if (collaborative.includes(item.id)) {
            explanations[item.id] = 'যারা এটা খেয়েছে তারা এটাও পছন্দ করেছে';
          } else {
            explanations[item.id] = 'একই ধরনের আইটেম';
          }
        });

        strategy = 'similar';
      }
    }

    // Strategy 2: Personalized (if userId provided)
    else if (options.userId && options.strategy === 'personalized') {
      recommendedItems = await getPersonalizedRecommendations(
        restaurantId,
        options.userId,
        menuItems,
        limit
      );

      recommendedItems.forEach(item => {
        explanations[item.id] = 'আপনার পছন্দ অনুযায়ী';
      });

      strategy = 'personalized';
    }

    // Strategy 3: Popular/Trending
    else if (options.strategy === 'popular') {
      recommendedItems = await getPopularityRecommendations(
        restaurantId,
        'day',
        limit
      );

      recommendedItems.forEach(item => {
        explanations[item.id] = '🔥 ট্রেন্ডিং আইটেম';
      });

      strategy = 'popular';
    }

    // Strategy 4: Balanced (Default) - Mix of all
    else {
      const [popular, timeBased] = await Promise.all([
        getPopularityRecommendations(restaurantId, 'day', 3),
        getTimeBasedRecommendations(restaurantId, currentHour, 3)
      ]);

      // Combine and deduplicate
      const combinedIds = new Set([
        ...popular.map(i => i.id),
        ...timeBased
      ]);

      recommendedItems = menuItems
        .filter(item => combinedIds.has(item.id))
        .slice(0, limit);

      recommendedItems.forEach(item => {
        if (popular.find(p => p.id === item.id)) {
          explanations[item.id] = '⭐ জনপ্রিয় আইটেম';
        } else if (timeBased.includes(item.id)) {
          if (currentHour >= 6 && currentHour < 11) {
            explanations[item.id] = '🌅 সকালের জনপ্রিয়';
          } else if (currentHour >= 11 && currentHour < 16) {
            explanations[item.id] = '☀️ দুপুরের জনপ্রিয়';
          } else {
            explanations[item.id] = '🌙 রাতের জনপ্রিয়';
          }
        }
      });

      strategy = 'balanced';
    }

    // Fallback: If no recommendations, return random popular items
    if (recommendedItems.length === 0) {
      recommendedItems = menuItems
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      recommendedItems.forEach(item => {
        explanations[item.id] = 'আপনার জন্য বিশেষ';
      });
    }

    return {
      items: recommendedItems,
      explanations,
      strategy
    };
  } catch (error) {
    console.error('Advanced recommendations error:', error);
    return { items: [], explanations: {}, strategy: 'error' };
  }
}

// 7. A/B Testing & Analytics
export async function trackRecommendationPerformance(
  restaurantId: string,
  sessionId: string,
  recommendedItemIds: string[],
  clickedItemId?: string,
  orderedItemId?: string
) {
  try {
    await supabase.from('recommendation_analytics').insert({
      restaurant_id: restaurantId,
      session_id: sessionId,
      recommended_items: recommendedItemIds,
      clicked_item: clickedItemId,
      ordered_item: orderedItemId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
}
