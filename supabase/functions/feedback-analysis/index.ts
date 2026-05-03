import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FeedbackRow = {
  id: string;
  rating?: number | string | null;
  comment?: string | null;
  created_at?: string | null;
  source: "order" | "item" | "general";
  item_name?: string | null;
};

type FeedbackAnalysis = {
  headline: string;
  sentiment: "positive" | "neutral" | "negative";
  positive: string[];
  negative: string[];
  common_complaints: string[];
  actions: string[];
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const numberValue = (value: unknown) => Number(value || 0);

const cleanText = (value?: string | null) => String(value || "").replace(/\s+/g, " ").trim();

const parseGeminiJson = (text: string): FeedbackAnalysis | null => {
  try {
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      headline: String(parsed.headline || "Customer Feedback Analysis"),
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      positive: Array.isArray(parsed.positive) ? parsed.positive.map(String).slice(0, 6) : [],
      negative: Array.isArray(parsed.negative) ? parsed.negative.map(String).slice(0, 6) : [],
      common_complaints: Array.isArray(parsed.common_complaints)
        ? parsed.common_complaints.map(String).slice(0, 6)
        : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 6) : [],
    };
  } catch {
    return null;
  }
};

const buildMetrics = (feedback: FeedbackRow[]) => {
  const ratings = feedback.map((row) => numberValue(row.rating)).filter((rating) => rating > 0);
  const comments = feedback.filter((row) => cleanText(row.comment));
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: ratings.filter((value) => value === rating).length,
  }));

  return {
    totalFeedback: feedback.length,
    commentsCount: comments.length,
    averageRating,
    positiveCount: ratings.filter((rating) => rating >= 4).length,
    negativeCount: ratings.filter((rating) => rating <= 2).length,
    neutralCount: ratings.filter((rating) => rating === 3).length,
    ratingDistribution,
  };
};

const keywordHits = (feedback: FeedbackRow[], words: string[]) =>
  feedback
    .filter((row) => {
      const text = cleanText(row.comment).toLowerCase();
      return text && words.some((word) => text.includes(word));
    })
    .length;

