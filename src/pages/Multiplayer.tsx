import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Gauge,
  Gamepad2,
  Lock,
  Medal,
  Radar,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useRoom } from "@/context/RoomContext";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
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
  gradient: string;
  xp: "enabled" | "disabled";
  team?: "1v1" | "2v2" | "3v3" | "mixed";
};

const premiumCards = [
  {
    id: "quick-match",
    label: "⚔️ Quick Match",
    description: "Balanced Match Guarantee by SR, grade, streak, and recent form",
    preview: "2 players battling · avg queue 7s",
    gradient: "from-blue-500 to-cyan-500",
    icon: Swords,
  },
  {
    id: "team-battle",
    label: "👥 Team Battle",
    description: "2v2 and 3v3 tactical modes with squad streak bonuses",
    preview: "6 players online in active team queues",
    gradient: "from-fuchsia-500 to-purple-500",
    icon: Users,
  },
  {
    id: "private-room",
    label: "🔐 Private Room",
    description: "Invite friends, share room code, and launch with ready sync",
    preview: "Join via code · reconnect window 30s",
    gradient: "from-emerald-500 to-teal-500",
    icon: Lock,
  },
  {
    id: "tournaments",
    label: "🏆 Tournaments",
    description: "Weekly premium bracket with qualifiers, semis, and finals",
    preview: "Next finals in 03:24:11",
    gradient: "from-amber-500 to-orange-500",
    icon: Trophy,
  },
] as const;

const multiplayerModes: HubMode[] = [
  {
    id: "duel",
    title: "1v1 Duel",
    subtitle: "Pure skill, fast rounds, ELO-sensitive matchmaking",
    description: "10-20 question duel where speed and accuracy decide every round.",
    icon: Swords,
    gradient: "from-blue-500 to-cyan-500",
    xp: "enabled",
    team: "1v1",
  },
  {
    id: "2v2",
    title: "2v2 Team Battle",
    subtitle: "Collaborative tactics with shared score or survival rules",
    description: "Coordinate with your teammate for streak multipliers and clutch recoveries.",
    icon: Users,
    gradient: "from-violet-500 to-purple-500",
    xp: "enabled",
    team: "2v2",
  },
  {
    id: "3v3",
    title: "3v3 Team Battle",
    subtitle: "Larger team battles with strategy mode + live mini leaderboard",
    description: "High-chaos competitive mode with player elimination in survival settings.",
    icon: Users,
    gradient: "from-indigo-500 to-blue-500",
    xp: "enabled",
    team: "3v3",
  },
  {
    id: "private",
    title: "Private Room (Code)",
    subtitle: "Invite-only rooms for friends, school clubs, or scrims",
    description: "Create a room code and customize format before launching your match.",
    icon: Lock,
    gradient: "from-fuchsia-500 to-pink-500",
    xp: "enabled",
    team: "mixed",
  },
  {
    id: "tournament",
    title: "Tournament Mode",
    subtitle: "Bracket-driven competitive flow with knockout intensity",
    description: "Progress from qualifiers to finals and chase title-exclusive rewards.",
    icon: Trophy,
    gradient: "from-yellow-500 to-orange-500",
    xp: "enabled",
    team: "mixed",
  },
  {
    id: "practice",
    title: "Practice Match",
    subtitle: "No-XP environment to train speed and topic confidence",
    description: "Stress-free reps with analytics and weak-topic detection enabled.",
    icon: Gauge,
    gradient: "from-slate-500 to-zinc-500",
    xp: "disabled",
    team: "mixed",
  },
];

