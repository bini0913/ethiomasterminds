import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Target, Zap, Brain, Calendar, Award, Loader2, Sparkles, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const AcademicInsightsPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [topicData, setTopicData] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
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

  const generateAIInsights = async () => {
    if (!user) return;
    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-academic-insights", {
        body: {
          stats,
          topicData,
          streak,
          grade: user.grade || "12",
          xp: user.xp || 0,
        },
      });

      if (error) throw error;
      setAiInsights(data?.insights || generateFallbackInsights());
    } catch (e) {
      console.error("AI insights error:", e);
      setAiInsights(generateFallbackInsights());
    } finally {
      setIsLoadingAI(false);
    }
  };

  const generateFallbackInsights = () => {
    const accuracy = stats?.accuracy || 0;
    const totalQuizzes = stats?.total_quizzes || 0;
    const currentStreak = streak?.current_streak || 0;

    const weakSubjects = subjectAccuracies.filter(s => s.accuracy < 60);
    const strongSubjects = subjectAccuracies.filter(s => s.accuracy >= 80);

    let insights = "📊 **Your Academic Analysis**\n\n";

    if (accuracy >= 80) {
      insights += "🌟 **Outstanding Performance!** Your overall accuracy of " + Math.round(accuracy) + "% shows excellent understanding.\n\n";
    } else if (accuracy >= 60) {
      insights += "📈 **Good Progress!** Your " + Math.round(accuracy) + "% accuracy is solid. Focus on weak areas to push higher.\n\n";
    } else {
      insights += "💪 **Room to Grow!** Your " + Math.round(accuracy) + "% accuracy has potential. Let's build stronger foundations.\n\n";
    }

    if (strongSubjects.length > 0) {
      insights += "✅ **Strengths:** " + strongSubjects.map(s => s.subject).join(", ") + "\n";
    }
    if (weakSubjects.length > 0) {
      insights += "⚠️ **Focus Areas:** " + weakSubjects.map(s => `${s.subject} (${s.accuracy}%)`).join(", ") + "\n\n";
    }

    if (currentStreak >= 7) {
      insights += "🔥 **Consistency:** Amazing " + currentStreak + "-day streak! Keep it up!\n";
    } else if (currentStreak >= 3) {
      insights += "📅 **Consistency:** Good " + currentStreak + "-day streak. Try to maintain daily practice.\n";
    } else {
      insights += "📅 **Consistency:** Build a daily habit. Even 15 minutes a day makes a huge difference.\n";
    }

    insights += "\n**Recommendations:**\n";
    if (weakSubjects.length > 0) {
      insights += "• Spend 30 min daily on " + weakSubjects[0].subject + " (your weakest area)\n";
    }
    insights += "• Use flashcards for active recall\n";
    insights += "• Take practice exams under timed conditions\n";
    insights += "• Review mistakes immediately after each quiz\n";

    return insights;
  };

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
    { icon: <Target className="h-5 w-5" />, label: "Accuracy", value: `${Math.round(accuracy)}%`, color: accuracy >= 80 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-600" },
    { icon: <Zap className="h-5 w-5" />, label: "Quizzes Done", value: String(totalQuizzes), color: "text-primary" },
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

        {/* AI Insights Button */}
        <Button
          className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700"
          onClick={generateAIInsights}
          disabled={isLoadingAI}
        >
          {isLoadingAI ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analyzing your performance...</>
          ) : (
            <><Sparkles className="h-5 w-5 mr-2" /> Get AI-Powered Insights</>
          )}
        </Button>

        {/* AI Insights Display */}
        {aiInsights && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-br from-violet-500/5 to-purple-500/5 border-violet-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-sm">AI Analysis</h3>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">
                  {aiInsights}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

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
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Subject Performance</h3>
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
                <p className="text-xs text-muted-foreground mb-1">💪 Strongest</p>
                <p className="font-bold capitalize text-green-600">{strongest.subject}</p>
                <p className="text-sm">{strongest.accuracy}%</p>
              </CardContent>
            </Card>
          )}
          {weakest && weakest.subject !== strongest?.subject && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <p className="text-xs text-muted-foreground">Needs Work</p>
                </div>
                <p className="font-bold capitalize text-red-600">{weakest.subject}</p>
                <p className="text-sm">{weakest.accuracy}%</p>
                <Button size="sm" variant="outline" className="mt-2 text-xs h-7" onClick={() => navigate(`/quiz?subject=${weakest.subject}`)}>
                  Practice Now
                </Button>
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
            <p className="text-xs text-muted-foreground mt-2">
              {currentStreak >= 7
                ? "Outstanding! You're building a powerful study habit."
                : currentStreak >= 3
                ? "Great momentum! Keep going to reach a 7-day streak."
                : "Study daily to build consistency. Even 15 minutes counts!"}
            </p>
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
