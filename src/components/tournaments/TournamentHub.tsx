import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Clock,
  Crown,
  Gamepad2,
  Medal,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TournamentStatus = "joinable" | "lobby" | "live" | "completed";
type MatchStatus = "pending" | "ready" | "live" | "finished";

type Tournament = {
  id: string;
  name: string;
  mode: "knockout" | "timed" | "daily";
  maxPlayers: number;
  currentPlayers: number;
  entry: "free" | "coins";
  entryCost?: number;
  status: TournamentStatus;
  countdownSeconds: number;
};

type Match = {
  id: string;
  roundName: string;
  round: number;
  player1: string;
  player2: string;
  winner?: string;
  status: MatchStatus;
  subject: string;
  questionCount: number;
  mode: "standard" | "speed";
};

type NotificationItem = {
  id: string;
  message: string;
  createdAt: number;
};

const roundLabels: Record<number, string> = {
  1: "Quarterfinal",
  2: "Semifinal",
  3: "Final",
};

const starterPlayers = [
  "You",
  "Amina",
  "Noah",
  "Mika",
  "Eden",
  "Sami",
  "Liya",
  "Kenan",
];

const createRoundOneMatches = (): Match[] => [
  { id: "qf-1", roundName: "Quarterfinal", round: 1, player1: "You", player2: "Amina", status: "ready", subject: "Math", questionCount: 12, mode: "standard" },
  { id: "qf-2", roundName: "Quarterfinal", round: 1, player1: "Noah", player2: "Mika", status: "live", subject: "Science", questionCount: 12, mode: "standard" },
  { id: "qf-3", roundName: "Quarterfinal", round: 1, player1: "Eden", player2: "Sami", status: "finished", winner: "Eden", subject: "English", questionCount: 12, mode: "speed" },
  { id: "qf-4", roundName: "Quarterfinal", round: 1, player1: "Liya", player2: "Kenan", status: "pending", subject: "Mixed", questionCount: 12, mode: "standard" },
];

const tournamentCatalog: Tournament[] = [
  {
    id: "mm-knockout-8",
    name: "Master Minds Knockout Cup",
    mode: "knockout",
    maxPlayers: 8,
    currentPlayers: 7,
    entry: "free",
    status: "joinable",
    countdownSeconds: 90,
  },
  {
    id: "mm-daily-blitz",
    name: "Daily Blitz Tournament",
    mode: "daily",
    maxPlayers: 16,
    currentPlayers: 13,
    entry: "coins",
    entryCost: 100,
    status: "joinable",
    countdownSeconds: 600,
  },
  {
    id: "mm-timed-night",
    name: "Evening Timed Clash",
    mode: "timed",
    maxPlayers: 16,
    currentPlayers: 16,
    entry: "coins",
    entryCost: 150,
    status: "live",
    countdownSeconds: 0,
  },
];

const formatClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.max(0, seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const TournamentHub: React.FC = () => {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [joined, setJoined] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([]);
  const [lobbyCountdown, setLobbyCountdown] = useState(45);
  const [currentRound, setCurrentRound] = useState(1);
  const [matches, setMatches] = useState<Match[]>(createRoundOneMatches());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const [champion, setChampion] = useState<string | null>(null);

  const activeMatch = useMemo(
    () => matches.find((match) => ["ready", "live"].includes(match.status) && match.player1 === "You"),
    [matches],
  );

  const activeRoundMatches = useMemo(() => matches.filter((match) => match.round === currentRound), [matches, currentRound]);

  const addNotification = (message: string) => {
    const item = { id: `${Date.now()}-${Math.random()}`, message, createdAt: Date.now() };
    setNotifications((prev) => [item, ...prev].slice(0, 8));
    toast(message);
  };

  const joinTournament = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setJoined(true);
    setLobbyPlayers(["You", ...starterPlayers.filter((player) => player !== "You").slice(0, tournament.currentPlayers)]);
    setLobbyCountdown(20);
    addNotification(`Joined ${tournament.name}. Waiting lobby opened.`);
  };

  useEffect(() => {
    if (!joined || champion) return;

    const interval = window.setInterval(() => {
      setLobbyPlayers((prev) => {
        if (!selectedTournament) return prev;
        if (prev.length >= selectedTournament.maxPlayers) return prev;
        const nextCandidate = starterPlayers[prev.length];
        if (!nextCandidate) return prev;
        return [...prev, nextCandidate];
      });

      setLobbyCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [joined, selectedTournament, champion]);

  useEffect(() => {
    if (!selectedTournament || !joined || champion) return;

    if (lobbyPlayers.length >= selectedTournament.maxPlayers) {
      addNotification("Tournament full. Matchmaking started.");
      setMatches(createRoundOneMatches());
      setCurrentRound(1);
    }
  }, [lobbyPlayers.length, selectedTournament, joined, champion]);

  const setMatchResult = (matchId: string, winner: string) => {
    setMatches((prev) =>
      prev.map((match) =>
        match.id === matchId
          ? {
              ...match,
              winner,
              status: "finished",
            }
          : match,
      ),
    );

    addNotification(`Match finished: ${winner} advanced.`);
  };

  useEffect(() => {
    if (!joined || champion) return;
    const allFinished = activeRoundMatches.length > 0 && activeRoundMatches.every((match) => match.status === "finished");

    if (!allFinished) return;

    const winners = activeRoundMatches.map((match) => match.winner).filter(Boolean) as string[];

    if (winners.length === 1 && currentRound === 3) {
      setChampion(winners[0]);
      addNotification(`🏆 ${winners[0]} became Tournament Champion.`);
      return;
    }

    if (winners.length < 2) return;

    setTransitionCountdown(6);
    addNotification("Next Round Starting...");
  }, [activeRoundMatches, currentRound, joined, champion]);

  useEffect(() => {
    if (transitionCountdown === null) return;

    if (transitionCountdown <= 0) {
      const winners = activeRoundMatches.map((match) => match.winner).filter(Boolean) as string[];
      const nextRound = currentRound + 1;
      const nextMatches: Match[] = [];

      for (let index = 0; index < winners.length; index += 2) {
        const left = winners[index];
        const right = winners[index + 1];
        if (!left || !right) continue;

        nextMatches.push({
          id: `${nextRound}-${index}`,
          round: nextRound,
          roundName: roundLabels[nextRound],
          player1: left,
          player2: right,
          status: left === "You" ? "ready" : "pending",
          subject: nextRound === 3 ? "Mixed Finals" : "STEM Mix",
          questionCount: 15,
          mode: nextRound === 3 ? "speed" : "standard",
        });
      }

      setMatches((prev) => [...prev, ...nextMatches]);
      setCurrentRound(nextRound);
      setTransitionCountdown(null);
      addNotification(`${roundLabels[nextRound]} launched.`);
      return;
    }

    const interval = window.setInterval(() => setTransitionCountdown((prev) => (prev === null ? null : prev - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [transitionCountdown, activeRoundMatches, currentRound]);

  const bracketRounds = useMemo(() => {
    const byRound = new Map<number, Match[]>();
    matches.forEach((match) => {
      const current = byRound.get(match.round) ?? [];
      byRound.set(match.round, [...current, match]);
    });

    return [1, 2, 3].map((round) => ({ round, label: roundLabels[round], matches: byRound.get(round) ?? [] }));
  }, [matches]);

  const statusBadge = (status: MatchStatus) => {
    if (status === "live") return <Badge className="bg-red-500 text-white">Live</Badge>;
    if (status === "ready") return <Badge className="bg-emerald-500 text-white">Ready</Badge>;
    if (status === "finished") return <Badge className="bg-violet-500 text-white">Finished</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <div className="space-y-6 text-foreground">
      <Card className="bg-gradient-to-br from-slate-950 via-slate-900 to-black border-primary/30 shadow-lg shadow-primary/15">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-3 text-primary">
            <Trophy className="w-8 h-8" /> Master Minds Tournament Arena
          </CardTitle>
          <CardDescription>
            Esports-style knockout competitions with live battles, round transitions, rewards, and champion titles.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Lobby", value: joined ? `${lobbyPlayers.length}/${selectedTournament?.maxPlayers ?? 8}` : "Not Joined" },
            { icon: Swords, label: "Current Round", value: joined ? roundLabels[currentRound] ?? "TBD" : "-" },
            { icon: Zap, label: "Live Match", value: activeMatch ? `${activeMatch.player1} vs ${activeMatch.player2}` : "No active room" },
            { icon: Crown, label: "Champion", value: champion ?? "To be decided" },
          ].map((tile) => (
            <Card key={tile.label} className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <tile.icon className="w-5 h-5 text-cyan-400 mb-2" />
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="font-semibold">{tile.value}</p>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="join" className="space-y-5">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="join">Tournaments</TabsTrigger>
          <TabsTrigger value="lobby">Lobby</TabsTrigger>
          <TabsTrigger value="matches">Live Matches</TabsTrigger>
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
        </TabsList>

        <TabsContent value="join" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {tournamentCatalog.map((tournament) => (
              <motion.div key={tournament.id} initial={{ opacity: 0.7 }} animate={{ opacity: 1 }}>
                <Card className="border-primary/30 hover:border-primary transition-colors h-full bg-card/90">
                  <CardHeader>
                    <CardTitle className="text-lg">{tournament.name}</CardTitle>
                    <CardDescription className="capitalize">{tournament.mode} tournament</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Entry</span>
                      <span className="font-medium">{tournament.entry === "free" ? "Free" : `${tournament.entryCost} coins`}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Players</span>
                      <span className="font-medium">{tournament.currentPlayers}/{tournament.maxPlayers}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Start in</span>
                      <span className="font-medium">{formatClock(tournament.countdownSeconds)}</span>
                    </div>
                    <Button className="w-full" onClick={() => joinTournament(tournament)}>
                      <Gamepad2 className="w-4 h-4 mr-2" /> Join Tournament
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lobby" className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Tournament Lobby</CardTitle>
              <CardDescription>Waiting room before automatic tournament start.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total players</p>
                <p className="font-semibold">{joined ? `${lobbyPlayers.length}/${selectedTournament?.maxPlayers ?? 8}` : "0/8"}</p>
              </div>
              <Progress value={joined && selectedTournament ? (lobbyPlayers.length / selectedTournament.maxPlayers) * 100 : 0} />
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Countdown</span>
                <strong>{formatClock(lobbyCountdown)}</strong>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {lobbyPlayers.map((player) => (
                  <div key={player} className="rounded-lg border border-border px-3 py-2 text-sm flex justify-between">
                    <span>{player}</span>
                    <UserCheck className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications.length === 0 && <p className="text-sm text-muted-foreground">No tournament alerts yet.</p>}
              {notifications.map((note) => (
                <div key={note.id} className="text-sm rounded-lg bg-muted/30 p-2 border border-border">
                  {note.message}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          {transitionCountdown !== null && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="pt-6 flex items-center justify-between">
                <p className="font-semibold">Next Round Starting…</p>
                <Badge className="bg-amber-500 text-black">{transitionCountdown}s</Badge>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {activeRoundMatches.map((match) => (
              <Card key={match.id} className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{match.roundName} · {match.player1} vs {match.player2}</span>
                    {statusBadge(match.status)}
                  </CardTitle>
                  <CardDescription>
                    Subject: {match.subject} · Questions: {match.questionCount} · Mode: {match.mode}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      disabled={match.status === "finished"}
                      onClick={() => setMatchResult(match.id, match.player1)}
                    >
                      {match.player1} wins
                    </Button>
                    <Button
                      variant="outline"
                      disabled={match.status === "finished"}
                      onClick={() => setMatchResult(match.id, match.player2)}
                    >
                      {match.player2} wins
                    </Button>
                  </div>
                  {match.winner && <p className="text-sm text-emerald-500">Winner: {match.winner} advanced to next round.</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bracket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" /> Knockout Bracket</CardTitle>
              <CardDescription>Real-time progression from Quarterfinal to Champion.</CardDescription>
            </CardHeader>
            <CardContent className="grid lg:grid-cols-3 gap-4">
              {bracketRounds.map((column) => (
                <div key={column.round}>
                  <h3 className="font-semibold mb-3">{column.label}</h3>
                  <div className="space-y-2">
                    {column.matches.length === 0 && (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Waiting for previous round.</div>
                    )}
                    {column.matches.map((match) => (
                      <div key={match.id} className="rounded-lg border p-3 bg-muted/20">
                        <p className="text-sm">{match.player1} vs {match.player2}</p>
                        <div className="flex justify-between items-center mt-2">
                          {statusBadge(match.status)}
                          {match.winner ? <span className="text-xs text-emerald-500 font-medium">{match.winner} ✓</span> : <span className="text-xs text-muted-foreground">In progress</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {champion && (
            <Card className="border-yellow-400/60 bg-yellow-500/10">
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-500" /> {champion} is Tournament Champion
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border p-3 bg-black/20">🏅 Winner Reward: 1,500 Coins</div>
                  <div className="rounded-lg border p-3 bg-black/20">🎯 XP Bonus: +800 XP</div>
                  <div className="rounded-lg border p-3 bg-black/20">🏆 Badge: Tournament Champion</div>
                  <div className="rounded-lg border p-3 bg-black/20">🥈 Runner-up: 600 Coins + 300 XP</div>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Title unlocked: "Tournament Champion"
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Medal className="w-5 h-5" /> Competitive Ranking Loop</CardTitle>
          <CardDescription>Every tournament updates rankings, streaks, and reward economy.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border p-3">Live match status with ready-state checks and synchronized question timers.</div>
          <div className="rounded-lg border p-3">Automatic winner advancement and elimination with bracket updates.</div>
          <div className="rounded-lg border p-3">Notifications for opponent found, next round, and match readiness.</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentHub;
