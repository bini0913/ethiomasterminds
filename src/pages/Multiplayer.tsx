import { db } from "@/integrations/untypedClient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3, Gamepad2, Lock, Medal, RefreshCw, Share2, Shield,
  Swords, Trophy, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useRoom } from "@/context/RoomContext";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RealTimeRoom, { type MatchSummary } from "@/components/multiplayer/RealTimeRoom";
import Confetti from "@/components/quiz/Confetti";

type HubMode = {
  id: "duel" | "2v2" | "private" | "tournament";
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  targetPath: string;
};

const MODES: HubMode[] = [
  { id: "duel", title: "1v1 Duel", subtitle: "Speed & accuracy showdown", description: "Face another student in a live, head-to-head quiz battle.", badge: "Quick match", icon: Swords, targetPath: "/lobby?mode=1v1" },
  { id: "2v2", title: "2v2 Team Battle", subtitle: "Play together", description: "Team up with a classmate and compete as a pair.", badge: "Team play", icon: Users, targetPath: "/lobby?mode=2v2" },
  { id: "private", title: "Private Arena", subtitle: "Challenge your friends", description: "Create or join a private room using its room code.", badge: "Invite only", icon: Lock, targetPath: "/lobby?mode=private" },
  { id: "tournament", title: "Tournaments", subtitle: "Compete for the title", description: "Explore available tournaments and competitive brackets.", badge: "Competition", icon: Trophy, targetPath: "/tournaments" },
];

type LeaderboardEntry = {
  user_id: string;
  rank_position: number;
  player_name: string;
  total_points: number;
  matches_played?: number;
  wins?: number;
  podiums?: number;
};

type MatchHistoryEntry = {
  room_id: string;
  placement: number;
  player_count: number;
  score: number;
  accuracy: number;
  xp_earned: number;
  coins_earned: number;
  created_at: string;
};

