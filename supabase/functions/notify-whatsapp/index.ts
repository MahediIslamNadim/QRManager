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
      console.error("notify-whatsapp: missing required env vars");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500 });
    }
    if (!isAuthorizedRequest(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase Database Webhook payload format
    const record = (payload as any)?.record;
    if (!record) {
      return new Response(JSON.stringify({ error: "no record" }), { status: 400 });
    }

    const restaurantId: string = record.restaurant_id;
    const orderId: string = record.id;
    const total: number = record.total;

    // Create admin supabase client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch restaurant phone + whatsapp_api_key + notify setting
    const { data: restaurant, error: restError } = await supabaseAdmin
      .from("restaurants")
      .select("name, phone, whatsapp_api_key, notify_new_order")
      .eq("id", restaurantId)
      .single();

    if (restError || !restaurant) {
      return new Response(JSON.stringify({ error: "restaurant not found" }), { status: 404 });
    }

    // Skip if notifications are disabled or not configured
    if (!restaurant.notify_new_order || !restaurant.whatsapp_api_key || !restaurant.phone) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    // Fetch table name
    const { data: orderRow } = await supabaseAdmin
      .from("orders")
      .select("restaurant_tables(name)")
      .eq("id", orderId)
      .single();

    const tableName = (orderRow as any)?.restaurant_tables?.name || "N/A";

    // Build WhatsApp message
    const message = encodeURIComponent(
      `🍽️ নতুন অর্ডার!\n` +
      `রেস্টুরেন্ট: ${restaurant.name}\n` +
      `টেবিল: ${tableName}\n` +
      `মোট: ৳${total}\n` +
      `অর্ডার ID: #${orderId.slice(0, 6).toUpperCase()}\n` +
      `⏰ ${new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}`
    );

    // Normalize phone number (remove leading 0, add country code)
    let phone = restaurant.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "88" + phone;
    if (!phone.startsWith("880")) phone = "88" + phone;

    const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=+${phone}&text=${message}&apikey=${restaurant.whatsapp_api_key}`;

    const response = await fetch(callMeBotUrl);
    const text = await response.text();

    return new Response(
      JSON.stringify({ success: true, status: response.status, body: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-whatsapp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
