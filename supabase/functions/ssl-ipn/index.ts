import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ssl-ipn — Instant Payment Notification handler for SSLCommerz.
 *
 * SSLCommerz POSTs this server-to-server after payment, regardless of
 * whether the user's browser redirect succeeded. This is the authoritative
 * source for activating subscriptions.
 *
 * Always respond 200 to SSLCommerz — errors are logged but not retried.
 */

async function validateWithSSL(
  valId: string,
  storeId: string,
  storePass: string,
  isSandbox: boolean,
): Promise<Record<string, string>> {
  const baseUrl = isSandbox
    ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
    : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";
  const res = await fetch(`${baseUrl}?val_id=${valId}&store_id=${storeId}&store_passwd=${storePass}&format=json`);
  return res.json();
}

async function activateSubscription(
  admin: ReturnType<typeof createClient>,
  txn: { restaurant_id: string; plan: string; billing_cycle: string },
) {
  const d = new Date();
  if (txn.billing_cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  const expiryDate = d.toISOString();
  const now = new Date().toISOString();

  await admin.from("restaurants").update({
    status: "active_paid",
    subscription_status: "active",
    plan: txn.plan,
    tier: txn.plan,
    trial_ends_at: expiryDate,
    trial_end_date: expiryDate,
    updated_at: now,
  }).eq("id", txn.restaurant_id);

  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .eq("restaurant_id", txn.restaurant_id);

  if (roles && roles.length > 0) {
    await admin.from("notifications").insert(
      roles.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        restaurant_id: txn.restaurant_id,
        title: "পেমেন্ট নিশ্চিত হয়েছে",
        message: `${txn.plan} প্ল্যান সফলভাবে সক্রিয় হয়েছে।`,
        type: "success",
      })),
    );
  }
}

Deno.serve(async (req) => {
  // Always return 200 to SSLCommerz — they may retry on non-200
  const ok = new Response("OK", { status: 200 });

  try {
    if (req.method !== "POST") return ok;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const text = await req.text();
    const form = new URLSearchParams(text);

    const tran_id      = form.get("tran_id") ?? "";
    const val_id       = form.get("val_id") ?? "";
    const status       = form.get("status") ?? "";
    const bank_tran_id = form.get("bank_tran_id") ?? "";
    const card_type    = form.get("card_type") ?? "";
    const store_amount = parseFloat(form.get("store_amount") ?? "0");

    if (!tran_id || !val_id) {
      console.warn("ssl-ipn: missing tran_id or val_id");
      return ok;
    }

    const { data: txn } = await admin
      .from("ssl_transactions")
      .select("*")
      .eq("tran_id", tran_id)
      .single();

    if (!txn) {
      console.warn(`ssl-ipn: transaction not found for tran_id=${tran_id}`);
      return ok;
    }

    // If already validated/success, skip — SSLCommerz retries IPN multiple times
    if (txn.status === "validated" || txn.status === "success" || txn.status === "invalid") {
      console.log(`ssl-ipn: already processed tran_id=${tran_id} status=${txn.status}`);
      return ok;
    }

    if (status !== "VALID" && status !== "VALIDATED") {
      await admin.from("ssl_transactions")
        .update({ status: "failed", ssl_status: status, updated_at: new Date().toISOString() })
        .eq("tran_id", tran_id);
      return ok;
    }

    const storeId   = Deno.env.get("SSL_STORE_ID")!;
    const storePass = Deno.env.get("SSL_STORE_PASSWORD")!;
    const isSandbox = Deno.env.get("SSL_SANDBOX") !== "false";

    const validation = await validateWithSSL(val_id, storeId, storePass, isSandbox);
    const sslStatus  = validation.status;
    const isValid    = (sslStatus === "VALID" || sslStatus === "VALIDATED") &&
                       Math.abs(parseFloat(validation.amount ?? "0") - txn.amount) < 1;

    if (!isValid) {
      await admin.from("ssl_transactions").update({
        status: "invalid",
        val_id, ssl_status: sslStatus,
        error_message: `IPN validation failed. SSL: ${validation.amount}, Expected: ${txn.amount}`,
        updated_at: new Date().toISOString(),
      }).eq("tran_id", tran_id);
      return ok;
    }

    const { data: claimRows, error: claimError } = await admin
      .from("ssl_transactions")
      .update({
        status: "validated",
        val_id,
        bank_tran_id,
        card_type,
        store_amount,
        ssl_status: sslStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("tran_id", tran_id)
      .eq("status", "pending")
      .select("restaurant_id, plan, billing_cycle");

    if (claimError) {
      console.error("ssl-ipn: failed to claim transaction:", claimError.message);
      return ok;
    }

    const claimedTxn = claimRows?.[0];
    if (!claimedTxn) {
      console.log(`ssl-ipn: transaction already processed or not pending tran_id=${tran_id}`);
      return ok;
    }

    await activateSubscription(admin, claimedTxn);
    console.log(`ssl-ipn: activated subscription for restaurant=${claimedTxn.restaurant_id}`);
  } catch (err) {
    console.error("ssl-ipn error:", err);
  }

  return ok;
});
