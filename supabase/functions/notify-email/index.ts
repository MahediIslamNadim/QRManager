import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500 });
    }
    if (!resendApiKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }), { status: 200 });
    }

    let payload: unknown;
    try { payload = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const record = (payload as any)?.record;
    if (!record) return new Response(JSON.stringify({ error: "no record" }), { status: 400 });

    const restaurantId: string = record.restaurant_id;
    const orderId: string = record.id;
    const total: number = record.total;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("name, notification_email, notify_email")
      .eq("id", restaurantId)
      .single();

    if (!restaurant?.notify_email || !restaurant?.notification_email) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { data: orderRow } = await supabaseAdmin
      .from("orders")
      .select("restaurant_tables(name), order_items(name, quantity, price)")
      .eq("id", orderId)
      .single();

    const tableName = (orderRow as any)?.restaurant_tables?.name || "N/A";
    const items = ((orderRow as any)?.order_items || []) as { name: string; quantity: number; price: number }[];
    const itemRows = items.map(i => `<tr><td style="padding:4px 8px">${i.name}</td><td style="padding:4px 8px;text-align:right">${i.quantity}x</td><td style="padding:4px 8px;text-align:right">৳${i.price * i.quantity}</td></tr>`).join("");
    const time = new Date().toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#f97316;padding:20px 24px">
    <h2 style="margin:0;color:#fff;font-size:20px">🍽️ নতুন অর্ডার!</h2>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">${restaurant.name}</p>
  </div>
  <div style="padding:20px 24px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#666;font-size:13px">অর্ডার ID</td><td style="padding:6px 0;font-weight:700;text-align:right">#${orderId.slice(0,8).toUpperCase()}</td></tr>
      <tr><td style="padding:6px 0;color:#666;font-size:13px">টেবিল</td><td style="padding:6px 0;font-weight:700;text-align:right">${tableName}</td></tr>
      <tr><td style="padding:6px 0;color:#666;font-size:13px">সময়</td><td style="padding:6px 0;text-align:right">${time}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;margin-bottom:16px">
      <thead><tr style="background:#f9f9f9"><th style="padding:8px;text-align:left;font-size:12px;color:#666">আইটেম</th><th style="padding:8px;font-size:12px;color:#666">পরিমাণ</th><th style="padding:8px;font-size:12px;color:#666">মূল্য</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;text-align:center">
      <span style="font-size:22px;font-weight:800;color:#f97316">৳${total}</span>
      <span style="font-size:13px;color:#c2410c;display:block;margin-top:2px">মোট</span>
    </div>
  </div>
  <div style="padding:12px 24px;background:#f9f9f9;text-align:center;font-size:11px;color:#999">QRManager · qrmanager.app</div>
</div></body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "QRManager <noreply@qrmanager.app>",
        to: [restaurant.notification_email],
        subject: `🍽️ নতুন অর্ডার — ${restaurant.name} — ৳${total}`,
        html,
      }),
    });

    const resendData = await resendRes.json();
    return new Response(
      JSON.stringify({ success: resendRes.ok, status: resendRes.status, data: resendData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
