import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  Clock3,
  Crown,
  Flame,
  Home,
  Lock,
  Pencil,
  Rocket,
  Send,
  Shirt,
  Sparkles,
  Star,
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

type Activity = { id: string; text: string; time: string; icon: "trophy" | "zap" | "spark" };
type Achievement = { id: string; name: string; icon: string; description: string; date: string; locked?: boolean };

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [privacy, setPrivacy] = useState({ isPublic: true, hideStats: false });
  const previousLevelRef = useRef<number | null>(null);
  const previousRankRef = useRef<string | null>(null);
  const aboutHydratedRef = useRef(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("10");
  const [isFriend, setIsFriend] = useState(false);
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null);
  const [collections, setCollections] = useState<Array<{ item_id: string; equipped: boolean; acquired_at: string; section: string; rarity: string; name: string; preview: string; price: number }>>([]);
  const [allCollectionItems, setAllCollectionItems] = useState<Array<{ item_id: string; section: string; rarity: string; name: string; preview: string; price: number }>>([]);
  const [totalCollectionItems, setTotalCollectionItems] = useState(0);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState("");
  const [avatarReacting, setAvatarReacting] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

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
            `Reached a new momentum spike (+${row.xp_earned ?? 0} XP)`,
            "Unlocked a sharp-focus study streak",
            "Completed a precision challenge",
          ][index % 4],
          time: row.completed_at ? new Date(row.completed_at).toISOString() : new Date().toISOString(),
          icon: (["trophy", "zap", "spark", "spark"] as const)[index % 4],
        })),
      );

      const achievementIds = (userAchievementsRes.data ?? []).map((x) => x.achievement_id);
      const { data: defs } = achievementIds.length
        ? await supabase.from("achievements").select("id,name,icon,description").in("id", achievementIds)
        : { data: [] as Array<{ id: string; name: string; icon: string; description?: string }> };

      const byId = new Map<string, { id: string; name: string; icon: string; description?: string }>((defs as any[] ?? []).map((d: any) => [d.id, d]));
      setAchievements(
        (userAchievementsRes.data ?? []).map((row, index) => {
          const def = byId.get(row.achievement_id);
          return {
            id: row.id,
            name: def?.name ?? `Achievement ${index + 1}`,
            icon: def?.icon ?? "🏅",
            description: def?.description ?? "A high-impact milestone unlocked through learning consistency.",
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
  const progress = xpProgress.percentage;
  const currentTier = getRankTierByLevel(profile?.level ?? 1);
  const nextTier = getNextRankTier(profile?.level ?? 1);

  const wins = Number(statsJson.total_wins ?? profile?.wins ?? 0);
  const streak = Number(statsJson.current_streak ?? profile?.streak ?? 0);
  const weeklyXp = Number(statsJson.weekly_xp ?? Math.round((profile?.xp ?? 0) * 0.08));

  const collectionCatalog = useMemo(() => {
    const categorize = (section: string, name: string) => {
      const normalizedSection = section.toLowerCase();
      const normalizedName = name.toLowerCase();
      if (normalizedSection.includes("title")) return "titles";
      if (normalizedSection.includes("avatar") || normalizedSection.includes("cloth") || normalizedSection.includes("outfit") || normalizedSection.includes("wearable")) return "outfit";
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

  const featuredItems = useMemo(() => collections.filter((item) => item.rarity === "legendary" || item.rarity === "epic" || item.equipped).slice(0, 4), [collections]);

  const displayedAchievements = useMemo(
    () => [
      ...achievements,
      ...Array.from({ length: Math.max(0, 8 - achievements.length) }).map((_, index) => ({
        id: `locked-${index}`,
        name: "Locked Achievement",
        icon: "🔒",
        description: "Keep leveling up and winning matches to unlock this badge.",
        date: "",
        locked: true,
      })),
    ],
    [achievements],
  );

  useEffect(() => {
    if (!userId) return;
    setAboutText(localStorage.getItem(`profile-bio:${userId}`) ?? "");
    aboutHydratedRef.current = true;
  }, [userId]);

  useEffect(() => {
    if (!isSelf || !userId || !aboutHydratedRef.current) return;
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(`profile-bio:${userId}`, aboutText.trim());
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [aboutText, isSelf, userId]);

  useEffect(() => {
    if (!isSelf || !profile) return;
    if (previousLevelRef.current === null) {
      previousLevelRef.current = profile.level;
      previousRankRef.current = currentTier.name;
      return;
    }

    const leveledUp = profile.level > (previousLevelRef.current ?? profile.level);
    const rankChanged = previousRankRef.current !== currentTier.name;

    if (leveledUp) toast.success(`⬆️ Level up! You are now level ${profile.level}.`);
    if (rankChanged) {
      toast.success(`🎉 You reached ${currentTier.name} rank!`);
      playRankUpTone();
    }

    previousLevelRef.current = profile.level;
    previousRankRef.current = currentTier.name;
  }, [currentTier.name, isSelf, profile?.level]);

  const onFollowToggle = async () => {
    if (!authUser?.id || !profile) return;
    try {
      if (isFollowing) {
        await unfollowUser(authUser.id, profile.id);
      } else {
        await followUser(authUser.id, profile.id);
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
      navigate(data?.room_id ? `/multiplayer?room=${data.room_id}` : "/multiplayer");
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

  const onEquipCollectionItem = async (itemId: string, section: string) => {
    if (!authUser?.id || !isSelf) return;
    try {
      const sameSectionOwnedIds = collections.filter((item) => item.section === section).map((item) => item.item_id);
      if (sameSectionOwnedIds.length) {
        await (supabase as any).from("user_items").update({ equipped: false }).eq("user_id", authUser.id).in("item_id", sameSectionOwnedIds);
      }

      await (supabase as any).from("user_items").update({ equipped: true }).eq("user_id", authUser.id).eq("item_id", itemId);
      toast.success("Item equipped.");
      await refreshProfileDetails();
    } catch (error: any) {
      toast.error(error.message ?? "Could not equip item");
    }
  };

  const relativeTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "recently";
    const diff = Date.now() - parsed.getTime();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    if (diff < hour) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    return `${Math.floor(diff / day)}d ago`;
  };

  if (!profile) return <div className="p-8">Profile not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e1b4b,_#0b1020_45%,_#05060f)] px-3 pb-14 pt-4 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 border-white/20 bg-white/5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <p className="text-xs text-white/60">Joined {joinedAt ? new Date(joinedAt).toLocaleDateString() : "recently"}</p>
        </header>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-900/70 via-violet-900/60 to-cyan-900/50 shadow-[0_0_60px_rgba(34,211,238,0.12)]">
          <motion.div
            aria-hidden
            className="absolute inset-0"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1), transparent 40%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.25), transparent 35%)" }}
          />
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative flex min-h-[70vh] flex-col items-center justify-center gap-5 p-8 text-center md:p-10">
            <motion.button
              type="button"
              onClick={() => {
                setAvatarReacting(true);
                setTimeout(() => setAvatarReacting(false), 420);
              }}
              whileTap={{ scale: 0.96 }}
              animate={avatarReacting ? { scale: [1, 1.05, 1], y: [0, -6, 0] } : { y: [0, -8, 0] }}
              transition={avatarReacting ? { duration: 0.42 } : { duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              className="relative rounded-full"
            >
              <div className={`absolute inset-0 rounded-full blur-2xl ${tierStyle(profile.level)} opacity-50`} />
              <AvatarShowcase3D avatar={profile.avatar ?? undefined} avatarConfig={profile.avatarConfig as any} size={290} autoRotate={false} />
            </motion.button>

            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">{profile.name || profile.username}</h1>
              <p className="text-sm text-white/80">@{profile.username}</p>
              <Badge className={`animate-pulse bg-gradient-to-r ${tierStyle(profile.level)} px-4 py-1 text-sm shadow-[0_0_24px_rgba(168,85,247,0.5)]`}>
                {currentTier.icon} {currentTier.name}
              </Badge>
            </div>

            <motion.div className="w-full max-w-2xl space-y-2" initial={{ opacity: 0, width: "50%" }} animate={{ opacity: 1, width: "100%" }} transition={{ duration: 0.8 }}>
              <div className="flex items-center justify-between text-sm text-white/85">
                <span>Level {profile.level}</span>
                <span>{xpProgress.current}/220 XP</span>
              </div>
              <motion.div initial={{ scaleX: 0.2 }} animate={{ scaleX: 1 }} transition={{ duration: 1 }} style={{ transformOrigin: "left" }}>
                <Progress value={progress} className="h-2.5 bg-white/20" />
              </motion.div>
              <p className="text-xs text-white/70">Next tier: {nextTier ? nextTier.name : "MAX RANK"}</p>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {[`Lv.${profile.level}`, `${(profile.xp ?? 0).toLocaleString()} XP`, `#${profileRank > 0 ? profileRank : "-"} Rank`, `Grade ${Math.max(1, Math.ceil((profile.level ?? 1) / 2))}`].map((chip) => (
                <motion.div key={chip} whileHover={{ y: -3, scale: 1.03 }} className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold shadow-[0_0_20px_rgba(56,189,248,0.22)] backdrop-blur">
                  {chip}
                </motion.div>
              ))}
            </div>

            {isSelf ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate("/avatar-creator")} className="gap-2 bg-white text-black hover:bg-white/90">
                  <Pencil className="h-4 w-4" /> Edit Avatar
                </Button>
              </div>
            ) : null}
          </div>
        </section>

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
            <p className="text-xs text-muted-foreground">Premium profile mode</p>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80 backdrop-blur">
          <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            {[{ label: "Followers", value: followersCount, icon: Users }, { label: "Following", value: followingCount, icon: UserRoundPlus }, { label: "Streak", value: streak, icon: Flame }, { label: "Wins", value: wins, icon: Trophy }].map((stat) => (
              <motion.div key={stat.label} whileHover={{ y: -4 }} className="rounded-full border border-white/10 bg-white/[0.03] p-3 text-center">
                <stat.icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-extrabold">{stat.value.toLocaleString()}</p>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Learning Progress</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <p className="text-xs text-cyan-100">XP this week</p>
              <p className="text-xl font-bold">+{weeklyXp}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-100">Strong subjects</p>
              <p className="mt-1 text-sm font-semibold">{insights.strong.length ? insights.strong.join(" • ") : "Math • Logic • Speed"}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs text-amber-100">Weak subjects</p>
              <p className="mt-1 text-sm font-semibold">{insights.weak.length ? insights.weak.join(" • ") : "Grammar • Theory"}</p>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3 rounded-3xl border border-white/15 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><BadgeCheck className="h-5 w-5 text-primary" />Achievements</h2>
            <p className="text-xs text-white/60">Tap a badge for details</p>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {displayedAchievements.map((achievement) => (
              <motion.button
                key={achievement.id}
                type="button"
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedAchievement(achievement)}
                className={`min-w-36 snap-start rounded-2xl border p-4 text-left transition ${achievement.locked ? "border-white/10 bg-white/[0.03] opacity-55 blur-[0.4px]" : "border-cyan-400/25 bg-cyan-400/10"}`}
              >
                <p className="text-3xl">{achievement.icon}</p>
                <p className="mt-2 text-sm font-semibold">{achievement.name}</p>
                <p className="text-xs text-white/70">{achievement.locked ? "Locked" : `Unlocked ${achievement.date || "recently"}`}</p>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-white/15 bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" />Collection Showroom</h2>
            <Badge variant="secondary">{collections.length}/{totalCollectionItems || 0} owned</Badge>
          </div>

          <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-500/20 via-cyan-500/10 to-transparent p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-violet-100/80">Featured Loadout</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {featuredItems.length ? featuredItems.map((item) => (
                <motion.div key={item.item_id} whileHover={{ scale: 1.04 }} className="rounded-xl border border-white/15 bg-white/[0.04] p-3 text-center">
                  <p className="text-3xl">{item.preview}</p>
                  <p className="truncate text-xs font-semibold">{item.name}</p>
                  <p className="text-[10px] uppercase text-white/60">{item.section}</p>
                </motion.div>
              )) : <p className="col-span-full text-sm text-muted-foreground">No featured items yet.</p>}
            </div>
          </div>

          <Tabs defaultValue="outfit" className="space-y-4">
            <TabsList className="grid grid-cols-2 gap-2 bg-transparent md:grid-cols-4">
              <TabsTrigger value="outfit" className="gap-1 data-[state=active]:border-b-2 data-[state=active]:border-cyan-300"><Shirt className="h-4 w-4" />Clothes</TabsTrigger>
              <TabsTrigger value="garage" className="gap-1 data-[state=active]:border-b-2 data-[state=active]:border-cyan-300"><Car className="h-4 w-4" />Cars</TabsTrigger>
              <TabsTrigger value="lifestyle" className="gap-1 data-[state=active]:border-b-2 data-[state=active]:border-cyan-300"><Home className="h-4 w-4" />Houses</TabsTrigger>
              <TabsTrigger value="titles" className="gap-1 data-[state=active]:border-b-2 data-[state=active]:border-cyan-300"><Trophy className="h-4 w-4" />Titles</TabsTrigger>
            </TabsList>

            {(Object.keys(collectionCatalog) as Array<keyof typeof collectionCatalog>).map((category) => (
              <TabsContent key={category} value={category}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {collectionCatalog[category].map((item) => (
                    <motion.div
                      key={item.item_id}
                      whileHover={{ scale: 1.03 }}
                      className={`rounded-2xl border p-3 text-center transition ${item.owned ? "bg-card" : "opacity-45 grayscale"} ${item.rarity === "legendary" ? "border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.35)]" : "border-white/10"}`}
                    >
                      <p className="text-4xl">{item.preview}</p>
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
        </section>

        <section className="space-y-3 rounded-3xl border border-white/15 bg-card/70 p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Rocket className="h-5 w-5 text-primary" />Activity Feed</h2>
          {(activities.length ? activities : [{ id: "0", text: "Reached a new learning milestone", time: new Date().toISOString(), icon: "spark" as const }]).map((activity, index) => (
            <motion.div key={activity.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="rounded-full border border-white/20 bg-white/10 p-2">
                {activity.icon === "trophy" ? <Trophy className="h-4 w-4 text-amber-300" /> : activity.icon === "zap" ? <Zap className="h-4 w-4 text-cyan-300" /> : <Sparkles className="h-4 w-4 text-fuchsia-300" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{activity.text}</p>
                <p className="text-xs text-muted-foreground">{relativeTime(activity.time)}</p>
              </div>
              <Clock3 className="h-4 w-4 text-white/40" />
            </motion.div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">About</h2>
            {isSelf ? <span className="text-xs text-white/60">Auto-saves</span> : null}
          </div>
          {isSelf ? (
            <textarea
              value={aboutText}
              onChange={(event) => setAboutText(event.target.value)}
              placeholder="Tell others about yourself..."
              className="min-h-16 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-white/90 outline-none focus:border-cyan-400/50"
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{aboutText || "This learner hasn't added an about section yet."}</p>
          )}
          {equippedAvatar ? <p className="mt-3 text-xs text-primary">Equipped avatar item: {equippedAvatar}</p> : null}
        </section>

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

      <Dialog open={Boolean(selectedAchievement)} onOpenChange={(open) => !open && setSelectedAchievement(null)}>
        <DialogContent className="border-white/20 bg-[#0b1020]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="text-2xl">{selectedAchievement?.icon}</span>
              {selectedAchievement?.name}
            </DialogTitle>
            <DialogDescription>{selectedAchievement?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <p className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-cyan-300" />Status: {selectedAchievement?.locked ? "Locked" : "Unlocked"}</p>
            <p className="inline-flex items-center gap-2"><Crown className="h-4 w-4 text-amber-300" />Earn date: {selectedAchievement?.date || "Not yet earned"}</p>
            <p className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-violet-300" />Rarity: {selectedAchievement?.locked ? "Hidden" : "Profile highlight"}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Coins</DialogTitle>
            <DialogDescription>Transfer coins to {profile.name || profile.username}. Minimum 10 coins, max 500/day, friends only.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Your balance: <strong>{coins.toLocaleString()}</strong> coins</p>
            <Input type="number" min={10} step={10} value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Enter amount" />
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
