
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import UserLevel from "@/components/profile/UserLevel";

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  rank: number;
  score: number;
}

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeFrame, setTimeFrame] = useState<string>("week");
  
  // Mock leaderboard data
  const mockLeaderboard: LeaderboardEntry[] = [
    { id: "1", name: "Emma", avatar: "🧠", level: 12, xp: 1250, rank: 1, score: 9850 },
    { id: "2", name: "Michael", avatar: "👦", level: 10, xp: 1050, rank: 2, score: 8720 },
    { id: "3", name: "Sophia", avatar: "👧", level: 9, xp: 930, rank: 3, score: 7640 },
    { id: "4", name: "William", avatar: "🦸", level: 8, xp: 850, rank: 4, score: 6520 },
    { id: "5", name: "Olivia", avatar: "👩‍🎓", level: 8, xp: 820, rank: 5, score: 6350 },
    { id: "6", name: "James", avatar: "🧑", level: 7, xp: 740, rank: 6, score: 5840 },
    { id: "7", name: "Ava", avatar: "🧠", level: 7, xp: 710, rank: 7, score: 5620 },
    { id: "8", name: "Noah", avatar: "👦", level: 6, xp: 630, rank: 8, score: 4950 },
    { id: "9", name: "Isabella", avatar: "👧", level: 5, xp: 580, rank: 9, score: 4320 },
    { id: "10", name: "Liam", avatar: "🦸", level: 4, xp: 450, rank: 10, score: 3740 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary px-4 py-3 shadow-md">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-center">Top Players</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={timeFrame} onValueChange={setTimeFrame}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="day">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
              
              <TabsContent value="day" className="space-y-4">
                {renderLeaderboard(mockLeaderboard)}
              </TabsContent>
              
              <TabsContent value="week" className="space-y-4">
                {renderLeaderboard(mockLeaderboard)}
              </TabsContent>
              
              <TabsContent value="month" className="space-y-4">
                {renderLeaderboard(mockLeaderboard)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* User's position */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <div className="text-center font-medium text-gray-700 mb-2">Your Position</div>
          <div className="flex items-center gap-3 p-3 bg-white rounded-md shadow-sm">
            <div className="font-semibold w-6 text-center text-gray-500">24</div>
            <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center">
              👤
            </div>
            <div className="flex-1">
              <div className="font-medium">You</div>
              <UserLevel level={3} xp={250} className="w-full mt-1" />
            </div>
            <div className="font-semibold">2140 pts</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to render the leaderboard
const renderLeaderboard = (entries: LeaderboardEntry[]) => {
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
        <div className="font-medium">{entry.name}</div>
        <UserLevel level={entry.level} xp={entry.xp} className="w-full mt-1" />
      </div>
      <div className="font-semibold">{entry.score} pts</div>
    </div>
  ));
};

export default Leaderboard;
