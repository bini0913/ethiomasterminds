import React, { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Flame,
  Hourglass,
  PlayCircle,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

type TournamentStatus = "waiting" | "starting" | "active" | "finished" | "upcoming" | "completed" | "next_round" | "cancelled";
type MatchStatus = "waiting" | "playing" | "finished" | "pending" | "ready" | "live";
type PlayerStatus = "active" | "eliminated" | "champion" | "runner_up" | "withdrawn";

type HubTournament = {
  id: string;
  name: string;
  status: TournamentStatus;
  mode: string;
  subject: string;
  questionsPerMatch: number;
  startTime: string | null;
  registrationDeadline: string | null;
  maxPlayers: number;
  currentPlayers: number;
  entryFee: number;
  prize: number;
  winnerId: string | null;
  winnerName: string | null;
};

type TournamentPlayer = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: PlayerStatus;
};

type HubMatch = {
  id: string;
  round: number;
  bracketPosition: number;
  status: MatchStatus;
  player1Id: string | null;
  player2Id: string | null;
  player1: string;
  player2: string;
  winnerId: string | null;
  winnerName: string | null;
  score1: number;
  score2: number;
  roomId: string | null;
  meta: Record<string, unknown>;
};

type TournamentEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  data: Record<string, unknown>;
};

const roundLabel: Record<number, string> = {
  1: "Round 1",
  2: "Quarterfinals",
  3: "Semifinals",
  4: "Final",
  5: "Grand Final",
};

const statusPill = (status: TournamentStatus) => {
  if (status === "active") return <Badge className="bg-red-500/90 hover:bg-red-500 text-white">🔴 Live</Badge>;
  if (status === "finished" || status === "completed") return <Badge className="bg-emerald-500/90 hover:bg-emerald-500 text-white">🟢 Finished</Badge>;
  if (status === "starting" || status === "next_round") return <Badge className="bg-amber-500/90 hover:bg-amber-500 text-black">🟡 Waiting</Badge>;
  return <Badge className="bg-slate-400/30 text-slate-100 border border-slate-500/60">🟡 Waiting</Badge>;
};

const matchStatusPill = (status: MatchStatus) => {
  if (status === "playing" || status === "live") return <Badge className="bg-red-500 text-white">Live</Badge>;
  if (status === "finished") return <Badge className="bg-emerald-500 text-white">Finished</Badge>;
  return <Badge variant="secondary">Waiting</Badge>;
};

