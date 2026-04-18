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
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  Flame,
  Gift,
  Home,
  Pencil,
  Send,
  Shirt,
  Sparkles,
  Sword,
  Target,
  Trophy,
  UserRoundPlus,
  Users,
  Zap,
} from "lucide-react";
import AvatarShowcase3D from "@/components/avatar/AvatarShowcase3D";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createFollowChallenge,
  fetchFollowerCounts,
  fetchFollowing,
  fetchLeaderboardUsers,
  followUser,
  rankScore,
  tierStyle,
  unfollowUser,
  type LeaderboardUser,
} from "@/lib/leaderboardApi";
import { getNextRankTier, getRankTierByLevel, getXpProgressInLevel, playRankUpTone } from "@/lib/rankSystem";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const HIGHLIGHT_TABS = ["Achievements", "Top Wins", "Collections", "Moments"] as const;
type HighlightTab = (typeof HIGHLIGHT_TABS)[number];

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: authUser } = useUser();
  const { coins, transferCoins, refreshCurrency } = useCurrency();
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
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null);
  const [collections, setCollections] = useState<Array<{ item_id: string; equipped: boolean; acquired_at: string; section: string; rarity: string; name: string; preview: string; price: number }>>([]);
  const [allCollectionItems, setAllCollectionItems] = useState<Array<{ item_id: string; section: string; rarity: string; name: string; preview: string; price: number }>>([]);
  const [totalCollectionItems, setTotalCollectionItems] = useState(0);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState("");
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<HighlightTab>("Achievements");
  const [avatarReacting, setAvatarReacting] = useState(false);

  const openProfile = (id: string) => navigate(`/profile/${id}`);

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
      const [statsRes, analyticsRes, recentResultsRes, userAchievementsRes, privacyRes, allStoreItemsRes, profileRes] = await Promise.all([
        supabase.rpc("get_user_stats", { p_user_id: userId }),
        supabase.from("analytics").select("strong_topics,weak_topics").eq("user_id", userId),
        supabase
          .from("quiz_results")
          .select("id,score,xp_earned,completed_at")
          .eq("student_id", userId)
          .order("completed_at", { ascending: false })
          .limit(8),
        supabase
          .from("user_achievements")
          .select("id,achievement_id,unlocked_at")
          .eq("user_id", userId)
          .eq("completed", true)
          .order("unlocked_at", { ascending: false })
          .limit(9),
        supabase.from("profile_privacy_settings" as never).select("is_public,hide_stats").eq("user_id", userId).maybeSingle(),
        (supabase as any).from("store_items").select("id,name,section,rarity,preview,price").eq("is_active", true),
        supabase.from("profiles").select("created_at").eq("id", userId).single(),
      ]);

      setStatsJson((statsRes.data ?? {}) as Record<string, any>);

      const strong = (analyticsRes.data ?? []).flatMap((item: any) => (Array.isArray(item.strong_topics) ? item.strong_topics : []));
      const weak = (analyticsRes.data ?? []).flatMap((item: any) => (Array.isArray(item.weak_topics) ? item.weak_topics : []));
      setInsights({ strong: strong.slice(0, 3), weak: weak.slice(0, 3), recommended: [...new Set(weak)].slice(0, 3) });

      setActivities(
        (recentResultsRes.data ?? []).map((row, index) => ({
          id: row.id,
          text: [
            `Won a match with ${Math.round(row.score)}% accuracy`,
            `Leveled up momentum with +${row.xp_earned ?? 0} XP`,
            `Joined a high-focus streak session`,
            `Bought a performance boost item`,
          ][index % 4],
          time: row.completed_at ? new Date(row.completed_at).toLocaleString() : "recently",
        })),
      );

      const achievementIds = (userAchievementsRes.data ?? []).map((x) => x.achievement_id);
      const { data: defs } = achievementIds.length
        ? await supabase.from("achievements").select("id,name,icon").in("id", achievementIds)
        : { data: [] as Array<{ id: string; name: string; icon: string }> };

      const byId = new Map<string, { id: string; name: string; icon: string }>((defs as any[] ?? []).map((d: any) => [d.id, d]));
      setAchievements(
        (userAchievementsRes.data ?? []).map((row, index) => {
          const def = byId.get(row.achievement_id);
          return {
            id: row.id,
            name: def?.name ?? `Achievement ${index + 1}`,
            icon: def?.icon ?? "🏅",
            date: row.unlocked_at ? new Date(row.unlocked_at).toLocaleDateString() : "",
          };
        }),
      );

      if ((privacyRes as any)?.data) {
        const p = (privacyRes as any).data as { is_public: boolean; hide_stats: boolean };
        setPrivacy({ isPublic: p.is_public, hideStats: p.hide_stats });
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
      setEquippedAvatar(viewedItems.find((item) => item.equipped && item.section === "avatars")?.name ?? null);
      setJoinedAt((profileRes.data as any)?.created_at ?? null);
    } catch (error) {
      console.error("Failed to load full profile details. Falling back to basic profile.", error);
      setStatsJson({});
      setInsights({ strong: [], weak: [], recommended: [] });
      setActivities([]);
      setAchievements([]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "user_items" }, refreshProfileDetails)
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

  const wins = Number(statsJson.total_wins ?? profile?.wins ?? 0);
  const streak = Number(statsJson.current_streak ?? profile?.streak ?? 0);
  const weeklyXp = Number(statsJson.weekly_xp ?? Math.round((profile?.xp ?? 0) * 0.08));
  const collectionProgress = totalCollectionItems > 0 ? Math.round((collections.length / totalCollectionItems) * 100) : 0;
  const collectionCatalog = useMemo(() => {
    const categorize = (section: string, name: string) => {
      const normalizedSection = section.toLowerCase();
      const normalizedName = name.toLowerCase();
      if (normalizedSection.includes("title")) return "titles";
      if (normalizedSection.includes("avatar")) return "outfit";
      if (normalizedSection.includes("cloth") || normalizedSection.includes("outfit") || normalizedSection.includes("wearable")) return "outfit";
      if (normalizedSection.includes("house") || normalizedName.includes("house") || normalizedName.includes("home") || normalizedName.includes("theme")) return "lifestyle";
      if (normalizedSection.includes("car") || normalizedName.includes("car")) return "garage";
      return "outfit";
    };

    const ownedById = new Map<string, (typeof collections)[number]>(collections.map((item) => [item.item_id, item]));
    const catalog = {
      outfit: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
      garage: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
      lifestyle: [] as Array<{ item_id: string; name: string; preview: string; rarity: string; owned: boolean; equipped: boolean; price: number; sourceSection: string }>,
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

  const featuredItems = useMemo(() => {
    return collections
      .filter((item) => item.rarity === "legendary" || item.rarity === "epic" || item.equipped)
      .slice(0, 4);
  }, [collections]);

  const progressHeat = useMemo(() => {
    const data = Array.from({ length: 14 }).map((_, idx) => {
      const base = Math.max(10, Math.min(100, Math.round((weeklyXp / 10) * ((idx % 5) + 1))));
      return base;
    });
    return data;
  }, [weeklyXp]);

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#05060f] px-3 pb-14 pt-4 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 border-white/20 bg-white/5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-white/70" onClick={() => openProfile(profile.id)}>
            openProfile({profile.id.slice(0, 8)}...)
          </Button>
        </header>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-indigo-700/40 via-fuchsia-700/25 to-cyan-600/30">
          <motion.div
            aria-hidden
            className="absolute inset-0"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.25), transparent 35%)" }}
          />
          <CardContent className="relative flex min-h-[75vh] flex-col items-center justify-center gap-5 p-8 text-center md:p-10">
            <motion.button
              type="button"
              onClick={() => {
                setAvatarReacting(true);
                setTimeout(() => setAvatarReacting(false), 400);
              }}
              whileTap={{ scale: 0.96 }}
              animate={avatarReacting ? { scale: [1, 1.05, 1], y: [0, -4, 0] } : { y: [0, -6, 0] }}
              transition={avatarReacting ? { duration: 0.4 } : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
              className="relative rounded-full"
            >
              <div className={`absolute inset-0 rounded-full blur-2xl ${tierStyle(profile.level)} opacity-45`} />
              <AvatarShowcase3D avatar={profile.avatar ?? undefined} avatarConfig={profile.avatarConfig as any} size={280} autoRotate={false} />
            </motion.button>

            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">{profile.name || profile.username}</h1>
              <p className="text-sm text-white/80">@{profile.username}</p>
              <Badge className={`animate-pulse bg-gradient-to-r ${tierStyle(profile.level)} px-3 py-1 text-sm`}>
                {currentTier.icon} {currentTier.name}
              </Badge>
            </div>

            <motion.div className="w-full max-w-2xl space-y-2" initial={{ opacity: 0, width: "50%" }} animate={{ opacity: 1, width: "100%" }} transition={{ duration: 0.8 }}>
              <div className="flex items-center justify-between text-sm text-white/85">
                <span>Level {profile.level}</span>
                <span>{xpIntoLevel}/220 XP</span>
              </div>
              <motion.div initial={{ scaleX: 0.2 }} animate={{ scaleX: 1 }} transition={{ duration: 1 }} style={{ transformOrigin: "left" }}>
                <Progress value={progress} className="h-3 bg-white/20" />
              </motion.div>
              <p className="text-xs text-white/70">Next tier: {nextTier ? nextTier.name : "MAX RANK"}</p>
            </motion.div>

            {isSelf ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate("/avatar-creator")} className="gap-2 bg-white text-black hover:bg-white/90">
                  <Pencil className="h-4 w-4" /> Edit Avatar
                </Button>
                <Button variant="outline" className="gap-2 border-white/40 bg-white/5" onClick={() => setActiveHighlight("Collections") || setHighlightOpen(true)}>
                  <Gift className="h-4 w-4" /> Change Outfit
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80 backdrop-blur">
          <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            {[{ label: "Followers", value: followersCount, icon: Users }, { label: "Following", value: followingCount, icon: UserRoundPlus }, { label: "Streak", value: streak, icon: Flame }, { label: "Wins", value: wins, icon: Trophy }].map((stat) => (
              <motion.div key={stat.label} whileHover={{ y: -4 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
                <stat.icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-extrabold">{stat.value.toLocaleString()}</p>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="flex flex-wrap gap-2">
              {!isSelf ? (
                <>
                  <Button variant={isFollowing ? "secondary" : "default"} className="gap-2" onClick={onFollowToggle}>
                    <UserRoundPlus className="h-4 w-4" /> {isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={onChallenge}>
                    <Sword className="h-4 w-4" /> Invite to battle
                  </Button>
                  <Button variant="outline" className="gap-2" disabled={!isFriend} onClick={() => setTransferOpen(true)}>
                    <Send className="h-4 w-4" /> Send coins
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={onChallenge} className="gap-2">
                  <Sword className="h-4 w-4" /> Challenge
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Joined {joinedAt ? new Date(joinedAt).toLocaleDateString() : "recently"}</p>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {HIGHLIGHT_TABS.map((item) => (
                <motion.button
                  key={item}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveHighlight(item);
                    setHighlightOpen(true);
                  }}
                  className="min-w-24 rounded-full border border-white/20 bg-white/[0.04] px-4 py-3 text-sm font-semibold"
                >
                  {item}
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Learning Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>XP this week</span>
                <span className="font-bold text-primary">+{weeklyXp}</span>
              </div>
              <Progress value={Math.min(100, Math.round((weeklyXp / 1200) * 100))} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-xs text-emerald-100">Strong subjects</p>
                <p className="mt-1 text-sm font-semibold">{insights.strong.length ? insights.strong.join(" • ") : "Math • Logic • Speed"}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-xs text-amber-100">Weak subjects</p>
                <p className="mt-1 text-sm font-semibold">{insights.weak.length ? insights.weak.join(" • ") : "Grammar • Theory"}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-xs text-muted-foreground">2-week heatmap</p>
              <div className="grid grid-cols-7 gap-2">
                {progressHeat.map((value, index) => (
                  <motion.div key={`${value}-${index}`} className="h-7 rounded-md bg-primary/20" initial={{ opacity: 0.3 }} animate={{ opacity: 0.55 + value / 200 }} whileHover={{ scale: 1.08 }} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" />Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {[...achievements, ...Array.from({ length: Math.max(0, 6 - achievements.length) }).map((_, index) => ({
                id: `locked-${index}`,
                name: "Locked",
                icon: "🔒",
                date: "",
              }))].map((achievement, index) => {
                const locked = achievement.name === "Locked";
                const rare = !locked && index < 2;
                return (
                  <motion.button
                    key={achievement.id}
                    type="button"
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setActiveHighlight("Achievements");
                      setHighlightOpen(true);
                    }}
                    className={`rounded-2xl border p-3 text-left ${locked ? "opacity-50 grayscale" : "bg-primary/5"} ${rare ? "animate-pulse border-fuchsia-400/40" : "border-white/10"}`}
                  >
                    <p className="text-2xl">{achievement.icon}</p>
                    <p className="mt-1 text-sm font-semibold">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground">{locked ? "Keep playing" : `Unlocked ${achievement.date}`}</p>
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Collection Showroom</span>
              <Badge variant="secondary">{collections.length}/{totalCollectionItems || 0} owned</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={collectionProgress} />

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs text-muted-foreground">Featured Items</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {featuredItems.length ? featuredItems.map((item) => (
                  <div key={item.item_id} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-2 text-center">
                    <p className="text-2xl">{item.preview}</p>
                    <p className="truncate text-xs font-semibold">{item.name}</p>
                  </div>
                )) : <p className="col-span-full text-sm text-muted-foreground">No featured items yet.</p>}
              </div>
            </div>

            <Tabs defaultValue="outfit" className="space-y-4">
              <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <TabsTrigger value="outfit" className="gap-1"><Shirt className="h-4 w-4" />Outfit</TabsTrigger>
                <TabsTrigger value="garage" className="gap-1"><Car className="h-4 w-4" />Garage</TabsTrigger>
                <TabsTrigger value="lifestyle" className="gap-1"><Home className="h-4 w-4" />Lifestyle</TabsTrigger>
                <TabsTrigger value="titles" className="gap-1"><Trophy className="h-4 w-4" />Titles</TabsTrigger>
              </TabsList>

              {(Object.keys(collectionCatalog) as Array<keyof typeof collectionCatalog>).map((category) => (
                <TabsContent key={category} value={category}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {collectionCatalog[category].map((item) => (
                      <motion.div
                        key={item.item_id}
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-xl border p-3 text-center transition ${item.owned ? "bg-card" : "opacity-45 grayscale"} ${item.rarity === "legendary" ? "border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.25)]" : "border-white/10"}`}
                      >
                        <p className="text-3xl">{item.preview}</p>
                        <p className="mt-2 truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.owned ? "Owned" : `Locked • ${item.price} coins`}</p>
                        {item.owned && item.equipped ? <Badge className="mt-2">Equipped</Badge> : null}
                        {item.owned && isSelf && !item.equipped ? (
                          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => onEquipCollectionItem(item.item_id, item.sourceSection)}>
                            Equip
                          </Button>
                        ) : null}
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(activities.length ? activities : [{ id: "0", text: "Joined tournament", time: "recently" }]).map((activity, index) => (
              <motion.div key={activity.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-semibold">{activity.text}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSelf ? (
              <>
                <Textarea value={aboutText} onChange={(event) => setAboutText(event.target.value)} placeholder="Tell others about yourself..." className="min-h-24" />
                <Button variant="secondary" onClick={saveAbout}>Save Bio</Button>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{aboutText || "This learner hasn't added an about section yet."}</p>
            )}
            {equippedAvatar ? <p className="text-xs text-primary">Equipped avatar item: {equippedAvatar}</p> : null}
            <Separator />
            <p className="text-xs text-muted-foreground">Digital identity is live across leaderboard, friends, multiplayer, and chat.</p>
          </CardContent>
        </Card>

        {isSelf && (
          <Card className="border-white/15 bg-card/80">
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

      <Dialog open={highlightOpen} onOpenChange={setHighlightOpen}>
        <DialogContent className="max-w-3xl border-white/20 bg-[#0b1020]">
          <DialogHeader>
            <DialogTitle>{activeHighlight}</DialogTitle>
            <DialogDescription>Swipe-ready quick view of profile highlights.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeHighlight === "Achievements" ? achievements.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 p-3">{item.icon} {item.name} • {item.date || "Unlocked recently"}</div>
            )) : null}
            {activeHighlight === "Top Wins" ? (
              <div className="rounded-xl border border-white/10 p-3">Top wins this season: {wins} • Streak best: {streak} days.</div>
            ) : null}
            {activeHighlight === "Collections" ? (
              <div className="rounded-xl border border-white/10 p-3">Owned {collections.length} items and {featuredItems.length} featured flex items.</div>
            ) : null}
            {activeHighlight === "Moments" ? activities.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-white/10 p-3">{activity.text}</div>
            )) : null}
          </div>
        </DialogContent>
      </Dialog>

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
