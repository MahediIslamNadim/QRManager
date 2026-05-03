import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  available?: boolean | null;
};

type SummaryPayload = {
  headline: string;
  bullets: string[];
  suggestion: string;
};

const dayPeriod = (hour: number) => {
  if (hour >= 6 && hour < 11) return "সকাল";
  if (hour >= 11 && hour < 15) return "Lunch time";
  if (hour >= 15 && hour < 18) return "বিকেল";
  if (hour >= 18 && hour < 23) return "Dinner time";
  return "রাত";
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const numberValue = (value: unknown) => Number(value || 0);

const parseGeminiJson = (text: string): SummaryPayload | null => {
  try {
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      headline: String(parsed.headline || "আজকের সারাংশ"),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 6) : [],
      suggestion: String(parsed.suggestion || ""),
    };
  } catch {
    return null;
  }
};

const buildMetrics = (orders: OrderRow[], menuItems: MenuItem[]) => {
  const itemStats = new Map<string, { name: string; quantity: number; revenue: number }>();
  const periodStats = new Map<string, number>();
  let totalRevenue = 0;

  for (const order of orders) {
    totalRevenue += numberValue(order.total);
    if (order.created_at) {
      const hour = new Date(order.created_at).getUTCHours() + 6;
      const period = dayPeriod(hour >= 24 ? hour - 24 : hour);
      periodStats.set(period, (periodStats.get(period) || 0) + 1);
    }

    for (const item of order.order_items || []) {
      const id = item.menu_item_id || item.name || "unknown";
      const quantity = numberValue(item.quantity || 1);
      const price = numberValue(item.price);
      const current = itemStats.get(id) || { name: item.name || "Unknown item", quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += quantity * price;
      itemStats.set(id, current);
    }
  }

  const soldItems = [...itemStats.values()].sort((a, b) => b.quantity - a.quantity);
  const topSellingItem = soldItems[0] || null;
  const soldByName = new Set(soldItems.map((item) => item.name));
  const unsoldAvailable = menuItems.find((item) => item.available !== false && item.name && !soldByName.has(item.name));
  const lowSellingItem = unsoldAvailable
    ? { name: unsoldAvailable.name, quantity: 0, revenue: 0 }
    : [...soldItems].reverse()[0] || null;
  const busiestPeriod = [...periodStats.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return {
    totalOrders: orders.length,
    totalRevenue: Math.round(totalRevenue),
    averageOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
    topSellingItem,
    lowSellingItem,
    busiestPeriod: busiestPeriod ? { name: busiestPeriod[0], orders: busiestPeriod[1] } : null,
    soldItems: soldItems.slice(0, 8),
  };
};

const buildFallbackSummary = (metrics: ReturnType<typeof buildMetrics>): SummaryPayload => {
  const top = metrics.topSellingItem?.name || "কোনো item নেই";
  const low = metrics.lowSellingItem?.name || "কোনো item নেই";
  const busy = metrics.busiestPeriod?.name || "এখনও clear peak time নেই";

  return {
    headline: "আজকের AI Daily Summary",
    bullets: [
      `মোট order: ${metrics.totalOrders}`,
      `মোট sales: ৳${metrics.totalRevenue}`,
      `Average order value: ৳${metrics.averageOrderValue}`,
      `Top selling item: ${top}`,
      `কম sell item: ${low}`,
      `${busy}-এ order বেশি ছিল`,
    ],
    suggestion: metrics.totalOrders > 0
      ? "Top item দিয়ে combo offer test করলে average order value বাড়তে পারে।"
      : "আজ order কম থাকলে social post বা table QR visibility check করুন।",
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const restaurantId = typeof body.restaurant_id === "string" ? body.restaurant_id : null;
    const force = body.force === true;
    if (!restaurantId) return json({ error: "restaurant_id is required" }, 400);

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
      .select("id, owner_id, name")
      .eq("id", restaurantId)
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
      .eq("restaurant_id", restaurantId)
      .in("role", ["admin"])
      .maybeSingle();

    if (!superAdmin && restaurant.owner_id !== user.id && !roleRow) {
      return json({ error: "Forbidden" }, 403);
    }

    const bdNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const summaryDate = bdNow.toISOString().split("T")[0];

    if (!force) {
      const { data: cached } = await admin
        .from("ai_daily_summaries")
        .select("summary, metrics, source, generated_at")
        .eq("restaurant_id", restaurantId)
        .eq("summary_date", summaryDate)
        .maybeSingle();

      if (cached?.summary) {
        return json({ ...cached, summary_date: summaryDate, cached: true });
      }
    }

    const [{ data: orders }, { data: menuItems }] = await Promise.all([
      admin
        .from("orders")
        .select("id, total, status, created_at, order_items(name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", `${summaryDate}T00:00:00+06:00`)
        .lte("created_at", `${summaryDate}T23:59:59+06:00`)
        .gt("total", 0)
        .order("created_at", { ascending: false }),
      admin
        .from("menu_items")
        .select("id, name, available")
        .eq("restaurant_id", restaurantId),
    ]);

    const metrics = buildMetrics((orders || []) as OrderRow[], (menuItems || []) as MenuItem[]);
    let summary = buildFallbackSummary(metrics);
    let source: "gemini" | "fallback" = "fallback";

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey) {
      const prompt = `
You are an assistant for Bangladeshi restaurant owners using QRManager.
Create a short daily business summary in simple Bangla/Banglish. Be specific, practical, and friendly.

Restaurant: ${restaurant.name}
Date: ${summaryDate}
Metrics:
${JSON.stringify(metrics)}

Return only valid JSON:
{
  "headline": "short title",
  "bullets": ["5-6 short bullets"],
  "suggestion": "one practical sales suggestion"
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

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = text ? parseGeminiJson(text) : null;
        if (parsed) {
          summary = parsed;
          source = "gemini";
        }
      } else {
        console.error("ai-daily-summary Gemini failed:", await geminiResponse.text());
      }
    }

    const generatedAt = new Date().toISOString();
    await admin.from("ai_daily_summaries").upsert(
      {
        restaurant_id: restaurantId,
        summary_date: summaryDate,
        metrics,
        summary,
        source,
        generated_by: user.id,
        generated_at: generatedAt,
        updated_at: generatedAt,
      },
      { onConflict: "restaurant_id,summary_date" },
    );

    return json({
      summary,
      metrics,
      source,
      generated_at: generatedAt,
      summary_date: summaryDate,
      cached: false,
    });
  } catch (error) {
    console.error("ai-daily-summary error:", error);
    return json({ error: String(error) }, 500);
  }
});
