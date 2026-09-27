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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const token = authHeader.slice("Bearer ".length);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return json({ error: "Invalid authentication token" }, 401);
    }

    const body = await req.json();
    const submissionId = body?.submissionId ?? body?.submission_id;

    if (typeof submissionId !== "string" || submissionId.length > 100) {
      return json({ error: "A finalized quiz submissionId is required" }, 400);
    }

    // The score, correct answers, time, and XP are deliberately NOT accepted
    // from the client. They must already exist in quiz_results and are computed
    // by submit_quiz_result_secure from the stored answer key.
    const { data, error } = await admin.rpc("claim_quiz_reward", {
      p_submission_id: submissionId,
    });

    if (error) {
      console.error("Quiz reward claim failed:", error);
      return json({ error: error.message }, 400);
    }

    const result = Array.isArray(data) ? data[0] : data;

    return json({
      success: true,
      xpAwarded: result?.xp_awarded ?? 0,
      coinsAwarded: result?.coins_awarded ?? 0,
      newLevel: result?.new_level ?? null,
      alreadyClaimed: result?.already_claimed ?? false,
    });
  } catch (error) {
    console.error("Error claiming quiz reward:", error);
    return json({ error: error instanceof Error ? error.message : "Reward processing failed" }, 500);
  }
});
