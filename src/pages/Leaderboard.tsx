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
import { getUserTier } from "@/lib/getUserTier";

type LeaderboardTab = "global" | "grade" | "friends" | "weekly" | "classes";
type Timeframe = "all" | "monthly" | "weekly";

const podiumStyles = {
  1: "border-yellow-400/70 bg-gradient-to-b from-yellow-500/20 via-amber-500/15 to-background shadow-sm",
  2: "border-slate-300/70 bg-gradient-to-b from-slate-400/20 via-slate-400/10 to-background shadow-sm",
  3: "border-amber-600/60 bg-gradient-to-b from-amber-700/20 via-orange-600/10 to-background shadow-sm",
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
  const leaderboardTier = getUserTier(user?.grade);
  const upperStudent = leaderboardTier === "upper";
  const leaderboardGradeMin = leaderboardTier === "early" ? 0 : leaderboardTier === "middle" ? 5 : leaderboardTier === "upper" ? 9 : 0;
  const leaderboardGradeMax = leaderboardTier === "early" ? 4 : leaderboardTier === "middle" ? 8 : leaderboardTier === "upper" ? 12 : 12;
  const leaderboardGrades = Array.from(
    { length: leaderboardGradeMax - leaderboardGradeMin + 1 },
    (_, index) => leaderboardGradeMin + index,
  );
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classRows, setClassRows] = useState<ClassCompetitionRow[]>([]);
  const [visibleRows, setVisibleRows] = useState(16);
  const [previewUser, setPreviewUser] = useState<(LeaderboardUser & { rankPos: number; score: number; tier: any }) | null>(null);
  const [season, setSeason] = useState<{ name: string; number: number; startedAt: string | null }>({ name: "Season 1", number: 1, startedAt: null });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef(false);
  const longPressTriggeredRef = useRef(false);

  const loadLeaderboard = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchLeaderboardUsers();
      setUsers(rows);
    } catch (error) {
      console.error("Leaderboard load failed", error);
      setLoadError("We couldn't load rankings from Supabase. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
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

  const loadSeason = async () => {
    const { data } = await (supabase as any)
      .from("season_runtime_state")
      .select("current_season_name,season_number,started_at")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setSeason({
        name: data.current_season_name ?? "Season 1",
        number: data.season_number ?? 1,
        startedAt: data.started_at ?? null,
      });
    }
  };

  useEffect(() => {
    loadLeaderboard();
    loadFollowing();
    loadClassCompetition();
    loadSeason();

    const channel = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { loadLeaderboard(); loadClassCompetition(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "question_attempts" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_students" }, loadClassCompetition)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, loadClassCompetition)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_streaks" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, loadFollowing)
      .on("postgres_changes", { event: "*", schema: "public", table: "season_runtime_state" }, () => { loadSeason(); loadLeaderboard(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "season_history" }, () => { loadSeason(); loadLeaderboard(); })
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

  // Keep the student leaderboard within the viewer's school tier. Unknown-grade
  // accounts are not silently mixed into a grade-bounded tier ranking.
  const tierUsers = useMemo(
    () => users.filter((entry) => entry.grade !== null && entry.grade >= leaderboardGradeMin && entry.grade <= leaderboardGradeMax),
    [users, leaderboardGradeMin, leaderboardGradeMax],
  );

  const rankedUsers = useMemo(
    () => [...tierUsers].sort((a, b) => scoreFor(b) - scoreFor(a)),
    [tierUsers, timeframe],
  );

  const leaderboardData = useMemo(() => {
    if (activeTab === "friends") {
      return rankedUsers.filter((row) => following.includes(row.id) || row.id === user?.id);
    }

    if (activeTab === "grade") {
      return selectedGrade === "all" ? rankedUsers : rankedUsers.filter((row) => row.grade === Number(selectedGrade));
    }

    if (activeTab === "weekly") {
      return [...tierUsers].sort((a, b) => b.weeklyScore - a.weeklyScore);
    }

    return rankedUsers;
  }, [activeTab, following, rankedUsers, selectedGrade, user?.id, tierUsers]);

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
  const currentUserIndex = user?.id && activeTab !== "classes" ? leaderboardData.findIndex((entry) => entry.id === user.id) : -1;
  const currentUserScore = user?.id ? leaderboardData.find((entry) => entry.id === user.id) : undefined;
  const currentViewLabel = activeTab === "weekly" ? "weekly" : timeframe === "monthly" ? "monthly" : timeframe === "weekly" ? "weekly" : "season";

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
    <div className={upperStudent ? "tier-upper min-h-screen bg-background p-4 text-foreground md:p-8" : "min-h-screen bg-gradient-to-b from-background via-background to-primary/10 p-4 md:p-8"}>
      <div className="mx-auto max-w-5xl space-y-5 pb-24">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1 rounded-full bg-primary/10 text-primary hover:bg-primary/10"><Trophy className="h-3.5 w-3.5" /> {season.name} · #{season.number}</Badge>
              <span className="text-xs text-muted-foreground">Live rankings</span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Rank Arena</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Climb your grade, challenge your friends, and make every practice session count.</p>
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => navigate("/")}>Home</Button><Button onClick={() => navigate("/social")} className="gap-2"><Swords className="h-4 w-4" /> Challenge a friend</Button></div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your position</p><div className="mt-2 flex items-end gap-3"><span className="text-5xl font-black tabular-nums">{currentUserIndex >= 0 ? `#${currentUserIndex + 1}` : "—"}</span><span className="mb-2 text-sm text-muted-foreground">in {activeTab === "classes" ? "your classes" : currentViewLabel} rankings</span></div><p className="mt-2 text-sm text-muted-foreground">{currentUserScore ? `${Math.round(activeTab === "weekly" ? currentUserScore.weeklyScore : scoreFor(currentUserScore)).toLocaleString()} points · ${currentUserScore.streak} day streak` : "Complete a quiz to enter the arena."}</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border/70 bg-background/70 p-4"><p className="text-xs text-muted-foreground">Learners</p><p className="mt-1 text-2xl font-bold">{tierUsers.length.toLocaleString()}</p></div><div className="rounded-2xl border border-border/70 bg-background/70 p-4"><p className="text-xs text-muted-foreground">Your score</p><p className="mt-1 text-2xl font-bold">{currentUserScore ? Math.round(activeTab === "weekly" ? currentUserScore.weeklyScore : scoreFor(currentUserScore)).toLocaleString() : "—"}</p></div><div className="col-span-2 rounded-2xl border border-border/70 bg-background/70 p-4 sm:col-span-1"><p className="text-xs text-muted-foreground">Streak</p><p className="mt-1 text-2xl font-bold text-orange-500">{currentUserScore ? `🔥 ${currentUserScore.streak}` : "—"}</p></div></div>
          </div>
        </section>

        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">The board</p><h2 className="mt-1 text-xl font-bold">Compete your way</h2></div><Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All time</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaderboardTab)}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/70 p-1 sm:grid-cols-5">{tabConfig.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="gap-1.5 rounded-xl px-2 py-2 text-xs sm:text-sm"><Icon className="h-3.5 w-3.5" />{value === "global" ? "Overall" : label}</TabsTrigger>)}</TabsList></Tabs>
            {activeTab === "grade" && <Select value={selectedGrade} onValueChange={setSelectedGrade}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Choose grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades {leaderboardGradeMin}–{leaderboardGradeMax}</SelectItem>{leaderboardGrades.map((grade) => <SelectItem key={grade} value={String(grade)}>Grade {grade}</SelectItem>)}</SelectContent></Select>}

            {activeTab === "classes" ? <section className="space-y-3">{classRows.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Class rankings are coming together</p><p className="mt-1 text-sm text-muted-foreground">Join a class to compete with your classmates.</p></div> : classRows.map((row, index) => <div key={row.classId} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/60 p-4"><div><p className="text-xs font-bold text-primary">#{index + 1} CLASS RANK</p><h3 className="mt-1 font-semibold">{row.className}</h3><p className="text-xs text-muted-foreground">{row.studentCount} students · {row.totalClassXp.toLocaleString()} total XP</p></div><Badge className="px-3 py-1">{row.classScore.toLocaleString()} avg</Badge></div>)}</section> : <>
              {loading && <div className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Loading live rankings…</div>}
              {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" size="sm" onClick={loadLeaderboard}>Try again</Button></div>}
              {!loading && !loadError && withRank.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center"><Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Your arena starts here</p><p className="mt-1 text-sm text-muted-foreground">Complete quizzes to earn points and appear on the board.</p></div>}
              {withRank.length > 0 && <>
                <div className="grid gap-3 md:grid-cols-3">{topThree.map((entry, index) => <motion.button key={entry.id} layout whileHover={{ y: -4 }} whileTap={{ scale: .98 }} onClick={() => openProfile(entry)} onTouchStart={() => handleLongPressStart(entry)} onTouchMove={handleLongPressMove} onTouchEnd={() => handleLongPressEnd(entry)} onTouchCancel={() => handleLongPressEnd()} className={`rounded-2xl border p-4 text-left ${podiumStyles[(index + 1) as 1 | 2 | 3]}`}><div className="flex items-center justify-between"><Badge variant="outline">{index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"}</Badge><span className="text-xl">{index === 0 ? "🏆" : index === 1 ? "🥈" : "🥉"}</span></div><AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="lg" className="my-3" /><h3 className="font-bold">{getDisplayName(entry)}</h3><p className="text-xs text-muted-foreground">Level {entry.level} · Grade {entry.grade ?? "—"}</p><div className="mt-3 flex items-center justify-between"><Badge className={`bg-gradient-to-r ${tierStyle(entry.level)}`}>{entry.tier}</Badge><span className="font-black">{Math.round(entry.score).toLocaleString()}</span></div></motion.button>)}</div>
                <div className="space-y-2">{visibleRest.map((entry) => <motion.button key={`${activeTab}-${entry.id}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => openProfile(entry)} onTouchStart={() => handleLongPressStart(entry)} onTouchMove={handleLongPressMove} onTouchEnd={() => handleLongPressEnd(entry)} onTouchCancel={() => handleLongPressEnd()} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.03] ${entry.id === user?.id ? "border-primary/50 bg-primary/[0.06]" : "border-border/70 bg-background/50"}`}><span className="w-8 text-center font-bold text-muted-foreground">#{entry.rankPos}</span><AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="md" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{getDisplayName(entry)}{entry.id === user?.id && <span className="ml-2 text-xs font-normal text-primary">You</span>}</p><p className="text-xs text-muted-foreground">Level {entry.level} · {entry.streak} day streak</p></div><div className="text-right"><p className="font-bold tabular-nums">{Math.round(entry.score).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">points</p></div></motion.button>)}{visibleRows < rest.length && <Button variant="outline" className="w-full" onClick={() => setVisibleRows((count) => Math.min(count + 12, rest.length))}>Load more competitors</Button>}</div>
                {currentUserIndex >= visibleRows + 3 && currentUserScore && <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-3 text-sm"><span className="font-semibold">Your rank is #{currentUserIndex + 1}</span><span className="text-muted-foreground"> · Keep going to reach the next competitor.</span></div>}
              </>}
            </>}
          </CardContent>
        </Card>
      </div>
      <Button onClick={() => navigate("/social")} className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6" aria-label="Quick challenge"><Swords className="h-5 w-5" /></Button>
      <Dialog open={!!previewUser} onOpenChange={(isOpen) => !isOpen && setPreviewUser(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Competitor preview</DialogTitle></DialogHeader>{previewUser ? <div className="space-y-3"><div className="flex items-center gap-3"><AvatarRenderer avatar={previewUser.avatar ?? undefined} avatarConfig={previewUser.avatarConfig as any} size="md" /><div><p className="font-semibold">{getDisplayName(previewUser)}</p><p className="text-xs text-muted-foreground">Rank #{previewUser.rankPos} · Level {previewUser.level}</p></div></div><div className="flex flex-wrap gap-2"><Badge className={`bg-gradient-to-r ${tierStyle(previewUser.level)}`}>{previewUser.tier}</Badge><Badge variant="secondary">{Math.round(previewUser.score).toLocaleString()} points</Badge><Badge variant="outline">🔥 {previewUser.streak} day streak</Badge></div><Button className="w-full" onClick={() => navigate(`/profile/${previewUser.id}`)}>Open profile</Button></div> : null}</DialogContent></Dialog>
    </div>
  );
};

export default Leaderboard;
