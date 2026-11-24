import React, { useState } from "react";
import { ShieldBan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BlockUserButtonProps {
  userId: string;
  displayName?: string;
  onBlocked?: () => void;
}

const BlockUserButton: React.FC<BlockUserButtonProps> = ({ userId, displayName = "this user", onBlocked }) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const blockUser = async () => {
    if (!user?.id || !userId || user.id === userId || loading) return;
    if (!window.confirm(`Block ${displayName}? They will no longer be able to contact you through direct messages, friend requests, Study Mode calls or multiplayer invites. Existing friendship and follow links will be removed.`)) return;

    setLoading(true);
    try {
      const { error } = await (supabase as any).from("user_blocks").insert({
        blocker_id: user.id,
        blocked_id: userId,
      });
      if (error && error.code !== "23505") throw error;
      toast.success(`${displayName} has been blocked.`);
      onBlocked?.();
    } catch (error) {
      console.error("Could not block user:", error);
      toast.error("We couldn't block this user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.id === userId) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => void blockUser()}
      disabled={loading}
      aria-label={`Block ${displayName}`}
      title={`Block ${displayName}`}
    >
      <ShieldBan className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
};

export default BlockUserButton;
