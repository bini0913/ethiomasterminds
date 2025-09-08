import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Crown, 
  Medal, 
  Star, 
  TrendingUp, 
  Users, 
  Globe,
  School,
  Calendar,
  Target,
  Award,
  Zap,
  Brain
} from 'lucide-react';

const EnhancedLeaderboard: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [selectedScope, setSelectedScope] = useState('global');

  // Mock leaderboard data
  const globalLeaders = [
    { rank: 1, name: "Alexandra Chen", xp: 2847, level: 28, country: "🇨🇦 Canada", streak: 45, accuracy: 94 },
    { rank: 2, name: "Marcus Johnson", xp: 2756, level: 27, country: "🇺🇸 USA", streak: 38, accuracy: 91 },
    { rank: 3, name: "Sofia Rodriguez", xp: 2689, level: 26, country: "🇪🇸 Spain", streak: 42, accuracy: 93 },
    { rank: 4, name: "Raj Patel", xp: 2634, level: 26, country: "🇮🇳 India", streak: 35, accuracy: 89 },
    { rank: 5, name: "Emma Wilson", xp: 2578, level: 25, country: "🇬🇧 UK", streak: 31, accuracy: 92 },
    { rank: 6, name: "David Kim", xp: 2523, level: 25, country: "🇰🇷 South Korea", streak: 28, accuracy: 88 },
    { rank: 7, name: "Lila Hassan", xp: 2467, level: 24, country: "🇪🇹 Ethiopia", streak: 33, accuracy: 90 },
    { rank: 8, name: "Oliver Brown", xp: 2412, level: 24, country: "🇦🇺 Australia", streak: 26, accuracy: 87 },
    { rank: 9, name: "Isabella Garcia", xp: 2356, level: 23, country: "🇲🇽 Mexico", streak: 29, accuracy: 91 },
    { rank: 10, name: "Ahmed Al-Rashid", xp: 2301, level: 23, country: "🇦🇪 UAE", streak: 24, accuracy: 86 }
  ];

  const classLeaders = [
    { rank: 1, name: "Sarah Johnson", xp: 1234, level: 12, accuracy: 95, quizzes: 45 },
    { rank: 2, name: "Michael Chen", xp: 1198, level: 11, accuracy: 92, quizzes: 42 },
    { rank: 3, name: "Emma Wilson", xp: 1156, level: 11, accuracy: 89, quizzes: 38 },
    { rank: 4, name: "Daniel Brown", xp: 1134, level: 10, accuracy: 91, quizzes: 35 },
    { rank: 5, name: "Ava Davis", xp: 1089, level: 10, accuracy: 88, quizzes: 33 }
  ];

  const schoolLeaders = [
    { rank: 1, name: "Lincoln Elementary", avgXP: 1845, students: 234, completion: 94 },
    { rank: 2, name: "Roosevelt Middle School", avgXP: 1789, students: 189, completion: 91 },
    { rank: 3, name: "Washington High", avgXP: 1734, students: 156, completion: 89 },
    { rank: 4, name: "Jefferson Academy", avgXP: 1678, students: 198, completion: 87 },
    { rank: 5, name: "Madison Prep", avgXP: 1623, students: 167, completion: 85 }
  ];

  const weeklyChallengers = [
    { rank: 1, name: "Speed Demon", xp: 456, improvement: "+23%", challenge: "Quick Quiz Master" },
    { rank: 2, name: "Quiz Ninja", xp: 423, improvement: "+19%", challenge: "Math Sprint" },
    { rank: 3, name: "Brain Booster", xp: 398, improvement: "+15%", challenge: "Science Explorer" }
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-orange-500" />;
    return <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-sm font-bold text-gray-600">{rank}</div>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
    if (rank === 3) return "bg-gradient-to-r from-orange-400 to-orange-600 text-white";
    return "bg-gray-100 text-gray-700";
  };

  // Find user's rank (mock data)
  const userRank = 47;
  const userXP = user?.xp || 856;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="h-8 w-8 text-yellow-500" />
              Leaderboards
            </h1>
            <p className="text-gray-600">See how you rank against players worldwide!</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Menu
          </Button>
        </div>

        {/* User's Rank Card */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold">#{userRank}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{user?.name}</h3>
                  <p className="text-blue-100">Your Global Rank</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      <span className="text-sm">Level {user?.level || 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm">{userXP} XP</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-100 mb-2">Next Rank</div>
                <Progress value={75} className="w-32 h-2" />
                <div className="text-xs text-blue-100 mt-1">156 XP to go</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Period:</span>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="all-time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Scope:</span>
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="country">Country</SelectItem>
                <SelectItem value="school">School</SelectItem>
                <SelectItem value="class">Class</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Leaderboard Tabs */}
        <Tabs defaultValue="global" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Global
            </TabsTrigger>
            <TabsTrigger value="school" className="flex items-center gap-2">
              <School className="h-4 w-4" />
              Schools
            </TabsTrigger>
            <TabsTrigger value="class" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              My Class
            </TabsTrigger>
            <TabsTrigger value="challenges" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Challenges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Global Champions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {globalLeaders.map((leader) => (
                    <div key={leader.rank} className={`flex items-center justify-between p-4 rounded-lg ${leader.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getRankIcon(leader.rank)}
                          <Badge className={getRankBadge(leader.rank)}>
                            #{leader.rank}
                          </Badge>
                        </div>
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary text-white">
                            {leader.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{leader.name}</h3>
                          <p className="text-sm text-gray-600">{leader.country}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{leader.xp.toLocaleString()} XP</div>
                        <div className="text-sm text-gray-600">Level {leader.level}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>🔥 {leader.streak}d</span>
                          <span>🎯 {leader.accuracy}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="school" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Top Schools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {schoolLeaders.map((school) => (
                    <div key={school.rank} className={`flex items-center justify-between p-4 rounded-lg ${school.rank <= 3 ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-4">
                        {getRankIcon(school.rank)}
                        <div>
                          <h3 className="font-medium">{school.name}</h3>
                          <p className="text-sm text-gray-600">{school.students} students</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{school.avgXP.toLocaleString()} avg XP</div>
                        <div className="text-sm text-gray-600">{school.completion}% completion</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="class" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Class Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {classLeaders.map((student) => (
                    <div key={student.rank} className={`flex items-center justify-between p-4 rounded-lg ${student.rank <= 3 ? 'bg-gradient-to-r from-green-50 to-teal-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-4">
                        {getRankIcon(student.rank)}
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary text-white">
                            {student.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{student.name}</h3>
                          <p className="text-sm text-gray-600">Level {student.level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{student.xp.toLocaleString()} XP</div>
                        <div className="text-sm text-gray-600">{student.quizzes} quizzes • {student.accuracy}% accuracy</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="challenges" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Weekly Challenge Leaders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weeklyChallengers.map((challenger) => (
                    <div key={challenger.rank} className={`flex items-center justify-between p-4 rounded-lg ${challenger.rank <= 3 ? 'bg-gradient-to-r from-purple-50 to-pink-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-4">
                        {getRankIcon(challenger.rank)}
                        <div>
                          <h3 className="font-medium">{challenger.name}</h3>
                          <p className="text-sm text-gray-600">{challenger.challenge}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{challenger.xp} XP</div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {challenger.improvement}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Challenge Rewards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Challenge Rewards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                    <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="font-medium">1st Place</p>
                    <p className="text-sm text-gray-600">500 Coins + Badge</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                    <Medal className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="font-medium">2nd Place</p>
                    <p className="text-sm text-gray-600">300 Coins + Badge</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                    <Medal className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                    <p className="font-medium">3rd Place</p>
                    <p className="text-sm text-gray-600">200 Coins + Badge</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedLeaderboard;