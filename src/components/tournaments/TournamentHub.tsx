import React, { useEffect, useMemo, useState } from "react";
import { Bell, Crown, Target, Trophy, Users, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

type MatchStatus = "pending" | "ready" | "live" | "finished";

type DBTournament = {
  id: string;
  name: string;
  status: string;
  max_participants: number | null;
  entry_fee_coins: number | null;
  prize_coins: number | null;
};

type HubTournament = {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  currentPlayers: number;
  entryCost: number;
  prize: number;
};

type HubMatch = {
  id: string;
  round: number;
  bracketPosition: number;
  status: MatchStatus;
  player1: string;
  player2: string;
  winner?: string;
};

const roundName: Record<number, string> = {
  1: "Round of 16",
  2: "Quarterfinal",
  3: "Semifinal",
  4: "Final",
};

const TournamentHub: React.FC = () => {
  const { user } = useUser();
  const [tournaments, setTournaments] = useState<HubTournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [matches, setMatches] = useState<HubMatch[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string }>>([]);

  const addNotification = (message: string) => {
    setNotifications((prev) => [{ id: `${Date.now()}-${Math.random()}`, message }, ...prev].slice(0, 8));
    toast(message);
  };

  const selectedTournament = useMemo(
    () => tournaments.find((item) => item.id === selectedTournamentId) || null,
    [tournaments, selectedTournamentId],
  );

  const champion = useMemo(() => {
    const finalMatch = matches.find((match) => match.round === 4 && match.status === "finished");
    return finalMatch?.winner || null;
  }, [matches]);

  const bracketRounds = useMemo(() => {
    return [1, 2, 3, 4].map((round) => ({
      round,
      label: roundName[round],
      matches: matches.filter((item) => item.round === round),
    }));
  }, [matches]);

  const loadTournaments = async () => {
    const [{ data: tournData }, { data: participants }, { data: profiles }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("id,name,status,max_participants,entry_fee_coins,prize_coins")
        .order("start_time", { ascending: false })
        .limit(20),
      supabase.from("tournament_participants").select("tournament_id,user_id"),
      supabase.from("profiles").select("id,name"),
    ]);

    const participantCount = (participants || []).reduce<Record<string, number>>((acc, row) => {
      acc[row.tournament_id] = (acc[row.tournament_id] || 0) + 1;
      return acc;
    }, {});

    const mapped = ((tournData || []) as DBTournament[]).map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      maxPlayers: item.max_participants || 16,
      currentPlayers: participantCount[item.id] || 0,
      entryCost: item.entry_fee_coins || 0,
      prize: item.prize_coins || 1500,
    }));

    setTournaments(mapped);
    if (mapped.length && !selectedTournamentId) {
      setSelectedTournamentId(mapped[0].id);
    }

    if (selectedTournamentId) {
      await loadMatches(selectedTournamentId, profiles || []);
    }
  };

  const loadMatches = async (tournamentId: string, knownProfiles?: Array<{ id: string; name: string | null }>) => {
    const profiles = knownProfiles || (await supabase.from("profiles").select("id,name")).data || [];
    const profileMap = new Map(profiles.map((row) => [row.id, row.name || "Student"]));

    const { data } = await supabase
      .from("tournament_matches" as any)
      .select("id,round,bracket_position,status,player1_id,player2_id,winner_id")
      .eq("tournament_id", tournamentId)
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true });

    const mapped = (data || []).map((row: any) => ({
      id: row.id,
      round: row.round,
      bracketPosition: row.bracket_position,
      status: row.status,
      player1: row.player1_id ? profileMap.get(row.player1_id) || "TBD" : "TBD",
      player2: row.player2_id ? profileMap.get(row.player2_id) || "TBD" : "TBD",
      winner: row.winner_id ? profileMap.get(row.winner_id) || undefined : undefined,
    })) as HubMatch[];

    setMatches(mapped);
  };

  useEffect(() => {
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) return;
    loadMatches(selectedTournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId]);

  const joinTournament = async (tournamentId: string) => {
    if (!user?.id) return toast.error("Please sign in first");

    const { error } = await supabase.from("tournament_participants").insert({
      tournament_id: tournamentId,
      user_id: user.id,
    });

    if (error) {
      toast.error("Could not join tournament");
      return;
    }

    addNotification("Registered successfully. Wait for organizer to generate Round of 16 bracket.");
    await loadTournaments();
  };

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
            <Trophy className="w-8 h-8" /> Champions League Tournament Arena
          </CardTitle>
          <CardDescription>
            Real database-backed knockout ladder: Round of 16 → Quarterfinal → Semifinal → Final.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10"><CardContent className="pt-6"><Users className="w-5 h-5 text-cyan-400 mb-2" /><p className="text-xs text-muted-foreground">Players</p><p className="font-semibold">{selectedTournament ? `${selectedTournament.currentPlayers}/${selectedTournament.maxPlayers}` : "-"}</p></CardContent></Card>
          <Card className="bg-white/5 border-white/10"><CardContent className="pt-6"><Target className="w-5 h-5 text-cyan-400 mb-2" /><p className="text-xs text-muted-foreground">Bracket Stage</p><p className="font-semibold">{matches.length ? roundName[Math.max(...matches.map((m) => m.round))] : "Waiting"}</p></CardContent></Card>
          <Card className="bg-white/5 border-white/10"><CardContent className="pt-6"><Zap className="w-5 h-5 text-cyan-400 mb-2" /><p className="text-xs text-muted-foreground">Live Matches</p><p className="font-semibold">{matches.filter((m) => m.status === "live").length}</p></CardContent></Card>
          <Card className="bg-white/5 border-white/10"><CardContent className="pt-6"><Crown className="w-5 h-5 text-cyan-400 mb-2" /><p className="text-xs text-muted-foreground">Champion</p><p className="font-semibold">{champion || "TBD"}</p></CardContent></Card>
        </CardContent>
      </Card>

      <Tabs defaultValue="join" className="space-y-5">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="join">Tournaments</TabsTrigger>
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="join" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {tournaments.map((tournament) => (
              <Card key={tournament.id} className="border-primary/30 h-full bg-card/90">
                <CardHeader>
                  <CardTitle className="text-lg">{tournament.name}</CardTitle>
                  <CardDescription className="capitalize">Status: {tournament.status}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">Players: {tournament.currentPlayers}/{tournament.maxPlayers}</p>
                  <p className="text-sm">Entry: {tournament.entryCost > 0 ? `${tournament.entryCost} coins` : "Free"}</p>
                  <p className="text-sm">Prize: {tournament.prize} coins</p>
                  <Button className="w-full" onClick={() => joinTournament(tournament.id)}>Join Tournament</Button>
                  <Button variant="outline" className="w-full" onClick={() => setSelectedTournamentId(tournament.id)}>View Bracket</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bracket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Champions League Bracket</CardTitle>
              <CardDescription>Connected with organizer controls in Manager Portal.</CardDescription>
            </CardHeader>
            <CardContent className="grid lg:grid-cols-4 gap-4">
              {bracketRounds.map((column) => (
                <div key={column.round}>
                  <h3 className="font-semibold mb-3">{column.label}</h3>
                  <div className="space-y-2">
                    {column.matches.length === 0 && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Waiting for organizer.</div>}
                    {column.matches.map((match) => (
                      <div key={match.id} className="rounded-lg border p-3 bg-muted/20">
                        <p className="text-sm">#{match.bracketPosition} {match.player1} vs {match.player2}</p>
                        <div className="flex justify-between mt-2">{statusBadge(match.status)}{match.winner ? <span className="text-xs text-emerald-500">{match.winner} ✓</span> : <span className="text-xs text-muted-foreground">TBD</span>}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!notifications.length && <p className="text-sm text-muted-foreground">No alerts yet.</p>}
              {notifications.map((item) => <div key={item.id} className="text-sm rounded-lg bg-muted/30 p-2 border border-border">{item.message}</div>)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentHub;
