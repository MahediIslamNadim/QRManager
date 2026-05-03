// Browser-safe compatibility helpers.
// Direct OpenAI calls are intentionally disabled in the frontend so API keys
// stay in server-side Supabase Edge Function secrets.

export async function getMenuRecommendations(
  menuItems: any[],
  _userPreferences?: string
): Promise<any[]> {
  return menuItems.slice(0, 6);
}

export async function getBusinessInsights(
  _salesData: any[],
  menuItems: any[]
): Promise<any> {
  return {
    topPerformers: menuItems.slice(0, 3).map((item) => item.id),
    suggestions: 'AI analysis is available from secure server-side functions.'
  };
}

export async function chatWithAI(_message: string): Promise<string> {
  return 'AI chat is temporarily unavailable in the browser. Please use server-side AI features.';
}
