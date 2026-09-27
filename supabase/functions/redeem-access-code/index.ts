import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const codeType = typeof body?.code_type === "string" ? body.code_type.trim() : "";
    if (!code || code.length > 64 || !["teacher", "admin", "manager"].includes(codeType)) {
      return new Response(JSON.stringify({ error: "Invalid access code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return new Response(JSON.stringify({ error: "Invalid authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Privileged access-code redemption is intentionally much more tightly
    // rate-limited than normal API calls to prevent brute-force attempts.
    const rateLimit = await userClient.rpc("consume_edge_rate_limit", {
      p_bucket: "redeem-access-code",
      p_limit: 5,
      p_window_seconds: 900,
    });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) {
      return new Response(JSON.stringify({ error: "Too many access-code attempts. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await userClient.rpc("redeem_access_code", {
      p_code: code,
      p_code_type: codeType,
    });

    if (error) return new Response(JSON.stringify({ error: "Invalid or already used access code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
