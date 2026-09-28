import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const role = body?.role;
    const targetUserId = body?.target_user_id ?? null;

    if (!["student", "teacher", "admin", "manager"].includes(role)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or expired token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = authData.user.id;
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: callerRole } = await adminClient.rpc("get_user_role", { _user_id: callerId });

    // Self-assignment is only allowed for the normal student role.
    if (!targetUserId || targetUserId === callerId) {
      if (role !== "student") {
        return new Response(JSON.stringify({ ok: false, error: "You cannot self-assign a privileged role" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await adminClient.rpc("assign_user_role", { _user_id: callerId, _role: "student" });
      if (error) return new Response(JSON.stringify({ ok: false, error: "Failed to assign role" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, role: data ?? "student" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (callerRole !== "admin" && callerRole !== "manager" && callerRole !== "extreme_admin") {
      return new Response(JSON.stringify({ ok: false, error: "Not authorized to change other users' roles" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Managers may manage student/teacher roles; only admins/extreme_admin can grant admin/manager.
    if ((role === "admin" || role === "manager") && callerRole !== "admin" && callerRole !== "extreme_admin") {
      return new Response(JSON.stringify({ ok: false, error: "Only admins can grant admin or manager roles" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error } = await adminClient.rpc("assign_user_role", {
      _user_id: targetUserId,
      _role: role,
    });

    if (error) {
      console.error("Error assigning role:", error);
      return new Response(JSON.stringify({ ok: false, error: "Failed to assign role" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, role }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
