import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AnalyticsPayload = {
  total_revenue?: number;
  total_orders?: number;
  avg_order_value?: number;
  restaurant_breakdown?: Array<{ name: string; orders: number; revenue: number }>;
  daily_trend?: Array<{ day: string; orders: number; revenue: number }>;
  category_breakdown?: Array<{ category: string; quantity: number; revenue: number }>;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value || 0);
  return 0;
};

const buildFallbackSummary = (analytics: AnalyticsPayload) => {
  const topRestaurant = [...(analytics.restaurant_breakdown ?? [])].sort((a, b) => b.revenue - a.revenue)[0];
  const weakRestaurant = [...(analytics.restaurant_breakdown ?? [])].sort((a, b) => a.revenue - b.revenue)[0];
  const topCategory = [...(analytics.category_breakdown ?? [])].sort((a, b) => b.revenue - a.revenue)[0];
  const trend = analytics.daily_trend ?? [];
  const firstDayRevenue = trend[0]?.revenue ?? 0;
  const lastDayRevenue = trend[trend.length - 1]?.revenue ?? 0;
  const trendDirection = lastDayRevenue >= firstDayRevenue ? "up" : "down";

  return {
    summary:
      `Total revenue is BDT ${toNumber(analytics.total_revenue).toLocaleString("en-BD")} from ${toNumber(analytics.total_orders).toLocaleString("en-BD")} orders. ` +
      (topRestaurant ? `${topRestaurant.name} is currently leading the group.` : "No restaurant leader is clear yet."),
    focus_area: topCategory
      ? `Focus on ${topCategory.category} because it is generating the strongest revenue signal across the group.`
      : "Focus on building more consistent order volume across restaurants.",
    opportunities: [
      topRestaurant ? `Use ${topRestaurant.name} as the benchmark location for menu mix and service patterns.` : "Identify the strongest-performing restaurant and reuse its menu mix elsewhere.",
      topCategory ? `Promote ${topCategory.category} across more locations while it is performing well.` : "Highlight the best-selling category with group-level promotions.",
      trend.length > 3 ? `Recent revenue trend is moving ${trendDirection}; react quickly with staffing and menu visibility updates.` : "Collect more daily trend data for stronger forecasting.",
    ].filter(Boolean),
    risks: [
      weakRestaurant ? `${weakRestaurant.name} is trailing the group and may need local operational attention.` : "Some restaurants may be underperforming but need more data for confirmation.",
      toNumber(analytics.avg_order_value) < 300 ? "Average order value is relatively low, so upsell opportunities may be underused." : "Average order value looks healthy, but watch for drop-offs in lower-performing locations.",
    ],
    recommendations: [
      "Compare high-performing and low-performing restaurants side by side and standardize what is working.",
      "Use group-level menu updates and notices to coordinate fast changes across locations.",
      "Review staffing and order flow at weaker locations before revenue gaps widen.",
    ],
  };
};

async function generateGeminiSummary(apiKey: string, analytics: AnalyticsPayload) {
  const prompt = `
You are analyzing enterprise restaurant data. Return only valid JSON with this exact shape:
{
  "summary": string,
  "focus_area": string,
  "opportunities": string[],
  "risks": string[],
  "recommendations": string[]
}

Keep the answer concise, operator-friendly, and grounded in the provided numbers.

Analytics:
${JSON.stringify(analytics)}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini did not return text");

  const parsed = JSON.parse(text);
  return {
    summary: parsed.summary || "",
    focus_area: parsed.focus_area || "",
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !caller) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = roles?.some((role: { role: string }) => role.role === "super_admin");
    const isGroupOwner = roles?.some((role: { role: string }) => role.role === "group_owner");

    if (!isSuperAdmin && !isGroupOwner) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null) as {
      group_id?: string;
      restaurant_id?: string | null;
    } | null;

    if (!body?.group_id) return json({ error: "group_id is required" }, 400);

    if (!isSuperAdmin) {
      const { data: ownedGroup } = await admin
        .from("restaurant_groups")
        .select("id")
        .eq("id", body.group_id)
        .eq("owner_id", caller.id)
        .maybeSingle();

      if (!ownedGroup) return json({ error: "You do not manage this enterprise group" }, 403);
    }

    const { data: analytics, error: analyticsError } = await admin.rpc("get_enterprise_analytics", {
      p_group_id: body.group_id,
      p_restaurant_id: body.restaurant_id || null,
    });

    if (analyticsError) return json({ error: analyticsError.message }, 400);

    const fallback = buildFallbackSummary((analytics ?? {}) as AnalyticsPayload);

    if (!geminiApiKey) return json(fallback);

    try {
      const aiSummary = await generateGeminiSummary(geminiApiKey, (analytics ?? {}) as AnalyticsPayload);
      return json({
        summary: aiSummary.summary || fallback.summary,
        focus_area: aiSummary.focus_area || fallback.focus_area,
        opportunities: aiSummary.opportunities?.length ? aiSummary.opportunities : fallback.opportunities,
        risks: aiSummary.risks?.length ? aiSummary.risks : fallback.risks,
        recommendations: aiSummary.recommendations?.length ? aiSummary.recommendations : fallback.recommendations,
      });
    } catch (error) {
      console.error("[enterprise-ai-analytics] Gemini fallback", error);
      return json(fallback);
    }
  } catch (error) {
    console.error("[enterprise-ai-analytics]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
