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

    // Check caller has admin or super_admin role
    const { data: callerRoles } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isAdmin = callerRoles?.some(r => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: {
      action?: unknown;
      email?: unknown;
      password?: unknown;
      full_name?: unknown;
      role?: unknown;
      restaurant_id?: unknown;
      user_id?: unknown;
      manager_id?: unknown;  // Bug 5 fix: was missing from the type, causing TS errors
    };
    try {
      parsed = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { action, email, password, full_name, role, restaurant_id, user_id, manager_id } = parsed;
    const requestedAction = action === "remove" ? "remove" : "add";
    const allowedRoles = ["admin", "waiter", "kitchen"] as const;

    // ── DEDICATED MANAGER special path ────────────────────────────────────────
    if (role === "dedicated_manager" || (requestedAction === "remove" && manager_id)) {
      if (requestedAction === "remove") {
        if (!manager_id) {
          return new Response(JSON.stringify({ error: "manager_id is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: mgr } = await callerClient
          .from("dedicated_managers").select("user_id").eq("id", manager_id).maybeSingle();
        if (mgr?.user_id) {
          await callerClient.from("user_roles").delete()
            .eq("user_id", mgr.user_id).eq("role", "dedicated_manager");
          await callerClient.from("dedicated_managers").update({ user_id: null }).eq("id", manager_id);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // add dedicated_manager
      if (typeof email !== "string" || !email.trim() || !manager_id) {
        return new Response(JSON.stringify({ error: "email and manager_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mgEmail = email.trim().toLowerCase();

      const { data: existingMgrProfile } = await callerClient
        .from("profiles").select("id").eq("email", mgEmail).maybeSingle();

      let mgrUserId: string;
      if (existingMgrProfile?.id) {
        mgrUserId = existingMgrProfile.id;
      } else {
        if (typeof password !== "string" || !password) {
          return new Response(JSON.stringify({
            error: `"${mgEmail}" এই ইমেইলে কোনো অ্যাকাউন্ট নেই। নতুন অ্যাকাউন্ট তৈরি করতে পাসওয়ার্ড দিন।`,
          }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: newMgrUser, error: mgrCreateErr } = await callerClient.auth.admin.createUser({
          email: mgEmail, password,
          email_confirm: true,
          user_metadata: { full_name: typeof full_name === "string" ? full_name : "" },
        });
        if (mgrCreateErr || !newMgrUser?.user) {
          return new Response(JSON.stringify({ error: mgrCreateErr?.message || "User creation failed" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        mgrUserId = newMgrUser.user.id;
      }

      await (callerClient.from("user_roles") as any)
        .upsert({ user_id: mgrUserId, role: "dedicated_manager" }, { onConflict: "user_id,role" });
      await callerClient.from("dedicated_managers").update({ user_id: mgrUserId }).eq("id", manager_id);

      return new Response(JSON.stringify({ success: true, user_id: mgrUserId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ── END dedicated manager path ─────────────────────────────────────────────

    if (requestedAction === "remove" && typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestedAction === "add" && (typeof email !== "string" || typeof role !== "string")) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (requestedAction === "add" && !normalizedEmail) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestedAction === "add" && !allowedRoles.includes(role as (typeof allowedRoles)[number])) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const desiredRole = requestedAction === "add"
      ? role as (typeof allowedRoles)[number]
      : null;

    // Resolve caller's own restaurant_id
    const { data: callerRest } = await callerClient
      .from("restaurants")
      .select("id")
      .eq("owner_id", caller.id)
      .limit(1)
      .single();

    // super_admin may pass any restaurant_id; admin must own theirs
    const isSuperAdmin = callerRoles?.some(r => r.role === "super_admin");
    let restId: string | undefined;

    if (isSuperAdmin && restaurant_id) {
      // Verify the target restaurant actually exists
      const { data: targetRest } = await callerClient
        .from("restaurants")
        .select("id")
        .eq("id", restaurant_id)
        .single();
      if (!targetRest) {
        return new Response(JSON.stringify({ error: "Restaurant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      restId = restaurant_id;
    } else {
      // Regular admin: always use their own restaurant, ignore any provided restaurant_id
      restId = callerRest?.id;
    }

    if (!restId) {
      return new Response(JSON.stringify({ error: "No restaurant found for this user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upsertRoleAndLink = async (userId: string) => {
      const { data: ownerRestaurant, error: ownerRestaurantErr } = await callerClient
        .from("restaurants")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();

      if (ownerRestaurantErr) throw ownerRestaurantErr;
      if (ownerRestaurant && ownerRestaurant.id !== restId) {
        throw new Error("This user is already linked to another restaurant");
      }

      const { data: staffLinks, error: staffLinksErr } = await callerClient
        .from("staff_restaurants")
        .select("id, restaurant_id")
        .eq("user_id", userId);

      if (staffLinksErr) throw staffLinksErr;

      const linkedToOtherRestaurant = (staffLinks || []).some(
        (link) => link.restaurant_id !== restId,
      );

      if (linkedToOtherRestaurant) {
        throw new Error("This user is already linked to another restaurant");
      }

      const alreadyLinked = (staffLinks || []).some((link) => link.restaurant_id === restId);

      const { data: existingRoles, error: existingRolesErr } = await callerClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (existingRolesErr) throw existingRolesErr;

      if ((existingRoles || []).some((entry) => entry.role === "super_admin")) {
        throw new Error("Super admin users cannot be added as restaurant staff");
      }

      const currentRole = (existingRoles || []).find((entry) =>
        allowedRoles.includes(entry.role as (typeof allowedRoles)[number]),
      )?.role;

      if (currentRole && currentRole !== desiredRole) {
        const { error: deleteRoleErr } = await callerClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .in("role", [...allowedRoles]);

        if (deleteRoleErr) throw deleteRoleErr;
      }

      if (!currentRole || currentRole !== desiredRole) {
        const { error: insertRoleErr } = await (callerClient.from("user_roles") as any)
          .upsert(
            { user_id: userId, role: desiredRole, restaurant_id: restId },
            { onConflict: "user_id,role" }
          );

        if (insertRoleErr) throw insertRoleErr;
      }

      const linkPayload = { user_id: userId, restaurant_id: restId, role: desiredRole };
      let { error: linkErr } = await callerClient
        .from("staff_restaurants")
        .upsert(linkPayload, { onConflict: "user_id,restaurant_id" });

      if (linkErr?.message?.toLowerCase().includes("role")) {
        const retry = await callerClient
          .from("staff_restaurants")
          .upsert({ user_id: userId, restaurant_id: restId }, { onConflict: "user_id,restaurant_id" });
        linkErr = retry.error;
      }

      if (linkErr) throw linkErr;

      return {
        already_exists: alreadyLinked && currentRole === desiredRole,
        role_updated: !!currentRole && currentRole !== desiredRole,
        user_id: userId,
      };
    };

    const removeRoleAndLink = async (userId: string) => {
      const { data: currentLinks, error: currentLinksErr } = await callerClient
        .from("staff_restaurants")
        .select("id, restaurant_id")
        .eq("user_id", userId);

      if (currentLinksErr) throw currentLinksErr;

      const linkForRestaurant = (currentLinks || []).find((link) => link.restaurant_id === restId);
      if (!linkForRestaurant) {
        throw new Error("Staff member not found for this restaurant");
      }

      const hasOtherStaffLinks = (currentLinks || []).some((link) => link.restaurant_id !== restId);

      const { data: existingRoles, error: existingRolesErr } = await callerClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (existingRolesErr) throw existingRolesErr;

      const hasSuperAdminRole = (existingRoles || []).some((entry) => entry.role === "super_admin");

      const { data: ownerRestaurant, error: ownerRestaurantErr } = await callerClient
        .from("restaurants")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();

      if (ownerRestaurantErr) throw ownerRestaurantErr;

      let rolePreservedReason: "super_admin" | "restaurant_owner" | "other_staff_links" | null = null;
      if (hasSuperAdminRole) {
        rolePreservedReason = "super_admin";
      } else if (ownerRestaurant) {
        rolePreservedReason = "restaurant_owner";
      } else if (hasOtherStaffLinks) {
        rolePreservedReason = "other_staff_links";
      }

      let roleRevoked = false;
      if (!rolePreservedReason) {
        const { error: deleteRoleErr } = await callerClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .in("role", [...allowedRoles]);

        if (deleteRoleErr) throw deleteRoleErr;
        roleRevoked = true;
      }

      const { error: deleteLinkErr } = await callerClient
        .from("staff_restaurants")
        .delete()
        .eq("user_id", userId)
        .eq("restaurant_id", restId);

      if (deleteLinkErr) throw deleteLinkErr;

      return {
        link_removed: true,
        role_revoked: roleRevoked,
        role_preserved_reason: rolePreservedReason,
        user_id: userId,
      };
    };

    if (requestedAction === "remove") {
      const result = await removeRoleAndLink(user_id as string);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existingProfile, error: existingProfileErr } = await callerClient
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfileErr) {
      return new Response(JSON.stringify({ error: existingProfileErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingProfile?.id) {
      const result = await upsertRoleAndLink(existingProfile.id);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (typeof password !== "string" || !password) {
      return new Response(JSON.stringify({
        error: `"${normalizedEmail}" এই ইমেইলে কোনো অ্যাকাউন্ট নেই। নতুন অ্যাকাউন্ট তৈরি করতে পাসওয়ার্ড দিন।`,
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const { data: newUser, error: createErr } = await callerClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: typeof full_name === "string" ? full_name : "" },
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await upsertRoleAndLink(newUser.user.id);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
