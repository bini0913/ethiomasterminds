import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

// Delivers live social and room-invite alerts while the user has Master Minds open.
// Server-side push delivery for a closed app is handled separately by the push backend.
export default function SocialRealtimeNotifications() {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();

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
            description: "Open Friends to accept or decline the request.",
            action: { label: "View", onClick: () => navigate("/friends?tab=requests") },
            duration: 10000,
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
            supabase.from("profiles").select("name, username").eq("id", invite.sender_id).maybeSingle(),
            supabase.from("multiplayer_rooms").select("name").eq("id", invite.room_id).maybeSingle(),
          ]);
          const senderName = profile?.name?.trim() || profile?.username?.trim() || "A friend";
          const roomName = room?.name?.trim() || "a multiplayer room";
          toast(`${senderName} invited you to play!`, {
            description: `Room: ${roomName}. Accept before the invite expires.`,
            action: {
              label: "Join",
              onClick: async () => {
                const { data, error } = await supabase.rpc("respond_multiplayer_invite", {
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
            duration: 15000,
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
  }, [isAuthenticated, user?.id, navigate]);

  return null;
}
