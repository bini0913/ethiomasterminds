import React from 'react';
import { useUser } from '@/context/UserContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useAchievements } from '@/context/AchievementsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  BookOpen, 
  Users, 
  Target, 
  Star, 
  Award,
  TrendingUp,
  Calendar,
  Play,
  Brain
} from 'lucide-react';
import CurrencyDisplay from '@/components/currency/CurrencyDisplay';
import UserLevel from '@/components/profile/UserLevel';
import XPProgressBar from '@/components/profile/XPProgressBar';

const StudentDashboard: React.FC = () => {
  const { user } = useUser();
  const { coins, gems } = useCurrency();
  const { achievements, unlockedBadges } = useAchievements();
  const navigate = useNavigate();

  const getRankTitle = (level: number) => {
    if (level < 3) return { title: "Rookie", color: "bg-gray-500" };
    if (level < 6) return { title: "Learner", color: "bg-blue-500" };
    if (level < 10) return { title: "Quizzer", color: "bg-green-500" };
    if (level < 15) return { title: "Thinker", color: "bg-purple-500" };
    if (level < 20) return { title: "Genius", color: "bg-orange-500" };
    return { title: "Master Mind", color: "bg-gradient-to-r from-yellow-400 to-yellow-600" };
  };

  const weeklyGoal = 500; // XP goal for the week
  const currentWeeklyXP = 347; // Current progress

  const todayStats = {
    quizzesCompleted: 3,
    correctAnswers: 28,
    totalQuestions: 35,
    xpEarned: 140
  };

  const recentAchievements = unlockedBadges.slice(0, 3);
  const rank = getRankTitle(user?.level || 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Welcome back, {user?.name}! 🌟
            </h1>
            <p className="text-gray-600">Ready to continue your learning journey?</p>
          </div>
          <div className="flex items-center gap-3">
            <CurrencyDisplay showBoth />
            <Badge variant="secondary" className={`${rank.color} text-white px-3 py-1`}>
              {rank.title}
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Level</p>
                  <p className="text-2xl font-bold">{user?.level || 1}</p>
                </div>
                <Star className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Today's XP</p>
                  <p className="text-2xl font-bold">{todayStats.xpEarned}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100">Accuracy</p>
                  <p className="text-2xl font-bold">
                    {Math.round((todayStats.correctAnswers / todayStats.totalQuestions) * 100)}%
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100">Badges</p>
                  <p className="text-2xl font-bold">{unlockedBadges.length}</p>
                </div>
                <Award className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button 
                    onClick={() => navigate('/quiz')}
                    className="flex flex-col items-center gap-2 h-auto py-4"
                  >
                    <BookOpen className="h-6 w-6" />
                    <span className="text-sm">Practice Quiz</span>
                  </Button>
                  <Button 
                    onClick={() => navigate('/multiplayer')}
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                  >
                    <Users className="h-6 w-6" />
                    <span className="text-sm">Multiplayer</span>
                  </Button>
                  <Button 
                    onClick={() => navigate('/tournaments')}
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                  >
                    <Trophy className="h-6 w-6" />
                    <span className="text-sm">Tournaments</span>
                  </Button>
                  <Button 
                    onClick={() => navigate('/leaderboard')}
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                  >
                    <TrendingUp className="h-6 w-6" />
                    <span className="text-sm">Leaderboard</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Progress Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Weekly Goal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>XP Progress</span>
                    <span>{currentWeeklyXP} / {weeklyGoal} XP</span>
                  </div>
                  <Progress 
                    value={(currentWeeklyXP / weeklyGoal) * 100} 
                    className="h-3"
                  />
                  <p className="text-sm text-gray-600">
                    You're {Math.round((currentWeeklyXP / weeklyGoal) * 100)}% towards your weekly goal! 
                    Keep it up! 🎯
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Today's Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{todayStats.quizzesCompleted}</p>
                    <p className="text-sm text-gray-600">Quizzes Completed</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {todayStats.correctAnswers}/{todayStats.totalQuestions}
                    </p>
                    <p className="text-sm text-gray-600">Correct Answers</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">+{todayStats.xpEarned}</p>
                    <p className="text-sm text-gray-600">XP Earned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Level Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Level Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserLevel level={user?.level || 1} xp={user?.xp || 0} />
                <div className="mt-4">
                  <XPProgressBar level={user?.level || 1} xp={user?.xp || 0} />
                </div>
              </CardContent>
            </Card>

            {/* Recent Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentAchievements.length > 0 ? (
                    recentAchievements.map((badge, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                        <div className="text-2xl">{badge.icon}</div>
                        <div>
                          <p className="font-medium text-sm">{badge.name}</p>
                          <p className="text-xs text-gray-600">{badge.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Complete more quizzes to earn achievements! 🏆
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => navigate('/profile')}
                >
                  View All Achievements
                </Button>
              </CardContent>
            </Card>

            {/* Daily Challenge */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Challenge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 border-2 border-dashed border-primary/20 rounded-lg">
                  <Trophy className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="font-medium text-sm mb-1">Math Sprint Challenge</p>
                  <p className="text-xs text-gray-600 mb-3">Answer 10 math questions in under 5 minutes</p>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    +100 XP • +50 Coins
                  </Badge>
                </div>
                <Button className="w-full mt-3" onClick={() => navigate('/quiz')}>
                  Start Challenge
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;