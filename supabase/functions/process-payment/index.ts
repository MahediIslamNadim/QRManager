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

const VALID_PLANS = ["medium_smart", "high_smart"] as const;
const VALID_BILLING_CYCLES = ["monthly", "yearly"] as const;

const VALID_ACTIONS: Action[] = ["approve", "reject", "update", "reopen", "delete"];

function getSafePlan(plan?: string | null): string {
  return VALID_PLANS.includes(plan as typeof VALID_PLANS[number]) ? (plan as string) : "medium_smart";
}

function getSafeBillingCycle(billingCycle?: string | null): "monthly" | "yearly" {
  return VALID_BILLING_CYCLES.includes(billingCycle as typeof VALID_BILLING_CYCLES[number])
    ? (billingCycle as "monthly" | "yearly")
    : "monthly";
}

function getExpiryDate(billingCycle?: string | null): string {
  const d = new Date();
  if (getSafeBillingCycle(billingCycle) === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

type PaymentState = {
  id?: string;
  restaurant_id: string;
  plan: string;
  billing_cycle?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  transaction_id?: string | null;
  admin_notes?: string | null;
};

async function notifyRestaurantAdmins(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  title: string,
  message: string,
  type: string,
) {
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .eq("restaurant_id", restaurantId);

  const recipientIds = new Set<string>();

  if (restaurant?.owner_id) {
    recipientIds.add(restaurant.owner_id);
  }

  for (const role of roles || []) {
    if (role.user_id) recipientIds.add(role.user_id);
  }

  if (recipientIds.size > 0) {
    await admin.from("notifications").insert(
      Array.from(recipientIds).map((userId) => ({
        user_id: userId,
        restaurant_id: restaurantId,
        title,
        message,
        type,
      })),
    );
  }
}

async function syncRestaurantSubscription(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  payment: PaymentState | null,
) {
  const now = new Date().toISOString();

  if (!payment) {
    const { error: restaurantError } = await admin
      .from("restaurants")
      .update({
        status: "inactive",
        subscription_status: "expired",
        subscription_start_date: null,
        subscription_end_date: null,
        next_billing_date: null,
        updated_at: now,
      })
      .eq("id", restaurantId);

    if (restaurantError) throw restaurantError;

    const { error: subscriptionError } = await admin
      .from("subscriptions")
      .update({ status: "expired", updated_at: now })
      .eq("restaurant_id", restaurantId)
      .eq("status", "active");

    if (subscriptionError) throw subscriptionError;

    return;
  }

  const tier = getSafePlan(payment.plan);
  const billingCycle = getSafeBillingCycle(payment.billing_cycle);
  const startDate = now;
  const endDate = getExpiryDate(billingCycle);

  const { error: deactivateError } = await admin
    .from("subscriptions")
    .update({ status: "expired", updated_at: now })
    .eq("restaurant_id", restaurantId)
    .eq("status", "active");

  if (deactivateError) throw deactivateError;

  if (payment.transaction_id) {
    const { data: existingSubscription, error: subscriptionLookupError } = await admin
      .from("subscriptions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("transaction_id", payment.transaction_id)
      .maybeSingle();

    if (subscriptionLookupError) throw subscriptionLookupError;

    const subscriptionPayload = {
      tier,
      billing_cycle: billingCycle,
      amount: Number(payment.amount ?? 0),
      payment_method: payment.payment_method ?? null,
      transaction_id: payment.transaction_id,
      notes: payment.admin_notes ?? null,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      updated_at: now,
    };

    if (existingSubscription?.id) {
      const { error: updateSubscriptionError } = await admin
        .from("subscriptions")
        .update(subscriptionPayload)
        .eq("id", existingSubscription.id);

      if (updateSubscriptionError) throw updateSubscriptionError;
    } else {
      const { error: insertSubscriptionError } = await admin
        .from("subscriptions")
        .insert({
          restaurant_id: restaurantId,
          ...subscriptionPayload,
        });

      if (insertSubscriptionError) throw insertSubscriptionError;
    }
  }

  const { error: restaurantError } = await admin
    .from("restaurants")
    .update({
      status: "active_paid",
      subscription_status: "active",
      plan: tier,
      tier,
      billing_cycle: billingCycle,
      trial_ends_at: endDate,
      trial_end_date: endDate,
      subscription_start_date: startDate,
      subscription_end_date: endDate,
      next_billing_date: endDate,
      updated_at: now,
    })
    .eq("id", restaurantId);

  if (restaurantError) throw restaurantError;
}

async function getLatestApprovedPayment(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  excludePaymentId?: string,
): Promise<PaymentState | null> {
  let query = admin
    .from("payment_requests")
    .select("id, restaurant_id, plan, billing_cycle, amount, payment_method, transaction_id, admin_notes")
    .eq("restaurant_id", restaurantId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (excludePaymentId) {
    query = query.neq("id", excludePaymentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return Array.isArray(data) && data.length > 0 ? (data[0] as PaymentState) : null;
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
    const { data: isSuperAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });
    if (roleErr || !isSuperAdmin) return json({ error: "Forbidden: super_admin only" }, 403);

    let body: RequestBody;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const { action, payment_id } = body;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, 400);
    }
    if (!payment_id) return json({ error: "payment_id is required" }, 400);

    const { data: payment, error: fetchErr } = await admin
      .from("payment_requests")
      .select("id, restaurant_id, plan, billing_cycle, amount, payment_method, transaction_id, admin_notes, status")
      .eq("id", payment_id)
      .single();
    if (fetchErr || !payment) return json({ error: "Payment request not found" }, 404);

    const now = new Date().toISOString();

    // ── APPROVE ─────────────────────────────────────────────────────────────
    if (action === "approve") {
      const plan = getSafePlan(body.plan ?? payment.plan);
      const billingCycle = getSafeBillingCycle(body.billing_cycle ?? payment.billing_cycle);
      const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : payment.amount;
      const tier = plan;

      const { error: payErr } = await admin
        .from("payment_requests")
        .update({ status: "approved", plan, billing_cycle: billingCycle, amount, admin_notes: body.admin_notes ?? null, updated_at: now })
        .eq("id", payment_id);
      if (payErr) return json({ error: "Internal server error" }, 500);

      await syncRestaurantSubscription(admin, payment.restaurant_id, {
        ...payment,
        plan,
        billing_cycle: billingCycle,
        amount,
        admin_notes: body.admin_notes ?? null,
      });

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
        const replacementPayment = await getLatestApprovedPayment(admin, payment.restaurant_id, payment_id);
        await syncRestaurantSubscription(admin, payment.restaurant_id, replacementPayment);
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
      const newPlan = getSafePlan(body.plan ?? payment.plan);
      const newBillingCycle = getSafeBillingCycle(body.billing_cycle ?? payment.billing_cycle);

      if (!["pending", "approved", "rejected"].includes(newStatus as string)) {
        return json({ error: "Invalid status value" }, 400);
      }

      const paymentUpdatePayload: Record<string, unknown> = {
        plan: newPlan,
        billing_cycle: newBillingCycle,
        status: newStatus,
        admin_notes: body.admin_notes ?? null,
        updated_at: now,
      };
      if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
        paymentUpdatePayload.amount = body.amount;
      }

      const { error: payErr } = await admin
        .from("payment_requests")
        .update(paymentUpdatePayload)
        .eq("id", payment_id);
      if (payErr) return json({ error: "Internal server error" }, 500);

      if (newStatus === "approved") {
        await syncRestaurantSubscription(admin, payment.restaurant_id, {
          ...payment,
          plan: newPlan,
          billing_cycle: newBillingCycle,
          amount: typeof body.amount === "number" ? body.amount : payment.amount,
          admin_notes: body.admin_notes ?? null,
        });
      } else if (payment.status === "approved" && newStatus !== "approved") {
        const replacementPayment = await getLatestApprovedPayment(admin, payment.restaurant_id, payment_id);
        await syncRestaurantSubscription(admin, payment.restaurant_id, replacementPayment);
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
        const replacementPayment = await getLatestApprovedPayment(admin, payment.restaurant_id, payment_id);
        await syncRestaurantSubscription(admin, payment.restaurant_id, replacementPayment);
      }
      return json({ success: true, action: "reopen" });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (action === "delete") {
      if (payment.status === "approved") {
        const replacementPayment = await getLatestApprovedPayment(admin, payment.restaurant_id, payment_id);
        await syncRestaurantSubscription(admin, payment.restaurant_id, replacementPayment);
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
