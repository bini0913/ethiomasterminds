import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey) return json({ error: "Server configuration error" }, 500);
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Invalid authentication token" }, 401);

    const rateLimit = await userClient.rpc("consume_edge_rate_limit", {
      p_bucket: "award-rewards",
      p_limit: 20,
      p_window_seconds: 60,
    });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return json({ error: "Too many reward requests. Please try again shortly." }, 429);

    const body = await req.json();
    const submissionId = body?.submissionId ?? body?.submission_id;

    if (
      typeof submissionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)
    ) {
      return json({ error: "A finalized quiz submissionId is required" }, 400);
    }

    // The score, correct answers, time, and XP are deliberately NOT accepted
    // from the client. The secure quiz submission and reward RPCs own all
    // grading and reward calculations.
    const { data, error } = await userClient.rpc("claim_quiz_reward", {
      p_submission_id: submissionId,
    });

    if (error) {
      console.error("Quiz reward claim failed:", error.message);
      return json({ error: "Reward claim could not be completed" }, 400);
    }

    const result = Array.isArray(data) ? data[0] : data;

    return json({
      success: true,
      xpAwarded: result?.xp_awarded ?? 0,
      coinsAwarded: result?.coins_awarded ?? 0,
      newLevel: result?.new_level ?? null,
      alreadyClaimed: result?.already_claimed ?? false,
      ineligible: result?.ineligible ?? false,
    });
  } catch (error) {
    console.error("Error claiming quiz reward:", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Reward processing failed" }, 500);
  }
});
