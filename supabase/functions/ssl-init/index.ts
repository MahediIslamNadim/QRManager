import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ssl-init — initiates an SSLCommerz payment session.
 *
 * Called from UpgradePage when user clicks "Pay with SSLCommerz".
 * Returns the SSLCommerz gateway URL to redirect the user to.
 *
 * Body: { restaurant_id, plan, billing_cycle }
 * Response: { gateway_url, tran_id }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_PLANS = ["medium_smart", "high_smart"] as const;
const VALID_BILLING = ["monthly", "yearly"] as const;

const PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  medium_smart: { monthly: 999, yearly: 9590 },
  high_smart:   { monthly: 1999, yearly: 19190 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    let body: { restaurant_id?: string; plan?: string; billing_cycle?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { restaurant_id, plan, billing_cycle } = body;
    if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);
    if (!plan || !VALID_PLANS.includes(plan as typeof VALID_PLANS[number])) {
      return json({ error: "Invalid plan. Use medium_smart or high_smart" }, 400);
    }
    if (!billing_cycle || !VALID_BILLING.includes(billing_cycle as typeof VALID_BILLING[number])) {
      return json({ error: "Invalid billing_cycle. Use monthly or yearly" }, 400);
    }

    // Verify the caller owns this restaurant
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name, owner_id, phone")
      .eq("id", restaurant_id)
      .single();
    if (!restaurant) return json({ error: "Restaurant not found" }, 404);
    if (restaurant.owner_id !== user.id) return json({ error: "Permission denied" }, 403);

    // Get user profile for customer info
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle();

    const amount = PLAN_AMOUNTS[plan][billing_cycle];
    const tran_id = `SSL_${restaurant_id.replace(/-/g, "").slice(0, 8)}_${Date.now()}`;

    // SSL credentials from env
    const storeId   = Deno.env.get("SSL_STORE_ID")!;
    const storePass = Deno.env.get("SSL_STORE_PASSWORD")!;
    const isSandbox = Deno.env.get("SSL_SANDBOX") !== "false";

    const sslInitUrl = isSandbox
      ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
      : "https://securepay.sslcommerz.com/gwprocess/v4/api.php";

    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://qrmanager.app";
    const fnBaseUrl  = `${supabaseUrl}/functions/v1`;

    const formData = new URLSearchParams({
      store_id:         storeId,
      store_passwd:     storePass,
      total_amount:     amount.toString(),
      currency:         "BDT",
      tran_id,
      success_url:      `${fnBaseUrl}/ssl-result?status=success`,
      fail_url:         `${fnBaseUrl}/ssl-result?status=failed`,
      cancel_url:       `${fnBaseUrl}/ssl-result?status=cancelled`,
      ipn_url:          `${fnBaseUrl}/ssl-ipn`,
      product_name:     `QR Manager ${plan} (${billing_cycle})`,
      product_category: "SaaS",
      product_profile:  "non-physical-goods",
      shipping_method:  "NO",
      num_of_item:      "1",
      cus_name:  profile?.full_name  ?? restaurant.name,
      cus_email: profile?.email      ?? user.email ?? "customer@qrmanager.app",
      cus_phone: profile?.phone      ?? restaurant.phone ?? "01700000000",
      cus_add1:  "Bangladesh",
      cus_city:  "Dhaka",
      cus_country: "Bangladesh",
    });

    const sslRes = await fetch(sslInitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    const sslData = await sslRes.json();

    if (sslData.status !== "SUCCESS") {
      console.error("SSLCommerz init failed:", sslData);
      return json({ error: sslData.failedreason ?? "SSLCommerz initialization failed" }, 502);
    }

    // Store pending transaction
    await admin.from("ssl_transactions").insert({
      restaurant_id,
      user_id: user.id,
      plan,
      billing_cycle,
      amount,
      tran_id,
      status: "pending",
    });

    return json({ gateway_url: sslData.GatewayPageURL, tran_id });
  } catch (err) {
    console.error("ssl-init error:", err);
    return json({ error: String(err) }, 500);
  }
});
