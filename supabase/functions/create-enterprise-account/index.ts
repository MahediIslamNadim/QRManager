// create-enterprise-account/index.ts
// Super Admin থেকে Enterprise account তৈরি করার edge function
// Created: April 26, 2026

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Verify caller is super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: super_admin only" }, 403);

    // Parse request body
    let body: {
      email: string;
      password: string;
      full_name: string;
      restaurant_name: string;
      phone?: string;
      address?: string;
      billing_cycle?: "monthly" | "yearly";
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { email, password, full_name, restaurant_name, phone, address, billing_cycle = "yearly" } = body;

    // Validate required fields
    if (!email || !password || !full_name || !restaurant_name) {
      return json({ error: "email, password, full_name, restaurant_name are required" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Step 1: Check if email already exists
    const { data: { users: existingUsers } } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.find(u => u.email === normalizedEmail);
    if (existingUser) {
      return json({ error: `এই ইমেইলে আগেই অ্যাকাউন্ট আছে: ${normalizedEmail}` }, 400);
    }

    // Step 2: Create auth user with email + password
    const { data: newUser, error: createUserErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // auto-confirm, no email needed
      user_metadata: { full_name: full_name.trim() },
    });

    if (createUserErr || !newUser.user) {
      return json({ error: createUserErr?.message || "User তৈরি করা যায়নি" }, 400);
    }

    const userId = newUser.user.id;

    // Step 3: Create profile
    await admin.from("profiles").upsert({
      id: userId,
      full_name: full_name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
    });

    // Step 4: Create restaurant with enterprise tier
    const expiryDate = billing_cycle === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: restaurant, error: restErr } = await admin
      .from("restaurants")
      .insert({
        name: restaurant_name.trim(),
        owner_id: userId,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        status: "active_paid",
        plan: "high_smart_enterprise",
        tier: "high_smart_enterprise",
        subscription_status: "active",
        billing_cycle,
        trial_end_date: expiryDate,
        trial_ends_at: expiryDate,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: expiryDate,
        is_branch: false,
      })
      .select("id")
      .single();

    if (restErr || !restaurant) {
      // Rollback: delete the user we just created
      await admin.auth.admin.deleteUser(userId);
      return json({ error: restErr?.message || "Restaurant তৈরি করা যায়নি" }, 500);
    }

    const restaurantId = restaurant.id;

    // Step 5: Assign group_owner role
    await admin.from("user_roles").upsert(
      { user_id: userId, role: "group_owner" },
      { onConflict: "user_id,role" },
    );

    // Step 6: Link user to restaurant in profiles
    await admin.from("profiles").update({ restaurant_id: restaurantId }).eq("id", userId);

    // Step 7: Add default menu items (optional, same as signup)
    await admin.from("menu_items").insert([
      { restaurant_id: restaurantId, name: "চিকেন বিরিয়ানি", price: 350, category: "বিরিয়ানি", description: "সুগন্ধি বাসমতি চালে রান্না করা মুরগির বিরিয়ানি" },
      { restaurant_id: restaurantId, name: "বটি কাবাব", price: 180, category: "কাবাব", description: "মশলাযুক্ত গরুর মাংসের কাবাব" },
      { restaurant_id: restaurantId, name: "মাংগো লাচ্ছি", price: 120, category: "পানীয়", description: "তাজা আমের লাচ্ছি" },
    ]);

    // Step 8: Send notification to new user
    await admin.from("notifications").insert({
      user_id: userId,
      restaurant_id: restaurantId,
      title: "হাই স্মার্ট এন্টারপ্রাইজ সক্রিয় হয়েছে! 🎉",
      message: `আপনার "${restaurant_name}" রেস্টুরেন্টের Enterprise প্যাকেজ সক্রিয় হয়েছে। এখন গ্রুপ ড্যাশবোর্ড থেকে সব শাখা পরিচালনা করুন।`,
      type: "success",
    });

    console.log(`[create-enterprise] Created enterprise account for ${normalizedEmail}, restaurant=${restaurantId}`);

    return json({
      success: true,
      user_id: userId,
      restaurant_id: restaurantId,
      email: normalizedEmail,
      message: `Enterprise অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। ${normalizedEmail} দিয়ে login করতে পারবে।`,
    });

  } catch (err: unknown) {
    console.error("[create-enterprise] error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
