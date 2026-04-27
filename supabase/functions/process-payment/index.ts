import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * process-payment — super_admin approves/rejects/edits manual bKash/Nagad payments.
 * Actions: approve | reject | update | reopen | delete
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "approve" | "reject" | "update" | "reopen" | "delete";

interface RequestBody {
  action: Action;
  payment_id: string;
  plan?: string;
  amount?: number;
  admin_notes?: string;
  billing_cycle?: string;
  status?: string;
}

const VALID_PLANS = ["basic", "premium", "enterprise", "medium_smart", "high_smart"] as const;
const VALID_ACTIONS: Action[] = ["approve", "reject", "update", "reopen", "delete"];

function getExpiryDate(billingCycle?: string): string {
  const d = new Date();
  if (billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

async function hasOtherApprovedPayment(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  excludePaymentId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("payment_requests")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "approved")
    .neq("id", excludePaymentId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function notifyRestaurantAdmins(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  title: string,
  message: string,
  type: string,
) {
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .eq("restaurant_id", restaurantId);

  if (roles && roles.length > 0) {
    await admin.from("notifications").insert(
      roles.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        restaurant_id: restaurantId,
        title,
        message,
        type,
      })),
    );
  }
}

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
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: super_admin only" }, 403);

    let body: RequestBody;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const { action, payment_id } = body;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, 400);
    }
    if (!payment_id) return json({ error: "payment_id is required" }, 400);

    const { data: payment, error: fetchErr } = await admin
      .from("payment_requests")
      .select("id, restaurant_id, plan, billing_cycle, status")
      .eq("id", payment_id)
      .single();
    if (fetchErr || !payment) return json({ error: "Payment request not found" }, 404);

    const now = new Date().toISOString();

    // ── APPROVE ─────────────────────────────────────────────────────────────
    if (action === "approve") {
      const plan = body.plan ?? payment.plan;
      if (!VALID_PLANS.includes(plan as typeof VALID_PLANS[number])) {
        return json({ error: "Invalid plan" }, 400);
      }
      const expiryDate = getExpiryDate(body.billing_cycle ?? payment.billing_cycle);
      const tier = ["medium_smart", "high_smart"].includes(plan) ? plan : "medium_smart";

      const { error: payErr } = await admin
        .from("payment_requests")
        .update({ status: "approved", admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", payment_id);
      if (payErr) return json({ error: "Internal server error" }, 500);

      const { error: restErr } = await admin
        .from("restaurants")
        .update({
          status: "active_paid",
          subscription_status: "active",
          plan,
          tier,
          trial_ends_at: expiryDate,
          trial_end_date: expiryDate,
          updated_at: now,
        })
        .eq("id", payment.restaurant_id);
      if (restErr) return json({ error: "Internal server error" }, 500);

      await notifyRestaurantAdmins(
        admin, payment.restaurant_id,
        "পেমেন্ট অনুমোদিত হয়েছে",
        `আপনার ${tier} প্ল্যান সক্রিয় হয়েছে।`,
        "success",
      );

      console.log(`[process-payment] APPROVE payment=${payment_id} plan=${plan}`);
      return json({ success: true, action: "approve" });
    }

    // ── REJECT ──────────────────────────────────────────────────────────────
    if (action === "reject") {
      const { error } = await admin
        .from("payment_requests")
        .update({ status: "rejected", admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", payment_id);
      if (error) return json({ error: "Internal server error" }, 500);

      if (payment.status === "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, payment_id);
        if (!otherApproved) {
          await admin.from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }

      await notifyRestaurantAdmins(
        admin, payment.restaurant_id,
        "পেমেন্ট প্রত্যাখ্যান হয়েছে",
        "আপনার পেমেন্ট রিকোয়েস্ট প্রত্যাখ্যান হয়েছে। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
        "error",
      );

      return json({ success: true, action: "reject" });
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (action === "update") {
      const newStatus = body.status ?? payment.status;
      const newPlan   = body.plan   ?? payment.plan;

      if (!["pending", "approved", "rejected"].includes(newStatus as string)) {
        return json({ error: "Invalid status value" }, 400);
      }
      if (!VALID_PLANS.includes(newPlan as typeof VALID_PLANS[number])) {
        return json({ error: "Invalid plan" }, 400);
      }

      const { error: payErr } = await admin
        .from("payment_requests")
        .update({ plan: newPlan, amount: body.amount, status: newStatus, admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", payment_id);
      if (payErr) return json({ error: "Internal server error" }, 500);

      if (newStatus === "approved") {
        const expiryDate = getExpiryDate(payment.billing_cycle);
        const tier = ["medium_smart", "high_smart"].includes(newPlan) ? newPlan : "medium_smart";
        await admin.from("restaurants")
          .update({ status: "active_paid", subscription_status: "active", plan: newPlan, tier, trial_ends_at: expiryDate, trial_end_date: expiryDate, updated_at: now })
          .eq("id", payment.restaurant_id);
      } else if (payment.status === "approved" && newStatus !== "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, payment_id);
        if (!otherApproved) {
          await admin.from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }

      return json({ success: true, action: "update" });
    }

    // ── REOPEN ──────────────────────────────────────────────────────────────
    if (action === "reopen") {
      const { error } = await admin
        .from("payment_requests")
        .update({ status: "pending", updated_at: now })
        .eq("id", payment_id);
      if (error) return json({ error: "Internal server error" }, 500);

      if (payment.status === "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, payment_id);
        if (!otherApproved) {
          await admin.from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }
      return json({ success: true, action: "reopen" });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (action === "delete") {
      if (payment.status === "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, payment_id);
        if (!otherApproved) {
          await admin.from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }
      const { error } = await admin.from("payment_requests").delete().eq("id", payment_id);
      if (error) return json({ error: "Internal server error" }, 500);
      return json({ success: true, action: "delete" });
    }

    return json({ error: "Unhandled action" }, 400);
  } catch (err) {
    console.error("[process-payment] error:", err);
    return json({ error: String(err) }, 500);
  }
});
