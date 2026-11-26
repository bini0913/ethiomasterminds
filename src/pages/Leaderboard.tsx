import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight, CalendarClock, ChevronUp, Flame, Globe, Medal, Search, Sparkles, Swords, Target, Trophy, Users, Zap } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchClassCompetitionLeaderboard, fetchFollowing, fetchLeaderboardUsers, rankScore, tierFromUser, tierStyle, type ClassCompetitionRow, type LeaderboardUser } from "@/lib/leaderboardApi";
import { prefetchProfileBundle } from "@/lib/profilePrefetch";
import { getUserTier } from "@/lib/getUserTier";

type LeaderboardTab = "global" | "grade" | "friends" | "weekly" | "classes";
type Timeframe = "all" | "monthly" | "weekly";

const tabConfig: Array<{ value: LeaderboardTab; label: string; icon: typeof Globe }> = [
  { value: "global", label: "Global", icon: Globe },
  { value: "grade", label: "Grade", icon: Users },
  { value: "friends", label: "Friends", icon: Users },
  { value: "weekly", label: "Weekly", icon: CalendarClock },
  { value: "classes", label: "Classes", icon: Users },
];

const podiumTone: Record<1 | 2 | 3, string> = {
  1: "from-amber-300/30 via-orange-400/10 to-transparent border-amber-300/50 shadow-[0_18px_70px_hsl(38_92%_55%/.18)]",
  2: "from-slate-200/25 via-slate-400/10 to-transparent border-slate-300/40",
  3: "from-orange-400/25 via-amber-700/10 to-transparent border-orange-500/40",
};