const Multiplayer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const { currentRoom, leaveRoom } = useRoom();

  const [onlineCount, setOnlineCount] = useState(0);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [recentHistory, setRecentHistory] = useState<MatchHistoryEntry[]>([]);
  const [rankedLeaderboard, setRankedLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rankedLoading, setRankedLoading] = useState(true);
  const [directCode, setDirectCode] = useState("");

  const roomId = searchParams.get("room");

  const fetchOnlineCount = useCallback(async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("user_presence")
      .select("*", { count: "exact", head: true })
      .eq("status", "online")
      .gte("last_seen", fiveMinutesAgo);
    if (!error && count !== null) setOnlineCount(count);
  }, []);

  useEffect(() => {
    void fetchOnlineCount();
    const interval = window.setInterval(() => void fetchOnlineCount(), 30000);
    return () => window.clearInterval(interval);
  }, [fetchOnlineCount]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const updatePresence = async () => {
      await db.from("user_presence").upsert(
        { user_id: user.id, status: "online", last_seen: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    };
    void updatePresence();
    const interval = window.setInterval(() => void updatePresence(), 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void active;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const loadRankedLeaderboard = async () => {
      setRankedLoading(true);
      const { data, error } = await db.rpc("multiplayer_ranked_leaderboard", { p_limit: 10 });
      if (active && !error && data) setRankedLeaderboard(data as LeaderboardEntry[]);
      if (active) setRankedLoading(false);
    };
    void loadRankedLeaderboard();

    if (user?.id) {
      const loadHistory = async () => {
        const { data, error } = await (supabase as any)
          .from("multiplayer_match_results")
          .select("room_id, placement, player_count, score, accuracy, xp_earned, coins_earned, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (active && !error && data) setRecentHistory(data as MatchHistoryEntry[]);
      };
      void loadHistory();
    }
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access multiplayer features");
      navigate("/");
    }
  }, [navigate, user]);

  const playerMetrics = useMemo(() => ({
    level: user?.level ?? 1,
    xp: user?.xp ?? 0,
    rank: user?.rank ?? "Rookie",
  }), [user?.level, user?.rank, user?.xp]);

  const xpInLevel = playerMetrics.xp % 1000;
  const xpProgress = Math.max(0, Math.min(100, (xpInLevel / 1000) * 100));

  const handleJoinDirectCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = directCode.trim().toUpperCase();
    if (!code) {
      toast.error("Enter the room code first");
      return;
    }
    navigate(`/lobby?join=${encodeURIComponent(code)}`);
  };

  const handleLeaveRoom = useCallback(() => {
    if (roomId && user?.id) void leaveRoom(roomId, user.name || "Player");
    navigate("/multiplayer");
  }, [leaveRoom, navigate, roomId, user?.id, user?.name]);

  const shareResult = async () => {
    const text = `I finished a Master Minds multiplayer match with a score of ${matchSummary?.score ?? 0}!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Master Minds match result", text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success("Result copied");
      } else {
        toast.error("Sharing isn't available on this device");
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") toast.error("Couldn't share the result");
    }
  };

  if (roomId && user && matchSummary) {
    const didWin = matchSummary.playerRank === 1;
    return (
      <div className={`min-h-screen bg-background text-foreground ${upperStudent ? "tier-upper pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-10"}`}>
        {didWin && <Confetti />}
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
          <Card>
            <CardHeader className="text-center sm:text-left">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl sm:justify-start">
                {didWin ? <Trophy className="h-7 w-7 text-amber-500" /> : <Medal className="h-7 w-7 text-primary" />}
                {didWin ? "Victory!" : "Match complete"}
              </CardTitle>
              <CardDescription>
                {didWin ? "Great performance. Your final results are ready." : "Review your performance and get ready for the next match."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Placement", value: `#${matchSummary.playerRank} / ${matchSummary.playerCount}` },
                  { label: "Score", value: String(matchSummary.score) },
                  { label: "Accuracy", value: `${matchSummary.accuracy}%` },
                  { label: "Correct", value: `${matchSummary.correctAnswers}/${matchSummary.answeredQuestions}` },
                  { label: "XP", value: `+${matchSummary.xpGained}` },
                  { label: "Coins", value: `+${matchSummary.coinsGained}` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-card p-3 text-center">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-lg font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>
              <section className="space-y-3">
                <h2 className="font-semibold">Final standings</h2>
                {matchSummary.players.map((player) => (
                  <div key={player.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${player.id === user.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{player.placement <= 3 ? ["🥇", "🥈", "🥉"][player.placement - 1] : `#${player.placement}`} {player.name}{player.id === user.id ? " (You)" : ""}</p>
                      <p className="text-xs text-muted-foreground">{player.score} pts · {player.accuracy}% accuracy</p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="font-semibold">+{player.xpEarned} XP</p>
                      <p className="text-xs text-muted-foreground">+{player.coinsEarned} coins</p>
                    </div>
                  </div>
                ))}
              </section>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Button onClick={() => { setMatchSummary(null); navigate(`/multiplayer?room=${encodeURIComponent(roomId)}`); }}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Rematch
                </Button>
                <Button variant="outline" onClick={() => navigate("/leaderboard")}>
                  <BarChart3 className="mr-2 h-4 w-4" /> Statistics
                </Button>
                <Button variant="outline" onClick={() => void shareResult()}>
                  <Share2 className="mr-2 h-4 w-4" /> Share result
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => { setMatchSummary(null); navigate("/multiplayer"); }}>
                Return to Arena
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (roomId && user) {
    return (
      <RealTimeRoom
        roomId={roomId}
        roomName={currentRoom?.name || "Game Room"}
        initialMaxPlayers={currentRoom?.maxPlayers || 4}
        currentUserId={user.id}
        currentUserName={user.name || "Player"}
        onLeave={handleLeaveRoom}
        onGameEnd={setMatchSummary}
      />
    );
  }

  const playerCard = (
    <Card className="border-border shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-primary">
            {(user?.name || "P").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user?.name || "Player"}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" /> {playerMetrics.rank} · Level {playerMetrics.level}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Level progress</span><span>{xpInLevel.toLocaleString()} / 1,000 XP</span>
          </div>
          <Progress value={xpProgress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );

  const leaderboardCard = (
    <Card className="border-border shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-500" /> Ranked leaderboard</CardTitle>
        <CardDescription className="text-xs">Top players by multiplayer points</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        {rankedLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading rankings…</p> :
          rankedLeaderboard.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No ranked matches recorded yet.</p> :
          rankedLeaderboard.slice(0, 6).map((entry) => (
            <div key={entry.user_id} className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm ${entry.user_id === user?.id ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 text-center font-bold">{entry.rank_position <= 3 ? ["🥇", "🥈", "🥉"][Number(entry.rank_position) - 1] : `#${entry.rank_position}`}</span>
                <span className="truncate font-medium">{entry.player_name}{entry.user_id === user?.id ? " (You)" : ""}</span>
              </div>
              <span className="shrink-0 font-bold text-primary">{Number(entry.total_points).toLocaleString()} pts</span>
            </div>
          ))}
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/leaderboard")}>View full leaderboard</Button>
      </CardContent>
    </Card>
  );

  const historyCard = (
    <Card className="border-border shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Medal className="h-4 w-4 text-primary" /> Recent matches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        {recentHistory.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Your completed matches will appear here.</p> :
          recentHistory.map((match) => (
            <div key={`${match.room_id}-${match.created_at}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">#{match.placement} of {match.player_count}</p>
                <p className="text-xs text-muted-foreground">{match.score} pts · {Number(match.accuracy || 0)}% accuracy</p>
              </div>
              <span className="shrink-0 font-semibold text-primary">+{match.xp_earned} XP</span>
            </div>
          ))}
      </CardContent>
    </Card>
  );

  return (
    <div className={`min-h-screen bg-background text-foreground ${upperStudent ? "tier-upper pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-10"}`}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BackButton />
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Gamepad2 className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight">Multiplayer Arena</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Play live quiz battles with other students</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 gap-2 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> {onlineCount} online
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <section className="min-w-0 space-y-5 lg:col-span-8">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-sm sm:p-7">
              <Badge variant="secondary" className="mb-3">MULTIPLAYER SEASON</Badge>
              <h2 className="max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">Ready for your next challenge?</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Jump into a quick duel, team up with a friend, or create a private room. Your next match starts here.</p>
              <Button size="lg" className="mt-5 w-full font-bold sm:w-auto" onClick={() => navigate("/lobby?mode=1v1")}>
                <Swords className="mr-2 h-4 w-4" /> Quick 1v1 Duel <Zap className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button key={mode.id} type="button" onClick={() => navigate(mode.targetPath)}
                    className="group flex min-h-36 flex-col items-start rounded-xl border border-border border-b-4 bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/40 active:translate-y-1 active:border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-40 sm:p-4">
                    <div className="mb-3 flex w-full items-center justify-between gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-4 w-4" /></span>
                      <Badge variant="secondary" className="text-[10px]">{mode.badge}</Badge>
                    </div>
                    <span className="text-sm font-bold sm:text-base">{mode.title}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{mode.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <Card className="border-border shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <form onSubmit={handleJoinDirectCode} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-primary" /> Have a room code?</div>
                  <div className="flex min-w-0 flex-1 gap-2">
                    <Input value={directCode} onChange={(event) => setDirectCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                      placeholder="Enter room code" aria-label="Room code" autoComplete="off" className="min-w-0 text-center font-mono tracking-widest sm:text-left" />
                    <Button type="submit" className="shrink-0">Join room</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="lg:hidden">
              <Tabs defaultValue="rankings" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="rankings">Rankings</TabsTrigger>
                  <TabsTrigger value="history">Recent matches</TabsTrigger>
                </TabsList>
                <TabsContent value="rankings" className="mt-3">{leaderboardCard}</TabsContent>
                <TabsContent value="history" className="mt-3">{historyCard}</TabsContent>
              </Tabs>
            </div>
          </section>

          <aside className="hidden space-y-5 lg:sticky lg:top-20 lg:col-span-4 lg:block">
            {playerCard}
            {leaderboardCard}
            {historyCard}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Multiplayer;
