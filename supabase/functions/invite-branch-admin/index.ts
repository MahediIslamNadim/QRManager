// invite-branch-admin/index.ts
// Invites a user as branch admin for a specific restaurant in a group
// Created: April 25, 2026

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
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
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://tasty-qr-spot.lovable.app";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Admin client (service role) for privileged ops
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Caller client to verify identity
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    // Parse request body
    let body: { restaurant_id?: string; group_id?: string; email?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { restaurant_id, group_id, email } = body;

    if (!restaurant_id || !group_id || !email) {
      return json({ error: "restaurant_id, group_id, email are required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      return json({ error: "Invalid email address" }, 400);
    }

    // Verify caller owns this group OR is super_admin
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isSuperAdmin = callerRoles?.some(r => r.role === "super_admin");
    const isGroupOwner = callerRoles?.some(r => r.role === "group_owner");

    if (!isSuperAdmin && !isGroupOwner) {
      return json({ error: "Permission denied: must be group_owner or super_admin" }, 403);
    }

    if (isGroupOwner && !isSuperAdmin) {
      // Verify this group belongs to the caller
      const { data: group } = await admin
        .from("restaurant_groups")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", callerUser.id)
        .single();

      if (!group) {
        return json({ error: "Permission denied: you do not own this group" }, 403);
      }
    }

    // Verify restaurant belongs to this group
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurant_id)
      .eq("group_id", group_id)
      .single();

    if (!restaurant) {
      return json({ error: "Restaurant not found in this group" }, 404);
    }

    // Check if a user with this email already exists
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let invitedUserId: string | null = null;

    if (existingProfile?.id) {
      // User already exists — just assign admin role for this restaurant
      invitedUserId = existingProfile.id;
    } else {
      // Invite new user via Supabase Auth magic link
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        { redirectTo: `${siteUrl}/admin` }
      );

      if (inviteError) {
        // If already invited but not yet confirmed — still proceed
        if (!inviteError.message.toLowerCase().includes("already")) {
          return json({ error: inviteError.message }, 400);
        }
        // Try to find the user anyway
        const { data: { users } } = await admin.auth.admin.listUsers();
        const found = users?.find(u => u.email === normalizedEmail);
        if (found) invitedUserId = found.id;
      } else {
        invitedUserId = inviteData?.user?.id ?? null;
      }
    }

    // If we have the user ID, assign admin role + link to restaurant
    if (invitedUserId) {
      // Assign admin role
      await admin.from("user_roles").upsert(
        { user_id: invitedUserId, role: "admin" },
        { onConflict: "user_id,role" }
      );

      // Link user to this specific restaurant via profiles
      await admin.from("profiles").upsert(
        { id: invitedUserId, restaurant_id: restaurant_id },
        { onConflict: "id" }
      );

      // Also link via staff_restaurants if that table exists
      try {
        await admin.from("staff_restaurants").upsert(
          { user_id: invitedUserId, restaurant_id: restaurant_id, role: "admin" },
          { onConflict: "user_id,restaurant_id" }
        );
      } catch {
        // Table may not exist — ignore
      }
    }

    // Record the invitation in branch_invitations table
    try {
      await (admin.from("branch_invitations") as any).upsert(
        {
          group_id,
          restaurant_id,
          invited_email: normalizedEmail,
          invited_by: callerUser.id,
          status: invitedUserId ? "accepted" : "pending",
          accepted_at: invitedUserId ? new Date().toISOString() : null,
        },
        { onConflict: "restaurant_id,invited_email" }
      );
    } catch {
      // Table not yet migrated — ignore, main invite still succeeded
    }

    return json({
      success: true,
      message: `আমন্ত্রণ পাঠানো হয়েছে ${normalizedEmail}-এ`,
      user_linked: !!invitedUserId,
    });

  } catch (err: unknown) {
    return json({ error: (err as Error).message }, 500);
  }
});
