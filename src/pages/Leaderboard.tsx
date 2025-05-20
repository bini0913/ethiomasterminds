
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import UserLevel from "@/components/profile/UserLevel";
import { useUser } from "@/context/UserContext";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  rank: number;
  score: number;
  role: string;
}

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeFrame, setTimeFrame] = useState<string>("week");
  const { user, getAllUsers } = useUser();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  
  // Function to calculate score based on XP and level
  const calculateScore = (xp: number, level: number): number => {
    return xp + (level * 100);
  };
  
  useEffect(() => {
    // Get all users from the system
    const users = getAllUsers();
    
    // Transform users to leaderboard entries
    const entries: LeaderboardEntry[] = users
      .filter(u => u.xp !== undefined) // Filter out users without XP
      .map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar || "avatar-1",
        level: u.level || 1,
        xp: u.xp || 0,
        rank: 0, // Will be calculated after sorting
        score: calculateScore(u.xp || 0, u.level || 1),
        role: u.role
      }))
      // Sort by score descending
      .sort((a, b) => b.score - a.score);
    
    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
      
      // Find current user's rank
      if (user && entry.id === user.id) {
        setUserRank(index + 1);
      }
    });
    
    setLeaderboard(entries);
    
    // Calculate simulated active users based on time of day
    const hour = new Date().getHours();
    let baseActiveUsers = 15; // Base number
    
    // More users during peak hours (8am-10pm)
    if (hour >= 8 && hour <= 22) {
      baseActiveUsers = 25 + Math.floor(Math.random() * 15);
    } else {
      baseActiveUsers = 5 + Math.floor(Math.random() * 10);
    }
    
    setActiveUsers(baseActiveUsers);
    
  }, [user, timeFrame, getAllUsers]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-primary to-indigo-600 px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
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
      
      <div className="container max-w-md mx-auto py-6 px-4">
        {/* Stats Section */}
        <div className="flex gap-3 mb-6">
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-2">
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Players</p>
                <p className="font-semibold">{leaderboard.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-2">
              <div className="bg-green-100 p-2 rounded-full">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Online</p>
                <p className="font-semibold">{activeUsers}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-2">
              <div className="bg-purple-100 p-2 rounded-full">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Updated</p>
                <p className="font-semibold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-center">Top Players</CardTitle>
            <div className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Live rankings based on score</span>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={timeFrame} onValueChange={setTimeFrame}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="day">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
              
              <TabsContent value="day" className="space-y-4">
                {renderLeaderboard(leaderboard.slice(0, 10))}
              </TabsContent>
              
              <TabsContent value="week" className="space-y-4">
                {renderLeaderboard(leaderboard.slice(0, 10))}
              </TabsContent>
              
              <TabsContent value="month" className="space-y-4">
                {renderLeaderboard(leaderboard.slice(0, 10))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* User's position */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 p-4 bg-gray-100 rounded-lg"
          >
            <div className="text-center font-medium text-gray-700 mb-2">Your Position</div>
            {userRank ? (
              <div className="flex items-center gap-3 p-3 bg-white rounded-md shadow-sm">
                <div className="font-semibold w-6 text-center text-gray-500">{userRank}</div>
                <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center">
                  {user.avatar?.startsWith('avatar') ? '👤' : user.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{user.name} <Badge variant="outline" className="ml-1">{user.role}</Badge></div>
                  <UserLevel level={user.level} xp={user.xp} className="w-full mt-1" />
                </div>
                <div className="font-semibold">{calculateScore(user.xp, user.level)} pts</div>
              </div>
            ) : (
              <div className="text-center py-2 text-gray-500">
                Complete quizzes and earn XP to appear on the leaderboard!
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Helper function to render the leaderboard
const renderLeaderboard = (entries: LeaderboardEntry[]) => {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No players found. Be the first to join the leaderboard!
      </div>
    );
  }

  return entries.map((entry) => (
    <div 
      key={entry.id}
      className={`flex items-center gap-3 p-3 rounded-md ${
        entry.rank <= 3 
          ? "bg-gradient-to-r from-primary-light to-white shadow-sm" 
          : "hover:bg-gray-50"
      }`}
    >
      <div className={`font-semibold w-6 text-center ${
        entry.rank === 1 ? "text-yellow-500" :
        entry.rank === 2 ? "text-gray-400" :
        entry.rank === 3 ? "text-amber-700" :
        "text-gray-500"
      }`}>
        {entry.rank}
      </div>
      <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center">
        {entry.avatar}
      </div>
      <div className="flex-1">
        <div className="font-medium flex items-center">
          {entry.name}
          {entry.role !== "student" && (
            <Badge variant="outline" className="ml-1 text-xs">
              {entry.role === "teacher" ? "Teacher" : "Admin"}
            </Badge>
          )}
        </div>
        <UserLevel level={entry.level} xp={entry.xp} className="w-full mt-1" />
      </div>
      <div className="font-semibold">{entry.score} pts</div>
    </div>
  ));
};

export default Leaderboard;
