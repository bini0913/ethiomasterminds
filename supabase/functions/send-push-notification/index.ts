import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

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
type Payload = { kind: string; event_id?: string };
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
    if (!url || !anonKey || !serviceRoleKey) return json({ error: "Push service configuration missing" }, 503);

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

    const socialKinds = new Set(["friend_request", "direct_message", "study_call_invite", "multiplayer_invite"]);
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
      } else if (payload.kind === "multiplayer_invite") {
        const { data: event, error } = await admin.from("multiplayer_invites")
          .select("id,room_id,sender_id,receiver_id,status,expires_at")
          .eq("id", payload.event_id)
          .eq("sender_id", callerId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (error || !event) return json({ error: "Multiplayer invitation not found or not authorized" }, 403);
        const { data: profile } = await admin.from("profiles").select("name,username").eq("id", callerId).maybeSingle();
        const senderName = profile?.name || profile?.username || "A student";
        authorized = [{
          recipient_id: event.receiver_id,
          notification_kind: payload.kind,
          notification_title: "Multiplayer invitation",
          notification_body: senderName + " invited you to a multiplayer match.",
          notification_data: { invite_id: event.id, room_id: event.room_id, route: "/multiplayer", action: "multiplayer_invite" },
        }];
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
    for (const item of authorized) {
      if (!item.notification_title?.trim() || !item.notification_body?.trim() || item.notification_title.length > 180 || item.notification_body.length > 1200) {
        return json({ error: "Invalid notification payload" }, 400);
      }
    }

    // Persist every authorized notification before checking push preferences or
    // device availability. The in-app inbox must work even when push is off.
    const { data: inboxEvents, error: inboxError } = await admin.from("notification_events").insert(
      authorized.map((item) => ({
        user_id: item.recipient_id,
        kind: item.notification_kind,
        title: item.notification_title.trim(),
        body: item.notification_body.trim(),
        data: { ...(item.notification_data ?? {}), delivery_status: "not_attempted", sent: 0, attempted: 0, failure_count: 0 },
      })),
    ).select("id,user_id");
    if (inboxError) return json({ error: "Could not record notification inbox event" }, 500);
    const eventIdByRecipient = new Map((inboxEvents ?? []).map((event) => [event.user_id, event.id]));

    if (!raw) {
      return json({ error: "Push service configuration missing; inbox event was recorded", inbox_recorded: true, sent: 0, attempted: 0 }, 503);
    }
    const serviceAccount = JSON.parse(raw) as ServiceAccount;
    const accessToken = await getGoogleAccessToken(serviceAccount);
    let sent = 0;
    let attempted = 0;
    let skippedPreferences = 0;
    let noEligibleDevices = 0;
    const failures: Array<{ device_id: string; status: number; token_invalid: boolean }> = [];

    for (const item of authorized) {
      const title = item.notification_title.trim();
      const body = item.notification_body.trim();
      if (!title || !body || title.length > 160 || body.length > 2000) return json({ error: "Notification payload is invalid" }, 400);
      const { data: prefs, error: prefsError } = await admin.from("notification_preferences").select("enabled,social,game_invites,new_content,study_reminders").eq("user_id", item.recipient_id).maybeSingle();
      if (prefsError) return json({ error: "Could not read notification preferences" }, 500);
      const preferenceKey = ["study_call_invite", "multiplayer_invite"].includes(item.notification_kind)
        ? "game_invites"
        : socialKinds.has(item.notification_kind)
          ? "social"
          : item.notification_kind === "quiz_assignment"
            ? "study_reminders"
            : "new_content";
      const preferenceDisabled = prefs?.enabled === false || prefs?.[preferenceKey] === false;
      const { data: devices, error: devicesError } = preferenceDisabled
        ? { data: [], error: null }
        : await admin.from("notification_devices").select("id,token").eq("user_id", item.recipient_id).eq("enabled", true);
      if (devicesError) return json({ error: "Could not read notification devices" }, 500);
      const itemAttempted = devices?.length ?? 0;
      if (preferenceDisabled) skippedPreferences += 1;
      else if (itemAttempted === 0) noEligibleDevices += 1;
      const itemFailures: Array<{ device_id: string; status: number; token_invalid: boolean }> = [];
      let itemSent = 0;
      attempted += itemAttempted;
      for (const device of devices ?? []) {
        const response = await fetch("https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token: device.token, data: { ...(item.notification_data ?? {}), kind: item.notification_kind, title, body }, android: { priority: "HIGH" } } }),
        });
        if (response.ok) { sent++; itemSent++; continue; }
        const details = await response.text();
        const invalid = response.status === 404 && (details.includes("UNREGISTERED") || details.includes("registration-token-not-registered"));
        if (invalid) await admin.from("notification_devices").update({ enabled: false }).eq("id", device.id);
        const failure = { device_id: device.id, status: response.status, token_invalid: invalid };
        failures.push(failure);
        itemFailures.push(failure);
      }
      const eventId = eventIdByRecipient.get(item.recipient_id);
      if (!eventId) return json({ error: "Notification inbox event could not be resolved", sent, attempted, failures }, 500);
      const deliveryStatus = preferenceDisabled
        ? "skipped_preferences"
        : itemSent > 0
          ? "sent"
          : itemAttempted === 0
            ? "no_eligible_devices"
            : "failed";
      const { error: eventUpdateError } = await admin.from("notification_events").update({
        data: {
          ...(item.notification_data ?? {}),
          delivery_status: deliveryStatus,
          delivery_reason: preferenceDisabled ? "recipient_preference_disabled" : itemAttempted === 0 ? "no_enabled_device" : null,
          sent: itemSent,
          attempted: itemAttempted,
          failure_count: itemFailures.length,
        },
        delivered_at: itemSent > 0 ? new Date().toISOString() : null,
      }).eq("id", eventId);
      if (eventUpdateError) return json({ error: "Could not update notification delivery status", sent, attempted, failures, inbox_recorded: true }, 500);
    }

    return json({ sent, attempted, failures, event_recorded: true, skipped_preferences: skippedPreferences, no_eligible_devices: noEligibleDevices });
  } catch (error) {
    console.error("send-push-notification failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Notification delivery failed" }, 500);
  }
});