const medalFor = (rank: number) => rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";

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
  const leaderboardGrades = Array.from({ length: leaderboardGradeMax - leaderboardGradeMin + 1 }, (_, index) => leaderboardGradeMin + index);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [searchQuery, setSearchQuery] = useState("");
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
      setUsers(await fetchLeaderboardUsers());
    } catch (error) {
      console.error("Leaderboard load failed", error);
      setLoadError("We couldn't load rankings from Supabase. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadClassCompetition = async () => {
    try {
      setClassRows(await fetchClassCompetitionLeaderboard(12));
    } catch (error) {
      // Class rankings are an optional view. Do not turn a secondary RPC or
      // school-membership issue into a failure for the global leaderboard.
      console.warn("Class competition leaderboard unavailable", error);
      setClassRows([]);
    }
  };

  const loadFollowing = async () => {
    if (!user?.id) return;
    setFollowing(await fetchFollowing(user.id));
  };

  const loadSeason = async () => {
    const { data } = await (supabase as any)
      .from("season_runtime_state")
      .select("current_season_name,season_number,started_at")
      .eq("id", 1)
      .maybeSingle();
    if (data) setSeason({ name: data.current_season_name ?? "Season 1", number: data.season_number ?? 1, startedAt: data.started_at ?? null });
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

  const scoreFor = (entry: LeaderboardUser) => timeframe === "weekly" ? entry.weeklyScore : timeframe === "monthly" ? entry.monthlyScore : rankScore(entry);

  const tierUsers = useMemo(
    () => users.filter((entry) => entry.grade !== null && entry.grade >= leaderboardGradeMin && entry.grade <= leaderboardGradeMax),
    [users, leaderboardGradeMin, leaderboardGradeMax],
  );

  const rankedUsers = useMemo(() => [...tierUsers].sort((a, b) => scoreFor(b) - scoreFor(a)), [tierUsers, timeframe]);

  const leaderboardData = useMemo(() => {
    if (activeTab === "friends") return rankedUsers.filter((row) => following.includes(row.id) || row.id === user?.id);
    if (activeTab === "grade") return selectedGrade === "all" ? rankedUsers : rankedUsers.filter((row) => row.grade === Number(selectedGrade));
    if (activeTab === "weekly") return [...tierUsers].sort((a, b) => b.weeklyScore - a.weeklyScore);
    return rankedUsers;
  }, [activeTab, following, rankedUsers, selectedGrade, user?.id, tierUsers]);

  const withRank = leaderboardData.map((entry, index) => ({ ...entry, rankPos: index + 1, score: activeTab === "weekly" ? entry.weeklyScore : scoreFor(entry), tier: tierFromUser(entry) })).slice(0, 50);
  const topThree = withRank.slice(0, 3);
  const mobilePodium = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;
  const rest = withRank.slice(3);
  const filteredRest = rest.filter((entry) => `${entry.name ?? ""} ${entry.username}`.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  const visibleRest = filteredRest.slice(0, visibleRows);
  const currentUserIndex = user?.id && activeTab !== "classes" ? leaderboardData.findIndex((entry) => entry.id === user.id) : -1;
  const currentUserScore = user?.id ? leaderboardData.find((entry) => entry.id === user.id) : undefined;
  const currentViewLabel = activeTab === "weekly" ? "weekly" : timeframe === "monthly" ? "monthly" : timeframe === "weekly" ? "weekly" : "season";
  const nextTarget = currentUserIndex > 0 ? withRank[currentUserIndex - 1] : undefined;
  const pointsToNext = nextTarget && currentUserScore ? Math.max(0, Math.ceil(scoreFor(nextTarget) - scoreFor(currentUserScore))) : 0;
  const percentile = currentUserIndex >= 0 && withRank.length ? Math.max(1, Math.ceil(((currentUserIndex + 1) / withRank.length) * 100)) : null;

  useEffect(() => setVisibleRows(16), [activeTab, selectedGrade, searchQuery]);

  const triggerHaptics = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(16);
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
    <div className={upperStudent ? "tier-upper min-h-screen overflow-hidden bg-background text-foreground" : "min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.18),transparent_32%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--primary)/.06))] text-foreground"}>
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(hsl(var(--border)/.12)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/.12)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-border/50 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 text-emerald-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live arena</span>
              <span className="text-border">/</span>
              <span>{season.name} · Split {season.number}</span>
            </div>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-6xl">Who is climbing fastest?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Every quiz, streak, and study session moves you closer to the top. Find your next target and make the next move.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => navigate("/")}>Home</Button><Button onClick={() => navigate("/social")} className="gap-2 rounded-full px-5"><Swords className="h-4 w-4" /> Challenge a friend</Button></div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/25 via-card/90 to-accent/15 p-5 shadow-[0_24px_80px_hsl(var(--primary)/.12)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your campaign</p><div className="mt-2 flex items-end gap-3"><span className="text-7xl font-black leading-none tracking-[-0.08em] tabular-nums">{currentUserIndex >= 0 ? `#${currentUserIndex + 1}` : "—"}</span><span className="mb-2 text-sm text-muted-foreground">{currentViewLabel} rank</span></div><div className="mt-4 flex flex-wrap items-center gap-2">{currentUserScore ? <Badge className={`border-0 bg-gradient-to-r text-white ${tierStyle(currentUserScore.level)}`}>{tierFromUser(currentUserScore)}</Badge> : <Badge variant="secondary">Unranked</Badge>}{percentile && <Badge variant="outline">Top {percentile}%</Badge>}</div></div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[250px]"><div className="rounded-2xl border border-border/60 bg-background/55 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Points</p><p className="mt-1 text-2xl font-black tabular-nums">{currentUserScore ? Math.round(scoreFor(currentUserScore)).toLocaleString() : "—"}</p></div><div className="rounded-2xl border border-border/60 bg-background/55 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Streak</p><p className="mt-1 flex items-center gap-1 text-2xl font-black tabular-nums text-orange-500"><Flame className="h-5 w-5" />{currentUserScore?.streak ?? "—"}</p></div></div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Next target</p><h2 className="mt-2 text-xl font-black">Keep the pressure on</h2></div><Target className="h-6 w-6 text-amber-500" /></div>{nextTarget ? <><div className="mt-5 flex items-center gap-3"><AvatarRenderer avatar={nextTarget.avatar ?? undefined} avatarConfig={nextTarget.avatarConfig as any} size="md" /><div className="min-w-0"><p className="truncate font-bold">{getDisplayName(nextTarget)}</p><p className="text-xs text-muted-foreground">#{nextTarget.rankPos} · {Math.round(nextTarget.score).toLocaleString()} points</p></div></div><div className="mt-5 flex items-center justify-between text-xs"><span className="text-muted-foreground">You need</span><span className="font-black text-amber-500">{pointsToNext.toLocaleString()} pts</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: "72%" }} className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" /></div><p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><ChevronUp className="h-3.5 w-3.5 text-emerald-500" />One strong session can change your position.</p></> : <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Complete a quiz to enter the arena and reveal your next target.</div>}</div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Competition board</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Choose your battlefield</h2></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find a competitor" className="h-10 w-full rounded-full border border-border/70 bg-card/70 pl-9 pr-4 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20 sm:w-52" /></div><Select value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}><SelectTrigger className="h-10 w-full rounded-full bg-card/70 sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All time</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div></div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardTab)} className="mt-5"><TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1.5"><div className="flex min-w-max gap-1">{tabConfig.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="gap-2 rounded-xl px-4 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"><Icon className="h-3.5 w-3.5" />{value === "global" ? "Overall" : label}</TabsTrigger>)}</div></TabsList></Tabs>
          {activeTab === "grade" && <div className="mt-3"><Select value={selectedGrade} onValueChange={setSelectedGrade}><SelectTrigger className="h-10 w-full rounded-xl bg-card/70 sm:w-52"><SelectValue placeholder="Choose grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades {leaderboardGradeMin}–{leaderboardGradeMax}</SelectItem>{leaderboardGrades.map((grade) => <SelectItem key={grade} value={String(grade)}>Grade {grade}</SelectItem>)}</SelectContent></Select></div>}
        </section>

        {activeTab === "classes" ? <section className="mt-6 space-y-3">{classRows.length === 0 ? <div className="rounded-[2rem] border border-dashed border-border p-12 text-center"><Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-bold">Class rankings are coming together</p><p className="mt-1 text-sm text-muted-foreground">Join a class to compete with your classmates.</p></div> : classRows.map((row, index) => <div key={row.classId} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/70 p-4 transition hover:-translate-y-0.5 hover:border-primary/40"><span className="w-8 text-center text-lg font-black text-muted-foreground">#{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{row.className}</p><p className="mt-1 text-xs text-muted-foreground">{row.studentCount} students · {row.totalClassXp.toLocaleString()} total XP</p></div><Badge className="rounded-full px-3 py-1">{row.classScore.toLocaleString()} avg</Badge><ArrowUpRight className="hidden h-4 w-4 text-muted-foreground sm:block" /></div>)}</section> : <>
          {loading && <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground"><Sparkles className="mx-auto mb-2 h-5 w-5 animate-pulse text-primary" />Loading live rankings…</div>}
          {loadError && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" size="sm" onClick={loadLeaderboard}>Try again</Button></div>}
          {!loading && !loadError && withRank.length === 0 && <div className="mt-6 rounded-[2rem] border border-dashed border-border p-12 text-center"><Trophy className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-bold">Your arena starts here</p><p className="mt-1 text-sm text-muted-foreground">Complete quizzes to earn points and appear on the board.</p></div>}
          {withRank.length > 0 && <>
            <div className="mt-8 flex items-end justify-center gap-2 sm:gap-5">{mobilePodium.map((entry) => { const rank = entry.rankPos as 1 | 2 | 3; const isChampion = rank === 1; return <motion.button key={entry.id} layout whileHover={{ y: -6 }} whileTap={{ scale: .98 }} onClick={() => openProfile(entry)} onTouchStart={() => handleLongPressStart(entry)} onTouchMove={handleLongPressMove} onTouchEnd={() => handleLongPressEnd(entry)} onTouchCancel={() => handleLongPressEnd()} className={`relative flex w-[31%] max-w-[260px] flex-col items-center overflow-hidden rounded-[2rem] border bg-gradient-to-b p-3 text-center transition sm:p-5 ${podiumTone[rank]} ${isChampion ? "z-10 min-h-[270px] sm:min-h-[330px]" : "min-h-[225px] sm:min-h-[280px]"}`}><div className="absolute right-3 top-3 text-xl">{medalFor(rank)}</div><span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Rank #{rank}</span><div className={`mt-4 rounded-full p-1 ${isChampion ? "bg-amber-300/30 ring-4 ring-amber-300/15" : "bg-background/40"}`}><AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size={isChampion ? "lg" : "md"} /></div><p className="mt-3 w-full truncate text-sm font-black sm:text-base">{getDisplayName(entry)}</p><p className="mt-1 text-[11px] text-muted-foreground">Level {entry.level} · {entry.streak} day streak</p><div className="mt-auto flex w-full items-center justify-between gap-2 pt-4"><Badge className={`max-w-[58%] truncate border-0 bg-gradient-to-r text-[10px] text-white ${tierStyle(entry.level)}`}>{entry.tier}</Badge><span className="font-black tabular-nums">{Math.round(entry.score).toLocaleString()}</span></div></motion.button>; })}</div>
            <div className="mt-10 overflow-hidden rounded-[2rem] border border-border/70 bg-card/65 shadow-sm"><div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="flex items-center gap-2"><Medal className="h-4 w-4 text-primary" /><h3 className="font-black">The climb</h3></div><p className="mt-1 text-xs text-muted-foreground">Tap a competitor to open their profile · long press on mobile for a quick preview</p></div><span className="text-xs font-semibold text-muted-foreground">{withRank.length} ranked learners</span></div><div className="hidden grid-cols-[4rem_minmax(0,1fr)_7rem_7rem] gap-3 border-b border-border/50 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:grid"><span>Rank</span><span>Competitor</span><span className="text-right">Streak</span><span className="text-right">Score</span></div><div className="divide-y divide-border/50">{visibleRest.map((entry) => <motion.button key={`${activeTab}-${entry.id}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => openProfile(entry)} onTouchStart={() => handleLongPressStart(entry)} onTouchMove={handleLongPressMove} onTouchEnd={() => handleLongPressEnd(entry)} onTouchCancel={() => handleLongPressEnd()} className={`grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-primary/[0.06] sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem] sm:px-6 ${entry.id === user?.id ? "bg-primary/[0.09]" : ""}`}><span className={`text-center text-sm font-black tabular-nums ${entry.id === user?.id ? "text-primary" : "text-muted-foreground"}`}>#{entry.rankPos}</span><span className="flex min-w-0 items-center gap-3"><AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-bold">{getDisplayName(entry)}{entry.id === user?.id && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">YOU</span>}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">Level {entry.level} · {entry.tier}</span></span></span><span className="hidden items-center justify-end gap-1 text-xs text-muted-foreground sm:flex"><Flame className="h-3.5 w-3.5 text-orange-500" />{entry.streak}d</span><span className="text-right"><span className="block text-sm font-black tabular-nums">{Math.round(entry.score).toLocaleString()}</span><span className="text-[10px] text-muted-foreground">points</span></span></motion.button>)}{filteredRest.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No competitors match “{searchQuery}”.</div>}</div>{visibleRows < filteredRest.length && <div className="border-t border-border/50 p-4"><Button variant="outline" className="w-full rounded-xl" onClick={() => setVisibleRows((count) => Math.min(count + 12, filteredRest.length))}>Load more competitors</Button></div>}</div>
            {currentUserIndex >= visibleRows + 3 && currentUserScore && <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-4 text-sm"><span><span className="font-bold">You are #{currentUserIndex + 1}</span><span className="text-muted-foreground"> · Keep climbing to reach the next competitor.</span></span><Button size="sm" variant="outline" className="rounded-full" onClick={() => setSearchQuery(currentUserScore.name?.trim() || currentUserScore.username)}>Find me</Button></div>}
          </>}
        </>}
      </div>
      <Button onClick={() => navigate("/social")} className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6" aria-label="Quick challenge"><Swords className="h-5 w-5" /></Button>
      <Dialog open={!!previewUser} onOpenChange={(isOpen) => !isOpen && setPreviewUser(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Competitor preview</DialogTitle></DialogHeader>{previewUser ? <div className="space-y-3"><div className="flex items-center gap-3"><AvatarRenderer avatar={previewUser.avatar ?? undefined} avatarConfig={previewUser.avatarConfig as any} size="md" /><div><p className="font-semibold">{getDisplayName(previewUser)}</p><p className="text-xs text-muted-foreground">Rank #{previewUser.rankPos} · Level {previewUser.level}</p></div></div><div className="flex flex-wrap gap-2"><Badge className={`bg-gradient-to-r ${tierStyle(previewUser.level)}`}>{previewUser.tier}</Badge><Badge variant="secondary">{Math.round(previewUser.score).toLocaleString()} points</Badge><Badge variant="outline">🔥 {previewUser.streak} day streak</Badge></div><Button className="w-full" onClick={() => navigate(`/profile/${previewUser.id}`)}>Open profile</Button></div> : null}</DialogContent></Dialog>
    </div>
  );
};

export default Leaderboard;
