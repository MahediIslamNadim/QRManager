import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fallbackInsights = {
  suggestions: "Top selling item stock ready rakun, peak hour-e staff plan korun, and slow item-e offer test korun.",
  pricingTips: "Average order value barate combo, add-on, and family bundle test korun.",
  marketingTips: "Repeat customer der jonno weekly lunch/dinner offer and QR campaign chalate paren.",
  forecastTip: "Recent trend follow kore next week-er busy day and high demand item agey plan korun.",
  menuOptimization: "Low selling item review korun and top item menu-te more visible position-e rakun.",
  predictiveForecast: "Order data barle forecast aro accurate hobe. Current trend diye next 1-2 week inventory plan korun.",
  actionItems: [
    "Top selling items stock check korun",
    "Peak hour staffing plan update korun",
    "Low selling items-er price/promotion review korun",
    "Combo offer A/B test korun",
  ],
};

type OrderItem = {
  name?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  menu_item_id?: string | null;
};

type OrderRow = {
  id: string;
  total?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  order_items?: OrderItem[] | null;
};

type MenuItem = {
  id: string;
  name?: string | null;
  price?: number | string | null;
  category?: string | null;
  available?: boolean | null;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const numberValue = (value: unknown) => Number(value || 0);

const parseGeminiJson = (text: string) => {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
};

const linearRegression = (values: number[]) => {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };

  const sumX = values.reduce((sum, _, index) => sum + index, 0);
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = values.reduce((sum, value, index) => sum + index * value, 0);
  const sumX2 = values.reduce((sum, _, index) => sum + index * index, 0);
  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const buildForecastRevenue = (weeklyTrend: { week: string; revenue: number }[]) => {
  if (weeklyTrend.length === 0) return [];

  const values = weeklyTrend.map((week) => week.revenue);
  const { slope, intercept } = linearRegression(values);
  const predict = (index: number) => Math.max(0, Math.round(intercept + slope * index));

  return [
    ...weeklyTrend.map((week, index) => ({
      week: week.week,
      actual: week.revenue,
      predicted: predict(index),
      isFuture: false,
    })),
    { week: "Next week", predicted: predict(weeklyTrend.length), isFuture: true },
    { week: "After 2 weeks", predicted: predict(weeklyTrend.length + 1), isFuture: true },
  ];
};

const buildAnalytics = (orders: OrderRow[], menuItems: MenuItem[]) => {
  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  const totalRevenue30d = orders.reduce((sum, order) => sum + numberValue(order.total), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue30d / totalOrders) : 0;

  const now = Date.now();
  const thisWeekRevenue = orders
    .filter((order) => order.created_at && new Date(order.created_at).getTime() > now - 7 * 86400000)
    .reduce((sum, order) => sum + numberValue(order.total), 0);
  const lastWeekRevenue = orders
    .filter((order) => {
      if (!order.created_at) return false;
      const time = new Date(order.created_at).getTime();
      return time > now - 14 * 86400000 && time <= now - 7 * 86400000;
    })
    .reduce((sum, order) => sum + numberValue(order.total), 0);
  const revenueGrowth =
    lastWeekRevenue > 0
      ? `${((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) >= 0 ? "+" : ""}${Math.round(
          ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100,
        )}%`
      : thisWeekRevenue > 0
        ? "New"
        : null;

  const categoryMap: Record<string, { revenue: number; orders: number }> = {};
  const itemFrequency: Record<string, number> = {};
  const itemRevenue: Record<string, number> = {};
  const recentFrequency: Record<string, number> = {};
  const previousFrequency: Record<string, number> = {};
  const hourlyMap: Record<string, number> = {};
  const dayMap: Record<number, { orders: number; revenue: number }> = {};
  const weeklyMap: Record<number, { revenue: number; orders: number }> = {};
  const statusMap: Record<string, number> = {};

  orders.forEach((order) => {
    const orderTime = order.created_at ? new Date(order.created_at).getTime() : now;
    const date = new Date(orderTime);
    const hour = `${date.getHours().toString().padStart(2, "0")}:00`;
    const day = date.getDay();
    const daysAgo = Math.floor((now - orderTime) / 86400000);
    const weekIndex = Math.floor(daysAgo / 7);
    const isRecent = orderTime > now - 14 * 86400000;

    hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    dayMap[day] = dayMap[day] || { orders: 0, revenue: 0 };
    dayMap[day].orders += 1;
    dayMap[day].revenue += numberValue(order.total);

    if (weekIndex >= 0 && weekIndex <= 3) {
      weeklyMap[weekIndex] = weeklyMap[weekIndex] || { revenue: 0, orders: 0 };
      weeklyMap[weekIndex].orders += 1;
      weeklyMap[weekIndex].revenue += numberValue(order.total);
    }

    const status = order.status || "unknown";
    statusMap[status] = (statusMap[status] || 0) + 1;

    (order.order_items || []).forEach((item) => {
      const quantity = numberValue(item.quantity || 1);
      const price = numberValue(item.price);
      const itemId = item.menu_item_id || item.name || "unknown";
      const menuItem = item.menu_item_id ? menuById.get(item.menu_item_id) : undefined;
      const category = menuItem?.category || "Other";

      categoryMap[category] = categoryMap[category] || { revenue: 0, orders: 0 };
      categoryMap[category].revenue += price * quantity;
      categoryMap[category].orders += quantity;

      itemFrequency[itemId] = (itemFrequency[itemId] || 0) + quantity;
      itemRevenue[itemId] = (itemRevenue[itemId] || 0) + price * quantity;

      if (isRecent) recentFrequency[itemId] = (recentFrequency[itemId] || 0) + quantity;
      else previousFrequency[itemId] = (previousFrequency[itemId] || 0) + quantity;
    });
  });

  const categoryRevenue = Object.entries(categoryMap)
    .map(([category, value]) => ({
      category,
      revenue: Math.round(value.revenue),
      orders: value.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const hourlyPattern = Object.entries(hourlyMap)
    .map(([hour, orders]) => ({ hour, orders }))
    .sort((a, b) => Number(a.hour.slice(0, 2)) - Number(b.hour.slice(0, 2)));
  const peakHour = [...hourlyPattern].sort((a, b) => b.orders - a.orders)[0]?.hour || null;

  const dayOfWeek = dayNames.map((day, index) => ({
    day,
    orders: dayMap[index]?.orders || 0,
    revenue: Math.round(dayMap[index]?.revenue || 0),
  }));

  const weekLabels = ["This week", "Last week", "2 weeks ago", "3 weeks ago"];
  const weeklyTrend = [3, 2, 1, 0]
    .filter((index) => weeklyMap[index])
    .map((index) => ({
      week: weekLabels[index],
      revenue: Math.round(weeklyMap[index].revenue),
      orders: weeklyMap[index].orders,
    }));

  const sortedItems = Object.entries(itemFrequency).sort((a, b) => b[1] - a[1]);
  const maxItemCount = sortedItems[0]?.[1] || 1;

  const topPerformers = sortedItems.slice(0, 5).map(([id, quantity]) => ({
    id,
    name: menuById.get(id)?.name || id,
    quantity,
    revenue: Math.round(itemRevenue[id] || 0),
  }));

  const lowPerformers = menuItems
    .map((item) => ({
      id: item.id,
      name: item.name || "Unnamed item",
      quantity: itemFrequency[item.id] || 0,
    }))
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);

  const menuScores = menuItems
    .map((item) => {
      const quantity = itemFrequency[item.id] || 0;
      const score = Math.max(0.2, Math.round((quantity / maxItemCount) * 50) / 10);
      return {
        id: item.id,
        name: item.name || "Unnamed item",
        score,
        quantity,
        trend: quantity > maxItemCount * 0.45 ? "up" : quantity < 2 ? "down" : "stable",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const demandForecast = Object.entries(recentFrequency)
    .map(([id, recent]) => {
      const previous = previousFrequency[id] || 0;
      const changePercent = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : recent > 0 ? 100 : 0;
      const trend = changePercent > 10 ? "up" : changePercent < -10 ? "down" : "stable";
      return {
        id,
        name: menuById.get(id)?.name || id,
        predictedOrders: Math.max(1, Math.round(recent * 1.1)),
        changePercent,
        trend,
      };
    })
    .sort((a, b) => b.predictedOrders - a.predictedOrders)
    .slice(0, 8);

  const completedStatuses = ["served", "completed", "paid"];
  const completedOrders = orders.filter((order) => completedStatuses.includes(order.status || "")).length;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const dataConfidence = Math.min(95, Math.max(35, totalOrders * 3 + menuItems.length * 2));

  return {
    totalRevenue30d: Math.round(totalRevenue30d),
    totalOrders,
    avgOrderValue,
    revenueGrowth,
    peakHour,
    completionRate,
    dataConfidence,
    categoryRevenue,
    hourlyPattern,
    dayOfWeek,
    weeklyTrend,
    forecastRevenue: buildForecastRevenue(weeklyTrend),
    topPerformers,
    lowPerformers,
    menuScores,
    demandForecast,
    orderStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
  };
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

    const safeOrders = (orders || []) as OrderRow[];
    const safeMenu = (menuItems || []) as MenuItem[];
    const analytics = buildAnalytics(safeOrders, safeMenu);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return json({ insights: fallbackInsights, analytics, source: "fallback" });
    }

    const prompt = `
You are a restaurant business analyst for a QR ordering SaaS product in Bangladesh.
Use the metrics below and answer only valid JSON. Keep advice practical for Sylhet/Bangladesh restaurant owners.

Metrics:
${JSON.stringify({
      totalRevenue30d: analytics.totalRevenue30d,
      totalOrders: analytics.totalOrders,
      avgOrderValue: analytics.avgOrderValue,
      revenueGrowth: analytics.revenueGrowth,
      peakHour: analytics.peakHour,
      completionRate: analytics.completionRate,
      topPerformers: analytics.topPerformers,
      lowPerformers: analytics.lowPerformers,
      categoryRevenue: analytics.categoryRevenue,
      weeklyTrend: analytics.weeklyTrend,
      dayOfWeek: analytics.dayOfWeek,
      demandForecast: analytics.demandForecast,
    })}

JSON shape:
{
  "suggestions": "short Bangla/Banglish practical growth advice",
  "pricingTips": "short Bangla/Banglish pricing advice",
  "marketingTips": "short Bangla/Banglish marketing advice",
  "forecastTip": "short Bangla/Banglish next week forecast",
  "menuOptimization": "short Bangla/Banglish menu optimization advice",
  "predictiveForecast": "short Bangla/Banglish next 1-2 week forecast",
  "actionItems": ["action 1", "action 2", "action 3", "action 4", "action 5"]
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
      return json({ insights: fallbackInsights, analytics, source: "fallback" });
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ insights: fallbackInsights, analytics, source: "fallback" });

    return json({
      insights: { ...fallbackInsights, ...parseGeminiJson(text) },
      analytics,
      source: "gemini",
    });
  } catch (error) {
    console.error("ai-analytics error", error);
    return json({ insights: fallbackInsights, analytics: buildAnalytics([], []), source: "fallback" });
  }
});
