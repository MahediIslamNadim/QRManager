// Gemini AI Client - AI features for QR Manager
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAdvancedRecommendations } from './recommendationEngine';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// Enhanced menu recommendations using ML + Gemini AI
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
    // First, get ML-based recommendations
    const mlRecommendations = await getAdvancedRecommendations(restaurantId, {
      userId: options.userId,
      sessionId: options.sessionId,
      itemId: options.currentItemId,
      limit: 8,
      strategy: 'balanced'
    });

    // If we have good ML recommendations, return them
    if (mlRecommendations.items.length >= 3) {
      return mlRecommendations;
    }

    // Fallback: Use Gemini AI for cold start or low data scenarios
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `আপনি একজন restaurant menu recommendation AI.

Available menu:
${JSON.stringify(menuItems.map(item => ({
  id: item.id,
  name: item.name,
  price: item.price,
  category: item.category,
  description: item.description
})).slice(0, 50), null, 2)}

${options.userPreferences ? `Customer preferences: ${options.userPreferences}` : ''}

5-6টা best menu items suggest করুন।
Return ONLY a JSON array of item IDs: ["item_id1", "item_id2"]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[.*\]/s);
    if (!jsonMatch) {
      return { items: menuItems.slice(0, 6), explanations: {}, strategy: 'random' };
    }
    
    const itemIds = JSON.parse(jsonMatch[0]);
    const recommendedItems = menuItems.filter(item => itemIds.includes(item.id));
    
    const explanations: { [key: string]: string } = {};
    recommendedItems.forEach(item => {
      explanations[item.id] = '🤖 AI সুপারিশ';
    });

    return {
      items: recommendedItems,
      explanations,
      strategy: 'ai_gemini'
    };
  } catch (error) {
    console.error('AI Error:', error);
    // Ultimate fallback: return popular items
    return {
      items: menuItems.slice(0, 6),
      explanations: {},
      strategy: 'fallback'
    };
  }
}

// Get business insights for admin
export async function getBusinessInsights(
  salesData: any[],
  menuItems: any[]
): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `Analyze restaurant data:

Sales (last 30 days): ${JSON.stringify(salesData.slice(0, 30))}
Menu: ${JSON.stringify(menuItems)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "topPerformers": ["item_id1", "item_id2"],
  "suggestions": "Brief business tip in Bengali",
  "pricingTips": "Pricing advice in Bengali"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('AI Error:', error);
    return { 
      topPerformers: [], 
      suggestions: 'AI analysis temporarily unavailable',
      pricingTips: 'Please try again later'
    };
  }
}

// Chatbot
export async function chatWithAI(message: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(
      `You are a helpful restaurant assistant. Answer questions about menu, orders in Bengali or English. Be brief and friendly.\n\nUser: ${message}`
    );
    
    const response = await result.response;
    return response.text() || 'Sorry, try again.';
  } catch (error) {
    console.error('Chat Error:', error);
    return 'দুঃখিত, পরে চেষ্টা করুন।';
  }
}
