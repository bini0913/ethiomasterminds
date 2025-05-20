
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
  User, 
  Circle, 
  Clock, 
  Plus,
  Search,
  X
} from "lucide-react";
import { avatarToEmoji } from "@/utils/avatarUtils";
import RoomCard, { Room } from "@/components/multiplayer/RoomCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getAvailableSubjects } = useQuiz();
  
  // States
  const [chatMessage, setChatMessage] = useState("");
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [newRoomData, setNewRoomData] = useState({
    name: "",
    maxPlayers: "2",
    subject: "Mathematics",
    difficulty: "Medium",
    gameMode: "1v1"
  });
  
  // Chat messages
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
      message: "Welcome to the Master Minds Lobby! Challenge other players or join a tournament.",
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

  // Mock online players
  const [onlinePlayers] = useState([
    { id: "1", name: "Alex", avatar: "avatar-1", grade: "5", status: "online", xp: 450 },
    { id: "2", name: "Maria", avatar: "avatar-2", grade: "6", status: "in-game", xp: 720 },
    { id: "3", name: "David", avatar: "avatar-3", grade: "5", status: "online", xp: 380 },
    { id: "4", name: "Sophie", avatar: "avatar-4", grade: "7", status: "online", xp: 890 },
    { id: "5", name: "Michael", avatar: "avatar-5", grade: "6", status: "away", xp: 510 },
  ]);

  // Active rooms
  const [activeRooms, setActiveRooms] = useState<Room[]>([
    { id: "r1", name: "Math Duel", players: 2, maxPlayers: 2, status: "in-progress", subject: "Mathematics", difficulty: "Medium", gameMode: "1v1" },
    { id: "r2", name: "Science Battle", players: 1, maxPlayers: 2, status: "waiting", subject: "Science", difficulty: "Easy", gameMode: "1v1" },
    { id: "r3", name: "Team Challenge", players: 2, maxPlayers: 4, status: "waiting", subject: "Mixed", difficulty: "Hard", gameMode: "2v2" },
    { id: "r4", name: "English Quiz", players: 3, maxPlayers: 3, status: "in-progress", subject: "English", difficulty: "Medium", gameMode: "Battle Royale" },
  ]);

  // Mock tournaments
  const [tournaments] = useState([
    { 
      id: "t1", 
      name: "Daily Math Championship", 
      startTime: new Date(Date.now() + 30 * 60000), 
      players: 12, 
      maxPlayers: 16,
      prize: "500 XP + Gold Badge"
    },
    { 
      id: "t2", 
      name: "Science Weekly Tournament", 
      startTime: new Date(Date.now() + 120 * 60000), 
      players: 8, 
      maxPlayers: 32,
      prize: "1000 XP + Special Avatar"
    },
    { 
      id: "t3", 
      name: "Master Minds World Cup", 
      startTime: new Date(Date.now() + 24 * 60 * 60000), 
      players: 64, 
      maxPlayers: 128,
      prize: "5000 XP + Champion Title + Rare Avatar"
    },
  ]);

  // Check if user is authenticated
  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access the lobby", { 
        description: "You'll be redirected to the login page" 
      });
      setTimeout(() => navigate("/"), 2000);
    }
  }, [user, navigate]);

  // Handle chat submission
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

  // Create a game room
  const createRoom = () => {
    if (!newRoomData.name.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: newRoomData.name,
      players: 1, // Creator joins automatically
      maxPlayers: parseInt(newRoomData.maxPlayers),
      status: "waiting",
      subject: newRoomData.subject,
      difficulty: newRoomData.difficulty,
      gameMode: newRoomData.gameMode,
      createdBy: user?.id
    };
    
    setActiveRooms(prev => [newRoom, ...prev]);
    setCreateRoomOpen(false);
    
    toast.success("Room created successfully!", {
      description: "Others can now join your game room"
    });
    
    // Reset form
    setNewRoomData({
      name: "",
      maxPlayers: "2",
      subject: "Mathematics",
      difficulty: "Medium",
      gameMode: "1v1"
    });
  };

  // Join a game room
  const joinRoom = (room: Room) => {
    if (room.status !== "waiting" || room.players >= room.maxPlayers) {
      toast.error("Cannot join this room", {
        description: room.status === "in-progress" ? "Game is already in progress" : "Room is full"
      });
      return;
    }
    
    // Update the room's player count
    setActiveRooms(prev => 
      prev.map(r => 
        r.id === room.id 
          ? { ...r, players: r.players + 1 } 
          : r
      )
    );
    
    toast.success(`Joined ${room.name}!`, {
      description: "Game will start soon"
    });
    
    // In a real app, this would redirect to the game room
    // For now, we'll just simulate that with a timeout
    setTimeout(() => {
      navigate("/quiz");
    }, 2000);
  };

  // Register for a tournament
  const joinTournament = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    
    if (!tournament) {
      toast.error("Tournament not found");
      return;
    }
    
    toast.success(`Registered for ${tournament.name}!`, {
      description: "You'll be notified when the tournament begins"
    });
  };

  // Challenge a player
  const challengePlayer = (playerId: string, playerName: string) => {
    const player = onlinePlayers.find(p => p.id === playerId);
    
    if (!player) {
      toast.error("Player not found");
      return;
    }
    
    if (player.status !== "online") {
      toast.error(`${playerName} is ${player.status === "in-game" ? "already in a game" : "away"}`);
      return;
    }
    
    toast.success(`Challenge sent to ${playerName}!`, {
      description: "Waiting for them to accept..."
    });
    
    // Simulate response after a few seconds
    setTimeout(() => {
      const accepted = Math.random() > 0.3; // 70% chance to accept
      
      if (accepted) {
        toast.success(`${playerName} accepted your challenge!`, {
          description: "Redirecting to game..."
        });
        
        setTimeout(() => {
          navigate("/quiz");
        }, 2000);
      } else {
        toast.error(`${playerName} declined your challenge`);
      }
    }, 3000);
  };

  // Format time remaining for tournaments
  const formatTimeRemaining = (startTime: Date) => {
    const now = new Date();
    const diff = startTime.getTime() - now.getTime();
    
    if (diff < 0) return "Starting now";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-primary to-indigo-600 px-4 py-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <motion.div 
              className="bg-white rounded-full p-2 mr-2"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 1 }}
            >
              <span className="text-2xl">🎮</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-white">Multiplayer Lobby</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            Back to Menu
          </Button>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Online Players */}
          <div className="lg:col-span-1">
            <Card className="shadow-md h-full">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
                <div className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  <CardTitle>Online Players</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-4 space-y-4">
                    {onlinePlayers.map((player) => (
                      <motion.div 
                        key={player.id}
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-md border"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary-light flex items-center justify-center text-lg">
                          {avatarToEmoji(player.avatar)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-gray-500">Grade {player.grade} • {player.xp} XP</div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center">
                            <div className={`h-2 w-2 rounded-full mr-1 ${
                              player.status === 'online' ? 'bg-green-500' : 
                              player.status === 'in-game' ? 'bg-blue-500' : 'bg-yellow-500'
                            }`}></div>
                            <span className="text-xs capitalize">{player.status}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-xs mt-1 h-7 px-2"
                            onClick={() => challengePlayer(player.id, player.name)}
                            disabled={player.status !== "online"}
                          >
                            Challenge
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Middle column - Tabs for Rooms and Tournaments */}
          <div className="lg:col-span-1">
            <Card className="shadow-md h-full">
              <CardHeader className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-t-lg pb-3">
                <CardTitle>Play & Compete</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs defaultValue="rooms">
                  <TabsList className="w-full">
                    <TabsTrigger value="rooms">Game Rooms</TabsTrigger>
                    <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="rooms" className="space-y-4 mt-4">
                    <Button 
                      className="w-full bg-primary"
                      onClick={() => setCreateRoomOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Create New Room
                    </Button>
                    
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-500">Active Rooms</h3>
                      <ScrollArea className="h-[450px]">
                        <div className="grid grid-cols-1 gap-4 pr-4">
                          {activeRooms.map((room) => (
                            <RoomCard key={room.id} room={room} onJoin={joinRoom} />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tournaments" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-500">Upcoming Tournaments</h3>
                      <ScrollArea className="h-[480px]">
                        <div className="space-y-4">
                          {tournaments.map((tournament) => (
                            <motion.div 
                              key={tournament.id}
                              whileHover={{ scale: 1.02 }}
                              className="border rounded-lg p-4 hover:border-primary"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-medium">{tournament.name}</h3>
                                  <div className="text-xs text-gray-500 mt-1 flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    <span>Starts in: {formatTimeRemaining(tournament.startTime)}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1 flex items-center">
                                    <Users className="h-3 w-3 mr-1" />
                                    <span>{tournament.players}/{tournament.maxPlayers} players registered</span>
                                  </div>
                                  <div className="mt-2 text-xs">
                                    <span className="font-medium">Prize:</span> {tournament.prize}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => joinTournament(tournament.id)}
                                >
                                  Register
                                </Button>
                              </div>
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-primary h-1.5 rounded-full" 
                                  style={{ width: `${(tournament.players / tournament.maxPlayers) * 100}%` }}
                                ></div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Right column - Chat */}
          <div className="lg:col-span-1">
            <Card className="shadow-md h-full">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-lg">
                <div className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  <CardTitle>Lobby Chat</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col h-[600px]">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center text-sm">
                            {msg.userId === "system" ? "🤖" : avatarToEmoji(msg.userAvatar)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline">
                              <span className={`font-medium ${msg.userId === "system" ? "text-primary" : ""}`}>
                                {msg.userName}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="p-4 border-t">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit">Send</Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Create Room Dialog */}
      <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create a Game Room</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                value={newRoomData.name}
                onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})}
                placeholder="Enter a name for your room"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Select
                value={newRoomData.subject}
                onValueChange={(value) => setNewRoomData({...newRoomData, subject: value})}
              >
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSubjects().map((subject) => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                  <SelectItem value="Mixed">Mixed Subjects</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={newRoomData.difficulty}
                onValueChange={(value) => setNewRoomData({...newRoomData, difficulty: value})}
              >
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="game-mode">Game Mode</Label>
              <Select
                value={newRoomData.gameMode}
                onValueChange={(value) => setNewRoomData({...newRoomData, gameMode: value})}
              >
                <SelectTrigger id="game-mode">
                  <SelectValue placeholder="Select game mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1v1">1v1 Duel</SelectItem>
                  <SelectItem value="2v2">2v2 Team Battle</SelectItem>
                  <SelectItem value="Battle Royale">Battle Royale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="max-players">Maximum Players</Label>
              <Select
                value={newRoomData.maxPlayers}
                onValueChange={(value) => setNewRoomData({...newRoomData, maxPlayers: value})}
              >
                <SelectTrigger id="max-players">
                  <SelectValue placeholder="Select max players" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Players</SelectItem>
                  <SelectItem value="4">4 Players</SelectItem>
                  <SelectItem value="8">8 Players</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRoomOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createRoom}>Create Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Lobby;
