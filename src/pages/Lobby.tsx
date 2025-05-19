
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Users, MessageSquare, Trophy, User, Circle, Clock } from "lucide-react";
import { avatarToEmoji } from "@/utils/avatarUtils";

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [chatMessage, setChatMessage] = useState("");
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

  // Mock active rooms
  const [activeRooms] = useState([
    { id: "r1", name: "Math Duel", players: 2, maxPlayers: 2, status: "in-progress", subject: "math" },
    { id: "r2", name: "Science Battle", players: 1, maxPlayers: 2, status: "waiting", subject: "science" },
    { id: "r3", name: "Team Challenge", players: 2, maxPlayers: 4, status: "waiting", subject: "mixed" },
    { id: "r4", name: "English Quiz", players: 3, maxPlayers: 3, status: "in-progress", subject: "english" },
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
    toast.info("Creating a new game room...", {
      description: "This feature will be available soon!"
    });
  };

  // Join a game room
  const joinRoom = (roomId: string) => {
    toast.info(`Joining room ${roomId}...`, {
      description: "This feature will be available soon!"
    });
  };

  // Register for a tournament
  const joinTournament = (tournamentId: string) => {
    toast.info(`Registering for tournament...`, {
      description: "This feature will be available soon!"
    });
  };

  // Challenge a player
  const challengePlayer = (playerId: string, playerName: string) => {
    toast.info(`Challenging ${playerName}...`, {
      description: "This feature will be available soon!"
    });
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
                      onClick={createRoom}
                    >
                      Create New Room
                    </Button>
                    
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-500">Active Rooms</h3>
                      <ScrollArea className="h-[450px]">
                        <div className="space-y-3">
                          {activeRooms.map((room) => (
                            <motion.div 
                              key={room.id}
                              whileHover={{ scale: 1.02 }}
                              className="border rounded-lg p-3 hover:border-primary cursor-pointer"
                              onClick={() => joinRoom(room.id)}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <h3 className="font-medium">{room.name}</h3>
                                  <div className="flex items-center text-xs text-gray-500 mt-1">
                                    <Users className="h-3 w-3 mr-1" />
                                    <span>{room.players}/{room.maxPlayers} players</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <Badge className={
                                    room.status === 'waiting' 
                                      ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                      : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                  }>
                                    {room.status === 'waiting' ? 'Join Now' : 'In Progress'}
                                  </Badge>
                                  <span className="text-xs mt-1 capitalize">{room.subject}</span>
                                </div>
                              </div>
                            </motion.div>
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
    </div>
  );
};

export default Lobby;
