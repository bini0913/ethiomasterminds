import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type ActionPayload = {
  action?: string;
  request_id?: string;
  room_id?: string;
  message_id?: string;
  reply?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to respond to this notification." }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return json({ error: "Notification actions are not configured." }, 503);

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your session expired. Open Master Minds and sign in again." }, 401);

    const payload = await req.json() as ActionPayload;
    const userId = authData.user.id;

    if (payload.action === "friend_accept" || payload.action === "friend_decline") {
      if (!payload.request_id) return json({ error: "Missing friend request." }, 400);
      const { data: request, error } = await admin.from("friends").select("id,friend_id,status")
        .eq("id", payload.request_id).maybeSingle();
      if (error) return json({ error: "Could not load the friend request." }, 500);
      if (!request || request.friend_id !== userId) return json({ error: "This friend request is not addressed to your account." }, 403);
      if (request.status !== "pending") return json({ error: "This friend request has already been handled." }, 409);
      const { error: updateError } = await admin.rpc("respond_friend_request", {
        p_request_id: request.id,
        p_accept: payload.action === "friend_accept",
      }, { });
      if (updateError) return json({ error: "Could not update the friend request." }, 409);
      return json({ ok: true, action: payload.action });
    }

    if (payload.action === "call_accept" || payload.action === "call_decline") {
      if (!payload.room_id) return json({ error: "Missing call invitation." }, 400);
      const { data: invite, error } = await admin.from("study_call_participants")
        .select("room_id,user_id,status").eq("room_id", payload.room_id)
        .eq("user_id", userId).maybeSingle();
      if (error) return json({ error: "Could not load the call invitation." }, 500);
      if (!invite) return json({ error: "This call invitation is not addressed to your account." }, 403);
      if (invite.status !== "invited") return json({ error: "This call invitation has already been handled." }, 409);
      const { data: room, error: roomError } = await admin.from("study_call_rooms").select("id,ended_at")
        .eq("id", invite.room_id).maybeSingle();
      if (roomError || !room || room.ended_at) return json({ error: "This study call has ended." }, 409);
      const { error: updateError } = await admin.from("study_call_participants").update({
        status: payload.action === "call_accept" ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      }).eq("room_id", invite.room_id).eq("user_id", userId).eq("status", "invited");
      if (updateError) return json({ error: "Could not respond to the call invitation." }, 409);
      return json({ ok: true, action: payload.action, room_id: invite.room_id });
    }

    if (payload.action === "message_reply") {
      const reply = payload.reply?.trim();
      if (!payload.message_id || !reply) return json({ error: "Type a reply before sending." }, 400);
      if (reply.length > 2000) return json({ error: "Replies must be 2,000 characters or fewer." }, 400);
      const { data: message, error } = await admin.from("messages")
        .select("id,sender_id,receiver_id").eq("id", payload.message_id).maybeSingle();
      if (error) return json({ error: "Could not load the message." }, 500);
      if (!message || message.receiver_id !== userId) return json({ error: "This message is not addressed to your account." }, 403);
      const { data: friendship, error: friendshipError } = await admin.from("friends").select("id")
        .eq("status", "accepted")
        .or("and(user_id.eq." + userId + ",friend_id.eq." + message.sender_id + "),and(user_id.eq." + message.sender_id + ",friend_id.eq." + userId + ")")
        .maybeSingle();
      if (friendshipError || !friendship) return json({ error: "Replies are only available to accepted friends." }, 403);
      const { data: inserted, error: insertError } = await admin.rpc("send_direct_message", {
        p_receiver_id: message.sender_id,
        p_content: reply,
      });
      if (insertError || !inserted) return json({ error: "Your reply could not be sent." }, 409);
      return json({ ok: true, action: "message_reply", message_id: inserted.id });
    }

    return json({ error: "Unsupported notification action." }, 400);
  } catch (error) {
    console.error("notification-action failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not process this notification action." }, 500);
  }
});
