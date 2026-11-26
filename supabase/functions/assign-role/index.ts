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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Authentication required" }, 401);

    const body = await req.json();
    const role = body?.role;
    const targetUserId = body?.target_user_id ?? null;
    if (!["student", "teacher", "admin", "manager"].includes(role)) {
      return json({ ok: false, error: "Invalid role" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Server configuration missing" }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "Invalid or expired token" }, 401);

    const { error } = await userClient.rpc("platform_assign_role", {
      p_user_id: targetUserId || authData.user.id,
      p_role: role,
    });
    if (error) {
      const message = error.message || "Role assignment was denied";
      const forbidden = /required|authorized|self-assign|top-level|cannot be changed/i.test(message);
      return json({ ok: false, error: message }, forbidden ? 403 : 400);
    }

    return json({ ok: true, role });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
