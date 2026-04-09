// OpenAI Client - AI features for QR Manager
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Get menu recommendations for customers
export async function getMenuRecommendations(
  menuItems: any[],
  userPreferences?: string
): Promise<any[]> {
  try {
    const prompt = `আপনি একজন restaurant menu recommendation AI.

Available menu:
${JSON.stringify(menuItems.map(item => ({
  id: item.id,
  name: item.name,
  price: item.price,
  category: item.category
})), null, 2)}

${userPreferences ? `Customer preferences: ${userPreferences}` : ''}

3-5টা menu items suggest করুন।
Return ONLY a JSON array of item IDs: ["item_id1", "item_id2"]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful restaurant assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const content = response.choices[0].message.content || '[]';
    const itemIds = JSON.parse(content);
    
    return menuItems.filter(item => itemIds.includes(item.id));
  } catch (error) {
    console.error('AI Error:', error);
    return [];
  }
}

// Get business insights for admin
export async function getBusinessInsights(
  salesData: any[],
  menuItems: any[]
): Promise<any> {
  try {
    const prompt = `Analyze restaurant data:

Sales: ${JSON.stringify(salesData.slice(0, 30))}
Menu: ${JSON.stringify(menuItems)}

Return JSON:
{
  "topPerformers": ["item_id1"],
  "suggestions": "Brief tip in Bengali"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 500
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('AI Error:', error);
    return { topPerformers: [], suggestions: 'Not available' };
  }
}

// Chatbot
export async function chatWithAI(message: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Restaurant assistant. Answer in Bengali/English. Be brief.' },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    return response.choices[0].message.content || 'Sorry, try again.';
  } catch (error) {
    console.error('Chat Error:', error);
    return 'দুঃখিত, পরে চেষ্টা করুন।';
  }
}
