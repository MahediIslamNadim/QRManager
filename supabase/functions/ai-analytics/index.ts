import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fallbackInsights = {
  suggestions: "Best selling items stock-e rakun, peak hour-e staff ready rakun, and slow items er offer test korun.",
  pricingTips: "Average order value barate combo item, add-on, and family bundle test korte paren.",
  marketingTips: "Repeat customer der jonno weekly offer and lunch/dinner time targeted promotion chalate paren.",
  forecastTip: "Recent order trend follow kore next week-er busy day and high demand item plan korun.",
  menuOptimization: "Low selling items review korun and top items menu-te more visible position-e rakun.",
  predictiveForecast: "More order data collect hole forecast aro accurate hobe. Current trend diye next 1-2 week inventory plan korte paren.",
  actionItems: [
    "Top selling items stock check korun",
    "Peak hour staffing plan update korun",
    "Low selling items-er price/promotion review korun",
    "Combo offer A/B test korun",
  ],
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseGeminiJson = (text: string) => {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { restaurant_id } = await req.json();
    if (!restaurant_id) return json({ error: "restaurant_id is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, owner_id, tier, subscription_status")
      .eq("id", restaurant_id)
      .maybeSingle();

    if (restaurantError || !restaurant) return json({ error: "Restaurant not found" }, 404);

    const { data: superAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("restaurant_id", restaurant_id)
      .in("role", ["admin"])
      .maybeSingle();

    const canAccessRestaurant = Boolean(superAdmin || restaurant.owner_id === user.id || roleRow);
    if (!canAccessRestaurant) return json({ error: "Forbidden" }, 403);

    if (restaurant.tier !== "high_smart" || restaurant.subscription_status !== "active") {
      return json({ error: "AI Analytics requires active High Smart package" }, 403);
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: orders }, { data: menuItems }] = await Promise.all([
      admin
        .from("orders")
        .select("id, total, status, created_at, order_items(name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurant_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("menu_items")
        .select("id, name, price, category, available")
        .eq("restaurant_id", restaurant_id),
    ]);

    const safeOrders = orders || [];
    const safeMenu = menuItems || [];
    const totalRevenue = safeOrders.reduce((sum: number, order: { total?: number | string | null }) => sum + Number(order.total || 0), 0);
    const avgOrderValue = safeOrders.length > 0 ? Math.round(totalRevenue / safeOrders.length) : 0;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ insights: fallbackInsights, source: "fallback" });

    const prompt = `
You are a restaurant business analyst for a QR ordering SaaS product in Bangladesh.
Analyze this restaurant data and answer only valid JSON.

30 day revenue: ${totalRevenue}
Average order value: ${avgOrderValue}
Order count: ${safeOrders.length}
Menu items: ${JSON.stringify(safeMenu.slice(0, 30).map((item: Record<string, unknown>) => ({
      name: item.name,
      price: item.price,
      category: item.category,
      available: item.available,
    })))}
Recent order sample: ${JSON.stringify(safeOrders.slice(0, 50).map((order: Record<string, unknown>) => ({
      total: order.total,
      created_at: order.created_at,
      items: ((order.order_items as Record<string, unknown>[] | undefined) || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    })))}

JSON shape:
{
  "suggestions": "short Bangla/Banglish practical advice",
  "pricingTips": "short Bangla/Banglish pricing advice",
  "marketingTips": "short Bangla/Banglish marketing advice",
  "forecastTip": "short Bangla/Banglish forecast",
  "menuOptimization": "short Bangla/Banglish menu advice",
  "predictiveForecast": "short Bangla/Banglish next 1-2 week forecast",
  "actionItems": ["action 1", "action 2", "action 3", "action 4"]
}
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!geminiResponse.ok) {
      console.error("Gemini request failed", await geminiResponse.text());
      return json({ insights: fallbackInsights, source: "fallback" });
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ insights: fallbackInsights, source: "fallback" });

    return json({ insights: { ...fallbackInsights, ...parseGeminiJson(text) }, source: "gemini" });
  } catch (error) {
    console.error("ai-analytics error", error);
    return json({ insights: fallbackInsights, source: "fallback" });
  }
});
