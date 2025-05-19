
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Users, MessageSquare, Trophy, Gamepad, Clock, Star, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { avatarToEmoji } from "@/utils/avatarUtils";

const Multiplayer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  
  useEffect(() => {
    // Check if user is authenticated
    if (!user) {
      toast.error("Please log in to access multiplayer features");
      navigate("/");
    }
  }, [user, navigate]);
  
  const joinMatchmaking = (mode: string) => {
    // Redirect to the Lobby page
    navigate("/lobby");
    toast.success(`Joining ${mode} mode... redirecting to lobby`);
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
            <h1 className="text-2xl font-bold text-white">Multiplayer Arena</h1>
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
      
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-800">Welcome to Multiplayer Mode</h2>
          <p className="text-gray-600 max-w-xl mx-auto mt-2">
            Challenge friends, compete in tournaments, and show off your skills in real-time matches!
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
            className="col-span-2"
          >
            <Card className="shadow-lg overflow-hidden border-2 border-primary bg-gradient-to-br from-primary/10 to-indigo-100">
              <CardHeader className="bg-primary text-white pb-3">
                <CardTitle className="text-xl flex items-center">
                  <Gamepad className="mr-2 h-5 w-5" />
                  Enter the Multiplayer Lobby
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center">
                  <p className="text-center mb-4">
                    Join the Multiplayer Lobby to see who's online, chat with other players, and find matches.
                  </p>
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary-dark"
                    onClick={() => navigate("/lobby")}
                  >
                    Enter Lobby
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-md h-full bg-gradient-to-br from-blue-500/10 to-blue-100">
              <CardHeader className="bg-blue-500 text-white pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Player Vs Player
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm mb-4">
                  Challenge another player to a 1v1 duel or team up for 2v2 matches.
                </p>
                <Button 
                  className="w-full bg-blue-500 hover:bg-blue-600" 
                  onClick={() => joinMatchmaking("pvp")}
                >
                  Find Match
                </Button>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-md h-full bg-gradient-to-br from-green-500/10 to-green-100">
              <CardHeader className="bg-green-500 text-white pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Trophy className="mr-2 h-5 w-5" />
                  Tournaments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm mb-4">
                  Join scheduled tournaments to compete for XP and special rewards.
                </p>
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600" 
                  onClick={() => joinMatchmaking("tournament")}
                >
                  View Tournaments
                </Button>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-md h-full bg-gradient-to-br from-purple-500/10 to-purple-100">
              <CardHeader className="bg-purple-500 text-white pb-3">
                <CardTitle className="text-lg flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Custom Rooms
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm mb-4">
                  Create private rooms with custom settings to play with friends.
                </p>
                <Button 
                  className="w-full bg-purple-500 hover:bg-purple-600" 
                  onClick={() => joinMatchmaking("custom")}
                >
                  Create Room
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        <h3 className="text-xl font-bold text-gray-800 mb-4">Game Modes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-md h-full border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center mb-3">
                  <div className="bg-amber-100 p-2 rounded-full mr-3">
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <h3 className="font-bold">Speed Challenge</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Race against the clock! Answer as many questions as you can before time runs out.
                </p>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Fast-paced</Badge>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-md h-full border-l-4 border-l-cyan-500">
              <CardContent className="p-4">
                <div className="flex items-center mb-3">
                  <div className="bg-cyan-100 p-2 rounded-full mr-3">
                    <Star className="h-4 w-4 text-cyan-500" />
                  </div>
                  <h3 className="font-bold">Accuracy Battle</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Focus on getting answers right! The player with the highest accuracy wins.
                </p>
                <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-200">Precision</Badge>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-md h-full border-l-4 border-l-rose-500">
              <CardContent className="p-4">
                <div className="flex items-center mb-3">
                  <div className="bg-rose-100 p-2 rounded-full mr-3">
                    <Shield className="h-4 w-4 text-rose-500" />
                  </div>
                  <h3 className="font-bold">Knockout Finals</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Elimination-style tournament. Win each round to advance and become the champion!
                </p>
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200">Competitive</Badge>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl p-5 shadow-md mb-8">
          <div className="flex items-center mb-3">
            <div className="bg-indigo-100 p-2 rounded-full mr-3">
              <Trophy className="h-5 w-5 text-indigo-500" />
            </div>
            <h3 className="font-bold text-lg">World Championship</h3>
          </div>
          <p className="text-gray-700 mb-4">
            The Master Minds World Championship is coming soon! Compete against the best players from around the world for a chance to win exclusive rewards and recognition.
          </p>
          <div className="flex justify-between items-center">
            <Badge className="bg-indigo-100 text-indigo-800">Coming Soon</Badge>
            <Button variant="outline" size="sm" className="text-indigo-500 border-indigo-300">
              Get Notified
            </Button>
          </div>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Need help? Contact support at +251713445505</p>
        </div>
      </div>
    </div>
  );
};

export default Multiplayer;
