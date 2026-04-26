// create-enterprise-group-owner/index.ts
// Enterprise package এ নতুন Group Owner তৈরি করে
// - caller must be group_owner or super_admin
// - নতুন user পাবে: role = group_owner
// - সে caller এর group এ co-owner হিসেবে যুক্ত হবে
// - restaurant_id ও link হবে যাতে সে সব data দেখতে পারে
// Created: April 26, 2026

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

// ─── Validation ──────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitizeEmail = (raw: string) => raw.trim().toLowerCase();
const isValidEmail = (e: string) => e.length <= 320 && EMAIL_RE.test(e);
const isValidUUID = (s: unknown): s is string =>
  typeof s === "string" && UUID_RE.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ── Caller identity ───────────────────────────────────────────────────────
    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const { email, password, full_name, group_id, restaurant_id } = body;

    if (typeof email !== "string") return json({ error: "email required" }, 400);
    if (typeof password !== "string" || password.length < 6)
      return json({ error: "password must be at least 6 characters" }, 400);
    if (typeof full_name !== "string" || full_name.trim().length === 0)
      return json({ error: "full_name required" }, 400);
    if (!isValidUUID(group_id)) return json({ error: "Invalid group_id" }, 400);

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) return json({ error: "Invalid email address" }, 400);

    const cleanName = full_name.trim().replace(/\s+/g, " ").slice(0, 100);

    // ── Permission: caller must be group_owner or super_admin ─────────────────
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin");
    const isGroupOwner = callerRoles?.some((r: any) => r.role === "group_owner");

    if (!isSuperAdmin && !isGroupOwner) {
      return json({ error: "Permission denied: must be group_owner or super_admin" }, 403);
    }

    // ── Verify caller owns the group (unless super_admin) ─────────────────────
    if (!isSuperAdmin) {
      const { data: ownedGroup } = await admin
        .from("restaurant_groups")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", callerUser.id)
        .single();
      if (!ownedGroup) return json({ error: "Permission denied: you do not own this group" }, 403);
    }

    // ── Verify restaurant belongs to this group (if provided) ─────────────────
    let restId: string | null = isValidUUID(restaurant_id) ? restaurant_id : null;
    if (restId) {
      const { data: rest } = await admin
        .from("restaurants")
        .select("id")
        .eq("id", restId)
        .eq("group_id", group_id)
        .single();
      if (!rest) restId = null; // restaurant not in this group — ignore
    }

    // ── Check if user already exists ──────────────────────────────────────────
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let newUserId: string;
    let alreadyExisted = false;

    if (existingProfile?.id) {
      // User exists — just update their role
      newUserId = existingProfile.id;
      alreadyExisted = true;
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: cleanName },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      newUserId = newUser.user.id;

      // Create profile
      await admin.from("profiles").upsert(
        { id: newUserId, full_name: cleanName, email: normalizedEmail },
        { onConflict: "id" }
      );
    }

    // ── Assign group_owner role ───────────────────────────────────────────────
    // Remove any conflicting regular roles first (admin/waiter/kitchen)
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", newUserId)
      .in("role", ["admin", "waiter", "kitchen"]);

    // Upsert group_owner role
    const { error: roleErr } = await (admin.from("user_roles") as any).upsert(
      { user_id: newUserId, role: "group_owner" },
      { onConflict: "user_id,role" }
    );
    if (roleErr) throw new Error(roleErr.message);

    // ── Link to restaurant (so they can see restaurant data) ──────────────────
    if (restId) {
      await admin.from("profiles").upsert(
        { id: newUserId, restaurant_id: restId },
        { onConflict: "id" }
      );
    }

    // ── Link new user as co-owner of this group ───────────────────────────────
    // We use staff_restaurants with role='admin' so they can manage branches
    // The true ownership is captured by the group_owner role in user_roles
    if (restId) {
      await admin.from("staff_restaurants").upsert(
        { user_id: newUserId, restaurant_id: restId, role: "admin" },
        { onConflict: "user_id,restaurant_id" }
      ).catch(() => {}); // ignore if table not present
    }

    return json({
      success: true,
      user_id: newUserId,
      already_existed: alreadyExisted,
      message: alreadyExisted
        ? `${normalizedEmail} এর account ছিল — Group Owner role দেওয়া হয়েছে`
        : `${cleanName} এর Group Owner account তৈরি হয়েছে`,
    });

  } catch (err: unknown) {
    return json({ error: (err as Error).message }, 500);
  }
});
