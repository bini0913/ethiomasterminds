import React from 'react';
import { useUser } from '@/context/UserContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useAchievements } from '@/context/AchievementsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Brain,
  Zap,
  Gamepad2,
  Crown,
  Flame,
  MessageCircle,
  Settings,
  LogOut,
  Sparkles
} from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import CurrencyDisplay from '@/components/currency/CurrencyDisplay';

const StudentDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const { coins, gems } = useCurrency();
  const { unlockedBadges } = useAchievements();
  const navigate = useNavigate();

  const getRankInfo = (level: number) => {
    if (level < 5) return { title: "Rookie", icon: "🌱", color: "from-slate-500 to-slate-600" };
    if (level < 10) return { title: "Thinker", icon: "💭", color: "from-blue-500 to-blue-600" };
    if (level < 20) return { title: "Master", icon: "🎓", color: "from-purple-500 to-purple-600" };
    if (level < 35) return { title: "Grand Master", icon: "👑", color: "from-amber-500 to-orange-600" };
    return { title: "Legend", icon: "⚡", color: "from-pink-500 to-rose-600" };
  };

  const rank = getRankInfo(user?.level || 1);
  const xpForNextLevel = (user?.level || 1) * 100;
  const currentXP = user?.xp || 0;
  const xpProgress = (currentXP / xpForNextLevel) * 100;

  const todayStats = {
    quizzesCompleted: 3,
    correctAnswers: 28,
    totalQuestions: 35,
    xpEarned: 140,
    streak: 5
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />

      <div className="relative z-10">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo & User */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-xl font-display font-bold text-white">MM</span>
                </div>
                <div>
                  <h1 className="text-lg font-display font-bold text-foreground">
                    Welcome, {user?.name || "Student"}!
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{rank.icon}</span>
                    <span className="text-sm text-muted-foreground">{rank.title}</span>
                  </div>
                </div>
              </div>

              {/* Currency & Actions */}
              <div className="flex items-center gap-3">
                <CurrencyDisplay showBoth />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/settings')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <motion.main
          className="container mx-auto px-4 py-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* XP Progress Section */}
          <motion.div variants={itemVariants}>
            <Card className="glass border-primary/20 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${rank.color} flex items-center justify-center shadow-lg`}>
                      <span className="text-3xl">{rank.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-display font-bold text-foreground">
                          Level {user?.level || 1}
                        </span>
                        <Badge className={`bg-gradient-to-r ${rank.color} text-white border-0`}>
                          {rank.title}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {currentXP} / {xpForNextLevel} XP to next level
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-xl">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="font-display font-bold text-orange-500">{todayStats.streak} Day Streak</span>
                  </div>
                </div>
                <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 xp-bar rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Star, label: "Level", value: user?.level || 1, color: "from-primary to-accent" },
              { icon: Zap, label: "Today's XP", value: `+${todayStats.xpEarned}`, color: "from-secondary to-glow-cyan" },
              { icon: Target, label: "Accuracy", value: `${Math.round((todayStats.correctAnswers / todayStats.totalQuestions) * 100)}%`, color: "from-glow-green to-emerald-500" },
              { icon: Award, label: "Badges", value: unlockedBadges.length, color: "from-accent to-glow-pink" }
            ].map((stat, i) => (
              <Card key={i} className="glass border-border/30 card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <Card className="glass border-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { icon: BookOpen, label: "Start Quiz", path: "/quiz", gradient: "from-primary to-accent" },
                    { icon: Users, label: "Multiplayer", path: "/multiplayer", gradient: "from-secondary to-glow-cyan" },
                    { icon: Trophy, label: "Tournaments", path: "/tournaments", gradient: "from-accent to-glow-pink" },
                    { icon: TrendingUp, label: "Leaderboard", path: "/leaderboard", gradient: "from-glow-yellow to-orange-500" },
                    { icon: MessageCircle, label: "Chat", path: "/friends", gradient: "from-pink-500 to-rose-500" }
                  ].map((action, i) => (
                    <motion.div key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        onClick={() => navigate(action.path)}
                        className={`w-full h-20 flex-col gap-2 bg-gradient-to-br ${action.gradient} border-0 rounded-xl shadow-lg hover:shadow-xl transition-shadow`}
                      >
                        <action.icon className="h-6 w-6" />
                        <span className="text-sm font-display">{action.label}</span>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Daily Missions */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Daily Missions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { title: "Complete 3 Quizzes", progress: 2, total: 3, reward: "+50 XP" },
                      { title: "Win 1 Multiplayer Match", progress: 0, total: 1, reward: "+100 XP" },
                      { title: "Score 90%+ on any quiz", progress: 1, total: 1, reward: "+30 XP", completed: true }
                    ].map((mission, i) => (
                      <div key={i} className={`p-4 rounded-xl ${mission.completed ? 'bg-glow-green/10 border border-glow-green/30' : 'bg-muted/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">{mission.title}</span>
                          <Badge variant={mission.completed ? "default" : "secondary"} className={mission.completed ? "bg-glow-green text-background" : ""}>
                            {mission.reward}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={(mission.progress / mission.total) * 100} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground">
                            {mission.progress}/{mission.total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Today's Performance */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Brain className="h-5 w-5 text-accent" />
                      Today's Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Quizzes", value: todayStats.quizzesCompleted, icon: "📚" },
                        { label: "Correct", value: `${todayStats.correctAnswers}/${todayStats.totalQuestions}`, icon: "✅" },
                        { label: "XP Earned", value: `+${todayStats.xpEarned}`, icon: "⚡" }
                      ].map((stat, i) => (
                        <div key={i} className="text-center p-4 bg-muted/30 rounded-xl">
                          <span className="text-2xl mb-2 block">{stat.icon}</span>
                          <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Avatar Card */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30 overflow-hidden">
                  <div className="bg-gradient-to-br from-primary/20 to-accent/20 p-6 text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent p-1">
                      <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-4xl">
                        {user?.avatar || "🧑‍🎓"}
                      </div>
                    </div>
                    <h3 className="mt-3 font-display font-bold text-lg text-foreground">
                      {user?.name || "Student"}
                    </h3>
                    <p className="text-sm text-muted-foreground">Grade {user?.grade || 5}</p>
                  </div>
                  <CardContent className="p-4">
                    <Button 
                      variant="outline" 
                      className="w-full border-primary/30 hover:bg-primary/10"
                      onClick={() => navigate('/profile')}
                    >
                      Customize Avatar
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Achievements */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-glow-yellow" />
                      Recent Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {unlockedBadges.length > 0 ? (
                      <div className="space-y-2">
                        {unlockedBadges.slice(0, 3).map((badge, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                            <span className="text-2xl">{badge.icon}</span>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground">{badge.name}</p>
                              <p className="text-xs text-muted-foreground">{badge.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-6">
                        Complete quizzes to earn badges! 🏆
                      </p>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full mt-3 text-primary"
                      onClick={() => navigate('/profile')}
                    >
                      View All Achievements
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Friends Online */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-secondary" />
                      Friends Online
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { name: "Abebe K.", level: 12, online: true },
                        { name: "Tigist A.", level: 15, online: true },
                        { name: "Dawit H.", level: 8, online: false }
                      ].map((friend, i) => (
                        <div key={i} className="flex items-center gap-3 p-2">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                              <span className="text-lg">👤</span>
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${friend.online ? 'bg-glow-green' : 'bg-muted'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm text-foreground">{friend.name}</p>
                            <p className="text-xs text-muted-foreground">Level {friend.level}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-primary">
                            <Gamepad2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="ghost" 
                      className="w-full mt-3 text-primary"
                      onClick={() => navigate('/friends')}
                    >
                      View All Friends
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </motion.main>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground">
          Created by Biniam Bogale • Master Minds
        </footer>
      </div>
    </div>
  );
};

export default StudentDashboard;
