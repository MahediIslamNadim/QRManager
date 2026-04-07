import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * activate-trial — grants a FREE_TRIAL_DAYS trial to a restaurant that has
 * become inactive (expired). Enforces a one-reactivation-per-restaurant rule
 * by checking whether the restaurant has already received a reactivation
 * (trial_ends_at would be > created_at + FREE_TRIAL_DAYS + a grace buffer).
 *
 * Called from TrialExpired.tsx when the user clicks "ট্রায়াল শুরু করুন".
 */

const FREE_TRIAL_DAYS = 14;
const GRACE_DAYS = 2; // allows for slight clock drift on the original grant

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Verify caller identity via their JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Parse body
    let body: { restaurant_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { restaurant_id } = body;
    if (!restaurant_id || typeof restaurant_id !== "string") {
      return json({ error: "restaurant_id is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller owns this restaurant (or is super_admin)
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some((r: { role: string }) => r.role === "super_admin");
    const isAdmin = isSuperAdmin || roles?.some((r: { role: string }) => r.role === "admin");

    if (!isAdmin) return json({ error: "Permission denied" }, 403);

    // Load the restaurant
    const { data: restaurant, error: fetchErr } = await adminClient
      .from("restaurants")
      .select("id, owner_id, status, trial_ends_at, created_at")
      .eq("id", restaurant_id)
      .single();

    if (fetchErr || !restaurant) return json({ error: "Restaurant not found" }, 404);

    // Non-super-admins must own the restaurant
    if (!isSuperAdmin && restaurant.owner_id !== user.id) {
      return json({ error: "Permission denied" }, 403);
    }

    // Only allow reactivation when the restaurant is currently inactive
    if (restaurant.status !== "inactive") {
      return json({ error: "Restaurant is not inactive; trial cannot be granted" }, 400);
    }

    // Enforce one-reactivation rule:
    // The initial trial grant sets trial_ends_at ≈ created_at + FREE_TRIAL_DAYS.
    // If trial_ends_at is already beyond that window (+ GRACE_DAYS), a reactivation
    // was already given. Deny the request.
    if (restaurant.trial_ends_at && restaurant.created_at) {
      const createdAt = new Date(restaurant.created_at).getTime();
      const trialEndsAt = new Date(restaurant.trial_ends_at).getTime();
      const initialGrantCutoff =
        createdAt + (FREE_TRIAL_DAYS + GRACE_DAYS) * 24 * 60 * 60 * 1000;

      if (trialEndsAt > initialGrantCutoff) {
        return json(
          { error: "Trial has already been reactivated once. Please choose a paid plan." },
          400,
        );
      }
    }

    // Grant the trial
    const newTrialEndsAt = new Date(
      Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error: updateErr } = await adminClient
      .from("restaurants")
      .update({ status: "trial", trial_ends_at: newTrialEndsAt })
      .eq("id", restaurant_id);

    if (updateErr) throw updateErr;

    console.log(`activate-trial: granted ${FREE_TRIAL_DAYS}-day trial to restaurant ${restaurant_id}`);

    return json({ success: true, trial_ends_at: newTrialEndsAt });
  } catch (err) {
    console.error("activate-trial error:", err);
    return json({ error: (err as Error).message ?? String(err) }, 500);
  }
});
