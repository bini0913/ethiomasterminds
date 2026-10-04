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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Server configuration missing" }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "Invalid or expired token" }, 401);

    const callerId = authData.user.id;
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: callerRole, error: callerRoleError } = await adminClient.rpc("get_user_role", { _user_id: callerId });

    // Self-assignment is only allowed for the normal student role.
    // Use the service-role client for the final insert because the RPC's auth.uid()
    // refers to the service-role request context and therefore cannot authorize
    // this authenticated caller.
    if (!targetUserId || targetUserId === callerId) {
      if (role !== "student") return json({ ok: false, error: "You cannot self-assign a privileged role" }, 403);

      const { error } = await adminClient
        .from("user_roles")
        .upsert({ user_id: callerId, role: "student" }, { onConflict: "user_id,role" });
      if (error) {
        console.error("Error assigning student role:", error);
        return json({ ok: false, error: "Failed to assign role" }, 500);
      }
      return json({ ok: true, role: "student" });
    }

    if (callerRoleError) {
      console.error("Error resolving caller role:", callerRoleError);
      return json({ ok: false, error: "Unable to verify permissions" }, 500);
    }

    if (callerRole !== "admin" && callerRole !== "manager" && callerRole !== "extreme_admin") {
      return json({ ok: false, error: "Not authorized to change other users' roles" }, 403);
    }

    // Managers may manage student/teacher roles; only admins/extreme_admin can grant admin/manager.
    if ((role === "admin" || role === "manager") && callerRole !== "admin" && callerRole !== "extreme_admin") {
      return json({ ok: false, error: "Only admins can grant admin or manager roles" }, 403);
    }

    const { error } = await adminClient
      .from("user_roles")
      .upsert({ user_id: targetUserId, role }, { onConflict: "user_id,role" });

    if (error) {
      console.error("Error assigning role:", error);
      return json({ ok: false, error: "Failed to assign role" }, 500);
    }

    return json({ ok: true, role });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});