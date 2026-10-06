import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Gamepad2,
  Lock,
  Medal,
  RefreshCw,
  Share2,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useRoom } from "@/context/RoomContext";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import RealTimeRoom, { type MatchSummary } from "@/components/multiplayer/RealTimeRoom";
import Confetti from "@/components/quiz/Confetti";

type HubMode = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  xp: "enabled" | "disabled";
};

const multiplayerModes: HubMode[] = [
  {
    id: "duel",
    title: "1v1 Duel",
    subtitle: "Pure skill, fast rounds",
    description: "10-20 question duel where speed and accuracy decide every round.",
    icon: Swords,
    xp: "enabled",
  },
  {
    id: "2v2",
    title: "2v2 Team Battle",
    subtitle: "Coordinate with your teammate",
    description: "Coordinate with your teammate for streak multipliers and clutch recoveries.",
    icon: Users,
    xp: "enabled",
  },
  {
    id: "private",
    title: "Private Room",
    subtitle: "Invite-only rooms for friends",
    description: "Create a room code and customize format before launching your match.",
    icon: Lock,
    xp: "enabled",
  },
  {
    id: "tournament",
    title: "Tournament Mode",
    subtitle: "Bracket-driven competitive flow",
    description: "Progress from qualifiers to finals and chase title-exclusive rewards.",
    icon: Trophy,
    xp: "enabled",
  },
];

