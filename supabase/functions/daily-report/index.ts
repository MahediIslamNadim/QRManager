import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const isAuthorizedRequest = (req: Request, serviceRoleKey: string) => {
  const sharedSecret = Deno.env.get("EDGE_WEBHOOK_SECRET");
  const headerSecret = req.headers.get("x-webhook-secret");
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (sharedSecret) {
    return (
      headerSecret === sharedSecret ||
      bearerToken === sharedSecret ||
      bearerToken === serviceRoleKey
    );
  }

  return bearerToken === serviceRoleKey;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("daily-report: missing required env vars");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500 });
    }
    if (!isAuthorizedRequest(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get target restaurant_id from body (manual trigger) or process ALL active restaurants (cron)
    let targetRestaurantId: string | null = null;
    try {
      const body = await req.json();
      targetRestaurantId = body?.restaurant_id || null;
    } catch { /* no body — cron mode */ }

    // Fetch active restaurants with WhatsApp notify enabled
    const query = supabaseAdmin
      .from("restaurants")
      .select("id, name, phone, whatsapp_api_key, notify_daily_report")
      .eq("notify_daily_report", true)
      .not("whatsapp_api_key", "is", null)
      .not("phone", "is", null);

    const finalQuery = targetRestaurantId
      ? query.eq("id", targetRestaurantId)
      : query;

    const { data: restaurants, error: restError } = await finalQuery;
    if (restError) throw restError;

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const restaurant of restaurants || []) {
      try {
        // Today's date range (Bangladesh timezone = UTC+6)
        const now = new Date();
        const bdOffset = 6 * 60 * 60 * 1000;
        const bdNow = new Date(now.getTime() + bdOffset);
        const todayBD = bdNow.toISOString().split("T")[0];

        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("id, total, status")
          .eq("restaurant_id", restaurant.id)
          .gte("created_at", `${todayBD}T00:00:00+06:00`)
          .lte("created_at", `${todayBD}T23:59:59+06:00`);

        const allOrders = orders || [];
        const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);
        const totalOrders = allOrders.length;
        const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        // Top items for today
        const orderIds = allOrders.map(o => o.id);
        let topItemText = "";
        if (orderIds.length > 0) {
          const { data: items } = await supabaseAdmin
            .from("order_items")
            .select("name, quantity")
            .in("order_id", orderIds);

          const itemMap: Record<string, number> = {};
          (items || []).forEach(i => {
            itemMap[i.name] = (itemMap[i.name] || 0) + i.quantity;
          });
          const topItems = Object.entries(itemMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          topItemText = topItems.map(([name, qty]) => `${name} (${qty})`).join(", ");
        }

        // Build WhatsApp message
        const bdDate = bdNow.toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });
        const message = encodeURIComponent(
          `📊 দৈনিক রিপোর্ট — ${restaurant.name}\n` +
          `তারিখ: ${bdDate}\n` +
          `━━━━━━━━━━━━━━\n` +
          `🛒 মোট অর্ডার: ${totalOrders}টি\n` +
          `💰 মোট আয়: ৳${totalRevenue}\n` +
          `📈 গড় অর্ডার: ৳${avgOrder}\n` +
          (topItemText ? `🍽️ সেরা আইটেম: ${topItemText}\n` : "") +
          `━━━━━━━━━━━━━━\n` +
          `🔧 পরিচালিত: QRManager`
        );

        // Normalize phone
        let phone = restaurant.phone.replace(/\D/g, "");
        if (phone.startsWith("0")) phone = "88" + phone;
        if (!phone.startsWith("880")) phone = "88" + phone;

        const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=+${phone}&text=${message}&apikey=${restaurant.whatsapp_api_key}`;
        const res = await fetch(callMeBotUrl);

        results.push({ id: restaurant.id, success: res.ok });
      } catch (err) {
        results.push({ id: restaurant.id, success: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("daily-report error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
