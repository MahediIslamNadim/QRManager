# 🤖 AI Features Integration Guide - QR Manager

## 📋 **AI Features যা Add করা যাবে**

### 1. **AI Menu Recommendations** (High Smart only)
- Customer এর order history দেখে suggest করবে কী order করতে পারে
- Popular items recommend করবে
- Dietary preferences based suggestions

### 2. **Smart Pricing Optimization**
- Market data analyze করে optimal pricing suggest করবে
- Demand-based dynamic pricing
- Competitor price analysis

### 3. **Sales Forecasting**
- Future sales predict করবে
- Inventory management এর জন্য prediction
- Staff scheduling optimization

### 4. **Customer Behavior Analysis**
- Order patterns analyze করবে
- Peak hours prediction
- Customer segmentation

### 5. **AI Chatbot Support**
- Customer queries handle করবে
- Order assistance
- Menu recommendations

---

## 🔧 **Implementation Options**

### Option 1: **Anthropic Claude API** (Recommended)
- Best for natural language tasks
- Menu analysis, recommendations
- Customer support chatbot

### Option 2: **OpenAI API**
- GPT-4 for advanced features
- Image recognition for food photos
- Text generation

### Option 3: **Local AI Models**
- TensorFlow.js for browser
- Lightweight predictions
- Privacy-focused

---

## 📁 **File Structure**

```
src/
├── lib/
│   ├── ai/
│   │   ├── claudeAPI.ts          # Claude API integration
│   │   ├── menuRecommendations.ts # AI menu suggestions
│   │   ├── priceOptimization.ts   # Smart pricing
│   │   ├── salesForecast.ts       # Predictive analytics
│   │   └── chatbot.ts             # Customer support bot
│   └── ...
├── components/
│   ├── AIRecommendations.tsx      # UI for recommendations
│   ├── AIChatbot.tsx              # Chatbot UI
│   └── PriceOptimizer.tsx         # Pricing dashboard
└── ...
```

---

## 🚀 **Feature #1: AI Menu Recommendations**

### Step 1: Create Claude API Integration

```typescript
// src/lib/ai/claudeAPI.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

export async function getAIRecommendations(
  userOrderHistory: any[],
  menuItems: any[],
  preferences?: string
): Promise<string[]> {
  const prompt = `
You are a restaurant menu recommendation AI. Based on this customer's order history:
${JSON.stringify(userOrderHistory, null, 2)}

And this full menu:
${JSON.stringify(menuItems, null, 2)}

${preferences ? `Customer preferences: ${preferences}` : ''}

Recommend 3-5 menu items the customer might enjoy. Consider:
- Past orders and preferences
- Popular pairings
- Dietary restrictions
- Price range they typically order

Return ONLY a JSON array of item IDs, like: ["item_1", "item_2", "item_3"]
`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const response = message.content[0].type === 'text' 
    ? message.content[0].text 
    : '';
  
  try {
    return JSON.parse(response);
  } catch {
    return [];
  }
}

export async function getMenuInsights(
  salesData: any[],
  menuItems: any[]
): Promise<{
  topPerformers: string[];
  underPerformers: string[];
  pricingRecommendations: any[];
  bundleSuggestions: string[];
}> {
  const prompt = `
Analyze this restaurant's sales data and menu:

Sales Data:
${JSON.stringify(salesData, null, 2)}

Menu Items:
${JSON.stringify(menuItems, null, 2)}

Provide insights on:
1. Top 5 performing items
2. 3 underperforming items
3. Pricing recommendations
4. Bundle/combo suggestions

Return ONLY valid JSON in this format:
{
  "topPerformers": ["item_id1", "item_id2"],
  "underPerformers": ["item_id3"],
  "pricingRecommendations": [
    {"itemId": "item_1", "currentPrice": 350, "suggestedPrice": 380, "reason": "High demand"}
  ],
  "bundleSuggestions": ["Combo 1: item_1 + item_2", "Combo 2: item_3 + item_4"]
}
`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }]
  });

  const response = message.content[0].type === 'text' 
    ? message.content[0].text 
    : '{}';
  
  return JSON.parse(response);
}
```

### Step 2: Create React Component

