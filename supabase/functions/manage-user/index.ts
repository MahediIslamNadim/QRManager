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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller is authenticated
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is super_admin
    const { data: isSuperAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });

    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Permission denied - Super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, user_id, updates } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent super admin from deleting themselves
    if (action === "delete" && user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      console.log("Deleting user:", user_id);
      
      try {
        // Delete notifications first
        const { error: notifErr } = await adminClient.from("notifications").delete().eq("user_id", user_id);
        if (notifErr) console.log("Notifications delete error (may be ok):", notifErr.message);

        // Delete user role
        const { error: roleErr } = await adminClient.from("user_roles").delete().eq("user_id", user_id);
        if (roleErr) console.log("Role delete error (may be ok):", roleErr.message);
        
        // Delete staff restaurant links
        const { error: staffErr } = await adminClient.from("staff_restaurants").delete().eq("user_id", user_id);
        if (staffErr) console.log("Staff delete error (may be ok):", staffErr.message);
        
        // Delete profile
        const { error: profileErr } = await adminClient.from("profiles").delete().eq("id", user_id);
        if (profileErr) console.log("Profile delete error (may be ok):", profileErr.message);
        
        // Delete auth user last
        const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
        if (deleteErr) {
          console.error("Auth user delete error:", deleteErr.message);
          return new Response(JSON.stringify({ error: deleteErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("User deleted successfully:", user_id);
        return new Response(
          JSON.stringify({ success: true, message: "User deleted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("Delete operation failed:", err);
        return new Response(JSON.stringify({ error: err.message || "Delete failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update") {
      // Update profile
      if (updates?.full_name || updates?.phone) {
        const profileUpdates: any = {};
        if (updates.full_name) profileUpdates.full_name = updates.full_name;
        if (updates.phone) profileUpdates.phone = updates.phone;
        
        await adminClient.from("profiles").update(profileUpdates).eq("id", user_id);
      }

      // Update role if provided
      if (updates?.role) {
        // First delete existing role
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        // Insert new role
        await adminClient.from("user_roles").insert({ user_id, role: updates.role });
      }

      return new Response(
        JSON.stringify({ success: true, message: "User updated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
