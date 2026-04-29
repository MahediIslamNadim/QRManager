import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAFF_ROLES = ["admin", "waiter", "kitchen"] as const;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();

    if (!caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: isSuperAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });

    if (!isSuperAdmin) {
      return jsonResponse({ error: "Permission denied - Super admin only" }, 403);
    }

    const { action, user_id, updates } = await req.json();

    if (!user_id) {
      return jsonResponse({ error: "User ID required" }, 400);
    }

    if (action === "delete" && user_id === caller.id) {
      return jsonResponse({ error: "Cannot delete yourself" }, 400);
    }

    if (action === "delete") {
      console.log("Deleting user:", user_id);

      try {
        const { data: ownedRestaurants, error: ownerCheckErr } = await adminClient
          .from("restaurants")
          .select("id")
          .eq("owner_id", user_id)
          .limit(1);

        if (ownerCheckErr) {
          console.error("Owner lookup failed:", ownerCheckErr.message);
          return jsonResponse({ error: ownerCheckErr.message }, 500);
        }

        if (ownedRestaurants?.length) {
          return jsonResponse(
            { error: "This user owns one or more restaurants. Transfer ownership before deleting the account." },
            400,
          );
        }

        const { error: notifErr } = await adminClient.from("notifications").delete().eq("user_id", user_id);
        if (notifErr) console.log("Notifications delete error (may be ok):", notifErr.message);

        const { error: roleErr } = await adminClient.from("user_roles").delete().eq("user_id", user_id);
        if (roleErr) console.log("Role delete error (may be ok):", roleErr.message);

        const { error: staffErr } = await adminClient.from("staff_restaurants").delete().eq("user_id", user_id);
        if (staffErr) console.log("Staff delete error (may be ok):", staffErr.message);

        const { error: profileErr } = await adminClient.from("profiles").delete().eq("id", user_id);
        if (profileErr) console.log("Profile delete error (may be ok):", profileErr.message);

        const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
        if (deleteErr) {
          console.error("Auth user delete error:", deleteErr.message);
          return jsonResponse({ error: deleteErr.message }, 500);
        }

        console.log("User deleted successfully:", user_id);
        return jsonResponse({ success: true, message: "User deleted" });
      } catch (err: unknown) {
        console.error("Delete operation failed:", err);
        return jsonResponse({ error: (err as Error).message || "Delete failed" }, 500);
      }
    }

    if (action === "update") {
      if (updates?.full_name || updates?.phone) {
        const profileUpdates: Record<string, string> = {};
        if (updates.full_name) profileUpdates.full_name = updates.full_name;
        if (updates.phone) profileUpdates.phone = updates.phone;

        const { error: profileErr } = await adminClient.from("profiles").update(profileUpdates).eq("id", user_id);
        if (profileErr) {
          console.error("Profile update failed:", profileErr.message);
          return jsonResponse({ error: profileErr.message }, 500);
        }
      }

      if (updates?.role) {
        if (!STAFF_ROLES.includes(updates.role)) {
          return jsonResponse({ error: "Invalid role" }, 400);
        }

        if (user_id === caller.id) {
          return jsonResponse({ error: "Cannot change your own role" }, 400);
        }

        const { data: ownedRestaurants, error: ownerCheckErr } = await adminClient
          .from("restaurants")
          .select("id")
          .eq("owner_id", user_id)
          .limit(1);

        if (ownerCheckErr) {
          console.error("Owner lookup failed:", ownerCheckErr.message);
          return jsonResponse({ error: ownerCheckErr.message }, 500);
        }

        if (ownedRestaurants?.length) {
          if (updates.role !== "admin") {
            return jsonResponse(
              { error: "Restaurant owners must remain admin. Transfer ownership before changing this role." },
              400,
            );
          }
        } else {
          const { data: staffAssignments, error: staffErr } = await adminClient
            .from("staff_restaurants")
            .select("restaurant_id")
            .eq("user_id", user_id);

          if (staffErr) {
            console.error("Staff lookup failed:", staffErr.message);
            return jsonResponse({ error: staffErr.message }, 500);
          }

          if (!staffAssignments?.length) {
            return jsonResponse({ error: "No restaurant staff assignment found for this user." }, 400);
          }

          if (staffAssignments.length > 1) {
            return jsonResponse(
              { error: "This user has multiple restaurant assignments. Update the role from the restaurant staff management screen." },
              400,
            );
          }

          const { error: roleErr } = await (adminClient.from("staff_restaurants") as any)
            .update({ role: updates.role })
            .eq("user_id", user_id)
            .eq("restaurant_id", staffAssignments[0].restaurant_id);

          if (roleErr) {
            console.error("Role update failed:", roleErr.message);
            return jsonResponse({ error: roleErr.message }, 500);
          }
        }
      }

      return jsonResponse({ success: true, message: "User updated" });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
