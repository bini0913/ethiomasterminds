import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

/**
 * In-app realtime alerts for incoming friend requests and multiplayer room invites.
 * This listens only for new events addressed to the current authenticated user;
 * the existing FriendsContext remains responsible for online/last-seen presence.
 */
export default function SocialRealtimeNotifications() {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let active = true;
    const channel = supabase
      .channel(`social-alerts:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friends", filter: `friend_id=eq.${user.id}` },
        async (payload) => {
          const request = payload.new as { id?: string; user_id?: string; friend_id?: string; status?: string };
          if (!active || request.friend_id !== user.id || request.status !== "pending" || !request.user_id) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", request.user_id)
            .maybeSingle();
          if (!active) return;
          const sender = profile?.name?.trim() || (profile?.username ? `@${profile.username}` : "Someone");
          toast(`New friend request from ${sender}`, {
            description: "Open Friends to accept or decline.",
            duration: 10000,
            action: { label: "View request", onClick: () => navigate("/friends") },
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "multiplayer_invites", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const invite = payload.new as { id?: string; room_id?: string; sender_id?: string; receiver_id?: string; status?: string };
          if (!active || invite.receiver_id !== user.id || invite.status !== "pending" || !invite.sender_id) return;

          const [{ data: profile }, { data: room }] = await Promise.all([
            supabase.from("profiles").select("name, username").eq("id", invite.sender_id).maybeSingle(),
            invite.room_id
              ? supabase.from("multiplayer_rooms").select("name").eq("id", invite.room_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          if (!active) return;
          const sender = profile?.name?.trim() || (profile?.username ? `@${profile.username}` : "A friend");
          const roomName = room?.name?.trim() || "a multiplayer room";
          toast(`${sender} invited you to play!`, {
            description: `Room: ${roomName}. Open Multiplayer to respond to the invite.`,
            duration: 12000,
            action: { label: "Open Multiplayer", onClick: () => navigate("/multiplayer") },
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Social realtime notifications connection:", status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, navigate]);

  return null;
}
