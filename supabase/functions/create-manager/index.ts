import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok  = (data: object) => new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (msg: string)  => new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader     = req.headers.get("Authorization");

    if (!authHeader) return err("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient  = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return err("Unauthorized");

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin");
    const isAdmin      = callerRoles?.some((r: any) => r.role === "admin");
    if (!isSuperAdmin && !isAdmin) return err("Permission denied");

    const body = await req.json();
    const { action, manager_id, email, password, full_name } = body;

    // Regular admin: verify the manager belongs to their restaurant
    if (isAdmin && !isSuperAdmin && manager_id) {
      const { data: ownerRest } = await adminClient
        .from("restaurants")
        .select("dedicated_manager_id")
        .eq("owner_id", caller.id)
        .maybeSingle();

      // Also check via staff_restaurants if not owner
      if (!ownerRest) {
        const { data: staffRest } = await adminClient
          .from("staff_restaurants")
          .select("restaurant_id")
          .eq("user_id", caller.id)
          .limit(1)
          .maybeSingle();

        if (staffRest?.restaurant_id) {
          const { data: rest } = await adminClient
            .from("restaurants")
            .select("dedicated_manager_id")
            .eq("id", staffRest.restaurant_id)
            .maybeSingle();
          if (!rest || rest.dedicated_manager_id !== manager_id) {
            return err("এই ম্যানেজার আপনার রেস্টুরেন্টের নয়");
          }
        } else {
          return err("আপনার রেস্টুরেন্ট খুঁজে পাওয়া যায়নি");
        }
      } else if (ownerRest.dedicated_manager_id !== manager_id) {
        return err("এই ম্যানেজার আপনার রেস্টুরেন্টের নয়");
      }
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (action === "remove") {
      if (!manager_id) return err("manager_id is required");

      const { data: mgr } = await adminClient
        .from("dedicated_managers")
        .select("user_id")
        .eq("id", manager_id)
        .single();

      if (mgr?.user_id) {
        await adminClient.from("user_roles").delete()
          .eq("user_id", mgr.user_id).eq("role", "dedicated_manager");
        await adminClient.from("dedicated_managers")
          .update({ user_id: null }).eq("id", manager_id);
      }

      return ok({ success: true });
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (!email || !manager_id) return err("email এবং manager_id প্রয়োজন");

    const normalizedEmail = email.trim().toLowerCase();

    // Check if auth user already exists
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.find((u: any) => u.email === normalizedEmail);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      if (!password) {
        return err(`"${normalizedEmail}" এই ইমেইলে কোনো অ্যাকাউন্ট নেই। নতুন অ্যাকাউন্ট তৈরি করতে পাসওয়ার্ড দিন।`);
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createErr || !newUser?.user) {
        return err(createErr?.message || "ব্যবহারকারী তৈরি করতে সমস্যা হয়েছে");
      }

      userId = newUser.user.id;
    }

    const { error: roleErr } = await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "dedicated_manager" }, { onConflict: "user_id,role" });

    if (roleErr) return err(`Role assignment failed: ${roleErr.message}`);

    const { error: linkErr } = await adminClient
      .from("dedicated_managers")
      .update({ user_id: userId })
      .eq("id", manager_id);

    if (linkErr) return err(`Manager link failed: ${linkErr.message}`);

    return ok({ success: true, user_id: userId });

  } catch (e: unknown) {
    return err((e as Error).message || "Unknown error");
  }
});
