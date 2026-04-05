import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * expire-trials — scheduled edge function (run daily via Supabase cron)
 *
 * Marks restaurants whose trial_ends_at has passed and are not on an active
 * paid plan as "inactive". Business rule lives here, not in browser code.
 *
 * Schedule in Supabase dashboard:
 *   Cron expression : 0 0 * * *   (midnight UTC daily)
 *   HTTP method     : POST
 *   URL             : <project-url>/functions/v1/expire-trials
 *   Auth header     : Authorization: Bearer <service-role-key>
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Only the service-role key or the Supabase cron runner should call this.
  // Reject anon/authenticated JWT tokens.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date().toISOString();

    // Find all restaurants whose trial has ended and are not on a paid plan
    const { data: expired, error: fetchErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, trial_ends_at, status")
      .lt("trial_ends_at", now)
      .neq("status", "active_paid")
      .neq("status", "inactive"); // skip already-inactive ones

    if (fetchErr) throw fetchErr;
    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ expired: 0, message: "No trials to expire" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = expired.map((r: { id: string }) => r.id);
    const { error: updateErr } = await supabaseAdmin
      .from("restaurants")
      .update({ status: "inactive" })
      .in("id", ids);

    if (updateErr) throw updateErr;

    console.log(`expire-trials: marked ${ids.length} restaurant(s) inactive`, ids);

    return new Response(
      JSON.stringify({ expired: ids.length, ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("expire-trials error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
