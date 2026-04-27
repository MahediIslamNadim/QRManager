import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = roles?.some((role: { role: string }) => role.role === "super_admin");
    const isGroupOwner = roles?.some((role: { role: string }) => role.role === "group_owner");

    if (!isSuperAdmin && !isGroupOwner) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null) as {
      restaurant_id?: string;
      group_name?: string;
    } | null;

    if (!body?.restaurant_id) {
      return json({ error: "restaurant_id is required" }, 400);
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .select("id, name, owner_id, tier, plan")
      .eq("id", body.restaurant_id)
      .maybeSingle();

    if (restaurantError || !restaurant) {
      return json({ error: "Restaurant not found" }, 404);
    }

    if (!isSuperAdmin && restaurant.owner_id !== caller.id) {
      return json({ error: "You can only bootstrap your own enterprise restaurant" }, 403);
    }

    if ((restaurant.tier || restaurant.plan) !== "high_smart_enterprise") {
      return json({ error: "Restaurant is not on the enterprise plan" }, 400);
    }

    const { data: groupId, error: ensureError } = await admin.rpc("ensure_enterprise_group", {
      p_restaurant_id: restaurant.id,
      p_group_name: body.group_name || restaurant.name,
    });

    if (ensureError) {
      return json({ error: ensureError.message }, 400);
    }

    return json({
      success: true,
      restaurant_id: restaurant.id,
      group_id: groupId,
    });
  } catch (error) {
    console.error("[bootstrap-enterprise-restaurant]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