const TournamentHub: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [tournaments, setTournaments] = useState<HubTournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [matches, setMatches] = useState<HubMatch[]>([]);
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [newPlayerUsername, setNewPlayerUsername] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    mode: "speed",
    subject: "Math",
    maxPlayers: 8,
    questionsPerMatch: 10,
    startTime: "",
    registrationDeadline: "",
    entryFee: 0,
  });
  const [matchWinnerById, setMatchWinnerById] = useState<Record<string, string>>({});
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [navigatedMatchRoomId, setNavigatedMatchRoomId] = useState<string | null>(null);
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "extreme_admin";

  const selectedTournament = useMemo(
    () => tournaments.find((item) => item.id === selectedTournamentId) || null,
    [selectedTournamentId, tournaments],
  );

  const activeTournaments = tournaments.filter((t) => ["active", "starting", "next_round"].includes(t.status));
  const upcomingTournaments = tournaments.filter((t) => ["waiting", "upcoming"].includes(t.status));
  const completedTournaments = tournaments.filter((t) => ["finished", "completed"].includes(t.status));

  const bracketRounds = useMemo(() => {
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    return rounds.map((round) => ({
      round,
      label: roundLabel[round] || `Round ${round}`,
      matches: matches.filter((m) => m.round === round),
    }));
  }, [matches]);

  const loadTournaments = async () => {
    const [{ data: tournamentRows, error: tError }, { data: playerRows }, { data: profileRows }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("id,name,status,mode,subject,settings,question_count,questions_count,start_time,starts_at,max_participants,current_players,entry_fee,entry_fee_coins,prize_coins,winner_id")
        .order("created_at", { ascending: false })
        .limit(30),
      (supabase as any).from("tournament_players").select("tournament_id,user_id"),
      supabase.from("profiles").select("id,name"),
    ]);

    if (tError) {
      toast.error("Unable to load tournaments");
      return;
    }

    const participantCounts = (playerRows || []).reduce<Record<string, number>>((acc, row: any) => {
      acc[row.tournament_id] = (acc[row.tournament_id] || 0) + 1;
      return acc;
    }, {});

    const typedProfiles = (profileRows || []) as Array<{ id: string; name: string | null }>;
     const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile.name || "Unknown"]));

    const mapped = (tournamentRows || []).map((row: any): HubTournament => ({
      id: row.id,
      name: row.name,
      status: row.status,
      mode: row.mode ?? "speed",
      subject: row.subject ?? "General",
      questionsPerMatch: row.settings?.questions_per_match ?? row.question_count ?? row.questions_count ?? 10,
      startTime: row.start_time ?? row.starts_at ?? null,
      registrationDeadline: row.settings?.registration_deadline ?? null,
      maxPlayers: row.max_participants || 16,
      currentPlayers: row.current_players ?? participantCounts[row.id] ?? 0,
      entryFee: row.entry_fee ?? row.entry_fee_coins ?? 0,
      prize: row.prize_coins ?? 0,
      winnerId: row.winner_id,
      winnerName: row.winner_id ? String(profileMap.get(row.winner_id) ?? "Unknown") : null,
    }));

    setTournaments(mapped);

    if (!selectedTournamentId && mapped.length > 0) {
      setSelectedTournamentId(mapped[0].id);
    }
  };

  const loadTournamentDetails = async (tournamentId: string) => {
    const [{ data: playerRows }, { data: matchRows }, { data: profileRows }, { data: eventRows }] = await Promise.all([
      supabase
        .from("tournament_players" as any)
        .select("id,user_id,status")
        .eq("tournament_id", tournamentId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("tournament_matches" as any)
        .select("id,round,bracket_position,status,player1_id,player2_id,winner_id,score_player1,score_player2,room_id,meta")
        .eq("tournament_id", tournamentId)
        .order("round", { ascending: true })
        .order("bracket_position", { ascending: true }),
      supabase.from("profiles").select("id,name,avatar"),
      supabase
        .from("tournament_events" as any)
        .select("id,event_type,data,payload,created_at")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const profileMap = new Map(((profileRows as any[]) || []).map((profile: any) => [profile.id, profile]));

    const mappedPlayers = (playerRows || []).map((player: any): TournamentPlayer => ({
      id: player.id,
      userId: player.user_id,
      name: profileMap.get(player.user_id)?.name || "Unknown Player",
      avatarUrl: profileMap.get(player.user_id)?.avatar || null,
      status: player.status,
    }));

    const mappedMatches = (matchRows || []).map((match: any): HubMatch => ({
      id: match.id,
      round: match.round,
      bracketPosition: match.bracket_position,
      status: match.status,
      player1Id: match.player1_id,
      player2Id: match.player2_id,
      player1: match.player1_id ? profileMap.get(match.player1_id)?.name || "Unknown Player" : "Open Slot",
      player2: match.player2_id ? profileMap.get(match.player2_id)?.name || "Unknown Player" : "Open Slot",
      winnerId: match.winner_id,
      winnerName: match.winner_id ? profileMap.get(match.winner_id)?.name || "Unknown Player" : null,
      score1: match.score_player1 ?? 0,
      score2: match.score_player2 ?? 0,
      roomId: match.room_id ?? null,
      meta: (match.meta || {}) as Record<string, unknown>,
    }));

    setPlayers(mappedPlayers);
    setMatches(mappedMatches);
    setEvents(
      (eventRows || []).map((event: any): TournamentEvent => ({
        id: event.id,
        eventType: event.event_type,
        createdAt: event.created_at,
        data: (event.data || event.payload || {}) as Record<string, unknown>,
      })),
    );
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) return;
    loadTournamentDetails(selectedTournamentId);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (!user?.id) return;

    const liveMatchForUser = matches.find(
      (match) =>
        ["playing", "live"].includes(match.status) &&
        (match.player1Id === user.id || match.player2Id === user.id),
    );
    if (!liveMatchForUser) return;

    const roomId =
      liveMatchForUser.roomId ||
      (typeof liveMatchForUser.meta?.room_id === "string" ? (liveMatchForUser.meta.room_id as string) : null);

    if (!roomId || navigatedMatchRoomId === roomId) return;

    setNavigatedMatchRoomId(roomId);
    toast.success("Your tournament match is live. Launching battle room now!");
    navigate(`/multiplayer?room=${roomId}`);
  }, [matches, navigatedMatchRoomId, navigate, user?.id]);

  useEffect(() => {
    const channel = supabase
      .channel("tournament-hub-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => {
        loadTournaments();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_players" }, () => {
        loadTournaments();
        if (selectedTournamentId) loadTournamentDetails(selectedTournamentId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches" }, () => {
        if (selectedTournamentId) loadTournamentDetails(selectedTournamentId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournamentId]);

  const joinTournament = async (tournamentId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to join tournaments");
      return;
    }

    const { error } = await supabase.rpc("join_tournament" as any, { p_tournament_id: tournamentId });
    if (error) {
      toast.error(error.message || "Unable to join tournament");
      return;
    }

    toast.success("Joined tournament successfully");
    await loadTournaments();
    await loadTournamentDetails(tournamentId);
    setSelectedTournamentId(tournamentId);
  };

  const runManagerAction = async (
    action: () => any,
    successMessage: string,
  ) => {
    setIsSubmittingAction(true);
    try {
      const { error } = await action();
      if (error) {
        toast.error(error.message || "Manager action failed");
        return false;
      }

      toast.success(successMessage);
      await loadTournaments();
      if (selectedTournamentId) {
        await loadTournamentDetails(selectedTournamentId);
      }

      return true;
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const addPlayerAsManager = async () => {
    if (!selectedTournamentId || !newPlayerUsername.trim()) return;

    await runManagerAction(
      () =>
        supabase.rpc("manager_add_tournament_player" as any, {
          p_tournament_id: selectedTournamentId,
          p_username: newPlayerUsername.trim(),
        }),
      `Player ${newPlayerUsername.trim()} added`,
    );

    setNewPlayerUsername("");
  };

  const createTournamentAsManager = async () => {
    if (!createForm.name.trim()) {
      toast.error("Tournament name is required");
      return;
    }

    if (!createForm.startTime || !createForm.registrationDeadline) {
      toast.error("Set both start time and registration deadline");
      return;
    }

    await runManagerAction(
      () =>
        supabase.rpc("create_tournament_workflow" as any, {
          p_name: createForm.name.trim(),
          p_mode: createForm.mode,
          p_subject: createForm.subject.trim(),
          p_max_players: createForm.maxPlayers,
          p_questions_per_match: createForm.questionsPerMatch,
          p_start_time: new Date(createForm.startTime).toISOString(),
          p_registration_deadline: new Date(createForm.registrationDeadline).toISOString(),
          p_entry_fee: createForm.entryFee,
        }),
      `${createForm.name.trim()} created`,
    );

    setCreateForm((prev) => ({ ...prev, name: "", entryFee: 0 }));
  };

  const removePlayerAsManager = async (playerUserId: string, playerName: string) => {
    if (!selectedTournamentId) return;

    await runManagerAction(
      () =>
        supabase.rpc("manager_remove_tournament_player" as any, {
          p_tournament_id: selectedTournamentId,
          p_user_id: playerUserId,
        }),
      `${playerName} removed from tournament`,
    );
  };

  const setTournamentStatus = async (status: "waiting" | "active" | "finished" | "cancelled") => {
    if (!selectedTournamentId) return;

    await runManagerAction(
      () =>
        supabase.rpc("manager_set_tournament_status" as any, {
          p_tournament_id: selectedTournamentId,
          p_status: status,
        }),
      `Tournament set to ${status}`,
    );
  };

  const skipRound = async () => {
    if (!selectedTournamentId) return;

    await runManagerAction(
      () =>
        supabase.rpc("manager_skip_to_next_round" as any, {
          p_tournament_id: selectedTournamentId,
        }),
      "Round skipped successfully",
    );
  };

  const updateMatchStatus = async (matchId: string, status: "waiting" | "playing" | "finished") => {
    await runManagerAction(
      () =>
        supabase.rpc("manager_update_match_status" as any, {
          p_match_id: matchId,
          p_status: status,
        }),
      `Match moved to ${status}`,
    );
  };

  const setMatchWinner = async (match: HubMatch) => {
    const winnerId = matchWinnerById[match.id];
    if (!winnerId) {
      toast.error("Please choose a winner from this match");
      return;
    }

    await runManagerAction(
      () =>
        supabase.rpc("manager_set_match_winner" as any, {
          p_match_id: match.id,
          p_winner_id: winnerId,
          p_player1_score: match.score1,
          p_player2_score: match.score2,
        }),
      "Winner set successfully",
    );
  };

  const championLabel =
    selectedTournament?.status === "finished" && selectedTournament.winnerId
      ? selectedTournament.winnerName || "Champion locked"
      : "In Progress";

  const liveMatch = matches.find((m) => m.status === "playing" || m.status === "live") || null;
  const isRegistrationOpen = (tournament: HubTournament) => {
    if (!tournament.registrationDeadline) return true;
    return new Date(tournament.registrationDeadline).getTime() > Date.now();
  };

  return (
    <div className="space-y-6 text-foreground">
      <Card className="overflow-hidden border-cyan-400/20 bg-[linear-gradient(160deg,#020617_0%,#0f172a_45%,#111827_100%)] shadow-[0_0_45px_rgba(34,211,238,0.18)]">
        <CardHeader className="border-b border-cyan-500/20">
          <CardTitle className="flex items-center gap-3 text-2xl text-cyan-100">
            <Trophy className="h-7 w-7 text-cyan-300" />
            Master Minds Tournament Hub
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-cyan-200/70">Selected Tournament</p>
            <p className="mt-2 text-lg font-semibold text-cyan-100">{selectedTournament?.name || "No tournament selected"}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-cyan-200/70">Players</p>
            <p className="mt-2 text-lg font-semibold text-cyan-100">
              {selectedTournament ? `${selectedTournament.currentPlayers}/${selectedTournament.maxPlayers}` : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-cyan-200/70">Live Matches</p>
            <p className="mt-2 text-lg font-semibold text-cyan-100">{matches.filter((m) => ["playing", "live"].includes(m.status)).length}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-cyan-200/70">Champion</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-cyan-100">
              <Crown className="h-5 w-5 text-amber-300" /> {championLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Flame className="h-5 w-5 text-red-400" /> 🔥 Active Tournaments</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeTournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="group cursor-pointer border-red-400/30 bg-slate-950/80 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-red-300/70 hover:shadow-[0_0_28px_rgba(248,113,113,0.35)]"
              onClick={() => setSelectedTournamentId(tournament.id)}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base text-slate-100">{tournament.name}</CardTitle>
                  {statusPill(tournament.status)}
                </div>
                <div className="space-y-1 text-sm text-slate-300">
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-400" /> {tournament.currentPlayers}/{tournament.maxPlayers} players</p>
                  <p>Prize Pool 💰 {tournament.prize.toLocaleString()} coins</p>
                  <p>{tournament.subject} • {tournament.mode} • {tournament.questionsPerMatch} Qs</p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-red-500 text-white hover:bg-red-400" onClick={() => joinTournament(tournament.id)} disabled={!isRegistrationOpen(tournament)}>
                  {isRegistrationOpen(tournament) ? "Register" : "Registration Closed"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {activeTournaments.length === 0 && <p className="text-sm text-muted-foreground">No active tournaments right now.</p>}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Hourglass className="h-5 w-5 text-amber-400" /> ⏳ Upcoming</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {upcomingTournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="group cursor-pointer border-amber-400/20 bg-slate-950/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(251,191,36,0.28)]"
              onClick={() => setSelectedTournamentId(tournament.id)}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-100">{tournament.name}</p>
                  {statusPill(tournament.status)}
                </div>
                <p className="text-sm text-slate-300">Players: {tournament.currentPlayers}/{tournament.maxPlayers}</p>
                <p className="text-sm text-slate-300">Entry: {tournament.entryFee > 0 ? `${tournament.entryFee} coins` : "Free"}</p>
                <p className="text-sm text-slate-300">Starts: {tournament.startTime ? new Date(tournament.startTime).toLocaleString() : "TBD"}</p>
                <Button variant="outline" className="w-full border-amber-400/40 text-amber-100 hover:bg-amber-500/10" onClick={() => joinTournament(tournament.id)} disabled={!isRegistrationOpen(tournament)}>
                  {isRegistrationOpen(tournament) ? "Register" : "Registration Closed"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {upcomingTournaments.length === 0 && <p className="text-sm text-muted-foreground">No upcoming tournaments queued.</p>}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5 text-emerald-400" /> 🏆 Completed</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {completedTournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="cursor-pointer border-emerald-400/20 bg-slate-950/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]"
              onClick={() => setSelectedTournamentId(tournament.id)}
            >
              <CardContent className="space-y-2 p-5">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-slate-100">{tournament.name}</p>
                  {statusPill(tournament.status)}
                </div>
                <p className="text-sm text-slate-300">Champion: {tournament.winnerName || "Winner recorded"}</p>
                <p className="text-sm text-slate-300">Prize: {tournament.prize.toLocaleString()} coins</p>
              </CardContent>
            </Card>
          ))}
          {completedTournaments.length === 0 && <p className="text-sm text-muted-foreground">No completed tournaments yet.</p>}
        </div>
      </section>

      {selectedTournament && (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Card className="border-cyan-500/30 bg-slate-950/90 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-cyan-100">
                <span>🏟️ Tournament Details</span>
                {statusPill(selectedTournament.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Player Count</p><p className="font-semibold">{selectedTournament.currentPlayers}/{selectedTournament.maxPlayers}</p></div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Mode</p><p className="font-semibold capitalize">{selectedTournament.mode}</p></div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Entry Fee</p><p className="font-semibold">{selectedTournament.entryFee > 0 ? `${selectedTournament.entryFee} coins` : "Free"}</p></div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Prize</p><p className="font-semibold">{selectedTournament.prize.toLocaleString()} coins</p></div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Champion</p><p className="font-semibold">{championLabel}</p></div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Start Time</p><p className="font-semibold">{selectedTournament.startTime ? new Date(selectedTournament.startTime).toLocaleString() : "TBD"}</p></div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"><p className="text-xs text-slate-400">Registration Deadline</p><p className="font-semibold">{selectedTournament.registrationDeadline ? new Date(selectedTournament.registrationDeadline).toLocaleString() : "Open until start"}</p></div>
              </div>

              <Separator className="bg-slate-700" />

              <div className="space-y-3">
                <h3 className="font-semibold">👥 Players</h3>
                <ScrollArea className="h-64 pr-3">
                  <div className="space-y-2">
                    {players.map((player) => (
                      <div key={player.id} className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-900/60 p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-semibold text-cyan-200">
                            {player.name.slice(0, 1).toUpperCase()}
                          </div>
                          <p className="text-sm font-medium">{player.name}</p>
                        </div>
                        <Badge variant={player.status === "eliminated" ? "secondary" : "default"} className="capitalize">
                          {player.status === "eliminated" ? "Eliminated" : "Active"}
                        </Badge>
                      </div>
                    ))}
                    {players.length === 0 && <p className="text-sm text-muted-foreground">No players registered yet.</p>}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <Card className="border-fuchsia-500/30 bg-slate-950/90 shadow-[0_0_34px_rgba(217,70,239,0.2)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-fuchsia-100"><Target className="h-5 w-5" /> 🌳 Bracket</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="flex min-w-max gap-4">
                {bracketRounds.map((column, index) => (
                  <div key={column.round} className="w-[240px] space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{column.label}</p>
                      {index === bracketRounds.length - 1 && <Badge className="bg-fuchsia-500/70">Current</Badge>}
                    </div>
                    {column.matches.map((match) => (
                      <div key={match.id} className="relative rounded-xl border border-fuchsia-500/30 bg-slate-900/80 p-3 transition hover:border-fuchsia-300/70 hover:shadow-[0_0_20px_rgba(217,70,239,0.3)]">
                        <div className="absolute -right-3 top-1/2 hidden h-px w-3 bg-fuchsia-500/60 lg:block" />
                        <p className="text-xs text-slate-400">Match {match.bracketPosition}</p>
                        <p className={`text-sm ${match.winnerId === match.player1Id ? "text-emerald-300 font-semibold" : "text-slate-100"}`}>{match.player1}</p>
                        <p className={`text-sm ${match.winnerId === match.player2Id ? "text-emerald-300 font-semibold" : "text-slate-100"}`}>{match.player2}</p>
                        <div className="mt-2 flex items-center justify-between">
                          {matchStatusPill(match.status)}
                          <span className="text-xs text-slate-300">{match.score1} - {match.score2}</span>
                        </div>
                      </div>
                    ))}
                    {column.matches.length === 0 && <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-muted-foreground">Waiting for this round.</p>}
                  </div>
                ))}
                {bracketRounds.length === 0 && <p className="text-sm text-muted-foreground">Bracket appears once matches are generated.</p>}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {isManager && selectedTournament && (
        <Card className="border-amber-500/25 bg-slate-950/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-100"><Crown className="h-5 w-5 text-amber-300" /> Manager Control Center</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-100">Create Tournament</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Tournament name" value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} />
                <Input placeholder="Subject (Math, Science...)" value={createForm.subject} onChange={(event) => setCreateForm((prev) => ({ ...prev, subject: event.target.value }))} />
                <select className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100" value={createForm.mode} onChange={(event) => setCreateForm((prev) => ({ ...prev, mode: event.target.value }))}>
                  <option value="speed">Speed</option>
                  <option value="accuracy">Accuracy</option>
                </select>
                <select className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100" value={createForm.maxPlayers} onChange={(event) => setCreateForm((prev) => ({ ...prev, maxPlayers: Number(event.target.value) }))}>
                  <option value={8}>8 Players</option>
                  <option value={16}>16 Players</option>
                  <option value={32}>32 Players</option>
                </select>
                <Input type="number" min={5} max={50} placeholder="Questions per match" value={createForm.questionsPerMatch} onChange={(event) => setCreateForm((prev) => ({ ...prev, questionsPerMatch: Number(event.target.value) || 10 }))} />
                <Input type="number" min={0} placeholder="Entry fee (coins)" value={createForm.entryFee} onChange={(event) => setCreateForm((prev) => ({ ...prev, entryFee: Number(event.target.value) || 0 }))} />
                <Input type="datetime-local" value={createForm.startTime} onChange={(event) => setCreateForm((prev) => ({ ...prev, startTime: event.target.value }))} />
                <Input type="datetime-local" value={createForm.registrationDeadline} onChange={(event) => setCreateForm((prev) => ({ ...prev, registrationDeadline: event.target.value }))} />
              </div>
              <Button onClick={createTournamentAsManager} disabled={isSubmittingAction} className="bg-amber-500 text-black hover:bg-amber-400">
                Create Tournament
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Add participant by username"
                value={newPlayerUsername}
                onChange={(event) => setNewPlayerUsername(event.target.value)}
              />
              <Button onClick={addPlayerAsManager} disabled={isSubmittingAction || !newPlayerUsername.trim()} className="bg-amber-500 text-black hover:bg-amber-400">
                Add Player
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Button variant="secondary" onClick={() => setTournamentStatus("active")} disabled={isSubmittingAction}>Start/Resume</Button>
              <Button variant="secondary" onClick={() => setTournamentStatus("waiting")} disabled={isSubmittingAction}>Pause</Button>
              <Button variant="secondary" onClick={skipRound} disabled={isSubmittingAction}>Skip Round</Button>
              <Button variant="destructive" onClick={() => setTournamentStatus("cancelled")} disabled={isSubmittingAction}>Cancel</Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-200">Player management</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                    <p className="text-xs text-slate-200">{player.name}</p>
                    <Button size="sm" variant="outline" onClick={() => removePlayerAsManager(player.userId, player.name)} disabled={isSubmittingAction}>Remove</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-200">Match overrides</p>
              <div className="space-y-2">
                {matches.map((match) => (
                  <div key={match.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 space-y-2">
                    <p className="text-xs text-slate-300">Round {match.round} • Match {match.bracketPosition}</p>
                    <div className="grid gap-2 md:grid-cols-4">
                      <Button size="sm" variant="secondary" onClick={() => updateMatchStatus(match.id, "playing")} disabled={isSubmittingAction}>Force Start</Button>
                      <Button size="sm" variant="secondary" onClick={() => updateMatchStatus(match.id, "waiting")} disabled={isSubmittingAction}>Reset</Button>
                      <select
                        className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                        value={matchWinnerById[match.id] || ""}
                        onChange={(event) => setMatchWinnerById((prev) => ({ ...prev, [match.id]: event.target.value }))}
                      >
                        <option value="">Select winner</option>
                        {match.player1Id && <option value={match.player1Id}>{match.player1}</option>}
                        {match.player2Id && <option value={match.player2Id}>{match.player2}</option>}
                      </select>
                      <Button size="sm" onClick={() => setMatchWinner(match)} disabled={isSubmittingAction || !matchWinnerById[match.id]}>Set Winner</Button>
                    </div>
                  </div>
                ))}
                {matches.length === 0 && <p className="text-xs text-muted-foreground">No matches to manage yet.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-purple-500/30 bg-slate-950/90 shadow-[0_0_34px_rgba(168,85,247,0.22)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-100"><PlayCircle className="h-5 w-5" /> 🎮 Live Match Arena</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {liveMatch ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-100">{liveMatch.player1} vs {liveMatch.player2}</p>
                {matchStatusPill(liveMatch.status)}
              </div>
              <p className="text-sm text-slate-300">Timer ⏳ {String(Number(liveMatch.meta?.remaining_seconds || 90)).padStart(2, "0")}s</p>
              <p className="text-sm text-slate-300">Live Score: {liveMatch.score1} - {liveMatch.score2}</p>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                <p className="text-sm font-medium text-purple-100">Question</p>
                <p className="text-sm text-slate-200">{String(liveMatch.meta?.question || "Question stream will appear here during match play.")}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(Array.isArray(liveMatch.meta?.options) ? (liveMatch.meta.options as string[]) : []).map((option, index) => (
                    <div key={`${option}-${index}`} className="rounded border border-purple-500/30 bg-slate-900/80 px-2 py-1 text-xs text-slate-100">{option}</div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-300">Opponent answering…</p>
                <Progress value={Number(liveMatch.meta?.answer_progress ?? 45)} className="h-2" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No live match right now. Matches will appear here automatically once they start.</p>
          )}
          <div className="flex items-center gap-2 text-xs text-purple-200/80">
            <Sparkles className="h-4 w-4" /> Win flash, bracket highlights, and champion celebration are auto-triggered from live DB state updates.
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-400/25 bg-slate-950/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-100"><Zap className="h-5 w-5" /> 📊 Realtime Event Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs">
              <p className="font-semibold text-cyan-100">{event.eventType}</p>
              <p className="text-slate-300">{new Date(event.createdAt).toLocaleString()}</p>
              <p className="text-slate-400">{JSON.stringify(event.data)}</p>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-muted-foreground">No realtime events yet for this tournament.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentHub;
