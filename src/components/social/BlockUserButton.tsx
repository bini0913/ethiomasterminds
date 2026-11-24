import React, { useState } from "react";
import { ShieldBan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

type BlockUserButtonProps = {
  userId: string;
  userName?: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
  onBlocked?: () => void;
};

const BlockUserButton: React.FC<BlockUserButtonProps> = ({
  userId,
  userName = "this user",
  size = "icon",
  variant = "ghost",
  onBlocked,
}) => {
  const { user } = useUser();
  const [blocking, setBlocking] = useState(false);

  if (!user?.id || user.id === userId) return null;

  const block = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (blocking) return;
    const confirmed = window.confirm(
      `Block ${userName}? They will not be able to contact you or interact with your posts. You can unblock them later in Settings → Privacy.`
    );
    if (!confirmed) return;

    setBlocking(true);
    try {
      const { error } = await (supabase as any).from("user_blocks").insert({
        blocker_id: user.id,
        blocked_user_id: userId,
      });
      if (error && error.code !== "23505") throw error;
      toast.success(`${userName} has been blocked.`);
      onBlocked?.();
    } catch (error) {
      console.error("Could not block user:", error);
      toast.error("Could not block this user. Please try again.");
    } finally {
      setBlocking(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={blocking}
      title={`Block ${userName}`}
      aria-label={`Block ${userName}`}
      onClick={block}
      className="text-destructive hover:bg-destructive/10"
    >
      <ShieldBan className="h-4 w-4" />
      {size !== "icon" && <span className="ml-1">{blocking ? "Blocking…" : "Block"}</span>}
    </Button>
  );
};

export default BlockUserButton;
