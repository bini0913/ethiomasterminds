import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type ServiceAccount = { client_email: string; private_key: string; project_id: string };
type Payload = { user_id: string; kind: string; title: string; body: string; data?: Record<string, string> };

function b64(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getGoogleAccessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    b64(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (x) => x.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + b64(sig),
    }),
  });
  if (!response.ok) throw new Error("Google OAuth token request failed");
  return (await response.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!url || !serviceRoleKey || !raw) return json({ error: "Push service configuration missing" }, 503);

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const bearer = auth.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: callerRole, error: roleError } = await admin.rpc("get_user_role", { _user_id: authData.user.id });
    if (roleError) {
      console.error("Notification caller role lookup failed:", roleError);
      return json({ error: "Unable to verify notification permissions" }, 500);
    }

    const allowedRoles = new Set(["teacher", "admin", "manager", "extreme_admin"]);
    if (!allowedRoles.has(String(callerRole))) {
      return json({ error: "Not authorized to send push notifications" }, 403);
    }

    const payload = await req.json() as Payload;
    if (!payload.user_id || !payload.kind || !payload.title || !payload.body) {
      return json({ error: "user_id, kind, title and body are required" }, 400);
    }
    if (payload.title.length > 160 || payload.body.length > 2000 || payload.kind.length > 100) {
      return json({ error: "Notification payload is too large" }, 400);
    }

    const { data: prefs, error: prefsError } = await admin.from("notification_preferences")
      .select("enabled").eq("user_id", payload.user_id).maybeSingle();
    if (prefsError) return json({ error: "Could not read notification preferences" }, 500);
    if (prefs?.enabled === false) return json({ skipped: true, reason: "notifications_disabled", sent: 0 });

    const { data: devices, error: devicesError } = await admin.from("notification_devices")
      .select("id, token, platform, app_version").eq("user_id", payload.user_id).eq("enabled", true);
    if (devicesError) return json({ error: "Could not read notification devices" }, 500);
    if (!devices?.length) return json({ sent: 0, reason: "no_devices" });

    const serviceAccount = JSON.parse(raw) as ServiceAccount;
    const accessToken = await getGoogleAccessToken(serviceAccount);
    let sent = 0;
    const failures: Array<{ device_id: string; status: number; token_invalid: boolean }> = [];

    for (const device of devices) {
      const response = await fetch(
        \`https://fcm.googleapis.com/v1/projects/\${serviceAccount.project_id}/messages:send\`,
        {
          method: "POST",
          headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title: payload.title, body: payload.body },
              data: { ...(payload.data ?? {}), kind: payload.kind },
              android: { priority: "HIGH", notification: { channel_id: "master_minds_default" } },
            },
          }),
        },
      );

      if (response.ok) {
        sent++;
        continue;
      }

      const details = await response.text();
      const invalid = response.status === 404 &&
        (details.includes("UNREGISTERED") || details.includes("registration-token-not-registered"));
      if (invalid) await admin.from("notification_devices").update({ enabled: false }).eq("id", device.id);
      failures.push({ device_id: device.id, status: response.status, token_invalid: invalid });
    }

    const { error: eventError } = await admin.from("notification_events").insert({
      user_id: payload.user_id,
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      data: {
        ...(payload.data ?? {}),
        delivery_status: sent > 0 ? "sent" : "failed",
        sent,
        attempted: devices.length,
        failure_count: failures.length,
      },
      delivered_at: sent > 0 ? new Date().toISOString() : null,
    });

    return json({ sent, attempted: devices.length, failures, event_recorded: !eventError });
  } catch (error) {
    console.error("send-push-notification failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Notification delivery failed" }, 500);
  }
});
