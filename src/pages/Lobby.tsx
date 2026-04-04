import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useRoom } from "@/context/RoomContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  MessageSquare, 
  Trophy, 
  Clock, 
  Plus,
  Send,
  Home,
  Gamepad,
  Zap,
  Crown,
  Star,
  Swords,
  RefreshCw
} from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import RoomCard, { Room } from "@/components/multiplayer/RoomCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import BackButton from "@/components/ui/BackButton";

interface OnlinePlayer {
  id: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  status: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  timestamp: Date;
}

interface Tournament {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  players: number;
  maxPlayers: number;
  prize: string;
  status: "upcoming" | "active" | "completed";
  format: "knockout" | "speed_knockout" | "multiplayer_draw";
  scoreMode: "accuracy" | "speed";
  createdBy: string;
  isFull: boolean;
}

interface NewTournamentForm {
  name: string;
  description: string;
  format: Tournament["format"];
  scoreMode: Tournament["scoreMode"];
  subject: string;
  maxPlayers: string;
  prizeCoins: string;
  prizeGems: string;
  durationHours: string;
}

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { rooms, createRoom: contextCreateRoom, joinRoom: contextJoinRoom, refreshRooms } = useRoom();
  
  const [chatMessage, setChatMessage] = useState("");
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newRoomData, setNewRoomData] = useState({
    name: "",
    maxPlayers: "2",
    subject: "Mathematics",
    difficulty: "Medium",
    gameMode: "1v1"
  });
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [newTournamentData, setNewTournamentData] = useState<NewTournamentForm>({
    name: "",
    description: "",
    format: "knockout",
    scoreMode: "accuracy",
    subject: "Mixed",
    maxPlayers: "16",
    prizeCoins: "1000",
    prizeGems: "20",
    durationHours: "2"
  });

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access the lobby");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    loadLobbyData();
    setupRealtimeSubscriptions();

    return () => {
      supabase.removeAllChannels();
    };
  }, [user, navigate]);

  const loadLobbyData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshRooms(),
        fetchOnlinePlayers(),
        fetchChatMessages(),
        fetchTournaments()
      ]);
    } catch (error) {
      console.error('Error loading lobby data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlinePlayers = async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select(`
        user_id,
        status,
        last_seen,
        profiles!inner(id, name, avatar, level, xp)
      `)
      .eq('status', 'online')
      .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(20);

    if (!error && data) {
      const players = data.map((p: any) => ({
        id: p.profiles.id,
        name: p.profiles.name,
        avatar: p.profiles.avatar || 'avatar-1',
        level: p.profiles.level || 1,
        xp: p.profiles.xp || 0,
        status: p.status
      }));
      setOnlinePlayers(players);
    }

    // Update own presence
    if (user) {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          last_seen: new Date().toISOString()
        }, { onConflict: 'user_id' });
    }
  };

  const fetchChatMessages = async () => {
    const { data, error } = await supabase
      .from('lobby_messages')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles!inner(name, avatar)
      `)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!error && data) {
      const messages = data.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        userName: m.profiles.name,
        userAvatar: m.profiles.avatar || 'avatar-1',
        message: m.content,
        timestamp: new Date(m.created_at)
      }));
      setChatMessages(messages);
    }
  };

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        tournament_participants(count)
      `)
      .in('status', ['upcoming', 'active'])
      .order('start_time', { ascending: true })
      .limit(10);

    if (!error && data) {
      const parseTournamentMode = (difficulty: string | null, description: string | null) => {
        const lowerDifficulty = (difficulty || "").toLowerCase();
        const format = lowerDifficulty.includes("draw")
          ? "multiplayer_draw"
          : lowerDifficulty.includes("speed")
            ? "speed_knockout"
            : "knockout";
        return {
          format: format as Tournament["format"],
          scoreMode: lowerDifficulty.includes("speed") ? "speed" as Tournament["scoreMode"] : "accuracy" as Tournament["scoreMode"],
          description: description || "Tournament challenge"
        };
      };

      const tourns = data.map((t: any) => {
        const playersCount = t.tournament_participants?.[0]?.count || 0;
        const maxPlayers = t.max_participants || 128;
        return {
          ...parseTournamentMode(t.difficulty, t.description),
          id: t.id,
          name: t.name,
          startTime: new Date(t.start_time),
          endTime: new Date(t.end_time),
          players: playersCount,
          maxPlayers,
          prize: t.prize_description || `${t.prize_coins || 0} coins + ${t.prize_gems || 0} gems`,
          status: t.status as Tournament["status"],
          createdBy: t.created_by,
          isFull: playersCount >= maxPlayers
        };
      });
      setTournaments(tourns);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to lobby chat
    const chatChannel = supabase
      .channel('lobby-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lobby_messages'
      }, async (payload) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar')
          .eq('id', payload.new.user_id)
          .single();
        
        if (profile) {
          const newMsg: ChatMessage = {
            id: payload.new.id,
            userId: payload.new.user_id,
            userName: profile.name,
            userAvatar: profile.avatar || 'avatar-1',
            message: payload.new.content,
            timestamp: new Date(payload.new.created_at)
          };
          setChatMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    // Subscribe to room changes
    const roomChannel = supabase
      .channel('lobby-rooms')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'multiplayer_rooms'
      }, () => {
        refreshRooms();
      })
      .subscribe();

    // Subscribe to presence changes
    const presenceChannel = supabase
      .channel('lobby-presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, () => {
        fetchOnlinePlayers();
      })
      .subscribe();

    const tournamentChannel = supabase
      .channel('lobby-tournaments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments'
      }, () => {
        fetchTournaments();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants'
      }, () => {
        fetchTournaments();
      })
      .subscribe();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user) return;
    
    const { error } = await supabase
      .from('lobby_messages')
      .insert({
        user_id: user.id,
        content: chatMessage.trim()
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setChatMessage("");
    }
  };

  const createRoom = async () => {
    if (!newRoomData.name.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const gameSettings = {
      subject: newRoomData.subject,
      difficulty: newRoomData.difficulty as 'Easy' | 'Medium' | 'Hard',
      questionCount: 10,
      timePerQuestion: 30
    };

    const room = await contextCreateRoom(
      newRoomData.name,
      gameSettings,
      parseInt(newRoomData.maxPlayers),
      undefined
    );

    if (room) {
      setCreateRoomOpen(false);
      setNewRoomData({ name: "", maxPlayers: "2", subject: "Mathematics", difficulty: "Medium", gameMode: "1v1" });
      navigate(`/multiplayer?room=${room.id}`);
    }
  };

  const handleJoinRoom = async (room: Room) => {
    const success = await contextJoinRoom(room.id, user?.name || 'Player');
    if (success) {
      navigate(`/multiplayer?room=${room.id}`);
    }
  };

  const joinTournament = async (tournamentId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Already registered for this tournament');
      } else {
        toast.error('Failed to register');
      }
    } else {
      toast.success('Registered for tournament!');
      fetchTournaments();
    }
  };

  const createTournament = async () => {
    if (!user || !newTournamentData.name.trim()) {
      toast.error("Tournament name is required");
      return;
    }

    const startTime = new Date();
    const endTime = new Date(Date.now() + Number(newTournamentData.durationHours || 2) * 60 * 60 * 1000);
    const difficultyTag =
      newTournamentData.format === "multiplayer_draw"
        ? "draw"
        : newTournamentData.scoreMode === "speed"
          ? "speed"
          : "accuracy";

    const { error } = await supabase
      .from("tournaments")
      .insert({
        name: newTournamentData.name.trim(),
        description: newTournamentData.description.trim() || `Mode: ${newTournamentData.format.replace("_", " ")}`,
        created_by: user.id,
        status: "upcoming",
        subject: newTournamentData.subject,
        difficulty: difficultyTag,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        max_participants: Math.max(2, Number(newTournamentData.maxPlayers || 16)),
        prize_coins: Number(newTournamentData.prizeCoins || 0),
        prize_gems: Number(newTournamentData.prizeGems || 0),
        prize_description: `${newTournamentData.prizeCoins} coins + ${newTournamentData.prizeGems} gems`
      });

    if (error) {
      toast.error("Failed to create tournament");
      return;
    }

    toast.success("Tournament created. Students can now register.");
    setCreateTournamentOpen(false);
    setNewTournamentData({
      name: "",
      description: "",
      format: "knockout",
      scoreMode: "accuracy",
      subject: "Mixed",
      maxPlayers: "16",
      prizeCoins: "1000",
      prizeGems: "20",
      durationHours: "2"
    });
    fetchTournaments();
  };

  const startTournament = async (tournament: Tournament) => {
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      toast.error("Only admins can start tournaments");
      return;
    }

    if (!tournament.isFull) {
      toast.error("Tournament must be full before starting");
      return;
    }

    const { error } = await supabase
      .from("tournaments")
      .update({ status: "active" })
      .eq("id", tournament.id);

    if (error) {
      toast.error("Failed to start tournament");
      return;
    }

    const startMessage = tournament.format === "multiplayer_draw"
      ? "Draw generated. Players can now battle in multiplayer rounds."
      : tournament.scoreMode === "speed"
        ? "Speed knockout started. Fastest correct answers win."
        : "Accuracy knockout started. Highest precision wins each round.";

    toast.success(`Tournament started: ${tournament.name}`, { description: startMessage });
    fetchTournaments();
  };

  const challengePlayer = async (playerId: string, playerName: string) => {
    // Create a private room and invite the player
    toast.success(`Challenge sent to ${playerName}!`);
    // TODO: Implement challenge system with notifications
  };

  const formatTimeRemaining = (startTime: Date) => {
    const diff = startTime.getTime() - Date.now();
    if (diff < 0) return "Starting now";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'in-game': return 'bg-blue-500';
      default: return 'bg-yellow-500';
    }
  };

  const canManageTournaments = user?.role === "admin" || user?.role === "manager";
  const formatLabel: Record<Tournament["format"], string> = {
    knockout: "Knockout",
    speed_knockout: "Speed Knockout",
    multiplayer_draw: "Multiplayer Draw"
  };

  // Convert context rooms to Room type
  const activeRooms: Room[] = rooms.map(r => ({
    id: r.id,
    name: r.name,
    players: r.players?.length || 0,
    maxPlayers: r.maxPlayers,
    status: r.status as 'waiting' | 'in-progress' | 'finished',
    subject: r.gameSettings?.subject || 'Mixed',
    difficulty: r.gameSettings?.difficulty || 'Medium',
    gameMode: '1v1',
    createdBy: r.host
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 shadow-xl">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <BackButton to="/" className="text-white hover:bg-white/20" />
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
              <Gamepad className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Game Lobby</h1>
              <p className="text-xs text-white/70">{onlinePlayers.length} players online</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadLobbyData}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Menu
            </Button>
          </div>
        </div>
      </header>

      {/* Quick Actions Bar */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border/50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto scrollbar-none">
          <Button onClick={() => setCreateRoomOpen(true)} className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 whitespace-nowrap">
            <Plus className="h-4 w-4" /> Create Room
          </Button>
          <Button variant="outline" className="gap-2 whitespace-nowrap" onClick={() => navigate("/multiplayer")}>
            <Zap className="h-4 w-4" /> Quick Match
          </Button>
          <Button variant="outline" className="gap-2 whitespace-nowrap">
            <Swords className="h-4 w-4" /> Ranked
          </Button>
          <Button variant="outline" className="gap-2 whitespace-nowrap">
            <Crown className="h-4 w-4" /> Tournament
          </Button>
          {canManageTournaments && (
            <Button
              variant="outline"
              className="gap-2 whitespace-nowrap"
              onClick={() => setCreateTournamentOpen(true)}
            >
              <Trophy className="h-4 w-4" /> Create Tournament
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-4 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left - Online Players */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-xl py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                Online Players ({onlinePlayers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-3 space-y-2">
                  {onlinePlayers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No players online</p>
                  ) : (
                    onlinePlayers.map((player) => (
                      <motion.div 
                        key={player.id}
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="relative">
                          <AvatarRenderer avatar={player.avatar} size="md" />
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${getStatusColor(player.status)} border-2 border-card`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{player.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            Lv.{player.level} • {player.xp} XP
                          </div>
                        </div>
                        {player.id !== user?.id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => challengePlayer(player.id, player.name)}
                          >
                            <Swords className="h-3 w-3 mr-1" />
                            Fight
                          </Button>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* Middle - Rooms & Tournaments */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-xl py-3">
              <CardTitle className="text-base">Play & Compete</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <Tabs defaultValue="rooms">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="rooms" className="gap-1">
                    <Gamepad className="h-3 w-3" /> Rooms ({activeRooms.length})
                  </TabsTrigger>
                  <TabsTrigger value="tournaments" className="gap-1">
                    <Trophy className="h-3 w-3" /> Tournaments ({tournaments.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="rooms" className="mt-3">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-2">
                      {activeRooms.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No active rooms. Create one!</p>
                      ) : (
                        activeRooms.map((room) => (
                          <RoomCard key={room.id} room={room} onJoin={handleJoinRoom} />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="tournaments" className="mt-3">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {tournaments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No upcoming tournaments</p>
                      ) : (
                        tournaments.map((tournament) => (
                          <motion.div 
                            key={tournament.id}
                            whileHover={{ scale: 1.02 }}
                            className="border border-border/50 rounded-xl p-4 bg-muted/30 hover:border-primary/50 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold text-sm">{tournament.name}</h3>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {formatLabel[tournament.format]} • {tournament.scoreMode}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {tournament.status === 'active' ? 'In Progress' : `Starts in: ${formatTimeRemaining(tournament.startTime)}`}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {tournament.players}/{tournament.maxPlayers}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              <span className="text-yellow-500 font-medium">🏆 Prize:</span> {tournament.prize}
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                              <div 
                                className="bg-gradient-to-r from-primary to-purple-500 h-1.5 rounded-full transition-all" 
                                style={{ width: `${(tournament.players / tournament.maxPlayers) * 100}%` }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => joinTournament(tournament.id)}
                                disabled={tournament.status === 'active' || tournament.isFull}
                              >
                                {tournament.status === 'active' ? 'In Progress' : tournament.isFull ? 'Full' : 'Register'}
                              </Button>
                              {canManageTournaments && tournament.status === "upcoming" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => startTournament(tournament)}
                                  disabled={!tournament.isFull}
                                >
                                  {tournament.isFull ? 'Start Tournament' : 'Waiting for Full Capacity'}
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Right - Chat */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-t-xl py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5" />
                Lobby Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[500px]">
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No messages yet. Say hi!</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2">
                        <AvatarRenderer avatar={msg.userAvatar} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-sm">{msg.userName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground break-words">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border/50">
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" className="flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Room Dialog */}
      <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad className="h-5 w-5" /> Create Game Room
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Name</Label>
              <Input
                value={newRoomData.name}
                onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})}
                placeholder="e.g., Math Champions"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Game Mode</Label>
                <Select value={newRoomData.gameMode} onValueChange={(v) => setNewRoomData({...newRoomData, gameMode: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1v1">1v1 Duel</SelectItem>
                    <SelectItem value="2v2">2v2 Team</SelectItem>
                    <SelectItem value="Battle Royale">Battle Royale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Players</Label>
                <Select value={newRoomData.maxPlayers} onValueChange={(v) => setNewRoomData({...newRoomData, maxPlayers: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Players</SelectItem>
                    <SelectItem value="4">4 Players</SelectItem>
                    <SelectItem value="8">8 Players</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject</Label>
                <Select value={newRoomData.subject} onValueChange={(v) => setNewRoomData({...newRoomData, subject: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={newRoomData.difficulty} onValueChange={(v) => setNewRoomData({...newRoomData, difficulty: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRoomOpen(false)}>Cancel</Button>
            <Button onClick={createRoom} className="gap-2">
              <Plus className="h-4 w-4" /> Create Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createTournamentOpen} onOpenChange={setCreateTournamentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" /> Create Tournament (Admin)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tournament Name</Label>
              <Input
                value={newTournamentData.name}
                onChange={(e) => setNewTournamentData({ ...newTournamentData, name: e.target.value })}
                placeholder="e.g., Grade 8 Speed Cup"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newTournamentData.description}
                onChange={(e) => setNewTournamentData({ ...newTournamentData, description: e.target.value })}
                placeholder="What students will compete on"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format</Label>
                <Select
                  value={newTournamentData.format}
                  onValueChange={(value: Tournament["format"]) => setNewTournamentData({ ...newTournamentData, format: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knockout">Knockout (Football style)</SelectItem>
                    <SelectItem value="speed_knockout">Speed Knockout</SelectItem>
                    <SelectItem value="multiplayer_draw">Competition Draw (Multiplayer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scoring</Label>
                <Select
                  value={newTournamentData.scoreMode}
                  onValueChange={(value: Tournament["scoreMode"]) => setNewTournamentData({ ...newTournamentData, scoreMode: value })}
                  disabled={newTournamentData.format === "multiplayer_draw"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accuracy">Accuracy</SelectItem>
                    <SelectItem value="speed">Speed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Players</Label>
                <Input
                  type="number"
                  min={2}
                  value={newTournamentData.maxPlayers}
                  onChange={(e) => setNewTournamentData({ ...newTournamentData, maxPlayers: e.target.value })}
                />
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTournamentData.durationHours}
                  onChange={(e) => setNewTournamentData({ ...newTournamentData, durationHours: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prize Coins</Label>
                <Input
                  type="number"
                  min={0}
                  value={newTournamentData.prizeCoins}
                  onChange={(e) => setNewTournamentData({ ...newTournamentData, prizeCoins: e.target.value })}
                />
              </div>
              <div>
                <Label>Prize Gems</Label>
                <Input
                  type="number"
                  min={0}
                  value={newTournamentData.prizeGems}
                  onChange={(e) => setNewTournamentData({ ...newTournamentData, prizeGems: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTournamentOpen(false)}>Cancel</Button>
            <Button onClick={createTournament}>Create Tournament</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Lobby;
