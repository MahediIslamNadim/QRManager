// invite-branch-admin/index.ts
// Invites a user as branch admin for a specific restaurant in a group
// Updated: April 26, 2026
//   - Hardened email validation (RFC-5321 length checks, regex)
//   - listUsers() paginated fix (memory/timeout safe)
//   - Invitation stays "pending" until user clicks email link
//   - Pre-assigns role + restaurant for new users

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

// ─── Email validation ────────────────────────────────────────────────────────
// RFC-5321: local part ≤ 64, domain ≤ 253, total ≤ 320
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

const sanitizeEmail = (raw: string): string => raw.trim().toLowerCase();

const isValidEmail = (email: string): boolean =>
  email.length <= 320 && EMAIL_RE.test(email);

// ─── UUID validation (prevents malformed IDs being passed to DB) ─────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (s: string) => UUID_RE.test(s);

// ─── Handler ─────────────────────────────────────────────────────────────────

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

    // ── Parse & validate request body ────────────────────────────────────────
    let body: { restaurant_id?: unknown; group_id?: unknown; email?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { restaurant_id, group_id, email } = body;

    if (typeof restaurant_id !== "string" || !isValidUUID(restaurant_id)) {
      return json({ error: "Invalid restaurant_id" }, 400);
    }
    if (typeof group_id !== "string" || !isValidUUID(group_id)) {
      return json({ error: "Invalid group_id" }, 400);
    }
    if (typeof email !== "string") {
      return json({ error: "email is required" }, 400);
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return json({ error: "Invalid email address" }, 400);
    }

    // ── Permission check ──────────────────────────────────────────────────────
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

    // ── Validate restaurant belongs to this group ─────────────────────────────
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurant_id)
      .eq("group_id", group_id)
      .single();

    if (!restaurant) return json({ error: "Restaurant not found in this group" }, 404);

    // ── Upsert invitation as "pending" ────────────────────────────────────────
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

    // ── Helper: pre-assign role + restaurant to a known user ─────────────────
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

    // ── Check if user already exists in profiles ──────────────────────────────
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let invitedUserId: string | null = null;
    let alreadyExists = false;

    if (existingProfile?.id) {
      invitedUserId = existingProfile.id;
      alreadyExists = true;
      await assignRoleAndRestaurant(invitedUserId);
      await (admin.from("branch_invitations") as any)
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("restaurant_id", restaurant_id)
        .eq("invited_email", normalizedEmail);

    } else {
      // ── New user: send magic-link invite email ────────────────────────────
      const redirectUrl =
        `${siteUrl}/admin-setup?branch_restaurant_id=${encodeURIComponent(restaurant_id)}&group_id=${encodeURIComponent(group_id)}`;

      const { data: inviteData, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo: redirectUrl });

      if (inviteError) {
        if (!inviteError.message.toLowerCase().includes("already")) {
          return json({ error: inviteError.message }, 400);
        }

        // Already invited but email not confirmed — paginated user search (memory-safe)
        let foundUser: any = null;
        let page = 1;
        while (!foundUser) {
          const { data: pageData, error: listError } =
            await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (listError || !pageData?.users?.length) break;
          foundUser = pageData.users.find((u: any) => u.email === normalizedEmail);
          if (pageData.users.length < 1000) break;
          page++;
        }
        if (foundUser) {
          invitedUserId = foundUser.id;
          await assignRoleAndRestaurant(invitedUserId);
        }
      } else {
        invitedUserId = inviteData?.user?.id ?? null;
        if (invitedUserId) {
          await assignRoleAndRestaurant(invitedUserId);
        }
      }
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
