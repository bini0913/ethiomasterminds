import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const todayUtc = () => new Date().toISOString().slice(0, 10);

async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function assignForUser(client: ReturnType<typeof adminClient>, userId: string) {
  const date = todayUtc();

  const { data: existing, error: existingError } = await client
    .from("user_missions")
    .select("id")
    .eq("user_id", userId)
    .eq("mission_date", date)
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length > 0) {
    return { assigned: 0, alreadyAssigned: true };
  }

  const { data: activeMissions, error: missionError } = await client
    .from("daily_missions")
    .select("id")
    .eq("is_active", true);

  if (missionError) throw missionError;
  if (!activeMissions || activeMissions.length === 0) {
    return { assigned: 0, alreadyAssigned: false };
  }

  const selected = [...activeMissions]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const { error: insertError } = await client.from("user_missions").insert(
    selected.map((mission) => ({
      user_id: userId,
      mission_id: mission.id,
      mission_date: date,
      progress: 0,
      completed: false,
      claimed: false,
    })),
  );

  if (insertError) throw insertError;
  return { assigned: selected.length, alreadyAssigned: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";

    // reset_all is service-to-service only. Never accept a caller-supplied user id.
    if (action === "reset_all") {
      const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authorization = req.headers.get("Authorization");
      if (!expected || authorization !== `Bearer ${expected}`) {
        return json({ error: "Service authentication required" }, 401);
      }

      const client = adminClient();
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activeUsers, error: usersError } = await client
        .from("user_streaks")
        .select("user_id")
        .gte("last_activity_date", since);

      if (usersError) throw usersError;

      let usersProcessed = 0;
      for (const row of activeUsers ?? []) {
        const result = await assignForUser(client, row.user_id);
        if (result.assigned > 0) usersProcessed += 1;
      }

      return json({ success: true, usersProcessed });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: "Authentication required" }, 401);

    const client = adminClient();

    if (action === "assign") {
      const result = await assignForUser(client, user.id);
      return json({
        success: true,
        missionsAssigned: result.assigned,
        alreadyAssigned: result.alreadyAssigned,
      });
    }

    if (action === "claim") {
      const missionId = typeof body?.missionId === "string" ? body.missionId : "";
      if (!missionId || missionId.length > 100) {
        return json({ error: "A valid missionId is required" }, 400);
      }

      // The database function locks the mission row and performs the reward
      // atomically, so concurrent requests cannot double-claim.
      const { data, error } = await client.rpc("claim_daily_mission", {
        p_user_mission_id: missionId,
      });

      if (error) {
        return json({ error: error.message }, 400);
      }

      const result = Array.isArray(data) ? data[0] : data;
      return json(result ?? { success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("daily-missions error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Daily mission request failed" },
      500,
    );
  }
});
