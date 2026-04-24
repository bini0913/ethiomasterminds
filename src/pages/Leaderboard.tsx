import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, Flame, Globe, Swords, Trophy, Users, Zap } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchClassCompetitionLeaderboard, fetchFollowing, fetchLeaderboardUsers, rankScore, tierFromUser, tierStyle, type ClassCompetitionRow, type LeaderboardUser } from "@/lib/leaderboardApi";
import { prefetchProfileBundle } from "@/lib/profilePrefetch";
import { getRankTierByLevel } from "@/lib/rankSystem";

type LeaderboardTab = "global" | "grade" | "friends" | "weekly" | "classes";
type Timeframe = "all" | "monthly" | "weekly";

const podiumStyles = {
  1: "border-yellow-400/70 bg-gradient-to-b from-yellow-500/20 via-amber-500/15 to-background shadow-[0_0_30px_rgba(250,204,21,0.35)]",
  2: "border-slate-300/70 bg-gradient-to-b from-slate-400/20 via-slate-400/10 to-background shadow-[0_0_24px_rgba(148,163,184,0.28)]",
  3: "border-amber-600/60 bg-gradient-to-b from-amber-700/20 via-orange-600/10 to-background shadow-[0_0_20px_rgba(180,83,9,0.3)]",
};

const tabConfig: Array<{ value: LeaderboardTab; label: string; icon: typeof Globe }> = [
  { value: "global", label: "Global", icon: Globe },
  { value: "grade", label: "Grade", icon: Users },
  { value: "friends", label: "Friends", icon: Users },
  { value: "weekly", label: "Weekly", icon: CalendarClock },
  { value: "classes", label: "Classes", icon: Users },
];

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("global");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [loading, setLoading] = useState(true);
  const [classRows, setClassRows] = useState<ClassCompetitionRow[]>([]);
  const [visibleRows, setVisibleRows] = useState(16);
  const [previewUser, setPreviewUser] = useState<(LeaderboardUser & { rankPos: number; score: number; tier: any }) | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef(false);
  const longPressTriggeredRef = useRef(false);

  const loadLeaderboard = async () => {
    setLoading(true);
    const rows = await fetchLeaderboardUsers();
    setUsers(rows);
    setLoading(false);
  };

  const loadClassCompetition = async () => {
    const rows = await fetchClassCompetitionLeaderboard(12);
    setClassRows(rows);
  };

  const loadFollowing = async () => {
    if (!user?.id) return;
    const ids = await fetchFollowing(user.id);
    setFollowing(ids);
  };

  useEffect(() => {
    loadLeaderboard();
    loadFollowing();
    loadClassCompetition();

    const channel = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { loadLeaderboard(); loadClassCompetition(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "question_attempts" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_students" }, loadClassCompetition)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, loadClassCompetition)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_streaks" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, loadFollowing)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [user?.id]);

  const scoreFor = (u: LeaderboardUser) => {
    if (timeframe === "weekly") return u.weeklyScore;
    if (timeframe === "monthly") return u.monthlyScore;
    return rankScore(u);
  };

  const rankedUsers = useMemo(
    () => [...users].sort((a, b) => scoreFor(b) - scoreFor(a)),
    [users, timeframe],
  );

  const leaderboardData = useMemo(() => {
    if (activeTab === "friends") {
      return rankedUsers.filter((row) => following.includes(row.id) || row.id === user?.id);
    }

    if (activeTab === "grade") {
      return selectedGrade === "all" ? rankedUsers : rankedUsers.filter((row) => row.grade === Number(selectedGrade));
    }

    if (activeTab === "weekly") {
      return [...users].sort((a, b) => b.weeklyScore - a.weeklyScore);
    }

    return rankedUsers;
  }, [activeTab, following, rankedUsers, selectedGrade, user?.id, users]);

  const withRank = leaderboardData.map((entry, index) => ({
    ...entry,
    rankPos: index + 1,
    score: activeTab === "weekly" ? entry.weeklyScore : scoreFor(entry),
    tier: tierFromUser(entry),
  })).slice(0, 50);

  const topThree = withRank.slice(0, 3);
  const mobilePodium = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;
  const rest = withRank.slice(3);
  const visibleRest = rest.slice(0, visibleRows);

  useEffect(() => {
    setVisibleRows(16);
  }, [activeTab, selectedGrade]);

  const triggerHaptics = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(16);
    }
  };

  const openProfile = (entry: (typeof withRank)[number]) => {
    prefetchProfileBundle(entry.id);
    navigate(`/profile/${entry.id}`);
  };

  const getDisplayName = (entry: (typeof withRank)[number]) => entry.name?.trim() || entry.username;

  const handleLongPressStart = (entry: (typeof withRank)[number]) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    touchMovedRef.current = false;
    longPressTriggeredRef.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      triggerHaptics();
      setPreviewUser(entry);
    }, 420);
  };

  const handleLongPressMove = () => {
    touchMovedRef.current = true;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleLongPressEnd = (entry?: (typeof withRank)[number]) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (entry && !touchMovedRef.current && !longPressTriggeredRef.current) {
      triggerHaptics();
      openProfile(entry);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/10 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Live database rankings only • no demo accounts</p>
            <h1 className="text-3xl font-bold tracking-tight">Master Minds Leaderboard</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>Back to home</Button>
        </header>

        <Card className="border-primary/30 bg-background/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" /> Dynamic Ranking Arena
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaderboardTab)}>
              <div className="overflow-x-auto pb-2">
                <TabsList className="inline-flex min-w-max gap-2 bg-muted/70 p-1">
                  {tabConfig.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="gap-2 rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(99,102,241,0.45)]"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Timeframe</span>
                <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Timeframe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeTab === "grade" && (
                <div className="w-40">
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All grades</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                        <SelectItem key={grade} value={`${grade}`}>Grade {grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {activeTab === "classes" ? (
              <section className="space-y-3">
                {classRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No class competition data yet.</p>
                ) : classRows.map((row, index) => (
                  <div key={row.classId} className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">#{index + 1} Class Rank</p>
                      <h3 className="text-lg font-semibold">{row.className}</h3>
                      <p className="text-sm text-muted-foreground">{row.studentCount} students • {row.totalClassXp.toLocaleString()} total season XP</p>
                    </div>
                    <Badge className="text-base px-3 py-1">{row.classScore.toLocaleString()} avg XP</Badge>
                  </div>
                ))}
              </section>
            ) : (
              <>
            {loading ? <p className="text-sm text-muted-foreground">Loading leaderboard…</p> : null}

            <section className="space-y-3">
              <div className="hidden gap-4 md:grid md:grid-cols-3">
                {topThree.map((entry, index) => {
                  const podiumRank = (index + 1) as 1 | 2 | 3;
                  return (
                    <motion.button
                      layout
                      whileHover={{ y: -6 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openProfile(entry)}
                      onTouchStart={() => handleLongPressStart(entry)}
                      onTouchMove={handleLongPressMove}
                      onTouchEnd={() => handleLongPressEnd(entry)}
                      onTouchCancel={() => handleLongPressEnd()}
                      key={entry.id}
                      className={`rounded-2xl border p-4 text-left transition ${podiumStyles[podiumRank]}`}
                    >
                      <p className="text-xs opacity-85">{podiumRank === 1 ? "🥇 Gold" : podiumRank === 2 ? "🥈 Silver" : "🥉 Bronze"}</p>
                      <AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="lg" className="my-3" />
                      <h3 className="font-semibold">{getDisplayName(entry)}</h3>
                      <p className="text-sm text-muted-foreground">Level {entry.level} • Grade {entry.grade ?? "-"}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge className={`bg-gradient-to-r ${tierStyle(entry.level)}`}>{`${getRankTierByLevel(entry.level).icon} ${entry.tier}`}</Badge>
                        <span className="font-bold">#{entry.rankPos}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{Math.round(entry.score).toLocaleString()} Season XP</p>
                    </motion.button>
                  );
                })}
              </div>

              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:hidden">
                {mobilePodium.map((entry) => {
                  const isChampion = entry.rankPos === 1;
                  return (
                    <motion.button
                      key={entry.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => openProfile(entry)}
                      onTouchStart={() => handleLongPressStart(entry)}
                      onTouchMove={handleLongPressMove}
                      onTouchEnd={() => handleLongPressEnd(entry)}
                      onTouchCancel={() => handleLongPressEnd()}
                      className={`w-[82%] shrink-0 snap-center rounded-2xl border p-4 text-left transition ${podiumStyles[entry.rankPos as 1 | 2 | 3]} ${isChampion ? "scale-[1.01]" : "scale-95"}`}
                    >
                      <p className="text-xs opacity-80">Position #{entry.rankPos}</p>
                      <AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size={isChampion ? "lg" : "md"} className="my-3" />
                      <h3 className="text-base font-semibold">{getDisplayName(entry)}</h3>
                      <p className="text-sm text-muted-foreground">Level {entry.level} • Grade {entry.grade ?? "-"}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge className={`bg-gradient-to-r ${tierStyle(entry.level)}`}>{`${getRankTierByLevel(entry.level).icon} ${entry.tier}`}</Badge>
                        <span className="text-lg font-bold">#{entry.rankPos}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{Math.round(entry.score).toLocaleString()} Season XP</p>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            <div
              className="h-[440px] space-y-2 overflow-y-auto rounded-xl border border-primary/20 bg-background/60 p-2 backdrop-blur"
              onScroll={(event) => {
                const target = event.currentTarget;
                const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 100;
                if (nearBottom && visibleRows < rest.length) {
                  setVisibleRows((count) => Math.min(count + 12, rest.length));
                }
              }}
            >
              <AnimatePresence>
                {visibleRest.map((entry) => (
                  <motion.button
                    layout
                    key={`${activeTab}-${entry.id}`}
                    onClick={() => openProfile(entry)}
                    onTouchStart={() => handleLongPressStart(entry)}
                    onTouchMove={handleLongPressMove}
                    onTouchEnd={() => handleLongPressEnd(entry)}
                    onTouchCancel={() => handleLongPressEnd()}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:shadow-[0_0_20px_rgba(99,102,241,0.28)] ${entry.rankPos <= 10 ? "shadow-[0_0_14px_rgba(99,102,241,0.25)]" : "bg-card/80"}`}
                  >
                    <span className="w-8 text-center text-sm font-semibold text-muted-foreground">#{entry.rankPos}</span>
                    <AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="md" />
                    <div className="flex-1">
                      <p className="font-medium">{getDisplayName(entry)}</p>
                      <p className="text-xs text-muted-foreground">Level {entry.level} • Season XP {entry.seasonXp.toLocaleString()}</p>
                      {entry.activeTitle ? <p className="text-[11px] text-amber-400">{entry.activeTitle}</p> : null}
                    </div>
                    <div className="text-right">
                      <Badge className={`mb-1 bg-gradient-to-r ${tierStyle(entry.level)}`}>{entry.tier}</Badge>
                      <p className="text-sm font-semibold">{Math.round(entry.score).toLocaleString()} pts</p>
                      <p className="inline-flex items-center gap-1 text-xs text-orange-500"><Flame className="h-3 w-3" />{entry.streak}</p>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => navigate("/social")}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-[0_0_22px_rgba(168,85,247,0.75)] md:bottom-6 md:right-6"
        aria-label="Quick challenge"
      >
        <Swords className="h-5 w-5" />
      </Button>

      <Dialog open={!!previewUser} onOpenChange={(isOpen) => !isOpen && setPreviewUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Mini Profile Preview
            </DialogTitle>
          </DialogHeader>
          {previewUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <AvatarRenderer avatar={previewUser.avatar ?? undefined} avatarConfig={previewUser.avatarConfig as any} size="md" />
                <div>
                  <p className="font-semibold">{getDisplayName(previewUser)}</p>
                  <p className="text-xs text-muted-foreground">Rank #{previewUser.rankPos} • Level {previewUser.level}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={`bg-gradient-to-r ${tierStyle(previewUser.level)}`}>{previewUser.tier}</Badge>
                <Badge variant="secondary">{Math.round(previewUser.score).toLocaleString()} pts</Badge>
                <Badge variant="outline">🔥 {previewUser.streak} day streak</Badge>
              </div>
              <Button className="w-full" onClick={() => navigate(`/profile/${previewUser.id}`)}>Open full profile</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leaderboard;
