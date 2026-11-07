import { db } from "@/integrations/untypedClient";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

// Delivers live social and room-invite alerts while the user has Master Minds open.
// Server-side push delivery for a closed app is handled separately by the push backend.
export default function SocialRealtimeNotifications() {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel(`social-alerts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friends", filter: `friend_id=eq.${user.id}` },
        async (payload) => {
          const request = payload.new as { id?: string; user_id?: string; friend_id?: string; status?: string };
          if (request.status !== "pending" || !request.id || !request.user_id) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", request.user_id)
            .maybeSingle();
          const senderName = profile?.name?.trim() || profile?.username?.trim() || "Someone";
          toast(`New friend request from ${senderName}`, {
            description: "Accept or decline without leaving your current page.",
            action: {
              label: "Accept",
              onClick: async () => {
                const { error } = await db.rpc("respond_friend_request" as any, { p_request_id: request.id, p_accept: true } as any);
                if (error) { toast.error("Could not accept this friend request. Open Friends and try again."); return; }
                toast.success("Friend request accepted.");
              },
            },
            cancel: {
              label: "Decline",
              onClick: async () => {
                const { error } = await db.rpc("respond_friend_request" as any, { p_request_id: request.id, p_accept: false } as any);
                if (error) { toast.error("Could not decline this friend request. Open Friends and try again."); return; }
                toast.info("Friend request declined.");
              },
            },
            duration: 15000,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "multiplayer_invites", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const invite = payload.new as { id?: string; room_id?: string; sender_id?: string; status?: string; expires_at?: string };
          if (invite.status !== "pending" || !invite.id || !invite.room_id || !invite.sender_id) return;
          if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) return;

          const [{ data: profile }, { data: room }] = await Promise.all([
            db.from("profiles").select("name, username").eq("id", invite.sender_id).maybeSingle(),
            db.from("multiplayer_rooms").select("name").eq("id", invite.room_id).maybeSingle(),
          ]);
          const senderName = profile?.name?.trim() || profile?.username?.trim() || "A friend";
          const roomName = room?.name?.trim() || "a multiplayer room";
          toast(`${senderName} invited you to play!`, {
            description: `Room: ${roomName}. Accept before the invite expires.`,
            action: {
              label: "Join",
              onClick: async () => {
                const { data, error } = await db.rpc("respond_multiplayer_invite", {
                  _invite_id: invite.id,
                  _accept: true,
                });
                if (error) {
                  toast.error(error.message || "This invite is no longer available.");
                  return;
                }
                const result = data as { room_id?: string; status?: string } | null;
                if (result?.status === "accepted" && result.room_id) {
                  navigate(`/multiplayer?room=${encodeURIComponent(result.room_id)}`);
                } else {
                  toast.error("Could not accept this invite.");
                }
              },
            },
            cancel: {
              label: "Decline",
              onClick: async () => {
                const { data, error } = await db.rpc("respond_multiplayer_invite", {
                  _invite_id: invite.id,
                  _accept: false,
                });
                if (error) { toast.error("Could not decline this invite."); return; }
                const result = data as { status?: string } | null;
                if (result?.status === "declined") toast.info("Invitation declined.");
                else toast.error("This invitation could not be declined.");
              },
            },
            duration: 15000,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const message = payload.new as { id?: string; sender_id?: string; receiver_id?: string; content?: string };
          if (!message.id || !message.sender_id || message.sender_id === user.id) return;
          const activeFriendId = new URLSearchParams(location.search).get("friend");
          if (location.pathname === "/friends" && activeFriendId === message.sender_id) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", message.sender_id)
            .maybeSingle();
          const senderName = profile?.name?.trim() || profile?.username?.trim() || "Your friend";
          const preview = String(message.content ?? "").trim();
          toast(`Message from ${senderName}`, {
            description: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview || "You received a new message.",
            action: {
              label: "Reply",
              onClick: () => navigate(`/friends?friend=${encodeURIComponent(message.sender_id!)}`),
            },
            duration: 10000,
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Social notification realtime subscription:", status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, navigate, location.pathname, location.search]);

  return null;
}
