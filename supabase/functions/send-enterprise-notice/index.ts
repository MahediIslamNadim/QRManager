import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: string, maxLength: number) => value.trim().replace(/\s+/g, " ").slice(0, maxLength);

async function sendNoticeEmail({
  resendApiKey,
  recipients,
  title,
  message,
  groupName,
  restaurantName,
}: {
  resendApiKey: string;
  recipients: string[];
  title: string;
  message: string;
  groupName: string;
  restaurantName: string;
}) {
  const html = `<!doctype html>
  <html>
    <body style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #312e81; color: #ffffff; padding: 24px;">
          <div style="font-size: 12px; opacity: 0.8;">${groupName}</div>
          <h1 style="margin: 8px 0 0; font-size: 22px;">${title}</h1>
        </div>
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px; color: #334155; font-size: 14px;">Target restaurant: <strong>${restaurantName}</strong></p>
          <div style="white-space: pre-wrap; color: #0f172a; font-size: 15px; line-height: 1.6;">${message}</div>
        </div>
      </div>
    </body>
  </html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "QRManager <noreply@qrmanager.app>",
      to: recipients,
      subject: `${groupName}: ${title}`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Email delivery failed");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !caller) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = roles?.some((role: { role: string }) => role.role === "super_admin");
    const isGroupOwner = roles?.some((role: { role: string }) => role.role === "group_owner");

    if (!isSuperAdmin && !isGroupOwner) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null) as {
      group_id?: string;
      title?: string;
      message?: string;
      audience?: "all" | "selected";
      restaurant_ids?: string[];
      send_email?: boolean;
    } | null;

    if (!body?.group_id || !body.title || !body.message || !body.audience) {
      return json({ error: "Missing required fields" }, 400);
    }

    if (!isSuperAdmin) {
      const { data: ownedGroup } = await admin
        .from("restaurant_groups")
        .select("id")
        .eq("id", body.group_id)
        .eq("owner_id", caller.id)
        .maybeSingle();

      if (!ownedGroup) return json({ error: "You do not manage this enterprise group" }, 403);
    }

    const cleanTitle = cleanText(body.title, 160);
    const cleanMessage = cleanText(body.message, 4000);
    const targetMode = body.audience;
    const requestedIds = Array.isArray(body.restaurant_ids) ? body.restaurant_ids : [];

    const restaurantsQuery = (admin.from("restaurants") as any)
      .select("id, name, notification_email, notify_email")
      .eq("group_id", body.group_id)
      .eq("is_branch", true);

    if (targetMode === "selected") {
      if (requestedIds.length === 0) return json({ error: "Select at least one restaurant" }, 400);
      restaurantsQuery.in("id", requestedIds);
    }

    const { data: targetRestaurants, error: targetError } = await restaurantsQuery.order("name");
    if (targetError) return json({ error: targetError.message }, 400);
    if (!targetRestaurants?.length) return json({ error: "No target restaurants found" }, 404);

    const { data: group } = await admin
      .from("restaurant_groups")
      .select("id, name")
      .eq("id", body.group_id)
      .maybeSingle();

    const { data: notice, error: noticeError } = await (admin.from("enterprise_notices") as any)
      .insert({
        group_id: body.group_id,
        title: cleanTitle,
        message: cleanMessage,
        audience: targetMode,
        send_email: Boolean(body.send_email),
        created_by: caller.id,
      })
      .select("id")
      .single();

    if (noticeError || !notice) return json({ error: noticeError?.message || "Could not create notice" }, 500);

    await (admin.from("enterprise_notice_targets") as any).insert(
      targetRestaurants.map((restaurant: { id: string }) => ({
        notice_id: notice.id,
        restaurant_id: restaurant.id,
        delivery_status: "pending",
      })),
    );

    let deliveredCount = 0;
    let emailedCount = 0;

    for (const restaurant of targetRestaurants as Array<{
      id: string;
      name: string;
      notification_email?: string | null;
      notify_email?: boolean | null;
    }>) {
      const { data: adminLinks } = await (admin.from("staff_restaurants") as any)
        .select("user_id")
        .eq("restaurant_id", restaurant.id)
        .eq("role", "admin");

      const adminUserIds = [...new Set((adminLinks ?? []).map((link: { user_id: string }) => link.user_id))];

      if (adminUserIds.length > 0) {
        await admin.from("notifications").insert(
          adminUserIds.map((userId) => ({
            user_id: userId,
            restaurant_id: restaurant.id,
            title: cleanTitle,
            message: cleanMessage,
            type: "announcement",
          })),
        );
      }

      deliveredCount += 1;

      let deliveryStatus = "in_app";
      let deliveredEmailAt: string | null = null;
      let emailError: string | null = null;

      if (body.send_email) {
        const { data: profileRows } = adminUserIds.length > 0
          ? await (admin.from("profiles") as any)
              .select("email")
              .in("id", adminUserIds)
          : { data: [] };

        const emailTargets = [
          ...(restaurant.notify_email && restaurant.notification_email ? [restaurant.notification_email] : []),
          ...((profileRows ?? []).map((profile: { email?: string | null }) => profile.email).filter(Boolean) as string[]),
        ];

        const uniqueRecipients = [...new Set(emailTargets.map((email) => email.toLowerCase()))];

        if (uniqueRecipients.length > 0 && resendApiKey) {
          try {
            await sendNoticeEmail({
              resendApiKey,
              recipients: uniqueRecipients,
              title: cleanTitle,
              message: cleanMessage,
              groupName: group?.name || "Enterprise notice",
              restaurantName: restaurant.name,
            });
            deliveredEmailAt = new Date().toISOString();
            emailedCount += 1;
            deliveryStatus = "delivered";
          } catch (error) {
            emailError = error instanceof Error ? error.message : "Email delivery failed";
            deliveryStatus = "partial";
          }
        } else if (uniqueRecipients.length > 0) {
          deliveryStatus = "partial";
          emailError = "RESEND_API_KEY is not configured";
        }
      }

      await (admin.from("enterprise_notice_targets") as any)
        .update({
          delivery_status: deliveryStatus,
          delivered_in_app_at: new Date().toISOString(),
          delivered_email_at: deliveredEmailAt,
          email_error: emailError,
        })
        .eq("notice_id", notice.id)
        .eq("restaurant_id", restaurant.id);
    }

    return json({
      success: true,
      notice_id: notice.id,
      target_count: targetRestaurants.length,
      delivered_count: deliveredCount,
      emailed_count: emailedCount,
    });
  } catch (error) {
    console.error("[send-enterprise-notice]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
