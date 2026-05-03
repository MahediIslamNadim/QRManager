# 🤖 OpenAI API Integration Guide - QR Manager

## 💡 **ChatGPT Plus vs OpenAI API**

### ChatGPT Plus (যা আপনার কাছে আছে):
```
✅ $20/month subscription
✅ GPT-4 access via web interface
✅ Unlimited messages
❌ Cannot use in your app directly
❌ No API access
```

### OpenAI API (যা আপনার app এ লাগবে):
```
✅ Pay-per-use (only what you use)
✅ GPT-4 API access
✅ Use in your QR Manager app
💰 ~$0.01-0.03 per request
💰 ~৳500-1000/month for restaurant usage
```

**Good News:** ChatGPT Plus থাকলে OpenAI API key পাওয়া সহজ!

---

## 🔑 **OpenAI API Key কীভাবে পাবেন**

### Step 1: OpenAI Platform এ যান
```
https://platform.openai.com/
```

### Step 2: Sign in করুন
- Same account use করুন যেটা দিয়ে ChatGPT Plus আছে

### Step 3: API Key তৈরি করুন
1. Go to: https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (শুধু একবার দেখাবে!)
4. Save it safely

### Step 4: Billing Setup করুন
1. Go to: https://platform.openai.com/account/billing
2. Add payment method
3. Set usage limits (~$10-20/month sufficient)

---

## 💰 **Cost Comparison: Claude vs OpenAI**

### Claude API (Anthropic):
```
Input: $3 per million tokens
Output: $15 per million tokens
Average request: ~2000 tokens
Cost per request: ~$0.03-0.05

Monthly (100 requests/day):
~3000 requests = ~$90-150/month
```

### OpenAI GPT-4 Turbo:
```
Input: $10 per million tokens  
Output: $30 per million tokens
Average request: ~2000 tokens
Cost per request: ~$0.04-0.08

Monthly (100 requests/day):
~3000 requests = ~$120-240/month
```

### OpenAI GPT-3.5 Turbo (Cheaper!):
```
Input: $0.50 per million tokens
Output: $1.50 per million tokens
Average request: ~2000 tokens
Cost per request: ~$0.004

Monthly (100 requests/day):
~3000 requests = ~$12-15/month ✅ BEST VALUE!
```

**Recommendation:** Use GPT-3.5 Turbo for most features - 10x cheaper!

---

## 🚀 **Implementation: OpenAI API**

### Step 1: Install Package

```bash
npm install openai
```

