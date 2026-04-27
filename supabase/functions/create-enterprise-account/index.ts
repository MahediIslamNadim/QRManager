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

async function emailExists(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if (!data?.users?.length) return false;
    if (data.users.some((user) => user.email?.toLowerCase() === email)) return true;
    if (data.users.length < 1000) return false;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Forbidden: super_admin only" }, 403);

    const body = await req.json().catch(() => null) as {
      email?: string;
      password?: string;
      full_name?: string;
      restaurant_name?: string;
      phone?: string;
      address?: string;
      billing_cycle?: "monthly" | "yearly";
    } | null;

    if (!body?.email || !body.password || !body.full_name || !body.restaurant_name) {
      return json({ error: "email, password, full_name, restaurant_name are required" }, 400);
    }

    const email = body.email.trim().toLowerCase();
    const fullName = body.full_name.trim().replace(/\s+/g, " ").slice(0, 120);
    const restaurantName = body.restaurant_name.trim().replace(/\s+/g, " ").slice(0, 160);
    const billingCycle = body.billing_cycle || "yearly";

    if (body.password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (await emailExists(admin, email)) return json({ error: "This email already has an account" }, 400);

    const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createUserError || !authUser.user) {
      return json({ error: createUserError?.message || "Could not create user" }, 400);
    }

    const expiryDate = billingCycle === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        name: restaurantName,
        owner_id: authUser.user.id,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        status: "active_paid",
        plan: "high_smart_enterprise",
        tier: "high_smart_enterprise",
        subscription_status: "active",
        billing_cycle: billingCycle,
        trial_end_date: expiryDate,
        trial_ends_at: expiryDate,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: expiryDate,
        is_branch: false,
      })
      .select("id")
      .single();

    if (restaurantError || !restaurant) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return json({ error: restaurantError?.message || "Could not create enterprise restaurant" }, 500);
    }

    await admin.from("profiles").upsert(
      {
        id: authUser.user.id,
        full_name: fullName,
        email,
        phone: body.phone?.trim() || null,
        restaurant_id: restaurant.id,
      },
      { onConflict: "id" },
    );

    await admin.from("user_roles").upsert(
      {
        user_id: authUser.user.id,
        role: "group_owner",
        restaurant_id: restaurant.id,
      } as any,
      { onConflict: "user_id,role" },
    );

    const { data: groupId, error: bootstrapError } = await admin.rpc("ensure_enterprise_group", {
      p_restaurant_id: restaurant.id,
      p_group_name: restaurantName,
    });

    if (bootstrapError) {
      return json({ error: bootstrapError.message }, 500);
    }

    await admin.from("notifications").insert({
      user_id: authUser.user.id,
      restaurant_id: restaurant.id,
      title: "Enterprise account is ready",
      message: `${restaurantName} is ready for enterprise group management.`,
      type: "success",
    } as any);

    return json({
      success: true,
      user_id: authUser.user.id,
      restaurant_id: restaurant.id,
      group_id: groupId,
      email,
    });
  } catch (error) {
    console.error("[create-enterprise-account]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
