import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useQuiz } from "@/context/QuizContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { 
  Users, 
  MessageSquare, 
  Trophy, 
  Clock, 
  Plus,
  Send,
  ArrowLeft,
  Home,
  Gamepad,
  Zap,
  Crown,
  Star,
  Swords
} from "lucide-react";
import { avatarToEmoji } from "@/utils/avatarUtils";
import RoomCard, { Room } from "@/components/multiplayer/RoomCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import BackButton from "@/components/ui/BackButton";

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getAvailableSubjects } = useQuiz();
  
  const [chatMessage, setChatMessage] = useState("");
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [newRoomData, setNewRoomData] = useState({
    name: "",
    maxPlayers: "2",
    subject: "Mathematics",
    difficulty: "Medium",
    gameMode: "1v1"
  });
  
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    message: string;
    timestamp: Date;
  }>>([
    {
      id: "msg1",
      userId: "system",
      userName: "System",
      userAvatar: "avatar-1",
      message: "Welcome to the Master Minds Lobby! 🎮",
      timestamp: new Date(),
    },
    {
      id: "msg2",
      userId: "user1",
      userName: "Alex",
      userAvatar: "avatar-2",
      message: "Anyone up for a math challenge?",
      timestamp: new Date(Date.now() - 5 * 60000),
    },
    {
      id: "msg3",
      userId: "user2",
      userName: "Maria",
      userAvatar: "avatar-3",
      message: "Just finished a science quiz, got 95%! 🎉",
      timestamp: new Date(Date.now() - 2 * 60000),
    },
  ]);

  const [onlinePlayers] = useState([
    { id: "1", name: "Alex", avatar: "avatar-1", grade: "5", status: "online", xp: 450 },
    { id: "2", name: "Maria", avatar: "avatar-2", grade: "6", status: "in-game", xp: 720 },
    { id: "3", name: "David", avatar: "avatar-3", grade: "5", status: "online", xp: 380 },
    { id: "4", name: "Sophie", avatar: "avatar-4", grade: "7", status: "online", xp: 890 },
    { id: "5", name: "Michael", avatar: "avatar-5", grade: "6", status: "away", xp: 510 },
  ]);

  const [activeRooms, setActiveRooms] = useState<Room[]>([
    { id: "r1", name: "Math Duel", players: 2, maxPlayers: 2, status: "in-progress", subject: "Mathematics", difficulty: "Medium", gameMode: "1v1" },
    { id: "r2", name: "Science Battle", players: 1, maxPlayers: 2, status: "waiting", subject: "Science", difficulty: "Easy", gameMode: "1v1" },
    { id: "r3", name: "Team Challenge", players: 2, maxPlayers: 4, status: "waiting", subject: "Mixed", difficulty: "Hard", gameMode: "2v2" },
    { id: "r4", name: "English Quiz", players: 3, maxPlayers: 3, status: "in-progress", subject: "English", difficulty: "Medium", gameMode: "Battle Royale" },
  ]);

  const [tournaments] = useState([
    { id: "t1", name: "Daily Math Championship", startTime: new Date(Date.now() + 30 * 60000), players: 12, maxPlayers: 16, prize: "500 XP + Gold Badge" },
    { id: "t2", name: "Science Weekly Tournament", startTime: new Date(Date.now() + 120 * 60000), players: 8, maxPlayers: 32, prize: "1000 XP + Special Avatar" },
    { id: "t3", name: "Master Minds World Cup", startTime: new Date(Date.now() + 24 * 60 * 60000), players: 64, maxPlayers: 128, prize: "5000 XP + Champion Title" },
  ]);

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access the lobby");
      setTimeout(() => navigate("/"), 2000);
    }
  }, [user, navigate]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user) return;
    
    const newMessage = {
      id: `msg-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      message: chatMessage,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatMessage("");
  };

  const createRoom = () => {
    if (!newRoomData.name.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: newRoomData.name,
      players: 1,
      maxPlayers: parseInt(newRoomData.maxPlayers),
      status: "waiting",
      subject: newRoomData.subject,
      difficulty: newRoomData.difficulty,
      gameMode: newRoomData.gameMode,
      createdBy: user?.id
    };
    
    setActiveRooms(prev => [newRoom, ...prev]);
    setCreateRoomOpen(false);
    toast.success("Room created!");
    setNewRoomData({ name: "", maxPlayers: "2", subject: "Mathematics", difficulty: "Medium", gameMode: "1v1" });
  };

  const joinRoom = (room: Room) => {
    if (room.status !== "waiting" || room.players >= room.maxPlayers) {
      toast.error("Cannot join this room");
      return;
    }
    
    setActiveRooms(prev => prev.map(r => r.id === room.id ? { ...r, players: r.players + 1 } : r));
    toast.success(`Joined ${room.name}!`);
    setTimeout(() => navigate("/quiz"), 2000);
  };

  const joinTournament = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament) {
      toast.success(`Registered for ${tournament.name}!`);
    }
  };

  const challengePlayer = (playerId: string, playerName: string) => {
    const player = onlinePlayers.find(p => p.id === playerId);
    if (!player || player.status !== "online") {
      toast.error(`${playerName} is not available`);
      return;
    }
    toast.success(`Challenge sent to ${playerName}!`);
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
                Online Players
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-3 space-y-2">
                  {onlinePlayers.map((player) => (
                    <motion.div 
                      key={player.id}
                      whileHover={{ scale: 1.02 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg">
                          {avatarToEmoji(player.avatar)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${getStatusColor(player.status)} border-2 border-card`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{player.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          {player.xp} XP
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => challengePlayer(player.id, player.name)}
                        disabled={player.status !== "online"}
                      >
                        <Swords className="h-3 w-3 mr-1" />
                        Fight
                      </Button>
                    </motion.div>
                  ))}
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
                    <Gamepad className="h-3 w-3" /> Rooms
                  </TabsTrigger>
                  <TabsTrigger value="tournaments" className="gap-1">
                    <Trophy className="h-3 w-3" /> Tournaments
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="rooms" className="mt-3">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-2">
                      {activeRooms.map((room) => (
                        <RoomCard key={room.id} room={room} onJoin={joinRoom} />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="tournaments" className="mt-3">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {tournaments.map((tournament) => (
                        <motion.div 
                          key={tournament.id}
                          whileHover={{ scale: 1.02 }}
                          className="border border-border/50 rounded-xl p-4 bg-muted/30 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-sm">{tournament.name}</h3>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                Starts in: {formatTimeRemaining(tournament.startTime)}
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
                          <Button size="sm" className="w-full" onClick={() => joinTournament(tournament.id)}>
                            Register
                          </Button>
                        </motion.div>
                      ))}
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
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-sm flex-shrink-0">
                        {msg.userId === "system" ? "🤖" : avatarToEmoji(msg.userAvatar)}
                      </div>
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
                  ))}
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
    </div>
  );
};

export default Lobby;
