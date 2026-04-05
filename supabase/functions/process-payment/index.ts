import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * process-payment — server-side payment approval edge function
 *
 * All payment status changes and the resulting restaurant plan/status
 * updates run here under service_role, with super_admin verification.
 * This prevents a browser from directly writing to restaurants or
 * payment_requests and keeps a consistent audit trail in the logs.
 *
 * Actions:
 *   approve  — mark payment approved + activate restaurant plan
 *   reject   — mark payment rejected
 *   update   — edit plan/amount/status/notes; activates restaurant if status→approved
 *   reopen   — reset payment to pending
 *   delete   — delete payment request
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

const VALID_PLANS = ["basic", "premium", "enterprise"] as const;
const VALID_ACTIONS: Action[] = ["approve", "reject", "update", "reopen", "delete"];

function getExpiryDate(billingCycle?: string): string {
  const d = new Date();
  if (billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    // Verify the caller's JWT and resolve their user_id
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return json({ error: "Unauthorized" }, 401);

    // Confirm super_admin role via service client (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Forbidden: super_admin only" }, 403);

    // Parse and validate request body
    const body: RequestBody = await req.json();
    const { action, payment_id } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, 400);
    }
    if (!payment_id) return json({ error: "payment_id is required" }, 400);

    // Fetch the payment request (confirms it exists)
    const { data: payment, error: fetchErr } = await admin
      .from("payment_requests")
      .select("id, restaurant_id, plan, billing_cycle, status")
      .eq("id", payment_id)
      .single();

    if (fetchErr || !payment) return json({ error: "Payment request not found" }, 404);

    const now = new Date().toISOString();

    // ── APPROVE ────────────────────────────────────────────────────────────────
    if (action === "approve") {
      const plan = body.plan ?? payment.plan;
      if (!VALID_PLANS.includes(plan as typeof VALID_PLANS[number])) {
        return json({ error: "Invalid plan" }, 400);
      }

      const { error: payErr } = await admin
        .from("payment_requests")
        .update({ status: "approved", admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", payment_id);
      if (payErr) throw payErr;

      const expiryDate = getExpiryDate(body.billing_cycle ?? payment.billing_cycle);
      const { error: restErr } = await admin
        .from("restaurants")
        .update({ status: "active_paid", plan, trial_ends_at: expiryDate, updated_at: now })
        .eq("id", payment.restaurant_id);
      if (restErr) throw restErr;

      console.log(`[process-payment] APPROVE payment=${payment_id} restaurant=${payment.restaurant_id} plan=${plan} by super_admin=${caller.id}`);
      return json({ success: true, action: "approve" });
    }

    // ── REJECT ─────────────────────────────────────────────────────────────────
    if (action === "reject") {
      const { error } = await admin
        .from("payment_requests")
        .update({ status: "rejected", admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", payment_id);
      if (error) throw error;

      console.log(`[process-payment] REJECT payment=${payment_id} by super_admin=${caller.id}`);
      return json({ success: true, action: "reject" });
    }

    // ── UPDATE (edit fields freely, activate restaurant if status→approved) ────
    if (action === "update") {
      const newStatus = body.status ?? payment.status;
      const newPlan   = body.plan   ?? payment.plan;

      if (!["pending", "approved", "rejected"].includes(newStatus)) {
        return json({ error: "Invalid status value" }, 400);
      }
      if (!VALID_PLANS.includes(newPlan as typeof VALID_PLANS[number])) {
        return json({ error: "Invalid plan" }, 400);
      }

      const { error: payErr } = await admin
        .from("payment_requests")
        .update({
          plan: newPlan,
          amount: body.amount ?? undefined,
          status: newStatus,
          admin_notes: body.admin_notes ?? null,
          updated_at: now,
        })
        .eq("id", payment_id);
      if (payErr) throw payErr;

      if (newStatus === "approved") {
        const expiryDate = getExpiryDate(payment.billing_cycle);
        const { error: restErr } = await admin
          .from("restaurants")
          .update({ status: "active_paid", plan: newPlan, trial_ends_at: expiryDate, updated_at: now })
          .eq("id", payment.restaurant_id);
        if (restErr) throw restErr;
      }

      console.log(`[process-payment] UPDATE payment=${payment_id} status=${newStatus} plan=${newPlan} by super_admin=${caller.id}`);
      return json({ success: true, action: "update" });
    }

    // ── REOPEN ─────────────────────────────────────────────────────────────────
    if (action === "reopen") {
      const { error } = await admin
        .from("payment_requests")
        .update({ status: "pending", updated_at: now })
        .eq("id", payment_id);
      if (error) throw error;

      console.log(`[process-payment] REOPEN payment=${payment_id} by super_admin=${caller.id}`);
      return json({ success: true, action: "reopen" });
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { error } = await admin
        .from("payment_requests")
        .delete()
        .eq("id", payment_id);
      if (error) throw error;

      console.log(`[process-payment] DELETE payment=${payment_id} by super_admin=${caller.id}`);
      return json({ success: true, action: "delete" });
    }

    return json({ error: "Unhandled action" }, 400);
  } catch (err) {
    console.error("[process-payment] error:", err);
    return json({ error: String(err) }, 500);
  }
});
