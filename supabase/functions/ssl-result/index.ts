import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ssl-result — handles SSLCommerz POST redirect after payment attempt.
 *
 * SSLCommerz POSTs form data to success_url / fail_url / cancel_url.
 * This function validates the payment for success, updates ssl_transactions,
 * activates the subscription if valid, then redirects to the React app.
 */

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://qrmanager.app";

async function validateWithSSL(
  valId: string,
  storeId: string,
  storePass: string,
  isSandbox: boolean,
): Promise<Record<string, string>> {
  const validationUrl = isSandbox
    ? `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php`
    : `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php`;

  const res = await fetch(
    `${validationUrl}?val_id=${valId}&store_id=${storeId}&store_passwd=${storePass}&format=json`,
  );
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
  const tier = txn.plan;
  const now = new Date().toISOString();

  const { error: restaurantUpdateError } = await admin.from("restaurants").update({
    status: "active_paid",
    subscription_status: "active",
    plan: txn.plan,
    tier,
    billing_cycle: txn.billing_cycle,
    trial_ends_at: expiryDate,
    trial_end_date: expiryDate,
    subscription_start_date: now,
    subscription_end_date: expiryDate,
    next_billing_date: expiryDate,
    updated_at: now,
  }).eq("id", txn.restaurant_id);
  if (restaurantUpdateError) throw restaurantUpdateError;

  // Notify restaurant admins
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
        title: "পেমেন্ট সফল হয়েছে!",
        message: `${tier} প্ল্যান সক্রিয় হয়েছে।`,
        type: "success",
      })),
    );
  }
}

Deno.serve(async (req) => {
  const statusParam = new URL(req.url).searchParams.get("status") ?? "failed";

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse POSTed form data from SSLCommerz
    let formData: URLSearchParams;
    try {
      const text = await req.text();
      formData = new URLSearchParams(text);
    } catch {
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&reason=parse_error`);
    }

    const tran_id    = formData.get("tran_id") ?? "";
    const val_id     = formData.get("val_id") ?? "";
    const amount     = parseFloat(formData.get("amount") ?? "0");
    const bank_tran_id = formData.get("bank_tran_id") ?? "";
    const card_type  = formData.get("card_type") ?? "";
    const store_amount = parseFloat(formData.get("store_amount") ?? "0");

    if (!tran_id) {
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&reason=no_tran_id`);
    }

    // Fetch our stored transaction
    const { data: txn, error: txnErr } = await admin
      .from("ssl_transactions")
      .select("*")
      .eq("tran_id", tran_id)
      .single();

    if (txnErr || !txn) {
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&reason=txn_not_found`);
    }

    // If already validated/processed, just redirect appropriately
    if (txn.status === "validated" || txn.status === "success") {
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=success&tran_id=${tran_id}`);
    }

    if (statusParam === "cancelled") {
      await admin.from("ssl_transactions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("tran_id", tran_id);
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=cancelled&tran_id=${tran_id}`);
    }

    if (statusParam === "failed") {
      await admin.from("ssl_transactions").update({ status: "failed", updated_at: new Date().toISOString() }).eq("tran_id", tran_id);
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&tran_id=${tran_id}`);
    }

    // statusParam === "success" — validate with SSLCommerz
    const storeId   = Deno.env.get("SSL_STORE_ID")!;
    const storePass = Deno.env.get("SSL_STORE_PASSWORD")!;
    const isSandbox = Deno.env.get("SSL_SANDBOX") !== "false";

    if (!val_id) {
      await admin.from("ssl_transactions").update({ status: "invalid", updated_at: new Date().toISOString() }).eq("tran_id", tran_id);
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&reason=no_val_id`);
    }

    const validation = await validateWithSSL(val_id, storeId, storePass, isSandbox);
    const sslStatus  = validation.status;
    const isValid    = (sslStatus === "VALID" || sslStatus === "VALIDATED") &&
                       Math.abs(parseFloat(validation.amount ?? "0") - txn.amount) < 1;

    if (!isValid) {
      await admin.from("ssl_transactions").update({
        status: "invalid",
        val_id,
        ssl_status: sslStatus,
        error_message: `Amount mismatch or invalid. SSL: ${validation.amount}, Expected: ${txn.amount}`,
        updated_at: new Date().toISOString(),
      }).eq("tran_id", tran_id);
      return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&reason=validation_failed`);
    }

    // Valid payment — update transaction and activate subscription
    await admin.from("ssl_transactions").update({
      status: "validated",
      val_id,
      bank_tran_id,
      card_type,
      store_amount,
      ssl_status: sslStatus,
      updated_at: new Date().toISOString(),
    }).eq("tran_id", tran_id);

    await activateSubscription(admin, txn);

    return Response.redirect(`${APP_BASE_URL}/payment/result?status=success&tran_id=${tran_id}`);
  } catch (err) {
    console.error("ssl-result error:", err);
    return Response.redirect(`${APP_BASE_URL}/payment/result?status=failed&reason=server_error`);
  }
});
