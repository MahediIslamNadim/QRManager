import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json200 = (data: object) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader     = req.headers.get("Authorization");

    if (!authHeader) return json200({ error: "Unauthorized" });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient  = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Identify caller
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) return json200({ error: "Unauthorized" });

    // Check caller roles
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = (callerRoles || []).some((r: any) => r.role === "super_admin");
    const isAdmin      = (callerRoles || []).some((r: any) => r.role === "admin");
    if (!isSuperAdmin && !isAdmin) return json200({ error: "Permission denied" });

    // Parse body
    let body: any;
    try { body = await req.json(); }
    catch { return json200({ error: "Invalid request body" }); }

    const { action, manager_id, email, password, full_name } = body;

    // Regular admin: must own the restaurant that has this manager
    if (isAdmin && !isSuperAdmin && manager_id) {
      const { data: ownerRest } = await adminClient
        .from("restaurants")
        .select("dedicated_manager_id, id")
        .eq("owner_id", caller.id)
        .maybeSingle();

      let linkedManagerId: string | null = ownerRest?.dedicated_manager_id ?? null;

      if (!ownerRest) {
        // Check via staff_restaurants
        const { data: staffRow } = await adminClient
          .from("staff_restaurants")
          .select("restaurant_id")
          .eq("user_id", caller.id)
          .limit(1)
          .maybeSingle();

        if (staffRow?.restaurant_id) {
          const { data: rest } = await adminClient
            .from("restaurants")
            .select("dedicated_manager_id")
            .eq("id", staffRow.restaurant_id)
            .maybeSingle();
          linkedManagerId = rest?.dedicated_manager_id ?? null;
        }
      }

      if (linkedManagerId !== manager_id) {
        return json200({ error: "এই ম্যানেজার আপনার রেস্টুরেন্টের নয়" });
      }
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (action === "remove") {
      if (!manager_id) return json200({ error: "manager_id প্রয়োজন" });

      const { data: mgr } = await adminClient
        .from("dedicated_managers")
        .select("user_id")
        .eq("id", manager_id)
        .maybeSingle();

      if (mgr?.user_id) {
        await adminClient.from("user_roles").delete()
          .eq("user_id", mgr.user_id).eq("role", "dedicated_manager");
        await adminClient.from("dedicated_managers")
          .update({ user_id: null }).eq("id", manager_id);
      }

      return json200({ success: true });
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (!email || !manager_id) return json200({ error: "email এবং manager_id প্রয়োজন" });

    const normalizedEmail = (email as string).trim().toLowerCase();

    // Check if user already exists via profiles table
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let userId: string;

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      // Need password to create new account
      if (!password) {
        return json200({
          error: `"${normalizedEmail}" এই ইমেইলে কোনো অ্যাকাউন্ট নেই। নতুন অ্যাকাউন্ট তৈরি করতে পাসওয়ার্ড দিন।`,
          needs_password: true,
        });
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: password as string,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createErr || !newUser?.user) {
        return json200({ error: createErr?.message || "ব্যবহারকারী তৈরি করতে সমস্যা হয়েছে" });
      }

      userId = newUser.user.id;
    }

    // Assign dedicated_manager role
    const { error: roleErr } = await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "dedicated_manager" }, { onConflict: "user_id,role" });

    if (roleErr) return json200({ error: `Role error: ${roleErr.message}` });

    // Link user_id to dedicated_managers record
    const { error: linkErr } = await adminClient
      .from("dedicated_managers")
      .update({ user_id: userId })
      .eq("id", manager_id);

    if (linkErr) return json200({ error: `Link error: ${linkErr.message}` });

    return json200({ success: true, user_id: userId });

  } catch (e: unknown) {
    return json200({ error: (e as Error)?.message || "Unknown error" });
  }
});