const buildFallbackAnalysis = (feedback: FeedbackRow[], metrics: ReturnType<typeof buildMetrics>): FeedbackAnalysis => {
  const positive: string[] = [];
  const negative: string[] = [];
  const complaints: string[] = [];
  const actions: string[] = [];

  if (metrics.averageRating >= 4) positive.push("Overall customer rating strong");
  if (keywordHits(feedback, ["taste", "tasty", "flavor", "delicious", "স্বাদ", "মজা", "ভালো"]) > 0) {
    positive.push("Food taste নিয়ে ভালো feedback আছে");
  }
  if (keywordHits(feedback, ["staff", "service", "behavior", "ব্যবহার", "সার্ভিস"]) > 0) {
    positive.push("Staff/service experience customers notice করছে");
  }

  if (metrics.negativeCount > 0) negative.push("Low rating feedback review করা দরকার");
  if (keywordHits(feedback, ["slow", "late", "delay", "wait", "দেরি", "স্লো"]) > 0) {
    negative.push("Service/kitchen speed নিয়ে negative signal আছে");
    complaints.push("Delivery/service slow");
    actions.push("Peak time kitchen speed and waiter handoff improve করুন");
  }
  if (keywordHits(feedback, ["price", "expensive", "cost", "দাম", "বেশি"]) > 0) {
    negative.push("Price perception নিয়ে কিছু concern আছে");
    complaints.push("Price একটু বেশি মনে হয়েছে");
    actions.push("Popular items-এর value combo বা add-on offer test করুন");
  }
  if (keywordHits(feedback, ["cold", "temperature", "ঠান্ডা"]) > 0) {
    complaints.push("Food temperature consistency");
    actions.push("Serve timing and kitchen-to-table handoff check করুন");
  }

  return {
    headline: metrics.totalFeedback
      ? `${metrics.totalFeedback} feedback analyzed, avg rating ${metrics.averageRating || "-"}`
      : "No feedback yet",
    sentiment:
      metrics.averageRating >= 4 ? "positive" : metrics.averageRating > 0 && metrics.averageRating < 3 ? "negative" : "neutral",
    positive: positive.length ? positive : ["Feedback data কম, আরও review আসলে positive trend clear হবে"],
    negative: negative.length ? negative : ["Major negative pattern পাওয়া যায়নি"],
    common_complaints: complaints.length ? complaints : ["Common complaint এখনো clear না"],
    actions: actions.length ? actions : ["Customers feedback দিতে উৎসাহ দিন এবং weekly review করুন"],
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server is not configured" }, 500);
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { restaurant_id: restaurantId, force = false } = await req.json();
    if (!restaurantId || typeof restaurantId !== "string") return json({ error: "restaurant_id is required" }, 400);

    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser();
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

    if (!force) {
      const { data: cached } = await admin
        .from("feedback_ai_summaries")
        .select("analysis, metrics, source, generated_at")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      const generatedAt = cached?.generated_at ? new Date(cached.generated_at).getTime() : 0;
      if (cached?.analysis && Date.now() - generatedAt < 6 * 60 * 60 * 1000) {
        return json({ ...cached, cached: true });
      }
    }

    const [{ data: orderRows }, { data: generalReviews }, { data: itemReviews }] = await Promise.all([
      admin
        .from("orders")
        .select("id, rating, rating_comment, created_at")
        .eq("restaurant_id", restaurantId)
        .not("rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(300),
      admin
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("restaurant_id", restaurantId)
        .is("menu_item_id", null)
        .order("created_at", { ascending: false })
        .limit(300),
      admin
        .from("reviews")
        .select("id, rating, comment, created_at, menu_items!inner(name, restaurant_id)")
        .eq("menu_items.restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const feedback: FeedbackRow[] = [
      ...((orderRows || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        rating: row.rating as number | string | null,
        comment: row.rating_comment as string | null,
        created_at: row.created_at as string | null,
        source: "order" as const,
      })),
      ...((generalReviews || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        rating: row.rating as number | string | null,
        comment: row.comment as string | null,
        created_at: row.created_at as string | null,
        source: "general" as const,
      })),
      ...((itemReviews || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        rating: row.rating as number | string | null,
        comment: row.comment as string | null,
        created_at: row.created_at as string | null,
        source: "item" as const,
        item_name: (row.menu_items as { name?: string | null } | null)?.name || null,
      })),
    ].slice(0, 500);

    const metrics = buildMetrics(feedback);
    let analysis = buildFallbackAnalysis(feedback, metrics);
    let source: "gemini" | "fallback" = "fallback";

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey && feedback.length > 0) {
      const prompt = `
You are an AI customer feedback analyst for QRManager restaurant owners in Bangladesh.
Analyze customer ratings and review comments. Output simple Bangla/Banglish business insight.

Restaurant: ${restaurant.name}
Metrics:
${JSON.stringify(metrics)}

Recent feedback sample:
${JSON.stringify(
  feedback.slice(0, 120).map((row) => ({
    rating: row.rating,
    comment: cleanText(row.comment).slice(0, 300),
    source: row.source,
    item: row.item_name,
  })),
)}

Return only valid JSON:
{
  "headline": "short summary",
  "sentiment": "positive|neutral|negative",
  "positive": ["2-5 positive findings"],
  "negative": ["2-5 negative findings"],
  "common_complaints": ["2-5 repeated complaints"],
  "actions": ["3-5 practical action items"]
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
          analysis = parsed;
          source = "gemini";
        }
      } else {
        console.error("feedback-analysis Gemini failed:", await geminiResponse.text());
      }
    }

    const generatedAt = new Date().toISOString();
    await admin.from("feedback_ai_summaries").upsert(
      {
        restaurant_id: restaurantId,
        metrics,
        analysis,
        source,
        generated_by: user.id,
        generated_at: generatedAt,
        updated_at: generatedAt,
      },
      { onConflict: "restaurant_id" },
    );

    return json({
      analysis,
      metrics,
      source,
      generated_at: generatedAt,
      cached: false,
    });
  } catch (error) {
    console.error("feedback-analysis error:", error);
    return json({ error: String(error) }, 500);
  }
});
