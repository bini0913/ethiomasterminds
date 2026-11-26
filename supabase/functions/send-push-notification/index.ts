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
type Payload = { kind: string; event_id?: string; data?: Record<string, string> };
type AuthorizedNotification = {
  recipient_id: string;
  notification_kind: string;
  notification_title: string;
  notification_body: string;
  notification_data: Record<string, unknown>;
};

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!url || !anonKey || !serviceRoleKey || !raw) return json({ error: "Push service configuration missing" }, 503);

    const bearer = auth.replace(/^Bearer\s+/i, "");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const payload = await req.json() as Payload;
    if (!payload.kind || payload.kind.length > 100) return json({ error: "kind is required" }, 400);

    const socialKinds = new Set(["friend_request", "direct_message", "study_call_invite"]);
    let authorized: AuthorizedNotification[] = [];

    if (!socialKinds.has(payload.kind)) {
      if (!payload.event_id) return json({ error: "A database-owned notification source is required" }, 400);
      const { data, error } = await userClient.rpc("authorize_staff_push_notification", {
        p_source_id: payload.event_id,
        p_kind: payload.kind,
      });
      if (error) return json({ error: error.message || "Staff notification was not authorized" }, 403);
      authorized = (data ?? []) as AuthorizedNotification[];
    } else {
      if (!payload.event_id) return json({ error: "A valid social event_id is required" }, 400);
      const callerId = authData.user.id;
      if (payload.kind === "friend_request") {
        const { data: event, error } = await admin.from("friends").select("id,user_id,friend_id,status").eq("id", payload.event_id).maybeSingle();
        if (error || !event || event.user_id !== callerId || event.status !== "pending") return json({ error: "Friend request not found or not authorized" }, 403);
        const { data: profile } = await admin.from("profiles").select("name,username").eq("id", callerId).maybeSingle();
        const senderName = profile?.name || profile?.username || "A student";
        authorized = [{ recipient_id: event.friend_id, notification_kind: payload.kind, notification_title: "New friend request", notification_body: senderName + " sent you a friend request.", notification_data: { request_id: event.id, route: "/friends", action: "friend_request" } }];
      } else if (payload.kind === "direct_message") {
        const { data: event, error } = await admin.from("messages").select("id,sender_id,receiver_id,content").eq("id", payload.event_id).maybeSingle();
        if (error || !event || event.sender_id !== callerId) return json({ error: "Message not found or not authorized" }, 403);
        const { data: friendship } = await admin.from("friends").select("id").eq("status", "accepted").or("and(user_id.eq." + event.sender_id + ",friend_id.eq." + event.receiver_id + "),and(user_id.eq." + event.receiver_id + ",friend_id.eq." + event.sender_id + ")").maybeSingle();
        if (!friendship) return json({ error: "Messages can only notify accepted friends" }, 403);
        const { data: profile } = await admin.from("profiles").select("name,username").eq("id", callerId).maybeSingle();
        const senderName = profile?.name || profile?.username || "Your friend";
        authorized = [{ recipient_id: event.receiver_id, notification_kind: payload.kind, notification_title: senderName, notification_body: String(event.content ?? "").slice(0, 180), notification_data: { message_id: event.id, sender_id: event.sender_id, route: "/friends", action: "reply" } }];
      } else {
        const { data: event, error } = await admin.from("study_call_participants").select("room_id,user_id,invited_by,status").eq("room_id", payload.event_id).eq("invited_by", callerId).eq("status", "invited").maybeSingle();
        if (error || !event) return json({ error: "Call invitation not found or not authorized" }, 403);
        authorized = [{ recipient_id: event.user_id, notification_kind: payload.kind, notification_title: "Incoming study call", notification_body: "Your friend invited you to a Study Mode call.", notification_data: { room_id: event.room_id, route: "/study-mode", action: "call_invite" } }];
      }
      const recipientId = authorized[0]?.recipient_id;
      const { data: blocked, error: blockCheckError } = await admin.rpc("are_users_blocked", { p_user_a: callerId, p_user_b: recipientId });
      if (blockCheckError) return json({ error: "Could not verify social safety settings" }, 500);
      if (blocked) return json({ skipped: true, reason: "users_blocked", sent: 0 }, 200);
    }

    if (!authorized.length) return json({ sent: 0, attempted: 0, reason: "no_authorized_recipients" });
    const serviceAccount = JSON.parse(raw) as ServiceAccount;
    const accessToken = await getGoogleAccessToken(serviceAccount);
    let sent = 0;
    let attempted = 0;
    const failures: Array<{ device_id: string; status: number; token_invalid: boolean }> = [];

    for (const item of authorized) {
      const title = item.notification_title.trim();
      const body = item.notification_body.trim();
      if (title.length > 160 || body.length > 2000) return json({ error: "Notification payload is too large" }, 400);
      const { data: prefs, error: prefsError } = await admin.from("notification_preferences").select("enabled,social,game_invites").eq("user_id", item.recipient_id).maybeSingle();
      if (prefsError) return json({ error: "Could not read notification preferences" }, 500);
      if (prefs?.enabled === false) continue;
      if (socialKinds.has(item.notification_kind) && prefs?.social === false) continue;
      if (item.notification_kind === "study_call_invite" && prefs?.game_invites === false) continue;
      const { data: devices, error: devicesError } = await admin.from("notification_devices").select("id,token").eq("user_id", item.recipient_id).eq("enabled", true);
      if (devicesError) return json({ error: "Could not read notification devices" }, 500);
      attempted += devices?.length ?? 0;
      for (const device of devices ?? []) {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token: device.token, data: { ...(item.notification_data ?? {}), ...(payload.data ?? {}), kind: item.notification_kind, title, body }, android: { priority: "HIGH" } } }),
        });
        if (response.ok) { sent++; continue; }
        const details = await response.text();
        const invalid = response.status === 404 && (details.includes("UNREGISTERED") || details.includes("registration-token-not-registered"));
        if (invalid) await admin.from("notification_devices").update({ enabled: false }).eq("id", device.id);
        failures.push({ device_id: device.id, status: response.status, token_invalid: invalid });
      }
      await admin.from("notification_events").insert({ user_id: item.recipient_id, kind: item.notification_kind, title, body, data: { ...(item.notification_data ?? {}), delivery_status: sent > 0 ? "sent" : "failed", sent }, delivered_at: sent > 0 ? new Date().toISOString() : null });
    }

    return json({ sent, attempted, failures, event_recorded: true });
  } catch (error) {
    console.error("send-push-notification failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Notification delivery failed" }, 500);
  }
});
