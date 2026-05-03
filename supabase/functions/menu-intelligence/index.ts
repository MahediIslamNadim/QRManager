import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MenuInput = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  prep_time_minutes?: number | string | null;
};

type ExistingMenuItem = {
  id: string;
  name?: string | null;
  category?: string | null;
  price?: number | string | null;
  available?: boolean | null;
};

type MenuSuggestion = {
  better_name: string;
  description: string;
  category: string;
  price_positioning: string;
  combo_idea: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const numberValue = (value: unknown) => Number(value || 0);

const titleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const inferCategory = (name: string, currentCategory?: string | null) => {
  const lower = name.toLowerCase();
  if (lower.includes("burger")) return "Burger";
  if (lower.includes("pizza")) return "Pizza";
  if (lower.includes("biryani") || lower.includes("biriyani")) return "Biryani";
  if (lower.includes("kabab") || lower.includes("kebab")) return "Kabab";
  if (lower.includes("rice") || lower.includes("fried rice")) return "Rice";
  if (lower.includes("coffee") || lower.includes("juice") || lower.includes("drink")) return "Beverage";
  if (lower.includes("cake") || lower.includes("ice cream") || lower.includes("dessert")) return "Dessert";
  return currentCategory && currentCategory !== "other" ? currentCategory : "Chef Special";
};

const buildPricePositioning = (input: MenuInput, menuItems: ExistingMenuItem[], category: string) => {
  const price = numberValue(input.price);
  if (!price) return "Price missing. Similar menu items dekhe value-friendly price set korun.";

  const comparable = menuItems
    .filter((item) => item.category === category || !category)
    .map((item) => numberValue(item.price))
    .filter((itemPrice) => itemPrice > 0);

  const prices = comparable.length ? comparable : menuItems.map((item) => numberValue(item.price)).filter((itemPrice) => itemPrice > 0);
  if (!prices.length) return `৳${price} new menu price hisebe okay. Sales data ashle positioning aro accurate hobe.`;

  const avg = Math.round(prices.reduce((sum, itemPrice) => sum + itemPrice, 0) / prices.length);
  if (price < avg * 0.85) return `৳${price} value price. Add-on or combo diye average order value barano jabe.`;
  if (price > avg * 1.2) return `৳${price} premium side-e. Description and image strong rakha important.`;
  return `৳${price} category average-er kachakachi. Combo offer diye sell boost kora jabe.`;
};

const buildFallbackSuggestion = (input: MenuInput, menuItems: ExistingMenuItem[]): MenuSuggestion => {
  const baseName = titleCase(String(input.name || "Special Item"));
  const category = inferCategory(baseName, input.category);
  const lower = baseName.toLowerCase();
  const betterName =
    lower.includes("burger")
      ? `Juicy ${baseName}`
      : lower.includes("chicken")
        ? `Crispy ${baseName}`
        : `Signature ${baseName}`;

  const description =
    lower.includes("burger")
      ? "Crispy patty, fresh lettuce, soft bun and house special sauce diye freshly prepared."
      : lower.includes("biryani") || lower.includes("biriyani")
        ? "Aromatic rice, tender meat, balanced spices and fresh garnish diye served."
        : "Fresh ingredients, balanced flavor and restaurant special touch diye prepared.";

  const comboIdea =
    lower.includes("burger")
      ? `${betterName} + Fries + Soft Drink`
      : lower.includes("rice") || lower.includes("biryani") || lower.includes("biriyani")
        ? `${betterName} + Salad + Soft Drink`
        : `${betterName} + Side + Beverage`;

  return {
    better_name: betterName,
    description,
    category,
    price_positioning: buildPricePositioning(input, menuItems, category),
    combo_idea: comboIdea,
  };
};

const parseGeminiJson = (text: string): MenuSuggestion | null => {
  try {
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      better_name: String(parsed.better_name || parsed.betterName || ""),
      description: String(parsed.description || ""),
      category: String(parsed.category || "other"),
      price_positioning: String(parsed.price_positioning || parsed.pricePositioning || ""),
      combo_idea: String(parsed.combo_idea || parsed.comboIdea || ""),
    };
  } catch {
    return null;
  }
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

    const { restaurant_id: restaurantId, item } = await req.json();
    const menuInput = (item || {}) as MenuInput;

    if (!restaurantId || typeof restaurantId !== "string") return json({ error: "restaurant_id is required" }, 400);
    if (!menuInput.name || String(menuInput.name).trim().length < 2) {
      return json({ error: "Item name is required" }, 400);
    }

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

    const { data: menuItems } = await admin
      .from("menu_items")
      .select("id, name, category, price, available")
      .eq("restaurant_id", restaurantId)
      .limit(80);

    const safeMenuItems = (menuItems || []) as ExistingMenuItem[];
    let suggestion = buildFallbackSuggestion(menuInput, safeMenuItems);
    let source: "gemini" | "fallback" = "fallback";

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey) {
      const prompt = `
You are Menu Intelligence for QRManager, a Bangladesh restaurant ordering product.
Suggest practical menu improvements for a restaurant owner. Keep the wording sellable, concise, and customer-facing.

Restaurant: ${restaurant.name}
Current item draft:
${JSON.stringify(menuInput)}

Existing menu context:
${JSON.stringify(
  safeMenuItems.slice(0, 40).map((menuItem) => ({
    name: menuItem.name,
    category: menuItem.category,
    price: menuItem.price,
    available: menuItem.available,
  })),
)}

Return only valid JSON:
{
  "better_name": "more attractive food name",
  "description": "one menu-ready description under 140 characters",
  "category": "best category name",
  "price_positioning": "short pricing advice in Bangla/Banglish",
  "combo_idea": "one practical combo idea"
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
        if (parsed?.better_name && parsed.description && parsed.category) {
          suggestion = {
            better_name: parsed.better_name,
            description: parsed.description,
            category: parsed.category,
            price_positioning: parsed.price_positioning || suggestion.price_positioning,
            combo_idea: parsed.combo_idea || suggestion.combo_idea,
          };
          source = "gemini";
        }
      } else {
        console.error("menu-intelligence Gemini failed:", await geminiResponse.text());
      }
    }

    await admin.from("menu_intelligence_suggestions").insert({
      restaurant_id: restaurantId,
      menu_item_id: menuInput.id || null,
      input: menuInput,
      suggestion,
      source,
      generated_by: user.id,
    });

    return json({ suggestion, source });
  } catch (error) {
    console.error("menu-intelligence error:", error);
    return json({ error: String(error) }, 500);
  }
});