const Multiplayer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { currentRoom, leaveRoom } = useRoom();

  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedMode, setSelectedMode] = useState(multiplayerModes[0]);
  const [hubStep, setHubStep] = useState<"hub" | "mode">("hub");
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);

  const roomId = searchParams.get("room");

  const fetchOnlineCount = useCallback(async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from("user_presence")
      .select("*", { count: "exact", head: true })
      .eq("status", "online")
      .gte("last_seen", fiveMinutesAgo);

    if (!error && count !== null) {
      setOnlineCount(count);
    }
  }, []);

  useEffect(() => {
    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30000);
    return () => clearInterval(interval);
  }, [fetchOnlineCount]);

  useEffect(() => {
    if (!user?.id) return;

    const updatePresence = async () => {
      await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          status: "online",
          last_seen: new Date().toISOString(),
        },
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
      status: "Online",
    }),
    [user?.level, user?.rank, user?.xp],
  );

  const xpInLevel = playerMetrics.xp % 1000;
  const xpProgress = Math.max(5, Math.min(100, (xpInLevel / 1000) * 100));

  const joinMode = (mode: HubMode) => {
    toast.success(`Queued for ${mode.title}`);
    navigate("/lobby");
  };

  const handleLeaveRoom = useCallback(() => {
    if (roomId && user) {
      void leaveRoom(roomId, user.name || "Player");
    }
    navigate("/lobby");
  }, [leaveRoom, navigate, roomId, user]);

  if (roomId && user && matchSummary) {
    const didWin = matchSummary.playerRank === 1;
    return (
      <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
        {didWin && <Confetti />}
        <AnimatedBackground />
        <main className="max-w-5xl mx-auto px-4 py-8 relative z-10 space-y-6">
          <Card className="glass border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {didWin ? <Trophy className="text-yellow-400" /> : <Medal className="text-blue-300" />} {didWin ? "Victory" : "Match Complete"}
              </CardTitle>
              <CardDescription>
                {didWin
                  ? "Celebration unlocked: XP burst, rank climb, and streak bonus."
                  : "Great fight. Your speed stayed strong — tune accuracy and bounce back."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-5 gap-3">
                <Card className="bg-card/40"><CardContent className="p-3 text-sm">XP gained<br /><strong>+{matchSummary.xpGained}</strong></CardContent></Card>
                <Card className="bg-card/40"><CardContent className="p-3 text-sm">Rank change<br /><strong>{matchSummary.rankChange > 0 ? "+" : ""}{matchSummary.rankChange}</strong></CardContent></Card>
                <Card className="bg-card/40"><CardContent className="p-3 text-sm">Accuracy<br /><strong>{matchSummary.accuracy}%</strong></CardContent></Card>
                <Card className="bg-card/40"><CardContent className="p-3 text-sm">Avg speed<br /><strong>{matchSummary.avgResponseTime}s</strong></CardContent></Card>
                <Card className="bg-card/40"><CardContent className="p-3 text-sm">Best streak<br /><strong>{matchSummary.streak}</strong></CardContent></Card>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card/40">
                  <CardHeader><CardTitle className="text-base">Advanced Match Analytics</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p>Strong topics: {matchSummary.strongTopics.join(", ")}</p>
                    <p>Weak topics: {matchSummary.weakTopics.join(", ")}</p>
                    <Button variant="outline" className="w-full" onClick={() => toast.success("Launching AI weak-topic practice plan") }>
                      <Bot className="w-4 h-4 mr-2" /> Practice Weak Topic
                    </Button>
                  </CardContent>
                </Card>
                <Card className="bg-card/40">
                  <CardHeader><CardTitle className="text-base">Post Match Actions</CardTitle></CardHeader>
                  <CardContent className="grid gap-2">
                    <Button onClick={() => { setMatchSummary(null); navigate(`/multiplayer?room=${roomId}`); }}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Rematch
                    </Button>
                    <Button variant="outline" onClick={() => toast.success("Friend request sent") }>
                      <UserPlus className="w-4 h-4 mr-2" /> Add Friend
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/leaderboard") }>
                      <BarChart3 className="w-4 h-4 mr-2" /> View Stats
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

  if (roomId && user) {
    return (
      <RealTimeRoom
        roomId={roomId}
        roomName={currentRoom?.name || "Game Room"}
        maxPlayers={currentRoom?.maxPlayers || 4}
        currentUserId={user.id}
        currentUserName={user.name || "Player"}
        onLeave={handleLeaveRoom}
        onGameEnd={setMatchSummary}
      />
    );
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-purple-950">
      <AnimatedBackground />
      <div className="absolute inset-0 pointer-events-none opacity-40 [background-image:radial-gradient(circle_at_30%_20%,rgba(96,165,250,0.2),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(168,85,247,0.18),transparent_35%)]" />

      <header className="sticky top-0 z-50 bg-slate-950/70 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <motion.div
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-[0_0_35px_rgba(99,102,241,0.55)]"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Gamepad2 className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold">Multiplayer Hub</h1>
                <p className="text-sm text-blue-200/80">Home → Hub → Mode → Lobby → Match → Results</p>
              </div>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse mr-2" />
            {onlineCount} Online
          </Badge>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8 relative z-10 space-y-8">
        <Card className="bg-white/5 border-white/10 shadow-[0_0_35px_rgba(59,130,246,0.2)]">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 grid place-items-center font-bold text-white">
                {(user?.name || "P").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{user?.name || "Player"}</p>
                <p className="text-xs text-blue-200/75">Rank badge: {playerMetrics.rank} · {playerMetrics.status}</p>
              </div>
            </div>
            <div className="w-full sm:max-w-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-blue-100/80">
                <span>XP Progress</span>
                <span>{xpInLevel}/1000</span>
              </div>
              <Progress value={xpProgress} className="h-2 bg-white/10" />
            </div>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {premiumCards.map((card, index) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-left"
              onClick={() => {
                setHubStep("mode");
                toast.info(`${card.label.replace(/[⚔️👥🔐🏆]/g, "").trim()} loaded`);
              }}
            >
              <Card className="h-full bg-white/5 border-white/10 overflow-hidden hover:border-cyan-300/40 transition-all shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${card.gradient}`} />
                <CardContent className="relative p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <card.icon className="w-5 h-5" />
                    <Radar className="w-4 h-4 text-cyan-300" />
                  </div>
                  <p className="font-semibold">{card.label}</p>
                  <p className="text-sm text-blue-100/75">{card.description}</p>
                  <div className="text-xs px-2 py-1 rounded-full bg-black/25 inline-flex">{card.preview}</div>
                </CardContent>
              </Card>
            </motion.button>
          ))}
        </section>

        {hubStep === "mode" && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-white/5 border-white/10 lg:col-span-2">
              <CardHeader>
                <CardTitle>Mode Select</CardTitle>
                <CardDescription>Choose your battle format. Balanced Match Guarantee is always enabled.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {multiplayerModes.map((mode) => (
                  <button
                    key={mode.id}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedMode.id === mode.id
                        ? "border-cyan-300 bg-cyan-500/10"
                        : "border-white/15 bg-white/5 hover:border-cyan-400/45"
                    }`}
                    onClick={() => setSelectedMode(mode)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <mode.icon className="w-4 h-4 text-cyan-300" />
                        <span className="font-semibold">{mode.title}</span>
                      </div>
                      <Badge variant={mode.xp === "enabled" ? "default" : "secondary"}>
                        {mode.xp === "enabled" ? "XP" : "No XP"}
                      </Badge>
                    </div>
                    <p className="text-sm text-blue-100/75">{mode.subtitle}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-cyan-400/35">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <selectedMode.icon className="w-5 h-5 text-cyan-300" />
                  {selectedMode.title}
                </CardTitle>
                <CardDescription>{selectedMode.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-blue-100/75">{selectedMode.description}</p>
                <p className="text-sm">SR + grade + recent form + streak are used to avoid unfair games.</p>
                <Button className={`w-full bg-gradient-to-r ${selectedMode.gradient} text-white`} onClick={() => joinMode(selectedMode)}>
                  Queue for {selectedMode.title}
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle>Friends Online</CardTitle>
              <CardDescription>Live social panel with one-tap invite.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 overflow-x-auto pb-1">
              {["Aster", "Maya", "Nebiyu", "Zara", "Lia", "Noah"].map((friend) => (
                <div key={friend} className="min-w-[120px] rounded-xl border border-white/10 bg-black/20 p-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">{friend}</p>
                  <button className="text-xs text-cyan-300" onClick={() => toast.success(`Invite sent to ${friend}`)}>Invite</button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
              <CardDescription>Mini cards with speed + accuracy snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { mode: "Quick Match", result: "Win", acc: "92%", speed: "2.1s" },
                { mode: "Team Battle", result: "Loss", acc: "81%", speed: "1.9s" },
                { mode: "Private Room", result: "Win", acc: "88%", speed: "2.4s" },
              ].map((entry) => (
                <div key={`${entry.mode}-${entry.result}`} className="rounded-lg border border-white/10 p-3 text-sm flex justify-between bg-black/20">
                  <span>{entry.mode} · {entry.result}</span>
                  <span>{entry.acc} · {entry.speed}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            "No lag in matchmaking with realtime sync",
            "30s reconnect window with automatic state recovery",
            "Secure server-side answer validation and anti-spam throttling",
          ].map((item) => (
            <Card key={item} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-4 h-4 mt-0.5 text-cyan-300" />
                <p className="text-sm text-blue-100/80">{item}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <p className="text-center text-sm text-blue-100/80 pb-4">
          “Master Minds Multiplayer delivers a fast, immersive, and competitive learning experience that feels like a real-time strategy game powered by intelligence.”
        </p>
      </main>

      <div className="fixed bottom-4 right-4 z-30">
        <Button onClick={() => navigate("/lobby")} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.55)]">
          <Zap className="w-4 h-4 mr-2" />
          Open Lobby
        </Button>
      </div>

      <div className="fixed bottom-4 left-4 z-30">
        <Badge className="bg-black/35 border-white/15 text-blue-100"><Wifi className="w-3 h-3 mr-1" /> Stable Network</Badge>
      </div>
    </div>
  );
};

export default Multiplayer;