### Step 2: Add the key as a Supabase Edge Function secret

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here
```

Do not use `VITE_OPENAI_API_KEY` or browser OpenAI clients in production. Any `VITE_*` value is bundled into frontend JavaScript.

### Step 3: Create a Supabase Edge Function client

```typescript
// supabase/functions/ai-insights/index.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Menu Recommendations
export async function getMenuRecommendationsGPT(
  userOrderHistory: any[],
  menuItems: any[],
  preferences?: string
): Promise<string[]> {
  const prompt = `You are a restaurant menu recommendation AI.

Customer's order history:
${JSON.stringify(userOrderHistory, null, 2)}

Available menu:
${JSON.stringify(menuItems, null, 2)}

${preferences ? `Preferences: ${preferences}` : ''}

Recommend 3-5 items this customer might enjoy.
Return ONLY a JSON array of item IDs: ["item_1", "item_2"]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // Cheaper model
    messages: [
      { role: 'system', content: 'You are a helpful restaurant assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  const content = response.choices[0].message.content || '[]';
  
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Business Insights
export async function getBusinessInsightsGPT(
  salesData: any[],
  menuItems: any[]
): Promise<any> {
  const prompt = `Analyze this restaurant data:

Sales: ${JSON.stringify(salesData, null, 2)}
Menu: ${JSON.stringify(menuItems, null, 2)}

Provide insights as JSON:
{
  "topPerformers": ["item_id1", "item_id2"],
  "underPerformers": ["item_id3"],
  "pricingRecommendations": [{
    "itemId": "item_1",
    "currentPrice": 350,
    "suggestedPrice": 380,
    "reason": "High demand"
  }],
  "bundleSuggestions": ["Combo: item_1 + item_2"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview', // Better for analysis
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

// Customer Support Chatbot
export async function chatWithCustomerGPT(
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a helpful restaurant assistant for QR Manager.
Help customers with menu questions, orders, and recommendations.
Be friendly and concise. Respond in Bengali or English as needed.`
      },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 300
  });

  return response.choices[0].message.content || '';
}
```

---

## 🎯 **Which AI to Use When?**

### Use GPT-3.5 Turbo (Cheaper):
```
✅ Customer menu recommendations
✅ Simple chatbot queries
✅ Quick suggestions
✅ Basic analysis

Cost: ~$12-15/month
Perfect for High Smart users!
```

### Use GPT-4 Turbo (Better Quality):
```
✅ Complex business insights
✅ Sales forecasting
✅ Pricing optimization
✅ Detailed analytics

Cost: ~$120-240/month
Use sparingly, only for premium insights
```

### Use Claude (Best for Long Context):
```
✅ Analyzing full menu + sales data
✅ Long conversation history
✅ Complex reasoning
✅ Document analysis

Cost: ~$90-150/month
Alternative to GPT-4
```

---

## 💡 **Hybrid Approach (Recommended)**

```typescript
// Use GPT-3.5 for customer-facing features
export const getCustomerRecommendations = getMenuRecommendationsGPT;

// Use GPT-4 for admin insights (monthly reports)
export const getMonthlyInsights = getBusinessInsightsGPT;

// Use GPT-3.5 for chatbot
export const chatbot = chatWithCustomerGPT;
```

**Monthly Cost:** ~$15-30 (mostly GPT-3.5) ✅

---

## 🔧 **React Component with OpenAI**

```typescript
// src/components/AIMenuRecommendations.tsx
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { getMenuRecommendationsGPT } from '@/lib/ai/openaiClient';

export default function AIMenuRecommendations({ menuItems }: any) {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const orderHistory = []; // Get from user's past orders
      const itemIds = await getMenuRecommendationsGPT(
        orderHistory,
        menuItems
      );
      setRecommendations(itemIds);
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const recommendedItems = menuItems.filter((item: any) =>
    recommendations.includes(item.id)
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold">AI Recommendations</h3>
      </div>

      <Button onClick={loadRecommendations} disabled={loading}>
        {loading ? 'Loading...' : 'Get Recommendations'}
      </Button>

      <div className="mt-4 space-y-2">
        {recommendedItems.map((item: any) => (
          <div key={item.id} className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">৳{item.price}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

---

## 🎨 **Advanced: Image Analysis with GPT-4 Vision**

```typescript
// Analyze food images
export async function analyzeFoodImage(imageUrl: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this dish and suggest a price in BDT.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    max_tokens: 300
  });

  return response.choices[0].message.content || '';
}
```

**Use Case:** Upload food photo → AI suggests name, description, price!

---

## 📊 **Cost Optimization Tips**

### 1. Use GPT-3.5 by Default
```typescript
const DEFAULT_MODEL = 'gpt-3.5-turbo'; // 10x cheaper than GPT-4
```

### 2. Limit Token Usage
```typescript
max_tokens: 300 // Don't let AI ramble
```

### 3. Cache Common Requests
```typescript
// Cache menu recommendations for 1 hour
const cache = new Map();
```

### 4. Batch Requests
```typescript
// Get insights once per day, not per customer
```

---

## 🚀 **Quick Start Checklist**

- [ ] Get OpenAI API key from platform.openai.com
- [ ] Add as Supabase Edge Function secret: `OPENAI_API_KEY=sk-...`
- [ ] Install: `npm install openai`
- [ ] Call OpenAI only from an Edge Function
- [ ] Test with sample data
- [ ] Set usage limits ($10-20/month)
- [ ] Deploy!

---

## 💰 **Final Recommendation**

### For Your QR Manager App:

**Best Setup:**
```
Customer Features → GPT-3.5 Turbo (~$10/month)
- Menu recommendations
- Quick queries
- Chatbot

Admin Features → GPT-4 (monthly only, ~$5/month)
- Monthly insights reports
- Pricing optimization
- Sales forecasting

Total: ~$15-20/month ✅
High Smart Plan: ৳3500/month
AI Cost: Only 6% of revenue!
```

---

## 🎯 **Next Steps**

1. **Get API Key** - platform.openai.com
2. **Add to .env** - Copy key
3. **Install package** - `npm install openai`
4. **Copy code** - Use examples above
5. **Test** - Try with sample data
6. **Deploy** - Add to High Smart features!

---

**OpenAI Integration Ready!** 🚀

**Questions?**
- API setup - Check platform.openai.com/docs
- Pricing - platform.openai.com/pricing
- Models - GPT-3.5 for most, GPT-4 for premium

**আপনার ChatGPT Plus account আছে, তাই API setup করা easy হবে!** 💪
