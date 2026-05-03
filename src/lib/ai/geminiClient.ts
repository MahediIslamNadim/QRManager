// Recommendation helpers for QR Manager.
// Provider-backed AI calls must run in Supabase Edge Functions so API keys
// never enter the browser bundle.
import { getAdvancedRecommendations } from './recommendationEngine';

export async function getMenuRecommendations(
  restaurantId: string,
  menuItems: any[],
  options: {
    userId?: string;
    sessionId?: string;
    userPreferences?: string;
    currentItemId?: string;
  } = {}
): Promise<{
  items: any[];
  explanations: { [itemId: string]: string };
  strategy: string;
}> {
  try {
    const mlRecommendations = await getAdvancedRecommendations(restaurantId, {
      userId: options.userId,
      sessionId: options.sessionId,
      itemId: options.currentItemId,
      limit: 8,
      strategy: 'balanced'
    });

    if (mlRecommendations.items.length > 0) {
      return mlRecommendations;
    }

    return { items: menuItems.slice(0, 6), explanations: {}, strategy: 'fallback' };
  } catch (error) {
    console.error('Recommendation error:', error);
    return { items: menuItems.slice(0, 6), explanations: {}, strategy: 'fallback' };
  }
}

export async function getBusinessInsights(
  _salesData: any[],
  menuItems: any[]
): Promise<any> {
  return {
    topPerformers: menuItems.slice(0, 3).map((item) => item.id),
    suggestions: 'AI analysis is available from the secure server-side analytics page.',
    pricingTips: 'Use the AI Analytics page for secure pricing recommendations.'
  };
}

export async function chatWithAI(_message: string): Promise<string> {
  return 'AI chat is temporarily unavailable in the browser. Please use server-side AI features.';
}
