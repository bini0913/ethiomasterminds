import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type BlockedUser = { id: string; name: string; username: string | null };

const BlockedUsersManager: React.FC = () => {
  const { user } = useUser();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBlockedUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error } = await (supabase as any)
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Could not load blocked users:", error);
      toast.error("Blocked users could not be loaded.");
      setLoading(false);
      return;
    }
    const ids = (rows || []).map((row) => row.blocked_id);
    if (!ids.length) {
      setBlockedUsers([]);
      setLoading(false);
      return;
    }
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,name,username")
      .in("id", ids);
    if (profilesError) {
      console.error("Could not load blocked-user profiles:", profilesError);
      setBlockedUsers(ids.map((id) => ({ id, name: "Blocked account", username: null })));
    } else {
      const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
      setBlockedUsers(ids.map((id) => {
        const profile = byId.get(id);
        return { id, name: profile?.name || "Blocked account", username: profile?.username || null };
      }));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const unblock = async (blockedId: string) => {
    if (!user?.id) return;
    setSavingId(blockedId);
    const { error } = await (supabase as any)
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blockedId);
    setSavingId(null);
    if (error) {
      toast.error("This user could not be unblocked.");
      return;
    }
    toast.success("User unblocked.");
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Blocked users
        </CardTitle>
        <p className="text-sm text-muted-foreground">Manage accounts you have blocked. Unblocking does not automatically restore deleted friend or follow connections.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading blocked users…</p>
        ) : blockedUsers.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <UserRound className="h-4 w-4" /> You have not blocked anyone.
          </div>
        ) : blockedUsers.map((blockedUser) => (
          <div key={blockedUser.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{blockedUser.name}</p>
              {blockedUser.username && <p className="truncate text-xs text-muted-foreground">@{blockedUser.username}</p>}
            </div>
            <Button size="sm" variant="outline" disabled={savingId === blockedUser.id} onClick={() => void unblock(blockedUser.id)}>
              Unblock
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BlockedUsersManager;
