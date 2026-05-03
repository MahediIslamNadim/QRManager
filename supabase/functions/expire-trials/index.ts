import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("EDGE_WEBHOOK_SECRET");
  const bearerToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const headerSecret = req.headers.get("x-webhook-secret");

  if (!cronSecret || (bearerToken !== cronSecret && headerSecret !== cronSecret)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date().toISOString();

    // Find all restaurants whose trial has ended and are not on active paid plan
    const { data: expired, error: fetchErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, trial_ends_at, status, subscription_status")
      .lt("trial_ends_at", now)
      .not("status", "in", '("active_paid","inactive")')
      .not("subscription_status", "in", '("active","expired","cancelled")');

    if (fetchErr) throw fetchErr;
    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ expired: 0, message: "No trials to expire" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = expired.map((r: { id: string }) => r.id);

    const { error: updateErr } = await supabaseAdmin
      .from("restaurants")
      .update({ status: "inactive", subscription_status: "expired" })
      .in("id", ids);

    if (updateErr) throw updateErr;

    // Send expiry notifications to restaurant admins
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, restaurant_id")
      .eq("role", "admin")
      .in("restaurant_id", ids);

    if (adminRoles && adminRoles.length > 0) {
      const notifications = adminRoles.map((r: { user_id: string; restaurant_id: string }) => ({
        user_id: r.user_id,
        restaurant_id: r.restaurant_id,
        title: "ট্রায়াল শেষ হয়েছে",
        message: "আপনার ফ্রি ট্রায়াল মেয়াদ শেষ হয়েছে। সেবা চালু রাখতে একটি প্ল্যান কিনুন।",
        type: "warning",
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    console.log(`expire-trials: marked ${ids.length} restaurant(s) expired`, ids);

    return new Response(
      JSON.stringify({ expired: ids.length, ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("expire-trials error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
