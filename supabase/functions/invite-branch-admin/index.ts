// invite-branch-admin/index.ts
// Invites a user as branch admin for a specific restaurant in a group
// Fixed: April 26, 2026
//   - listUsers() bug fixed: paginated search instead of loading all users
//   - Invitation stays "pending" until user clicks email link & completes setup
//   - Pre-assigns role + restaurant for new users so AdminSetup only confirms

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

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

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

    // ── Permission check ──────────────────────────────────────
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin");
    const isGroupOwner = callerRoles?.some((r: any) => r.role === "group_owner");

    if (!isSuperAdmin && !isGroupOwner) {
      return json({ error: "Permission denied: must be group_owner or super_admin" }, 403);
    }

    if (isGroupOwner && !isSuperAdmin) {
      const { data: group } = await admin
        .from("restaurant_groups")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", callerUser.id)
        .single();
      if (!group) return json({ error: "Permission denied: you do not own this group" }, 403);
    }

    // ── Validate restaurant belongs to this group ─────────────
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurant_id)
      .eq("group_id", group_id)
      .single();

    if (!restaurant) return json({ error: "Restaurant not found in this group" }, 404);

    // ── Upsert invitation as "pending" ────────────────────────
    // Status stays "pending" until user clicks the link and AdminSetup.tsx marks it "accepted"
    await (admin.from("branch_invitations") as any).upsert(
      {
        group_id,
        restaurant_id,
        invited_email: normalizedEmail,
        invited_by: callerUser.id,
        status: "pending",
        accepted_at: null,
      },
      { onConflict: "restaurant_id,invited_email" }
    );

    // ── Helper: pre-assign role + restaurant to a known user ──
    const assignRoleAndRestaurant = async (userId: string) => {
      await admin.from("user_roles").upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id,role" }
      );
      await admin.from("profiles").upsert(
        { id: userId, restaurant_id },
        { onConflict: "id" }
      );
      await admin.from("staff_restaurants").upsert(
        { user_id: userId, restaurant_id, role: "admin" },
        { onConflict: "user_id,restaurant_id" }
      ).catch(() => {/* ignore if table missing */});
    };

    // ── Check if user already exists in profiles ──────────────
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let invitedUserId: string | null = null;
    let alreadyExists = false;

    if (existingProfile?.id) {
      // Existing user — assign directly and mark accepted immediately
      invitedUserId = existingProfile.id;
      alreadyExists = true;
      await assignRoleAndRestaurant(invitedUserId);
      await (admin.from("branch_invitations") as any)
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("restaurant_id", restaurant_id)
        .eq("invited_email", normalizedEmail);

    } else {
      // ── New user: send magic-link invite email ────────────────
      const redirectUrl =
        `${siteUrl}/admin-setup?branch_restaurant_id=${restaurant_id}&group_id=${group_id}`;

      const { data: inviteData, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo: redirectUrl });

      if (inviteError) {
        if (!inviteError.message.toLowerCase().includes("already")) {
          return json({ error: inviteError.message }, 400);
        }

        // ── Already invited but email not yet confirmed ────────
        // FIX: Search paginated instead of loading all users at once (was a memory/timeout risk)
        let foundUser: any = null;
        let page = 1;
        while (!foundUser) {
          const { data: pageData, error: listError } =
            await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (listError || !pageData?.users?.length) break;
          foundUser = pageData.users.find((u: any) => u.email === normalizedEmail);
          if (pageData.users.length < 1000) break; // reached last page
          page++;
        }
        if (foundUser) {
          invitedUserId = foundUser.id;
          // Pre-assign so AdminSetup.tsx only needs to confirm, not re-assign
          await assignRoleAndRestaurant(invitedUserId);
        }
      } else {
        invitedUserId = inviteData?.user?.id ?? null;
        if (invitedUserId) {
          // Pre-assign for freshly invited users too
          await assignRoleAndRestaurant(invitedUserId);
        }
      }
      // Note: invitation stays "pending" — AdminSetup.tsx marks it "accepted" on arrival
    }

    return json({
      success: true,
      message: alreadyExists
        ? `${normalizedEmail} ইতিমধ্যে account আছে — admin role দেওয়া হয়েছে`
        : `আমন্ত্রণ পাঠানো হয়েছে ${normalizedEmail}-এ`,
      user_linked: !!invitedUserId,
      already_existed: alreadyExists,
    });

  } catch (err: unknown) {
    return json({ error: (err as Error).message }, 500);
  }
});
