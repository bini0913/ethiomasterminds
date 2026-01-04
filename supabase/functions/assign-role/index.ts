import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ ok: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { role } = await req.json();
    
    if (!role || !["student", "teacher", "admin", "manager"].includes(role)) {
      console.log("Invalid role provided:", role);
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Assigning role:", role);

    // Create Supabase client with user's token to get their ID
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user token to get user info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.log("Failed to get user:", userError);
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Call the assign_user_role function
    const { data, error } = await supabaseAdmin.rpc("assign_user_role", {
      p_user_id: user.id,
      p_role: role,
    });

    if (error) {
      console.error("Error assigning role:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to assign role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Role assigned successfully:", role, "to user:", user.id);

    return new Response(
      JSON.stringify({ ok: true, role }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
