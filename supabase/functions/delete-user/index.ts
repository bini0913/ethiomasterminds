import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ ok: false, error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await supabaseAdmin.rpc("get_user_role", { _user_id: user.id });
    const { data: targetRole } = await supabaseAdmin.rpc("get_user_role", { _user_id: target_user_id });

    if (callerRole !== "admin" && callerRole !== "manager") {
      return new Response(JSON.stringify({ ok: false, error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerRole === "manager" && !["student", "teacher"].includes(targetRole || "")) {
      return new Response(JSON.stringify({ ok: false, error: "Managers can only delete student/teacher accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Remove role/profile rows first (if they exist) so linked records are cleaned up.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", target_user_id);

    // Delete auth account (hard delete).
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);

    if (deleteAuthError) {
      return new Response(JSON.stringify({ ok: false, error: deleteAuthError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, deleted_user_id: target_user_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-user error", error);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
