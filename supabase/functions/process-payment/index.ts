import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const VALID_PLANS = [
  "basic",
  "premium",
  "enterprise",
  "medium_smart",
  "high_smart",
  "high_smart_enterprise",
] as const;

const VALID_ACTIONS: Action[] = ["approve", "reject", "update", "reopen", "delete"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getExpiryDate(billingCycle?: string) {
  const date = new Date();
  if (billingCycle === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function resolveTier(plan: string) {
  if (plan === "high_smart_enterprise") return "high_smart_enterprise";
  if (plan === "high_smart") return "high_smart";
  return "medium_smart";
}

async function hasOtherApprovedPayment(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  excludePaymentId: string,
) {
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

  if (!roles?.length) return;

  await admin.from("notifications").insert(
    roles.map((role: { user_id: string }) => ({
      user_id: role.user_id,
      restaurant_id: restaurantId,
      title,
      message,
      type,
    })),
  );
}

async function bootstrapEnterpriseIfNeeded(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  plan: string,
) {
  if (plan !== "high_smart_enterprise") return;

  const { error } = await admin.rpc("ensure_enterprise_group", {
    p_restaurant_id: restaurantId,
    p_group_name: null,
  });

  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !caller) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Forbidden: super_admin only" }, 403);

    const body = await req.json().catch(() => null) as RequestBody | null;
    if (!body?.action || !VALID_ACTIONS.includes(body.action)) {
      return json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, 400);
    }
    if (!body.payment_id) return json({ error: "payment_id is required" }, 400);

    const { data: payment, error: paymentError } = await admin
      .from("payment_requests")
      .select("id, restaurant_id, plan, billing_cycle, status, user_id")
      .eq("id", body.payment_id)
      .single();

    if (paymentError || !payment) return json({ error: "Payment request not found" }, 404);

    const now = new Date().toISOString();

    if (body.action === "approve") {
      const plan = body.plan ?? payment.plan;
      if (!VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number])) {
        return json({ error: `Invalid plan: ${plan}` }, 400);
      }

      const expiryDate = getExpiryDate(body.billing_cycle ?? payment.billing_cycle);
      const tier = resolveTier(plan);

      const { error: paymentUpdateError } = await admin
        .from("payment_requests")
        .update({ status: "approved", admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", body.payment_id);

      if (paymentUpdateError) return json({ error: paymentUpdateError.message }, 500);

      const { error: restaurantUpdateError } = await admin
        .from("restaurants")
        .update({
          status: "active_paid",
          subscription_status: "active",
          plan,
          tier,
          trial_ends_at: expiryDate,
          trial_end_date: expiryDate,
          subscription_end_date: expiryDate,
          updated_at: now,
        })
        .eq("id", payment.restaurant_id);

      if (restaurantUpdateError) return json({ error: restaurantUpdateError.message }, 500);

      await bootstrapEnterpriseIfNeeded(admin, payment.restaurant_id, plan);

      await notifyRestaurantAdmins(
        admin,
        payment.restaurant_id,
        "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦…à¦¨à§à¦®à§‹à¦¦à¦¿à¦¤ à¦¹à¦¯à¦¼à§‡à¦›à§‡",
        "Your subscription is now active.",
        "success",
      );

      return json({ success: true, action: "approve", tier });
    }

    if (body.action === "reject") {
      const { error } = await admin
        .from("payment_requests")
        .update({ status: "rejected", admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", body.payment_id);

      if (error) return json({ error: error.message }, 500);

      if (payment.status === "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, body.payment_id);
        if (!otherApproved) {
          await admin
            .from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }

      await notifyRestaurantAdmins(
        admin,
        payment.restaurant_id,
        "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦ªà§à¦°à¦¤à§à¦¯à¦¾à¦–à§à¦¯à¦¾à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡",
        "Your payment request was rejected.",
        "error",
      );

      return json({ success: true, action: "reject" });
    }

    if (body.action === "update") {
      const nextStatus = body.status ?? payment.status;
      const nextPlan = body.plan ?? payment.plan;

      if (!["pending", "approved", "rejected"].includes(nextStatus)) {
        return json({ error: "Invalid status value" }, 400);
      }
      if (!VALID_PLANS.includes(nextPlan as (typeof VALID_PLANS)[number])) {
        return json({ error: `Invalid plan: ${nextPlan}` }, 400);
      }

      const { error: paymentUpdateError } = await admin
        .from("payment_requests")
        .update({
          plan: nextPlan,
          amount: body.amount,
          status: nextStatus,
          admin_notes: body.admin_notes ?? null,
          updated_at: now,
        })
        .eq("id", body.payment_id);

      if (paymentUpdateError) return json({ error: paymentUpdateError.message }, 500);

      if (nextStatus === "approved") {
        const expiryDate = getExpiryDate(payment.billing_cycle);
        const tier = resolveTier(nextPlan);

        await admin
          .from("restaurants")
          .update({
            status: "active_paid",
            subscription_status: "active",
            plan: nextPlan,
            tier,
            trial_ends_at: expiryDate,
            trial_end_date: expiryDate,
            subscription_end_date: expiryDate,
            updated_at: now,
          })
          .eq("id", payment.restaurant_id);

        await bootstrapEnterpriseIfNeeded(admin, payment.restaurant_id, nextPlan);
      } else if (payment.status === "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, body.payment_id);
        if (!otherApproved) {
          await admin
            .from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }

      return json({ success: true, action: "update" });
    }

    if (body.action === "reopen") {
      const { error } = await admin
        .from("payment_requests")
        .update({ status: "pending", updated_at: now })
        .eq("id", body.payment_id);

      if (error) return json({ error: error.message }, 500);

      if (payment.status === "approved") {
        const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, body.payment_id);
        if (!otherApproved) {
          await admin
            .from("restaurants")
            .update({ status: "inactive", subscription_status: "expired", updated_at: now })
            .eq("id", payment.restaurant_id);
        }
      }

      return json({ success: true, action: "reopen" });
    }

    if (payment.status === "approved") {
      const otherApproved = await hasOtherApprovedPayment(admin, payment.restaurant_id, body.payment_id);
      if (!otherApproved) {
        await admin
          .from("restaurants")
          .update({ status: "inactive", subscription_status: "expired", updated_at: now })
          .eq("id", payment.restaurant_id);
      }
    }

    const { error: deleteError } = await admin
      .from("payment_requests")
      .delete()
      .eq("id", body.payment_id);

    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ success: true, action: "delete" });
  } catch (error) {
    console.error("[process-payment]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
