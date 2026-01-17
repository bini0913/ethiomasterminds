import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useRoom } from "@/context/RoomContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Users, Trophy, Gamepad, Clock, Shield, Swords, Crown, Zap, Target, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import BackButton from "@/components/ui/BackButton";
import RealTimeRoom from "@/components/multiplayer/RealTimeRoom";

const Multiplayer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { currentRoom, leaveRoom } = useRoom();
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);
  
  const roomId = searchParams.get('room');
  
  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access multiplayer features");
      navigate("/");
    }
  }, [user, navigate]);
  
  const joinMatchmaking = (mode: string) => {
    navigate("/lobby");
    toast.success(`Joining ${mode} mode... redirecting to lobby`);
  };

  const handleLeaveRoom = () => {
    if (roomId && user) {
      leaveRoom(roomId, user.name || 'Player');
    }
    navigate('/lobby');
  };

  const handleGameEnd = (results: any[]) => {
    toast.success('Game finished!');
    // Could show a results modal here
  };

  // If we have a room ID, show the RealTimeRoom component
  if (roomId && user) {
    return (
      <RealTimeRoom
        roomId={roomId}
        roomName={currentRoom?.name || 'Game Room'}
        maxPlayers={currentRoom?.maxPlayers || 4}
        currentUserId={user.id}
        currentUserName={user.name || 'Player'}
        onLeave={handleLeaveRoom}
        onGameEnd={handleGameEnd}
      />
    );
  }

  const gameModes = [
    {
      id: 'pvp',
      title: 'Player vs Player',
      subtitle: '1v1 or 2v2 Matches',
      description: 'Challenge another player to a thrilling duel or team up for intense 2v2 battles.',
      icon: Swords,
      gradient: 'from-blue-500 to-cyan-500',
      glowColor: 'glow-cyan',
      players: '2-4 Players'
    },
    {
      id: 'tournament',
      title: 'Tournaments',
      subtitle: 'Compete for Glory',
      description: 'Join scheduled tournaments and compete for XP, badges, and legendary rewards.',
      icon: Trophy,
      gradient: 'from-yellow-500 to-orange-500',
      glowColor: 'glow-yellow',
      players: '8-128 Players'
    },
    {
      id: 'custom',
      title: 'Custom Rooms',
      subtitle: 'Play with Friends',
      description: 'Create private rooms with custom settings and invite your friends to play.',
      icon: Users,
      gradient: 'from-purple-500 to-pink-500',
      glowColor: 'glow-pink',
      players: '2-8 Players'
    }
  ];

  const quickModes = [
    { id: 'speed', title: 'Speed Challenge', icon: Clock, color: 'from-amber-500 to-yellow-500', badge: 'Fast-paced', description: 'Race against time!' },
    { id: 'accuracy', title: 'Accuracy Battle', icon: Target, color: 'from-cyan-500 to-blue-500', badge: 'Precision', description: 'Get the highest accuracy!' },
    { id: 'knockout', title: 'Knockout Finals', icon: Shield, color: 'from-rose-500 to-red-500', badge: 'Competitive', description: 'Win or go home!' },
  ];
  
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
              >
                <Gamepad className="w-6 h-6 text-primary-foreground" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">Multiplayer Arena</h1>
                <p className="text-sm text-muted-foreground">Challenge players worldwide</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
              1,247 Online
            </Badge>
          </div>
        </div>
      </header>
      
      <div className="container max-w-6xl mx-auto py-8 px-4 relative z-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-block mb-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent blur-xl opacity-50" />
              <h2 className="relative text-4xl md:text-5xl font-bold text-gradient">
                Battle Your Way to Glory
              </h2>
            </div>
          </motion.div>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Challenge friends, compete in tournaments, and prove you're the ultimate Master Mind!
          </p>
        </motion.div>

        {/* Quick Enter Lobby */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <Card className="glass neon-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10" />
            <CardContent className="relative p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center pulse-glow"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Gamepad className="w-8 h-8 text-primary-foreground" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">Enter the Arena</h3>
                    <p className="text-muted-foreground">Join the lobby to find matches and chat with players</p>
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    size="lg" 
                    className="btn-futuristic bg-gradient-to-r from-primary to-accent text-primary-foreground px-8 py-6 text-lg font-bold"
                    onClick={() => navigate("/lobby")}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Enter Lobby
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Game Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {gameModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onHoverStart={() => setHoveredMode(mode.id)}
              onHoverEnd={() => setHoveredMode(null)}
              whileHover={{ y: -8 }}
            >
              <Card className={`glass h-full overflow-hidden transition-all duration-300 ${hoveredMode === mode.id ? 'neon-border' : 'border-border/50'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-10`} />
                <CardHeader className={`bg-gradient-to-r ${mode.gradient} text-white pb-4`}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <mode.icon className="h-5 w-5" />
                      {mode.title}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-white/20 text-white border-0">
                      {mode.players}
                    </Badge>
                  </div>
                  <p className="text-white/80 text-sm">{mode.subtitle}</p>
                </CardHeader>
                <CardContent className="relative p-6">
                  <p className="text-muted-foreground mb-6">{mode.description}</p>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      className={`w-full bg-gradient-to-r ${mode.gradient} text-white border-0`}
                      onClick={() => joinMatchmaking(mode.id)}
                    >
                      {mode.id === 'pvp' ? 'Find Match' : mode.id === 'tournament' ? 'View Tournaments' : 'Create Room'}
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        
        {/* Quick Game Modes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-12"
        >
          <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Quick Game Modes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickModes.map((mode, index) => (
              <motion.div
                key={mode.id}
                whileHover={{ scale: 1.03, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="glass border-l-4 border-l-transparent hover:border-l-primary transition-all duration-300 cursor-pointer" onClick={() => joinMatchmaking(mode.id)}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center`}>
                        <mode.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{mode.title}</h4>
                        <p className="text-sm text-muted-foreground">{mode.description}</p>
                      </div>
                    </div>
                    <Badge className={`bg-gradient-to-r ${mode.color} text-white border-0`}>{mode.badge}</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* World Championship Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="glass neon-border overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20" />
            <CardContent className="relative p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <motion.div 
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center"
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Crown className="w-10 h-10 text-white" />
                </motion.div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-gradient mb-2">World Championship</h3>
                  <p className="text-muted-foreground mb-4">
                    The Master Minds World Championship is coming soon! Compete against the best players globally for legendary rewards.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 px-4 py-1">
                      Coming Soon
                    </Badge>
                    <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
                      Get Notified
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Need help? Contact support at +251713445505</p>
        </div>
      </div>
    </div>
  );
};

export default Multiplayer;