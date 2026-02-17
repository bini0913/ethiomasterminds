import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Target, Zap, Brain, Calendar, Award } from "lucide-react";

const AcademicInsightsPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [topicData, setTopicData] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [statsRes, topicsRes, streakRes] = await Promise.all([
        supabase.rpc("get_user_stats", { p_user_id: user.id }),
        supabase.from("topic_progress").select("*").eq("user_id", user.id),
        supabase.from("user_streaks").select("*").eq("user_id", user.id).single(),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (topicsRes.data) setTopicData(topicsRes.data);
      if (streakRes.data) setStreak(streakRes.data);
      setIsLoading(false);
    };
    fetchAll();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const accuracy = stats?.accuracy || 0;
  const totalQuizzes = stats?.total_quizzes || 0;
  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;

  // Find strongest and weakest subjects
  const subjectStats: Record<string, { total: number; correct: number }> = {};
  topicData.forEach(t => {
    if (!subjectStats[t.subject]) subjectStats[t.subject] = { total: 0, correct: 0 };
    subjectStats[t.subject].total += t.questions_attempted;
    subjectStats[t.subject].correct += t.questions_correct;
  });

  const subjectAccuracies = Object.entries(subjectStats).map(([s, d]) => ({
    subject: s,
    accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    total: d.total,
  })).sort((a, b) => b.accuracy - a.accuracy);

  const strongest = subjectAccuracies[0];
  const weakest = subjectAccuracies[subjectAccuracies.length - 1];

  const academicRank = getAcademicRank(user?.xp || 0);

  const insights = [
    { icon: <Target className="h-5 w-5" />, label: "Accuracy", value: `${accuracy}%`, color: accuracy >= 80 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-600" },
    { icon: <Zap className="h-5 w-5" />, label: "Quizzes Done", value: totalQuizzes, color: "text-primary" },
    { icon: <Calendar className="h-5 w-5" />, label: "Current Streak", value: `${currentStreak} days`, color: "text-orange-600" },
    { icon: <Award className="h-5 w-5" />, label: "Best Streak", value: `${longestStreak} days`, color: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-sky-700 to-cyan-700 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Academic Insights
          </h1>
        </div>
      </header>

      <div className="px-4 py-4 max-w-4xl mx-auto space-y-4">
        {/* Academic Rank */}
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl mb-1">{academicRank.emoji}</p>
            <h3 className="font-bold text-lg">{academicRank.title}</h3>
            <p className="text-xs text-muted-foreground">{user?.xp || 0} XP</p>
          </CardContent>
        </Card>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <motion.div key={ins.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="bg-card/80 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1 text-muted-foreground">{ins.icon}<span className="text-xs">{ins.label}</span></div>
                  <p className={`text-xl font-bold ${ins.color}`}>{ins.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Subject Performance */}
        {subjectAccuracies.length > 0 && (
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Brain className="h-4 w-4" /> Subject Performance</h3>
              <div className="space-y-3">
                {subjectAccuracies.map(s => (
                  <div key={s.subject}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium">{s.subject}</span>
                      <span className={s.accuracy >= 80 ? "text-green-600" : s.accuracy >= 50 ? "text-yellow-600" : "text-red-600"}>{s.accuracy}%</span>
                    </div>
                    <Progress value={s.accuracy} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-0.5">{s.total} questions attempted</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strongest / Weakest */}
        <div className="grid grid-cols-2 gap-3">
          {strongest && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Strongest</p>
                <p className="font-bold capitalize text-green-600">{strongest.subject}</p>
                <p className="text-sm">{strongest.accuracy}%</p>
              </CardContent>
            </Card>
          )}
          {weakest && weakest.subject !== strongest?.subject && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Needs Work</p>
                <p className="font-bold capitalize text-red-600">{weakest.subject}</p>
                <p className="text-sm">{weakest.accuracy}%</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Study Consistency */}
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2">Study Consistency Score</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Progress value={Math.min(currentStreak * 10, 100)} className="h-3" />
              </div>
              <Badge variant={currentStreak >= 7 ? "default" : "secondary"}>
                {currentStreak >= 7 ? "🔥 On Fire" : currentStreak >= 3 ? "📈 Building" : "🌱 Start"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function getAcademicRank(xp: number) {
  if (xp >= 10000) return { title: "Elite Scholar", emoji: "🏆" };
  if (xp >= 5000) return { title: "Gold Scholar", emoji: "🥇" };
  if (xp >= 2000) return { title: "Silver Scholar", emoji: "🥈" };
  if (xp >= 500) return { title: "Bronze Scholar", emoji: "🥉" };
  return { title: "Aspiring Scholar", emoji: "📖" };
}

export default AcademicInsightsPage;
