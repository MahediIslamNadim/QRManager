import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_TRIAL_DAYS = 14;
const GRACE_DAYS = 2;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    let body: { restaurant_id?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const { restaurant_id } = body;
    if (!restaurant_id || typeof restaurant_id !== "string") {
      return json({ error: "restaurant_id is required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isSuperAdmin = roles?.some((r: { role: string }) => r.role === "super_admin");
    const isAdmin = isSuperAdmin || roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Permission denied" }, 403);

    const { data: restaurant, error: fetchErr } = await admin
      .from("restaurants")
      .select("id, owner_id, status, subscription_status, trial_ends_at, created_at")
      .eq("id", restaurant_id)
      .single();

    if (fetchErr || !restaurant) return json({ error: "Restaurant not found" }, 404);
    if (!isSuperAdmin && restaurant.owner_id !== user.id) return json({ error: "Permission denied" }, 403);

    // Only allow when restaurant is inactive/expired
    const currentStatus = restaurant.status;
    const currentSubStatus = restaurant.subscription_status;
    if (currentStatus !== "inactive" && currentSubStatus !== "expired") {
      return json({ error: "Restaurant is not inactive; trial cannot be granted" }, 400);
    }

    // Enforce one-reactivation rule
    if (restaurant.trial_ends_at && restaurant.created_at) {
      const createdAt = new Date(restaurant.created_at).getTime();
      const trialEndsAt = new Date(restaurant.trial_ends_at).getTime();
      const initialGrantCutoff = createdAt + (FREE_TRIAL_DAYS + GRACE_DAYS) * 86400000;
      if (trialEndsAt > initialGrantCutoff) {
        return json({ error: "Trial has already been reactivated once. Please choose a paid plan." }, 400);
      }
    }

    const newTrialEndsAt = new Date(Date.now() + FREE_TRIAL_DAYS * 86400000).toISOString();

    const { error: updateErr } = await admin
      .from("restaurants")
      .update({
        status: "trial",
        subscription_status: "trial",
        trial_ends_at: newTrialEndsAt,
        trial_end_date: newTrialEndsAt,
      })
      .eq("id", restaurant_id);

    if (updateErr) throw updateErr;

    // Notify restaurant admin users
    const { data: adminRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .eq("restaurant_id", restaurant_id);

    if (adminRoles && adminRoles.length > 0) {
      const notifications = adminRoles.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        restaurant_id,
        title: "ট্রায়াল সক্রিয় হয়েছে",
        message: `${FREE_TRIAL_DAYS} দিনের ফ্রি ট্রায়াল শুরু হয়েছে।`,
        type: "success",
      }));
      await admin.from("notifications").insert(notifications);
    }

    console.log(`activate-trial: granted ${FREE_TRIAL_DAYS}-day trial to restaurant ${restaurant_id}`);
    return json({ success: true, trial_ends_at: newTrialEndsAt });
  } catch (err) {
    console.error("activate-trial error:", err);
    return json({ error: (err as Error).message ?? String(err) }, 500);
  }
});
