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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeText = (value: string, maxLength: number) => value.trim().replace(/\s+/g, " ").slice(0, maxLength);

async function userExists(admin: ReturnType<typeof createClient>, email: string) {
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
      group_id?: string;
      restaurant_name?: string;
      restaurant_address?: string;
      restaurant_phone?: string;
      admin_full_name?: string;
      admin_email?: string;
      admin_phone?: string;
      admin_password?: string;
    } | null;

    if (
      !body?.group_id ||
      !body.restaurant_name ||
      !body.admin_full_name ||
      !body.admin_email ||
      !body.admin_password
    ) {
      return json({ error: "Missing required fields" }, 400);
    }

    const adminEmail = normalizeEmail(body.admin_email);
    const adminFullName = normalizeText(body.admin_full_name, 120);
    const restaurantName = normalizeText(body.restaurant_name, 160);
    const restaurantAddress = body.restaurant_address ? normalizeText(body.restaurant_address, 300) : null;
    const restaurantPhone = body.restaurant_phone ? normalizeText(body.restaurant_phone, 40) : null;
    const adminPhone = body.admin_phone ? normalizeText(body.admin_phone, 40) : null;

    if (!EMAIL_RE.test(adminEmail)) return json({ error: "Invalid admin email" }, 400);
    if (body.admin_password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    if (!isSuperAdmin) {
      const { data: ownedGroup } = await admin
        .from("restaurant_groups")
        .select("id")
        .eq("id", body.group_id)
        .eq("owner_id", caller.id)
        .maybeSingle();

      if (!ownedGroup) return json({ error: "You do not manage this enterprise group" }, 403);
    }

    const { data: group } = await admin
      .from("restaurant_groups")
      .select("id, name")
      .eq("id", body.group_id)
      .maybeSingle();

    if (!group) return json({ error: "Enterprise group not found" }, 404);

    const { data: headOffice } = await admin
      .from("restaurants")
      .select("id, billing_cycle, subscription_end_date, trial_end_date, tier, plan")
      .eq("group_id", body.group_id)
      .eq("is_branch", false)
      .maybeSingle();

    if (!headOffice) return json({ error: "Enterprise head office is not ready yet" }, 400);

    if ((headOffice.tier || headOffice.plan) !== "high_smart_enterprise") {
      return json({ error: "This group is not on the enterprise plan" }, 400);
    }

    const exists = await userExists(admin, adminEmail);
    if (exists) {
      return json({ error: "This email already has an account" }, 400);
    }

    const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: body.admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: adminFullName,
      },
    });

    if (createUserError || !authUser.user) {
      return json({ error: createUserError?.message || "Could not create admin user" }, 400);
    }

    const { data: restaurantId, error: restaurantError } = await callerClient.rpc(
      "create_enterprise_restaurant" as any,
      {
        p_group_id: body.group_id,
        p_restaurant_name: restaurantName,
        p_admin_user_id: authUser.user.id,
        p_admin_full_name: adminFullName,
        p_admin_email: adminEmail,
        p_admin_phone: adminPhone,
        p_restaurant_address: restaurantAddress,
        p_restaurant_phone: restaurantPhone,
      } as any,
    );

    if (restaurantError || !restaurantId) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return json({ error: restaurantError?.message || "Could not create restaurant" }, 500);
    }

    await admin.from("notifications").insert({
      user_id: authUser.user.id,
      restaurant_id: restaurantId,
      title: "Enterprise restaurant added",
      message: `${restaurantName} is now connected to ${group.name}.`,
      type: "success",
    } as any);

    return json({
      success: true,
      group_id: body.group_id,
      restaurant_id: restaurantId,
      admin_user_id: authUser.user.id,
    });
  } catch (error) {
    console.error("[create-enterprise-restaurant-admin]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
