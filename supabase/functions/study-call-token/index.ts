import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const livekitUrl = Deno.env.get("LIVEKIT_URL");
  if (!supabaseUrl || !anonKey || !apiKey || !apiSecret || !livekitUrl) {
    return json({ error: "Study calling is not configured on the server yet." }, 503);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return json({ error: "Invalid or expired session" }, 401);

  let roomName = "";
  try {
    const body = await req.json();
    roomName = typeof body.roomName === "string" ? body.roomName : "";
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  // Room IDs are opaque UUIDs created by the app; never accept arbitrary long room names.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomName)) {
    return json({ error: "Invalid study call room" }, 400);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("study_call_participants")
    .select("room_id")
    .eq("room_id", roomName)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (membershipError || !membership) return json({ error: "You are not invited to this study call." }, 403);

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    ttl: "1h",
    metadata: JSON.stringify({ userId: user.id }),
  });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
  return json({ token: await token.toJwt(), serverUrl: livekitUrl });
});