import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ssl-result — browser redirect handler after SSLCommerz payment attempts.
 *
 * This endpoint is intentionally not authoritative for subscription activation.
 * SSLCommerz IPN is the server-to-server source of truth. The redirect only
 * reflects the current transaction state back to the React status page.
 */

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://qrmanager.app";

const redirect = (status: string, params: Record<string, string> = {}) => {
  const url = new URL("/payment/result", APP_BASE_URL);
  url.searchParams.set("status", status);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return Response.redirect(url.toString());
};

Deno.serve(async (req) => {
  const requestUrl = new URL(req.url);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let formData: URLSearchParams;
    try {
      formData = req.method === "GET"
        ? requestUrl.searchParams
        : new URLSearchParams(await req.text());
    } catch {
      return redirect("failed", { reason: "parse_error" });
    }

    const tran_id = formData.get("tran_id") ?? "";
    if (!tran_id) return redirect("failed", { reason: "no_tran_id" });
    const sslStatus = (formData.get("status") ?? requestUrl.searchParams.get("status") ?? "").toUpperCase();

    const { data: txn, error: txnErr } = await admin
      .from("ssl_transactions")
      .select("status")
      .eq("tran_id", tran_id)
      .maybeSingle();

    if (txnErr || !txn) return redirect("failed", { reason: "txn_not_found" });

    if (txn.status === "validated" || txn.status === "success") {
      return redirect("success", { tran_id });
    }

    if (txn.status === "failed" || txn.status === "invalid") {
      return redirect("failed", { tran_id });
    }

    if (txn.status === "cancelled") {
      return redirect("cancelled", { tran_id });
    }

    if (sslStatus === "CANCELLED" || sslStatus === "CANCEL") {
      return redirect("cancelled", { tran_id });
    }

    if (sslStatus === "FAILED" || sslStatus === "FAIL") {
      return redirect("failed", { tran_id });
    }

    return redirect("pending", { tran_id });
  } catch (err) {
    console.error("ssl-result error:", err);
    return redirect("failed", { reason: "server_error" });
  }
});
