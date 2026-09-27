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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const { code, code_type } = await req.json();
    if (typeof code !== "string" || code.length > 100 || !code.trim()) {
      return json({ error: "Code is required" }, 400);
    }
    if (!["teacher", "admin", "manager"].includes(code_type)) {
      return json({ error: "Invalid access code type" }, 400);
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Invalid authentication token" }, 401);
    }

    const { data, error } = await client.rpc("redeem_access_code", {
      p_code: code.trim(),
      p_code_type: code_type,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json(Array.isArray(data) ? data[0] : data);
  } catch (error) {
    console.error("redeem-access-code error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Access code redemption failed" },
      500,
    );
  }
});
