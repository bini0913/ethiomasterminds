import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const userIdFromBody = typeof body?.userId === "string" ? body.userId : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // reset_all is a server-only scheduled operation. Never accept a client user id for it.
    if (action === "reset_all") {
      const cronSecret = Deno.env.get("DAILY_MISSIONS_CRON_SECRET");
      if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
        return json({ error: "Forbidden" }, 403);
      }

      const today = new Date().toISOString().split("T")[0];
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activeUsers, error: usersError } = await admin
        .from("user_streaks")
        .select("user_id")
        .gte("last_activity_date", cutoff);

      if (usersError) throw usersError;

      const { data: activeMissions, error: missionsError } = await admin
        .from("daily_missions")
        .select("id")
        .eq("is_active", true);

      if (missionsError) throw missionsError;
      if (!activeMissions?.length) return json({ message: "No active missions available" });

      let assignedCount = 0;
      for (const activeUser of activeUsers ?? []) {
        const { data: existing } = await admin
          .from("user_missions")
          .select("id")
          .eq("user_id", activeUser.user_id)
          .eq("mission_date", today)
          .limit(1);

        if (existing?.length) continue;

        const selected = [...activeMissions]
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((mission) => ({
            user_id: activeUser.user_id,
            mission_id: mission.id,
            mission_date: today,
            progress: 0,
            completed: false,
            claimed: false,
          }));

        if (selected.length) {
          const { error } = await admin.from("user_missions").insert(selected);
          if (!error) assignedCount++;
        }
      }

      return json({ success: true, usersProcessed: assignedCount });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Invalid authentication token" }, 401);

    const userId = authData.user.id;
    if (userIdFromBody && userIdFromBody !== userId) return json({ error: "User mismatch" }, 403);

    if (action === "assign") {
      const rateLimit = await userClient.rpc("consume_edge_rate_limit", {
        p_bucket: "daily-missions-assign",
        p_limit: 3,
        p_window_seconds: 3600,
      });
      if (rateLimit.error) throw rateLimit.error;
      if (!rateLimit.data) return json({ error: "Too many mission assignment attempts. Please try again later." }, 429);

      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await admin
        .from("user_missions")
        .select("id")
        .eq("user_id", userId)
        .eq("mission_date", today)
        .limit(1);

      if (existing?.length) return json({ message: "Missions already assigned for today" });

      const { data: activeMissions, error } = await admin
        .from("daily_missions")
        .select("id")
        .eq("is_active", true);

      if (error) throw error;
      if (!activeMissions?.length) return json({ message: "No active missions available" });

      const selected = [...activeMissions]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((mission) => ({
          user_id: userId,
          mission_id: mission.id,
          mission_date: today,
          progress: 0,
          completed: false,
          claimed: false,
        }));

      const { error: insertError } = await admin.from("user_missions").insert(selected);
      if (insertError) throw insertError;

      return json({ success: true, missionsAssigned: selected.length });
    }

    if (action === "claim") {
      const missionId = typeof body?.missionId === "string" ? body.missionId : "";
      if (!missionId) return json({ error: "missionId is required" }, 400);

      // Reward calculation and the claimed flag are handled atomically by PostgreSQL.
      const { data, error } = await userClient.rpc("claim_daily_mission", {
        p_mission_id: missionId,
      });

      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Error in daily-missions function:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
