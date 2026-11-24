import React, { useCallback, useEffect, useState } from "react";
import { ShieldBan, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

type BlockedUser = {
  id: string;
  name: string;
  username: string | null;
  created_at: string;
};

const BlockedUsersPanel: React.FC = () => {
  const { user } = useUser();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    if (!user?.id) {
      setBlockedUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: blocks, error } = await (supabase as any)
        .from("user_blocks")
        .select("blocked_user_id, created_at")
        .eq("blocker_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (blocks || []).map((row) => row.blocked_user_id);
      if (!ids.length) {
        setBlockedUsers([]);
        return;
      }

      const { data: profiles, error: profileError } = await (supabase as any)
        .from("profiles")
        .select("id, name, username")
        .in("id", ids);
      if (profileError) throw profileError;

      const profileMap = new Map<string, { name?: string | null; username?: string | null }>(
        (profiles || []).map((profile: { id: string; name?: string | null; username?: string | null }) =>
          [profile.id, profile] as [string, { name?: string | null; username?: string | null }]
        )
      );
      setBlockedUsers((blocks || []).map((block) => {
        const profile = profileMap.get(block.blocked_user_id);
        return {
          id: block.blocked_user_id,
          name: profile?.name || "Master Minds user",
          username: profile?.username || null,
          created_at: block.created_at,
        };
      }));
    } catch (error) {
      console.error("Could not load blocked users:", error);
      toast.error("Your blocked-user list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadBlockedUsers();
  }, [loadBlockedUsers]);

  const unblockUser = async (blockedUserId: string) => {
    if (!user?.id) return;
    setUnblockingId(blockedUserId);
    try {
      const { error } = await (supabase as any)
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_user_id", blockedUserId);
      if (error) throw error;
      toast.success("User unblocked.");
      await loadBlockedUsers();
    } catch (error) {
      console.error("Could not unblock user:", error);
      toast.error("Could not unblock this user. Please try again.");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <Card className="glass border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5" />
          Blocked users
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Blocked accounts cannot send you direct messages, friend requests, multiplayer invitations, or Study Mode call invitations.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading blocked users…</p>
        ) : blockedUsers.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRoundX className="h-4 w-4" />
            You have not blocked anyone.
          </div>
        ) : (
          blockedUsers.map((blocked) => (
            <div key={blocked.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{blocked.name}</p>
                {blocked.username && <p className="truncate text-xs text-muted-foreground">@{blocked.username}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={unblockingId === blocked.id}
                onClick={() => void unblockUser(blocked.id)}
              >
                Unblock
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default BlockedUsersPanel;