```typescript
// src/components/AIRecommendations.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, DollarSign, Package } from 'lucide-react';
import { getMenuInsights } from '@/lib/ai/claudeAPI';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import FeatureGate from '@/components/FeatureGate';

export default function AIRecommendations() {
  const { restaurantId } = useAuth();
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadInsights = async () => {
    setLoading(true);
    try {
      // Fetch sales data
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Fetch menu items
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);

      // Get AI insights
      const aiInsights = await getMenuInsights(orders || [], menuItems || []);
      setInsights(aiInsights);
    } catch (error) {
      console.error('Error loading AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureGate feature="ai_recommendations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              AI Menu Insights
            </h2>
            <p className="text-sm text-muted-foreground">
              AI-powered recommendations to optimize your menu
            </p>
          </div>
          
          <Button onClick={loadInsights} disabled={loading}>
            {loading ? 'Analyzing...' : 'Refresh Insights'}
          </Button>
        </div>

        {insights && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.topPerformers.map((itemId: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span>{itemId}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pricing Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-warning" />
                  Pricing Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.pricingRecommendations.map((rec: any, i: number) => (
                    <div key={i} className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{rec.itemId}</p>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm line-through text-muted-foreground">
                            ৳{rec.currentPrice}
                          </p>
                          <p className="font-bold text-success">
                            ৳{rec.suggestedPrice}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bundle Suggestions */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Combo Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {insights.bundleSuggestions.map((bundle: string, i: number) => (
                    <div key={i} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <p className="font-medium">{bundle}</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Create Combo
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!insights && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Click "Refresh Insights" to get AI-powered menu recommendations
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </FeatureGate>
  );
}
```

---

## 🚀 **Feature #2: Customer-Facing AI Recommendations**

```typescript
// src/components/CustomerMenuRecommendations.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { getAIRecommendations } from '@/lib/ai/claudeAPI';

interface CustomerMenuRecommendationsProps {
  customerId?: string;
  menuItems: any[];
}

export default function CustomerMenuRecommendations({ 
  customerId, 
  menuItems 
}: CustomerMenuRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecommendations = async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      // Fetch customer order history
      const orderHistory = []; // TODO: Fetch from database
      
      const itemIds = await getAIRecommendations(
        orderHistory, 
        menuItems
      );
      
      setRecommendations(itemIds);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [customerId]);

  if (recommendations.length === 0) return null;

  const recommendedItems = menuItems.filter(item => 
    recommendations.includes(item.id)
  );

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold">AI Recommendations for You</h3>
        </div>

        <div className="grid gap-3">
          {recommendedItems.map(item => (
            <div 
              key={item.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">৳{item.price}</p>
              </div>
              <Button size="sm" variant="default">
                Add to Cart
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 📧 **Feature #3: AI Chatbot for Customer Support**

```typescript
// src/components/AIChatbot.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

export default function AIChatbot() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are a helpful restaurant assistant for QR Manager. 
Help customers with:
- Menu questions
- Order status
- Recommendations
- Dietary information
Be friendly and concise in Bengali or English.`,
        messages: [...messages, userMessage]
      });

      const aiMessage = {
        role: 'assistant',
        content: response.content[0].type === 'text' ? response.content[0].text : ''
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {messages.map((msg, i) => (
            <div 
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-lg">
                <span className="animate-pulse">Typing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask me anything..."
          />
          <Button onClick={sendMessage} disabled={loading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## ⚙️ **Setup Instructions**

### 1. Install Dependencies

```bash
npm install @anthropic-ai/sdk
```

### 2. Add Environment Variables

```env
# .env
VITE_ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

### 3. Get API Key

1. Go to https://console.anthropic.com/
2. Create account
3. Get API key
4. Add to .env file

### 4. Add Route

```typescript
// In router
import AIRecommendations from '@/components/AIRecommendations';

<Route path="/admin/ai-insights" element={<AIRecommendations />} />
```

### 5. Add to Navigation (High Smart only)

```typescript
import { InlineFeatureGate } from '@/components/FeatureGate';

<InlineFeatureGate feature="ai_recommendations">
  <NavItem href="/admin/ai-insights" icon={Sparkles}>
    AI Insights
  </NavItem>
</InlineFeatureGate>
```

---

## 💰 **Pricing Note**

Claude API pricing:
- Input: $3 per million tokens
- Output: $15 per million tokens

For a restaurant:
- ~100 AI requests/day = ~$5-10/month
- Still profitable with High Smart plan (৳3500/month)

---

## 🎯 **Next Steps**

1. **Get Anthropic API Key** ✅
2. **Add to environment variables** ✅
3. **Create AI components** ✅
4. **Test with sample data** ⏳
5. **Add feature gates** ✅
6. **Deploy!** 🚀

---

**AI features এখন ready!** 🤖✨

এটা High Smart tier এ lock থাকবে - premium feature হিসেবে!
