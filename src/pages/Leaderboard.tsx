import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import UserLevel from "@/components/profile/UserLevel";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, TrendingUp, Trophy, Award, Star, Home } from "lucide-react";
import { motion } from "framer-motion";
import BackButton from "@/components/ui/BackButton";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";

interface LeaderboardEntry {
  id: string;
  name: string;
  username: string;
  avatar: string;
  level: number;
  xp: number;
  rank: number;
  score: number;
}

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeFrame, setTimeFrame] = useState<string>("week");
  const { user } = useUser();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const calculateScore = (xp: number, level: number): number => {
    return xp + (level * 100);
  };
  
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        // Use the public leaderboard RPC function
        const { data, error } = await supabase.rpc('get_public_leaderboard', {
          limit_count: 50,
          timeframe: timeFrame
        });

        if (error) {
          console.error('Leaderboard fetch error:', error);
          setLeaderboard([]);
          return;
        }

        // Transform and rank the data
        const entries: LeaderboardEntry[] = (data || []).map((entry: any, index: number) => ({
          id: entry.id,
          name: entry.name || 'Anonymous',
          username: entry.username || '',
          avatar: entry.avatar || '👤',
          level: entry.level || 1,
          xp: entry.xp || 0,
          rank: index + 1,
          score: calculateScore(entry.xp || 0, entry.level || 1)
        }));

        setLeaderboard(entries);

        // Find user's rank
        if (user) {
          const userIndex = entries.findIndex(e => e.id === user.id);
          setUserRank(userIndex >= 0 ? userIndex + 1 : null);
        }
      } catch (err) {
        console.error('Leaderboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    
    // Calculate simulated active users based on time of day
    const hour = new Date().getHours();
    let baseActiveUsers = 15;
    if (hour >= 8 && hour <= 22) {
      baseActiveUsers = 25 + Math.floor(Math.random() * 15);
    } else {
      baseActiveUsers = 5 + Math.floor(Math.random() * 10);
    }
    setActiveUsers(baseActiveUsers);
  }, [user, timeFrame]);

  const renderLeaderboard = (entries: LeaderboardEntry[]) => {
    if (loading) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Loading leaderboard...
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No players found. Be the first to join the leaderboard!
        </div>
      );
    }

    return entries.map((entry) => (
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: entry.rank * 0.05 }}
        className={`flex items-center gap-3 p-3 rounded-md ${
          entry.rank <= 3 
            ? "bg-gradient-to-r from-primary/10 to-background shadow-sm" 
            : "hover:bg-muted/50"
        }`}
      >
        <div className={`font-semibold w-6 text-center ${
          entry.rank === 1 ? "text-yellow-500" :
          entry.rank === 2 ? "text-gray-400" :
          entry.rank === 3 ? "text-amber-700" :
          "text-muted-foreground"
        }`}>
          {entry.rank}
        </div>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
          👤
        </div>
        <div className="flex-1">
          <div className="font-medium flex items-center">
            {entry.name}
            {entry.rank <= 3 && (
              <Award className={`h-4 w-4 ml-1 ${
                entry.rank === 1 ? "text-yellow-500" : 
                entry.rank === 2 ? "text-gray-400" : "text-amber-700"
              }`} />
            )}
          </div>
          <UserLevel level={entry.level} xp={entry.xp} className="w-full mt-1" />
        </div>
        <div className="font-semibold text-foreground">{entry.score} pts</div>
      </motion.div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-yellow-500/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 px-4 py-3 shadow-xl">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <BackButton to="/" className="text-white hover:bg-white/20" />
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Leaderboard</h1>
              <p className="text-xs text-white/70">Top players worldwide</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate("/")} className="gap-2">
            <Home className="h-4 w-4" /> Menu
          </Button>
        </div>
      </header>
      
      <div className="container max-w-md mx-auto py-6 px-4">
        {/* Stats Section */}
        <div className="flex gap-3 mb-6">
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-2">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Players</p>
                <p className="font-semibold">{leaderboard.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-2">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="font-semibold">{activeUsers}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-4 flex items-center gap-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="font-semibold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Players
            </CardTitle>
            <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Live rankings based on performance</span>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={timeFrame} onValueChange={setTimeFrame}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="day">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
              
              <TabsContent value="day" className="space-y-2">
                {renderLeaderboard(leaderboard.slice(0, 10))}
              </TabsContent>
              
              <TabsContent value="week" className="space-y-2">
                {renderLeaderboard(leaderboard.slice(0, 10))}
              </TabsContent>
              
              <TabsContent value="month" className="space-y-2">
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
            className="mt-6 p-4 bg-muted rounded-lg"
          >
            <div className="text-center font-medium text-foreground mb-2 flex items-center justify-center">
              <Star className="h-4 w-4 mr-1 text-yellow-500" />
              Your Position
            </div>
            {userRank ? (
              <div className="flex items-center gap-3 p-3 bg-background rounded-md shadow-sm">
                <div className="font-semibold w-6 text-center text-muted-foreground">{userRank}</div>
                <AvatarRenderer avatar={user.avatar} avatarConfig={user.avatarConfig} size="sm" />
                <div className="flex-1">
                  <div className="font-medium flex items-center">
                    {user.name} 
                    {userRank <= 3 && (
                      <Award className={`h-4 w-4 ml-1 ${
                        userRank === 1 ? "text-yellow-500" : 
                        userRank === 2 ? "text-gray-400" : "text-amber-700"
                      }`} />
                    )}
                  </div>
                  <UserLevel level={user.level} xp={user.xp} className="w-full mt-1" />
                </div>
                <div className="font-semibold">{calculateScore(user.xp, user.level)} pts</div>
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                Complete quizzes and earn XP to appear on the leaderboard!
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
