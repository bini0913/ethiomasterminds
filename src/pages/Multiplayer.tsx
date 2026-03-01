import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock3,
  Crown,
  Gamepad2,
  Gauge,
  Globe,
  Lock,
  Radar,
  Shield,
  Sparkles,
  Swords,
  Timer,
  Trophy,
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
import RealTimeRoom from "@/components/multiplayer/RealTimeRoom";

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

const hubCards = [
  {
    id: "quick-match",
    label: "⚔️ Quick Match",
    description: "SR-balanced instant queue by grade, ping, and recent form",
    gradient: "from-blue-500 to-cyan-500",
    icon: Swords,
  },
  {
    id: "team-battle",
    label: "👥 Team Battle",
    description: "2v2 and 3v3 with shared score, survival, and strategy mode",
    gradient: "from-fuchsia-500 to-purple-500",
    icon: Users,
  },
  {
    id: "private-room",
    label: "🔐 Private Room",
    description: "Code-based room with ready checks, emotes, and 10s countdown",
    gradient: "from-emerald-500 to-teal-500",
    icon: Lock,
  },
  {
    id: "tournaments",
    label: "🏆 Tournaments",
    description: "Weekly qualification, knockout, semifinal, and finals",
    gradient: "from-amber-500 to-orange-500",
    icon: Trophy,
  },
  {
    id: "leaderboard",
    label: "📊 Leaderboard",
    description: "Global, grade, weekly, school, and contribution ladders",
    gradient: "from-rose-500 to-red-500",
    icon: Crown,
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
    id: "global-quick",
    title: "Global Quick Match",
    subtitle: "Worldwide search tuned by ping and hidden SR",
    description: "Find fair games in seconds with strict anti-smurf and performance balancing.",
    icon: Globe,
    gradient: "from-emerald-500 to-cyan-500",
    xp: "enabled",
    team: "mixed",
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
    id: "weekly-world",
    title: "Weekly World Championship",
    subtitle: "Premium weekly circuit with weekly leaderboard reset",
    description: "Global showcase event with champion frame, badge, and spotlight title.",
    icon: Crown,
    gradient: "from-rose-500 to-orange-500",
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

  const roomId = searchParams.get("room");

  const playClickFeedback = () => {
    if (typeof window === "undefined") return;
    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = "triangle";
    oscillator.frequency.value = 660;
    gainNode.gain.setValueAtTime(0.03, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.1);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  };

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
        { onConflict: "user_id" }
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
      streak: user?.streak ?? 0,
    }),
    [user?.level, user?.rank, user?.streak, user?.xp]
  );

  const joinMode = (mode: HubMode) => {
    playClickFeedback();
    toast.success(`Queued for ${mode.title}`);
    navigate("/lobby");
  };

  const handleLeaveRoom = () => {
    if (roomId && user) {
      leaveRoom(roomId, user.name || "Player");
    }
    navigate("/lobby");
  };

  if (roomId && user) {
    return (
      <RealTimeRoom
        roomId={roomId}
        roomName={currentRoom?.name || "Game Room"}
        maxPlayers={currentRoom?.maxPlayers || 4}
        currentUserId={user.id}
        currentUserName={user.name || "Player"}
        onLeave={handleLeaveRoom}
        onGameEnd={() => toast.success("Game finished!")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />

      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <motion.div
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.5 }}
              >
                <Gamepad2 className="w-6 h-6 text-primary-foreground" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">Multiplayer Hub</h1>
                <p className="text-sm text-muted-foreground">Real-time esports learning arena</p>
              </div>
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2" />
            {onlineCount} Online
          </Badge>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8 relative z-10 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: "XP", value: playerMetrics.xp, icon: Sparkles },
            { label: "Level", value: playerMetrics.level, icon: Zap },
            { label: "Rank Badge", value: playerMetrics.rank, icon: Trophy },
            { label: "Current Streak", value: playerMetrics.streak, icon: Timer },
            { label: "Connection", value: "Stable", icon: Wifi },
          ].map((metric) => (
            <Card key={metric.label} className="glass border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <metric.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="font-bold text-foreground">{metric.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-5">
          {hubCards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              whileHover={{ y: -6, scale: 1.01 }}
            >
              <Card
                className="glass h-full overflow-hidden cursor-pointer border-border/50 hover:neon-border transition-all"
                onClick={() => {
                  playClickFeedback();
                  const normalizedLabel = ["⚔️", "👥", "🔐", "🏆", "📊"].reduce(
                    (label, icon) => label.replace(icon, ""),
                    card.label,
                  ).trim();
                  toast.info(`${normalizedLabel} selected`);
                }}
              >
                <div className={`absolute inset-0 opacity-15 bg-gradient-to-br ${card.gradient}`} />
                <CardContent className="relative p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <card.icon className="w-5 h-5 text-foreground" />
                    <Radar className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-semibold">{card.label}</p>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass lg:col-span-2">
            <CardHeader>
              <CardTitle>All Multiplayer Modes</CardTitle>
              <CardDescription>Select from casual practice to weekly championship.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {multiplayerModes.map((mode) => (
                <motion.button
                  key={mode.id}
                  whileHover={{ scale: 1.01 }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedMode.id === mode.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-card/30 hover:border-primary/40"
                  }`}
                  onClick={() => {
                    playClickFeedback();
                    setSelectedMode(mode);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <mode.icon className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{mode.title}</span>
                    </div>
                    <Badge variant={mode.xp === "enabled" ? "default" : "secondary"}>
                      {mode.xp === "enabled" ? "XP" : "No XP"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{mode.subtitle}</p>
                </motion.button>
              ))}
            </CardContent>
          </Card>

          <Card className="glass border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <selectedMode.icon className="w-5 h-5 text-primary" />
                {selectedMode.title}
              </CardTitle>
              <CardDescription>{selectedMode.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedMode.description}</p>
              <div className="space-y-2 text-sm">
                <p>• 10-20 questions / match</p>
                <p>• 10-20s timer / question</p>
                <p>• +100 correct, +20 fast bonus, streak multipliers</p>
                <p>• 30s reconnect window before forfeit</p>
              </div>
              <Button className={`w-full bg-gradient-to-r ${selectedMode.gradient} text-white`} onClick={() => joinMode(selectedMode)}>
                Queue for {selectedMode.title}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Match History</CardTitle>
              <CardDescription>Recent performance snapshots and progression trends.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border/50 p-3 flex justify-between">
                <span>Victory · 2v2 Team Battle</span>
                <span className="text-green-400">+34 SR</span>
              </div>
              <div className="rounded-lg border border-border/50 p-3 flex justify-between">
                <span>Defeat · Quick Match</span>
                <span className="text-red-400">-12 SR</span>
              </div>
              <div className="rounded-lg border border-border/50 p-3 flex justify-between">
                <span>Victory · Private Room Scrim</span>
                <span className="text-green-400">+22 SR</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Friends Online</CardTitle>
              <CardDescription>Invite squadmates instantly to rooms and team queues.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {["Aster", "Maya", "Nebiyu", "Zara"].map((friend) => (
                <div key={friend} className="rounded-lg border border-border/50 p-3 flex items-center justify-between">
                  <span>{friend}</span>
                  <Button size="sm" variant="outline" onClick={playClickFeedback}>
                    Invite
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            "Server-side answer validation",
            "Anti-cheat timer and spam-click throttling",
            "Tamper-proof answer payload signature",
            "Room-based WebSocket state sync",
          ].map((item) => (
            <Card key={item} className="glass border-border/50">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-4 h-4 mt-0.5 text-primary" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="glass overflow-hidden border-primary/30">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-accent/10 to-secondary/15" />
          <CardContent className="relative p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-gradient mb-2">Weekly World Championship</h3>
              <p className="text-muted-foreground max-w-2xl">
                Qualification → Knockout → Semi-final → Final. Earn Champion of Week title, profile frame,
                and high-tier XP rewards with global broadcast-style match coverage.
              </p>
            </div>
            <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white" onClick={() => joinMode(multiplayerModes[6])}>
              <Crown className="w-4 h-4 mr-2" />
              Join Championship
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground pb-4">
          “Master Minds Multiplayer transforms academic competition into a structured, AI-enhanced, real-time esports learning experience.”
        </p>
      </main>

      <div className="fixed bottom-4 right-4 z-30">
        <Button onClick={() => navigate("/lobby")} className="btn-futuristic bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl">
          <Clock3 className="w-4 h-4 mr-2" />
          Open Lobby
        </Button>
      </div>
    </div>
  );
};

export default Multiplayer;