const Multiplayer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { currentRoom, leaveRoom } = useRoom();

  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedMode, setSelectedMode] = useState(multiplayerModes[0]);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [rankedLeaderboard, setRankedLeaderboard] = useState<any[]>([]);
  const [rankedLoading, setRankedLoading] = useState(true);

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
    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30000);
    return () => clearInterval(interval);
  }, [fetchOnlineCount]);
  useEffect(() => {
    const loadRankedLeaderboard = async () => {
      setRankedLoading(true);
      const { data, error } = await supabase.rpc('multiplayer_ranked_leaderboard', { p_limit: 10 });
      if (!error && data) setRankedLeaderboard(data);
      setRankedLoading(false);
    };
    void loadRankedLeaderboard();

    if (!user?.id) return;
    const loadHistory = async () => {
      const { data, error } = await (supabase as any)
        .from('multiplayer_match_results')
        .select('room_id, placement, player_count, score, accuracy, xp_earned, coins_earned, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!error && data) setRecentHistory(data);
    };
    void loadHistory();
  }, [user?.id]);



  useEffect(() => {
    if (!user?.id) return;
    const updatePresence = async () => {
      await supabase.from("user_presence").upsert(
        { user_id: user.id, status: "online", last_seen: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    };
    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access multiplayer features");
      navigate("/");
    }
  }, [navigate, user]);

  const playerMetrics = useMemo(
    () => ({
      level: user?.level ?? 1,
      xp: user?.xp ?? 0,
      rank: user?.rank ?? "Rookie",
    }),
    [user?.level, user?.rank, user?.xp],
  );

  const xpInLevel = playerMetrics.xp % 1000;
  const xpProgress = Math.max(5, Math.min(100, (xpInLevel / 1000) * 100));

  const joinMode = (mode: HubMode) => {
    toast.success(`Queued for ${mode.title}`);
    if (mode.id === "tournament") {
      navigate("/tournaments");
      return;
    }
    navigate("/lobby");
  };

  const handleLeaveRoom = useCallback(() => {
    if (roomId && user) {
      void leaveRoom(roomId, user.name || "Player");
    }
    navigate("/lobby");
  }, [leaveRoom, navigate, roomId, user]);

  // Match summary screen
  if (roomId && user && matchSummary) {
    const didWin = matchSummary.playerRank === 1;
    return (
      <div className="min-h-screen bg-background text-foreground">
        {didWin && <Confetti />}
        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {didWin ? <Trophy className="text-yellow-500" /> : <Medal className="text-blue-400" />}
                {didWin ? "Victory!" : "Match Complete"}
              </CardTitle>
              <CardDescription>
                {didWin
                  ? "XP burst, rank climb, and streak bonus unlocked."
                  : "Great fight — tune accuracy and bounce back."} Winner: {didWin ? 'You 🥇' : 'Opponent 🥇'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Match rank", value: `#${matchSummary.playerRank} / ${matchSummary.playerCount}` },
                  { label: "Score", value: String(matchSummary.score) },
                  { label: "Accuracy", value: `${matchSummary.accuracy}%` },
                  { label: "Correct", value: `${matchSummary.correctAnswers}/${matchSummary.answeredQuestions}` },
                  { label: "XP earned", value: `+${matchSummary.xpGained}` },
                  { label: "Coins earned", value: `+${matchSummary.coinsGained}` },
                ].map((stat) => (
                  <Card key={stat.label} className="bg-muted/50">
                    <CardContent className="p-3 text-sm">
                      {stat.label}<br /><strong>{stat.value}</strong>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" /> Match Standings
                  </CardTitle>
                  <CardDescription>Final ranking, score and rewards for every player.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {matchSummary.players.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${player.id === user.id ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-muted grid place-items-center font-bold">
                          {player.placement <= 3 ? ["🥇", "🥈", "🥉"][player.placement - 1] : `#${player.placement}`}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{player.name}{player.id === user.id ? " (You)" : ""}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.score} pts · {player.correctAnswers}/{player.answeredQuestions} correct · {player.accuracy}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">+{player.xpEarned} XP</p>
                        <p className="text-xs text-muted-foreground">+{player.coinsEarned} coins</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-muted/50">
                  <CardHeader><CardTitle className="text-base">Match Analytics</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p>Strong topics: {matchSummary.strongTopics.join(", ")}</p>
                    <p>Weak topics: {matchSummary.weakTopics.join(", ")}</p>
                    <Button variant="outline" className="w-full" onClick={() => toast.success("Launching AI weak-topic practice plan")}>
                      <Bot className="w-4 h-4 mr-2" /> Practice Weak Topic
                    </Button>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardHeader><CardTitle className="text-base">Post Match Actions</CardTitle></CardHeader>
                  <CardContent className="grid gap-2">
                    <Button onClick={() => { setMatchSummary(null); navigate(`/multiplayer?room=${roomId}`); }}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Rematch
                    </Button>
                    <Button variant="outline" onClick={() => toast.success("Friend request sent")}>
                      <UserPlus className="w-4 h-4 mr-2" /> Add Friend
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/leaderboard")}>
                      <BarChart3 className="w-4 h-4 mr-2" /> View Stats
                    </Button>
                    <Button variant="outline" onClick={() => toast.success('Result card shared')}>
                      <Share2 className="w-4 h-4 mr-2" /> Share Result
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <Button className="w-full" variant="ghost" onClick={() => { setMatchSummary(null); navigate("/multiplayer"); }}>
                Back to Hub
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Active room
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

  // Hub
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Multiplayer Hub</h1>
                <p className="text-sm text-muted-foreground">Choose a mode and start competing</p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 inline-block" />
            {onlineCount} Online
          </Badge>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Player card */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 grid place-items-center font-bold text-primary">
                {(user?.name || "P").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{user?.name || "Player"}</p>
                <p className="text-xs text-muted-foreground">Rank: {playerMetrics.rank} · Level {playerMetrics.level}</p>
              </div>
            </div>
            <div className="w-full sm:max-w-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>XP Progress</span>
                <span>{xpInLevel}/1000</span>
              </div>
              <Progress value={xpProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Ranked Points Leaderboard
            </CardTitle>
            <CardDescription>Players are ranked by total multiplayer points earned across completed matches — not XP.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankedLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading rankings…</div>
            ) : rankedLeaderboard.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No ranked matches yet. Be the first to score!</div>
            ) : (
              rankedLeaderboard.map((entry) => (
                <div key={entry.user_id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${entry.user_id === user?.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 text-center font-black">{entry.rank_position <= 3 ? ["🥇","🥈","🥉"][Number(entry.rank_position)-1] : `#${entry.rank_position}`}</div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{entry.player_name}{entry.user_id === user?.id ? " (You)" : ""}</p>
                      <p className="text-xs text-muted-foreground">{entry.matches_played} matches · {entry.wins} wins · {entry.podiums} podiums</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-cyan-500">{Number(entry.total_points).toLocaleString()} pts</p>
                    <p className="text-xs text-muted-foreground">Total points</p>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate("/leaderboard")}>
              View Full Leaderboard
            </Button>
          </CardContent>
        </Card>

        {recentHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="w-5 h-5" /> Recent Match History
              </CardTitle>
              <CardDescription>Your latest multiplayer results and rewards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentHistory.map((match) => (
                <div key={`${match.room_id}-${match.created_at}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <p className="font-semibold">#{match.placement} / {match.player_count} place</p>
                    <p className="text-xs text-muted-foreground">
                      {match.score} pts · {Number(match.accuracy || 0)}% accuracy · {new Date(match.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">+{match.xp_earned} XP</p>
                    <p className="text-xs text-muted-foreground">+{match.coins_earned} coins</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "⚔️ Quick Match", desc: "Fast balanced duel", onClick: () => navigate("/lobby") },
            { label: "👥 Team Up", desc: "Play with friends", onClick: () => navigate("/lobby") },
            { label: "🏆 Tournaments", desc: "Competitive cups", onClick: () => navigate("/lobby") },
            { label: "🔐 Private Room", desc: "Code-protected", onClick: () => navigate("/lobby") },
          ].map((card) => (
            <button
              key={card.label}
              onClick={card.onClick}
              className="text-left rounded-xl border border-border p-4 bg-card hover:bg-accent transition-colors"
            >
              <p className="font-semibold text-sm">{card.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
            </button>
          ))}
        </div>

        {/* Mode select */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Select Mode</CardTitle>
              <CardDescription>Choose your battle format</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {multiplayerModes.map((mode) => (
                <button
                  key={mode.id}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedMode.id === mode.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                  onClick={() => setSelectedMode(mode)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <mode.icon className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{mode.title}</span>
                    </div>
                    <Badge variant={mode.xp === "enabled" ? "default" : "secondary"} className="text-xs">
                      {mode.xp === "enabled" ? "XP" : "No XP"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{mode.subtitle}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <selectedMode.icon className="w-5 h-5 text-primary" />
                {selectedMode.title}
              </CardTitle>
              <CardDescription>{selectedMode.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedMode.description}</p>
              <Button className="w-full" onClick={() => joinMode(selectedMode)}>
                <Zap className="w-4 h-4 mr-2" /> Queue for {selectedMode.title}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Open lobby button */}
        <div className="text-center">
          <Button onClick={() => navigate("/lobby")} size="lg">
            <Zap className="w-4 h-4 mr-2" /> Open Lobby
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Multiplayer;
