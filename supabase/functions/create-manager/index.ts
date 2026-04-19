import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin");
    const isAdmin      = callerRoles?.some((r: any) => r.role === "admin");
    if (!isSuperAdmin && !isAdmin) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, manager_id, email, password, full_name } = await req.json();

    // If caller is a regular admin, verify the manager belongs to their restaurant
    if (!isSuperAdmin && isAdmin && manager_id) {
      const { data: ownerRest } = await callerClient
        .from("restaurants")
        .select("dedicated_manager_id")
        .eq("owner_id", caller.id)
        .maybeSingle();
      if (!ownerRest || ownerRest.dedicated_manager_id !== manager_id) {
        return new Response(JSON.stringify({ error: "This manager is not assigned to your restaurant" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "remove") {
      if (!manager_id) {
        return new Response(JSON.stringify({ error: "manager_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: mgr } = await callerClient
        .from("dedicated_managers")
        .select("user_id")
        .eq("id", manager_id)
        .single();

      if (mgr?.user_id) {
        await callerClient.from("user_roles").delete()
          .eq("user_id", mgr.user_id).eq("role", "dedicated_manager");
        await callerClient.from("dedicated_managers")
          .update({ user_id: null }).eq("id", manager_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "create"
    if (!email || !manager_id) {
      return new Response(JSON.stringify({ error: "email and manager_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingProfile } = await callerClient
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let userId: string;

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      if (!password) {
        return new Response(JSON.stringify({
          error: `"${normalizedEmail}" এই ইমেইলে কোনো অ্যাকাউন্ট নেই। নতুন অ্যাকাউন্ট তৈরি করতে পাসওয়ার্ড দিন।`,
          needs_password: true,
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createErr } = await callerClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
    }

    await (callerClient.from("user_roles") as any).upsert(
      { user_id: userId, role: "dedicated_manager" },
      { onConflict: "user_id,role" }
    );

    await callerClient.from("dedicated_managers")
      .update({ user_id: userId })
      .eq("id", manager_id);

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
