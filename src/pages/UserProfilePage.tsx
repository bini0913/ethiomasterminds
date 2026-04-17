import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Flame, Gem, Package, Send, Sword, Trophy, UserRoundPlus } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { createFollowChallenge, fetchFollowerCounts, fetchFollowing, fetchLeaderboardUsers, followUser, rankScore, tierStyle, unfollowUser, type LeaderboardUser } from "@/lib/leaderboardApi";
import { getNextRankTier, getRankTierByLevel, getXpProgressInLevel, playRankUpTone } from "@/lib/rankSystem";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: authUser } = useUser();
  const { coins, gems, transferCoins, refreshCurrency } = useCurrency();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [statsJson, setStatsJson] = useState<Record<string, any>>({});
  const [insights, setInsights] = useState<{ strong: string[]; weak: string[]; recommended: string[] }>({ strong: [], weak: [], recommended: [] });
  const [activities, setActivities] = useState<Array<{ id: string; text: string; time: string }>>([]);
  const [achievements, setAchievements] = useState<Array<{ id: string; name: string; icon: string; date: string }>>([]);
  const [privacy, setPrivacy] = useState({ isPublic: true, hideStats: false });
  const previousLevelRef = useRef<number | null>(null);
  const previousRankRef = useRef<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("10");
  const [isFriend, setIsFriend] = useState(false);
  const [ownedItems, setOwnedItems] = useState(0);
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null);

  const refreshCore = async () => {
    const rows = await fetchLeaderboardUsers();
    setUsers(rows);
  };

  const refreshSocial = async () => {
    if (!authUser?.id || !userId) return;
    const [mine, viewed, friendship] = await Promise.all([
      fetchFollowing(authUser.id),
      fetchFollowerCounts(userId),
      (supabase as any)
        .from("friends")
        .select("id")
        .or(`and(user_id.eq.${authUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${authUser.id})`)
        .eq("status", "accepted")
        .maybeSingle(),
    ]);
    setFollowingIds(mine);
    setFollowersCount(viewed.followers);
    setFollowingCount(viewed.following);
    setIsFriend(Boolean(friendship?.data));
  };

  const refreshProfileDetails = async () => {
    if (!userId) return;

    try {
      const [statsRes, analyticsRes, recentResultsRes, userAchievementsRes, privacyRes, myItemsRes] = await Promise.all([
        supabase.rpc("get_user_stats", { p_user_id: userId }),
        supabase.from("analytics").select("strong_topics,weak_topics").eq("user_id", userId),
        supabase
          .from("quiz_results")
          .select("id,score,xp_earned,completed_at")
          .eq("student_id", userId)
          .order("completed_at", { ascending: false })
          .limit(5),
        supabase
          .from("user_achievements")
          .select("id,achievement_id,unlocked_at")
          .eq("user_id", userId)
          .eq("completed", true)
          .order("unlocked_at", { ascending: false })
          .limit(6),
        supabase.from("profile_privacy_settings" as never).select("is_public,hide_stats").eq("user_id", userId).maybeSingle(),
        authUser?.id
          ? (supabase as any).from("user_items").select("item_id, equipped, store_items(name, section)").eq("user_id", authUser.id)
          : Promise.resolve({ data: [] }),
      ]);

      setStatsJson((statsRes.data ?? {}) as Record<string, any>);

      const strong = (analyticsRes.data ?? []).flatMap((item: any) => (Array.isArray(item.strong_topics) ? item.strong_topics : []));
      const weak = (analyticsRes.data ?? []).flatMap((item: any) => (Array.isArray(item.weak_topics) ? item.weak_topics : []));
      setInsights({ strong: strong.slice(0, 3), weak: weak.slice(0, 3), recommended: [...new Set(weak)].slice(0, 3) });

      setActivities(
        (recentResultsRes.data ?? []).map((row) => ({
          id: row.id,
          text: `Completed quiz with ${Math.round(row.score)}% score and +${row.xp_earned ?? 0} XP`,
          time: row.completed_at ? new Date(row.completed_at).toLocaleString() : "recently",
        })),
      );

      const achievementIds = (userAchievementsRes.data ?? []).map((x) => x.achievement_id);
      const { data: defs } = achievementIds.length
        ? await supabase.from("achievements").select("id,name,icon").in("id", achievementIds)
        : { data: [] as Array<{ id: string; name: string; icon: string }> };

      const byId = new Map((defs ?? []).map((d) => [d.id, d]));
      setAchievements(
        (userAchievementsRes.data ?? []).map((row) => {
          const def = byId.get(row.achievement_id);
          return {
            id: row.id,
            name: def?.name ?? "Achievement",
            icon: def?.icon ?? "🏅",
            date: row.unlocked_at ? new Date(row.unlocked_at).toLocaleDateString() : "",
          };
        }),
      );

      if ((privacyRes as any)?.data) {
        const p = (privacyRes as any).data as { is_public: boolean; hide_stats: boolean };
        setPrivacy({ isPublic: p.is_public, hideStats: p.hide_stats });
      }

      if (authUser?.id) {
        const items = (myItemsRes as any)?.data ?? [];
        setOwnedItems(items.length);
        const avatarItem = items.find((item: any) => item.equipped && item.store_items?.section === "avatars");
        setEquippedAvatar(avatarItem?.store_items?.name ?? null);
      }
    } catch (error) {
      console.error("Failed to load full profile details. Falling back to basic profile.", error);
      setStatsJson({});
      setInsights({ strong: [], weak: [], recommended: [] });
      setActivities([]);
      setAchievements([]);
      setOwnedItems(0);
      setEquippedAvatar(null);
    }
  };

  useEffect(() => {
    refreshCore();
    refreshSocial();
    refreshProfileDetails();

    const channel = supabase
      .channel(`profile-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshCore)
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, refreshSocial)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_results" }, refreshProfileDetails)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_achievements" }, refreshProfileDetails)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, userId]);

  const ranked = useMemo(() => [...users].sort((a, b) => rankScore(b) - rankScore(a)), [users]);
  const profile = useMemo(() => ranked.find((u) => u.id === userId), [ranked, userId]);
  const profileRank = useMemo(() => ranked.findIndex((u) => u.id === userId) + 1, [ranked, userId]);

  const isSelf = authUser?.id === (profile?.id ?? "");
  const isFollowing = profile ? followingIds.includes(profile.id) : false;
  const xpProgress = getXpProgressInLevel(profile?.xp ?? 0);
  const xpIntoLevel = xpProgress.current;
  const progress = xpProgress.percentage;
  const currentTier = getRankTierByLevel(profile?.level ?? 1);
  const nextTier = getNextRankTier(profile?.level ?? 1);

  const onFollowToggle = async () => {
    if (!authUser?.id || !profile) return;
    try {
      if (isFollowing) {
        await unfollowUser(authUser.id, profile.id);
      } else {
        await followUser(authUser.id, profile.id);
        toast.success(`${authUser.name ?? "A user"} started following ${profile.username}`);
      }
      await refreshSocial();
    } catch (error: any) {
      toast.error(error.message ?? "Failed to update follow status");
    }
  };

  const onChallenge = async () => {
    if (!authUser?.id || isSelf || !profile) {
      navigate("/multiplayer");
      return;
    }

    try {
      await createFollowChallenge(authUser.id, profile.id);
      const { data, error } = await (supabase as any).rpc("create_multiplayer_invite", {
        p_receiver_id: profile.id,
        p_room_id: null,
        p_max_players: 2,
        p_subject: "Mixed",
        p_difficulty: "Medium",
      });

      if (error) throw error;

      if (data?.room_id) {
        navigate(`/multiplayer?room=${data.room_id}`);
      } else {
        navigate("/multiplayer");
      }
      toast.success(`Challenge sent to ${profile.name || profile.username}`);
    } catch (error: any) {
      toast.error(error.message ?? "Could not send challenge");
    }
  };

  const onTransferCoins = async () => {
    const amount = Number(transferAmount);
    if (!profile) return;
    if (!Number.isFinite(amount) || amount < 10) {
      toast.error("Minimum transfer is 10 coins.");
      return;
    }

    const success = await transferCoins(profile.id, amount);
    if (!success) {
      toast.error("Transfer failed. Check balance, friendship status, and daily limit.");
      return;
    }

    toast.success(`Sent ${amount} coins to ${profile.name || profile.username}.`);
    setTransferOpen(false);
    setTransferAmount("10");
    await refreshCurrency();
  };

  const updatePrivacy = async (next: { isPublic: boolean; hideStats: boolean }) => {
    if (!authUser?.id) return;
    setPrivacy(next);
    await supabase.from("profile_privacy_settings" as never).upsert({
      user_id: authUser.id,
      is_public: next.isPublic,
      hide_stats: next.hideStats,
    } as never);
  };

  const accuracy = Number(statsJson.accuracy ?? profile?.accuracy ?? 0);
  const matchesPlayed = Number(statsJson.total_games_played ?? profile?.matchesPlayed ?? 0);
  const wins = Number(statsJson.total_wins ?? profile?.wins ?? 0);
  const losses = Number(statsJson.total_losses ?? profile?.losses ?? 0);
  const contributions = Number(statsJson.study_time_hours ?? ((profile?.contributions ?? 0) / 10));

  useEffect(() => {
    if (!isSelf || !profile) return;

    if (previousLevelRef.current === null) {
      previousLevelRef.current = profile.level;
      previousRankRef.current = currentTier.name;
      return;
    }

    const leveledUp = profile.level > (previousLevelRef.current ?? profile.level);
    const rankChanged = previousRankRef.current !== currentTier.name;

    if (leveledUp) {
      toast.success(`⬆️ Level up! You are now level ${profile.level}.`);
    }

    if (rankChanged) {
      toast.success(`🎉 You reached ${currentTier.name} rank!`);
      playRankUpTone();
    }

    previousLevelRef.current = profile.level;
    previousRankRef.current = currentTier.name;
  }, [currentTier.name, isSelf, profile?.level]);

  if (!profile) {
    return <div className="p-8">Profile not found.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          <Button onClick={onChallenge} className="gap-2"><Sword className="h-4 w-4" />Challenge to Match</Button>
        </header>

        <Card>
          <CardContent className="grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <AvatarRenderer avatar={profile.avatar ?? undefined} avatarConfig={profile.avatarConfig as any} size="xl" />
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">{profile.name || profile.username}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`bg-gradient-to-r ${tierStyle(profile.level)}`}><motion.span initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="inline-flex items-center gap-1">{currentTier.icon} {currentTier.name}</motion.span></Badge>
                <Badge variant="secondary">Rank #{profileRank}</Badge>
                <Badge variant="outline">Level {profile.level}</Badge>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>XP Progress</span><span>{xpIntoLevel}/220</span></div>
                <p className="text-xs text-muted-foreground">Level {profile.level} → {currentTier.name} → Next: {nextTier ? nextTier.name : "MAX RANK"}</p>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}><Progress value={progress} /></motion.div>
              </div>
            </div>
            {!isSelf && (
              <div className="flex flex-wrap gap-2">
                <Button variant={isFollowing ? "secondary" : "default"} className="gap-2" onClick={onFollowToggle}>
                  <UserRoundPlus className="h-4 w-4" />
                  {isFollowing ? "Unfollow" : "Follow"}
                </Button>
                <Button variant="outline" className="gap-2" disabled={!isFriend} onClick={() => setTransferOpen(true)}>
                  <Send className="h-4 w-4" />
                  Send Coins
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Total XP</p><p className="text-xl font-bold">{profile.xp.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Streak</p><p className="text-xl font-bold inline-flex items-center gap-1"><Flame className="h-4 w-4 text-orange-500" />{profile.streak}</p></div>
              <div><p className="text-xs text-muted-foreground">Accuracy</p><p className="text-xl font-bold">{accuracy.toFixed(1)}%</p></div>
              <div><p className="text-xs text-muted-foreground">Matches</p><p className="text-xl font-bold">{matchesPlayed}</p></div>
              <div><p className="text-xs text-muted-foreground">Wins / Losses</p><p className="text-xl font-bold">{wins}/{losses}</p></div>
              <div><p className="text-xs text-muted-foreground">Contribution points</p><p className="text-xl font-bold">{Math.round(contributions * 10)}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Social</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>Followers: <strong>{followersCount}</strong></p>
              <p>Following: <strong>{followingCount}</strong></p>
              <p>Power score: <strong>{Math.round(rankScore(profile))}</strong></p>
              <p>Friend transfer status: <strong>{isSelf ? "N/A" : isFriend ? "Eligible" : "Friends only"}</strong></p>
              <Separator />
              <p className="text-xs text-muted-foreground">Notifications</p>
              <p className="text-sm">🔔 Rank increases, new followers, and badges are shown in-app instantly.</p>
              {isSelf && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Public profile</span>
                      <Switch checked={privacy.isPublic} onCheckedChange={(v) => updatePrivacy({ ...privacy, isPublic: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hide stats</span>
                      <Switch checked={privacy.hideStats} onCheckedChange={(v) => updatePrivacy({ ...privacy, hideStats: v })} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Economy</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Coins: <strong>{coins.toLocaleString()}</strong></p>
              <p className="inline-flex items-center gap-2"><Gem className="h-4 w-4 text-purple-500" /> Gems: <strong>{gems.toLocaleString()}</strong></p>
              <p className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Owned items: <strong>{ownedItems}</strong></p>
              <p className="text-xs text-muted-foreground">Equipped avatar: {equippedAvatar ?? "Default avatar"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Learning Insights</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Strong:</strong> {insights.strong.length ? insights.strong.join(", ") : "No data"}</p>
              <p><strong>Weak:</strong> {insights.weak.length ? insights.weak.join(", ") : "No data"}</p>
              <p><strong>Recommended:</strong> {insights.recommended.length ? insights.recommended.join(", ") : "No data"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Achievements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {achievements.length === 0 ? <p className="text-sm text-muted-foreground">No achievements yet.</p> : null}
              {achievements.map((achievement) => (
                <motion.div whileHover={{ x: 4 }} key={achievement.id} className="rounded-md border p-2">
                  <p className="font-medium">{achievement.icon} {achievement.name}</p>
                  <p className="text-xs text-muted-foreground">Earned on {achievement.date}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activities.length === 0 ? <p className="text-muted-foreground">No recent activity.</p> : null}
              {activities.map((item) => (
                <div key={item.id} className="rounded-md border p-2">
                  <p>{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate('/multiplayer')}>
                <Trophy className="h-4 w-4" /> Challenge Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Coins</DialogTitle>
            <DialogDescription>
              Transfer coins to {profile.name || profile.username}. Minimum 10 coins, max 500/day, friends only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Your balance: <strong>{coins.toLocaleString()}</strong> coins</p>
            <Input
              type="number"
              min={10}
              step={10}
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={onTransferCoins}>Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default UserProfilePage;
