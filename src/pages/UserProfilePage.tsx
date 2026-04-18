import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BadgeCheck, Car, Home, Send, Shirt, Sparkles, Sword, Trophy, UserRoundPlus } from "lucide-react";
import AvatarShowcase3D from "@/components/avatar/AvatarShowcase3D";
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
  const [collections, setCollections] = useState<Array<{ item_id: string; equipped: boolean; acquired_at: string; section: string; rarity: string; name: string; preview: string; price: number }>>([]);
  const [allCollectionItems, setAllCollectionItems] = useState<Array<{ item_id: string; section: string; rarity: string; name: string; preview: string; price: number }>>([]);
  const [totalCollectionItems, setTotalCollectionItems] = useState(0);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState("");

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
      const [statsRes, analyticsRes, recentResultsRes, userAchievementsRes, privacyRes, myItemsRes, allStoreItemsRes, profileRes] = await Promise.all([
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
        (supabase as any).from("store_items").select("id,name,section,rarity,preview,price").eq("is_active", true),
        supabase.from("profiles").select("created_at").eq("id", userId).single(),
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

      const byId = new Map<string, { id: string; name: string; icon: string }>((defs as any[] ?? []).map((d: any) => [d.id, d]));
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

      const viewedItemsRes = await (supabase as any)
        .from("user_items")
        .select("item_id,equipped,acquired_at,store_items(section,rarity,name,preview,price)")
        .eq("user_id", userId)
        .order("acquired_at", { ascending: false });
      const viewedItems = (viewedItemsRes.data ?? []).map((item: any) => ({
        item_id: item.item_id,
        equipped: Boolean(item.equipped),
        acquired_at: item.acquired_at,
        section: item.store_items?.section ?? "customization",
        rarity: item.store_items?.rarity ?? "common",
        name: item.store_items?.name ?? "Unknown Item",
        preview: item.store_items?.preview ?? "🎁",
        price: item.store_items?.price ?? 0,
      }));
      setCollections(viewedItems);
      const allStore = ((allStoreItemsRes as any).data ?? []).map((item: any) => ({
        item_id: item.id,
        section: item.section ?? "customization",
        rarity: item.rarity ?? "common",
        name: item.name ?? "Unknown Item",
        preview: item.preview ?? "🎁",
        price: item.price ?? 0,
      }));
      setAllCollectionItems(allStore);
      setTotalCollectionItems(allStore.length);
      setJoinedAt((profileRes.data as any)?.created_at ?? null);
    } catch (error) {
      console.error("Failed to load full profile details. Falling back to basic profile.", error);
      setStatsJson({});
      setInsights({ strong: [], weak: [], recommended: [] });
      setActivities([]);
      setAchievements([]);
      setOwnedItems(0);
      setEquippedAvatar(null);
      setCollections([]);
      setAllCollectionItems([]);
      setTotalCollectionItems(0);
      setJoinedAt(null);
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
  const collectionProgress = totalCollectionItems > 0 ? Math.round((collections.length / totalCollectionItems) * 100) : 0;
  const categorizedCollection = useMemo(() => {
    const seed = {
      clothes: [] as typeof collections,
      avatars: [] as typeof collections,
      cars: [] as typeof collections,
      themes: [] as typeof collections,
      titles: [] as typeof collections,
      special: [] as typeof collections,
    };

    for (const item of collections) {
      if (item.section === "avatars") seed.avatars.push(item);
      else if (item.section === "titles") seed.titles.push(item);
      else if (item.section === "effects") {
        const lowerName = item.name.toLowerCase();
        if (lowerName.includes("car")) seed.cars.push(item);
        else if (lowerName.includes("theme")) seed.themes.push(item);
        else seed.special.push(item);
      } else seed.clothes.push(item);
    }

    return seed;
  }, [collections]);
  const collectionCatalog = useMemo(() => {
    const categorize = (section: string, name: string) => {
      const normalizedSection = section.toLowerCase();
      const normalizedName = name.toLowerCase();
      if (normalizedSection.includes("title")) return "titles";
      if (normalizedSection.includes("avatar")) return "clothes";
      if (normalizedSection.includes("cloth") || normalizedSection.includes("outfit") || normalizedSection.includes("wearable")) return "clothes";
      if (normalizedSection.includes("house") || normalizedName.includes("house") || normalizedName.includes("home")) return "houses";
      if (normalizedSection.includes("car") || normalizedName.includes("car")) return "cars";
      return "clothes";
    };

    const ownedById = new Map<string, (typeof collections)[number]>(collections.map((item) => [item.item_id, item]));
    const catalog = {
      clothes: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
      cars: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
      houses: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
      titles: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
    };

    for (const item of allCollectionItems) {
      const owned = ownedById.get(item.item_id);
      const bucket = categorize(item.section, item.name) as keyof typeof catalog;
      catalog[bucket].push({
        item_id: item.item_id,
        name: item.name,
        preview: item.preview,
        rarity: item.rarity,
        owned: Boolean(owned),
        equipped: Boolean(owned?.equipped),
        price: item.price,
        sourceSection: item.section,
      });
    }
    return catalog;
  }, [allCollectionItems, collections]);

  useEffect(() => {
    if (!userId) return;
    const savedBio = localStorage.getItem(`profile-bio:${userId}`);
    setAboutText(savedBio ?? "");
  }, [userId]);

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

  const saveAbout = () => {
    if (!userId) return;
    localStorage.setItem(`profile-bio:${userId}`, aboutText.trim());
    toast.success("About section saved.");
  };

  const onEquipCollectionItem = async (itemId: string, section: string) => {
    if (!authUser?.id || !isSelf) return;
    try {
      const sameSectionOwnedIds = collections.filter((item) => item.section === section).map((item) => item.item_id);
      if (sameSectionOwnedIds.length) {
        await (supabase as any)
          .from("user_items")
          .update({ equipped: false })
          .eq("user_id", authUser.id)
          .in("item_id", sameSectionOwnedIds);
      }

      await (supabase as any)
        .from("user_items")
        .update({ equipped: true })
        .eq("user_id", authUser.id)
        .eq("item_id", itemId);
      toast.success("Item equipped.");
      await refreshProfileDetails();
    } catch (error: any) {
      toast.error(error.message ?? "Could not equip item");
    }
  };

  if (!profile) {
    return <div className="p-8">Profile not found.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {!isSelf ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={isFollowing ? "secondary" : "default"} className="gap-2" onClick={onFollowToggle}>
                <UserRoundPlus className="h-4 w-4" />
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
              <Button variant="outline" className="gap-2" onClick={onChallenge}>
                <Sword className="h-4 w-4" />
                Invite
              </Button>
              <Button variant="outline" className="gap-2" disabled={!isFriend} onClick={() => setTransferOpen(true)}>
                <Send className="h-4 w-4" />
                Send Coins
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={onChallenge} className="gap-2">
              <Sword className="h-4 w-4" />
              Challenge
            </Button>
          )}
        </header>

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:p-10">
            <AvatarShowcase3D avatar={profile.avatar ?? undefined} avatarConfig={profile.avatarConfig as any} size={260} />
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight">{profile.name || profile.username}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <Badge className={`bg-gradient-to-r ${tierStyle(profile.level)}`}>
                {currentTier.icon} {currentTier.name}
              </Badge>
            </div>
            <div className="w-full max-w-xl space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Level {profile.level}</span>
                <span>{xpIntoLevel}/220 XP</span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Next tier: {nextTier ? nextTier.name : "MAX RANK"}</p>
            </div>
            {isSelf && (
              <Button onClick={() => navigate("/avatar-creator")} className="mt-2">
                Edit Avatar
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 md:gap-4 md:p-6">
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">Level</p>
              <p className="text-xl font-bold">{profile.level}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">XP</p>
              <p className="text-xl font-bold">{profile.xp.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">Rank</p>
              <p className="text-xl font-bold">#{profileRank}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">Grade</p>
              <p className="text-xl font-bold">{profile.grade ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSelf ? (
              <>
                <Textarea
                  value={aboutText}
                  onChange={(event) => setAboutText(event.target.value)}
                  placeholder="Tell others about yourself..."
                  className="min-h-24"
                />
                <Button variant="secondary" onClick={saveAbout}>Save Bio</Button>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {aboutText || "This learner hasn't added an about section yet."}
              </p>
            )}
            <Separator />
            <p className="text-xs text-muted-foreground">Joined {joinedAt ? new Date(joinedAt).toLocaleDateString() : "recently"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" />Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[...achievements, ...Array.from({ length: Math.max(0, 8 - achievements.length) }).map((_, index) => ({
                id: `locked-${index}`,
                name: "Locked",
                icon: "🔒",
                date: "",
              }))].map((achievement) => {
                const locked = achievement.name === "Locked";
                return (
                  <div
                    key={achievement.id}
                    className={`min-w-40 rounded-xl border p-3 ${locked ? "opacity-50 grayscale" : "bg-primary/5"}`}
                  >
                    <p className="text-2xl">{achievement.icon}</p>
                    <p className="mt-1 text-sm font-semibold">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground">{locked ? "Keep playing to unlock" : `Unlocked ${achievement.date}`}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Collection</span>
              <Badge variant="secondary">{collections.length}/{totalCollectionItems || 0} owned</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={collectionProgress} />
            <Tabs defaultValue="clothes" className="space-y-4">
              <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <TabsTrigger value="clothes" className="gap-1"><Shirt className="h-4 w-4" />Clothes</TabsTrigger>
                <TabsTrigger value="cars" className="gap-1"><Car className="h-4 w-4" />Cars</TabsTrigger>
                <TabsTrigger value="houses" className="gap-1"><Home className="h-4 w-4" />Houses</TabsTrigger>
                <TabsTrigger value="titles" className="gap-1"><Trophy className="h-4 w-4" />Titles</TabsTrigger>
              </TabsList>

              {(Object.keys(collectionCatalog) as Array<keyof typeof collectionCatalog>).map((category) => (
                <TabsContent key={category} value={category}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {collectionCatalog[category].map((item) => (
                      <div
                        key={item.item_id}
                        className={`rounded-xl border p-3 text-center transition ${item.owned ? "bg-card" : "opacity-45 grayscale"}`}
                      >
                        <p className="text-3xl">{item.preview}</p>
                        <p className="mt-2 truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.owned ? "Owned" : `Locked • ${item.price} coins`}</p>
                        {item.owned && item.equipped ? <Badge className="mt-2">Equipped</Badge> : null}
                        {item.owned && isSelf && !item.equipped ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full"
                            onClick={() => onEquipCollectionItem(item.item_id, item.sourceSection)}
                          >
                            Equip
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {isSelf && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Public profile</span>
                <Switch checked={privacy.isPublic} onCheckedChange={(value) => updatePrivacy({ ...privacy, isPublic: value })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Hide stats</span>
                <Switch checked={privacy.hideStats} onCheckedChange={(value) => updatePrivacy({ ...privacy, hideStats: value })} />
              </div>
            </CardContent>
          </Card>
        )}
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
