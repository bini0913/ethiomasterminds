import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { code, code_type } = await req.json();
    
    if (!code || !code_type) {
      console.log('Missing code or code_type');
      return new Response(
        JSON.stringify({ error: 'Code and code_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Attempting to redeem code: ${code} for type: ${code_type}`);

    // Create Supabase client with user's JWT to get user info
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to get the user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.log('User not authenticated:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // Service role client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access code
    const { data: accessCode, error: codeError } = await adminClient
      .from('access_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('code_type', code_type)
      .eq('is_used', false)
      .maybeSingle();

    if (codeError) {
      console.log('Error checking access code:', codeError);
      return new Response(
        JSON.stringify({ error: 'Error validating code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accessCode) {
      console.log('Invalid or already used access code');
      return new Response(
        JSON.stringify({ error: 'Invalid or already used access code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code is expired
    if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
      console.log('Access code has expired');
      return new Response(
        JSON.stringify({ error: 'Access code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Access code valid, assigning role...');

    // Check if user already has this role
    const { data: existingRole } = await adminClient
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', code_type)
      .maybeSingle();

    if (existingRole) {
      console.log('User already has this role');
      return new Response(
        JSON.stringify({ ok: true, role: code_type, message: 'Role already assigned' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing student role if upgrading to teacher/admin
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', user.id)
      .eq('role', 'student');

    // Assign the new role
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({
        user_id: user.id,
        role: code_type
      });

    if (roleError) {
      console.log('Error assigning role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as used
    const { error: updateError } = await adminClient
      .from('access_codes')
      .update({
        is_used: true,
        used_by: user.id
      })
      .eq('id', accessCode.id);

    if (updateError) {
      console.log('Error marking code as used:', updateError);
      // Role is assigned, just log the error
    }

    console.log(`Successfully assigned role ${code_type} to user ${user.id}`);

    return new Response(
      JSON.stringify({ ok: true, role: code_type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
