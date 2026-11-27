import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type ServiceCheck = { status: "healthy" | "degraded" | "not_configured"; checked_at: string; detail: string };

function base64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function checkFirebaseMessaging(): Promise<ServiceCheck> {
  const checked_at = new Date().toISOString();
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return { status: "not_configured", checked_at, detail: "FCM service account secret is not configured." };

  try {
    const serviceAccount = JSON.parse(raw) as { client_email?: string; private_key?: string; project_id?: string };
    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
      return { status: "degraded", checked_at, detail: "FCM service account configuration is incomplete." };
    }
    const now = Math.floor(Date.now() / 1000);
    const unsigned = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
      base64Url(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 300,
      }));
    const pem = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
    const der = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    ));
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: unsigned + "." + base64Url(signature),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { status: "degraded", checked_at, detail: `Google OAuth returned HTTP ${response.status}.` };
    }
    const token = await response.json();
    if (!token.access_token) return { status: "degraded", checked_at, detail: "Google OAuth did not return an access token." };

    // The deliberately invalid registration token cannot target a real device.
    // FCM should reject it with INVALID_ARGUMENT or UNREGISTERED if the API and
    // project authorization are reachable; no notification is delivered.
    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: "master-minds-health-check-invalid-registration-token",
            data: { health_check: "true" },
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const fcmBody = await fcmResponse.text();
    const expectedInvalidToken = fcmBody.includes("INVALID_ARGUMENT") || fcmBody.includes("UNREGISTERED");
    if ((fcmResponse.status === 400 || fcmResponse.status === 404) && expectedInvalidToken) {
      return { status: "healthy", checked_at, detail: "FCM API and project authorization responded as expected to a deliberately invalid token; no push was delivered." };
    }
    return { status: "degraded", checked_at, detail: `FCM API health probe returned HTTP ${fcmResponse.status} or an unexpected response.` };
  } catch {
    return { status: "degraded", checked_at, detail: "Firebase Messaging credential or OAuth check failed." };
  }
}

async function checkLiveKit(): Promise<ServiceCheck> {
  const checked_at = new Date().toISOString();
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const livekitUrl = Deno.env.get("LIVEKIT_URL");
  if (!apiKey || !apiSecret || !livekitUrl) {
    return { status: "not_configured", checked_at, detail: "LiveKit URL or server API credentials are not configured." };
  }

  try {
    const parsed = new URL(livekitUrl);
    if (parsed.protocol !== "wss:" && parsed.protocol !== "https:") {
      return { status: "degraded", checked_at, detail: "LiveKit must use a secure wss:// or https:// URL." };
    }
    const protocol = "https:";
    const endpoint = `${protocol}//${parsed.host}/twirp/livekit.RoomService/ListRooms`;
    const authorization = btoa(`${apiKey}:${apiSecret}`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { status: "degraded", checked_at, detail: `LiveKit RoomService returned HTTP ${response.status}.` };
    }
    return { status: "healthy", checked_at, detail: "LiveKit RoomService endpoint accepted the server credentials." };
  } catch {
    return { status: "degraded", checked_at, detail: "LiveKit endpoint or credential check failed." };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase function configuration is incomplete." }, 503);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401);

  const { error: accessError } = await client.rpc("extreme_admin_get_executive_metrics");
  if (accessError) return json({ error: "Extreme Admin access required" }, 403);

  const database: ServiceCheck = {
    status: "healthy",
    checked_at: new Date().toISOString(),
    detail: "The authenticated executive metrics RPC completed successfully.",
  };
  const [firebase, livekit] = await Promise.all([checkFirebaseMessaging(), checkLiveKit()]);
  return json({
    checked_at: new Date().toISOString(),
    database,
    firebase_messaging: firebase,
    livekit,
    note: "Checks validate database access, FCM API authorization with an intentionally invalid token, and LiveKit RoomService reachability. They do not send a notification or create a call room.",
  });
});
