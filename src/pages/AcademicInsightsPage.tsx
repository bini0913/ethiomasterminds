import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Target, Zap, Brain, Calendar, Award, Loader2, Sparkles, BookOpen, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { getAcademicProfile, normalizeGrade, resolveAcademicGrade } from "@/lib/academicProfile";

const AcademicInsightsPage: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [topicData, setTopicData] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [studyActivity, setStudyActivity] = useState<Array<{ date: string; minutes: number }>>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [academicContext, setAcademicContext] = useState<{ grade: number; curriculum: string; goal: string; book: string; subjects: string[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadError(false);
    const loadAcademicContext = async () => {
      try {
        const profile = await getAcademicProfile(user.id);
        if (cancelled) return;
        if (!profile) {
          setLoadError(true);
          return;
        }
        const selectedBookIds = Array.from(new Set([
          ...(profile.book_ids || []),
          ...(profile.book_id ? [profile.book_id] : []),
        ]));
        let selectedBookTitles: string[] = [];
        if (selectedBookIds.length) {
          const { data: books, error } = await supabase
            .from("library_books")
            .select("id,title,author,subject")
            .in("id", selectedBookIds);
          if (!error && books) {
            selectedBookTitles = books.map((book: any) =>
              [book.title, book.author, book.subject].filter(Boolean).join(" — ")
            );
          }
        }
        if (cancelled) return;
        const resources = Array.from(new Set([
          ...selectedBookTitles,
          ...(profile.book_title ? [profile.book_title] : []),
        ]));
        setAcademicContext({
          grade: resolveAcademicGrade(user.grade, profile.grade, 12),
          curriculum: profile.curriculum,
          goal: [profile.study_goal, profile.study_goal_detail].filter(Boolean).join(" — "),
          book: resources.join("; ") || "Not specified",
          subjects: profile.subjects || [],
        });
      } catch (error) {
        console.error("Academic insights profile context failed:", error);
        if (!cancelled) setLoadError(true);
      }
    };
    void loadAcademicContext();
    const fetchAll = async () => {
      try {
        const topicQuery = upperStudent
          ? (supabase as any).from("upper_student_topic_progress").select("subject,topic,accuracy_percentage,questions_attempted,correct_answers,last_practiced_at").eq("user_id", user.id)
          : supabase.from("topic_progress").select("*").eq("user_id", user.id);
        const activityStart = new Date();
        activityStart.setDate(activityStart.getDate() - 29);
        const [statsRes, topicsRes, streakRes, activityRes] = await Promise.all([
          supabase.rpc("get_user_stats", { p_user_id: user.id }),
          topicQuery,
          // A student with no recorded streak yet is a valid empty state.
          supabase.from("user_streaks").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("study_sessions").select("start_time,duration,status").eq("user_id", user.id).eq("status", "completed").gte("start_time", activityStart.toISOString()).order("start_time", { ascending: true }),
        ]);

        if (cancelled) return;

        setStats(statsRes.data ?? null);
        setTopicData(upperStudent
          ? (topicsRes.data || []).map((row: any) => ({ ...row, questions_correct: Number(row.correct_answers) || 0 }))
          : (topicsRes.data ?? []));
        setStreak(streakRes.data ?? null);
        const minutesByDay = new Map<string, number>();
        (activityRes.data || []).forEach((session: any) => {
          const day = String(session.start_time || "").slice(0, 10);
          if (!day) return;
          const minutes = Number(session.duration) || 0;
          minutesByDay.set(day, (minutesByDay.get(day) || 0) + Math.round(minutes));
        });
        setStudyActivity(Array.from({ length: 30 }, (_, index) => {
          const day = new Date(activityStart);
          day.setDate(activityStart.getDate() + index);
          const key = day.toISOString().slice(0, 10);
          return { date: key, minutes: minutesByDay.get(key) || 0 };
        }));
      } catch (error) {
        console.error("Academic insights data load failed:", error);
        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchAll();
    return () => { cancelled = true; };
  }, [user, retryKey]);

  const generateAIInsights = async () => {
    if (!user) return;
    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-academic-insights", {
        body: {
          stats,
          topicData,
          streak,
          grade: String(academicContext?.grade || normalizeGrade(user.grade, 12)),
          curriculum: academicContext?.curriculum,
          studyGoal: academicContext?.goal,
          book: academicContext?.book,
          subjects: academicContext?.subjects || [],
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
  const studyMinutesTotal = studyActivity.reduce((total, day) => total + day.minutes, 0);
  const maxStudyMinutes = Math.max(...studyActivity.map((day) => day.minutes), 1);

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
    { icon: <Clock className="h-5 w-5" />, label: "Study time", value: studyMinutesTotal >= 60 ? `${Math.floor(studyMinutesTotal / 60)}h ${studyMinutesTotal % 60}m` : `${studyMinutesTotal}m`, color: "text-primary" },
    { icon: <Target className="h-5 w-5" />, label: "Accuracy", value: `${Math.round(accuracy)}%`, color: accuracy >= 80 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-600" },
    { icon: <Zap className="h-5 w-5" />, label: "Quizzes Done", value: String(totalQuizzes), color: "text-primary" },
    { icon: <Calendar className="h-5 w-5" />, label: "Current Streak", value: `${currentStreak} days`, color: "text-orange-600" },
  ];

  return (
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]" : "tier-middle min-h-screen bg-slate-50/80 text-slate-950 pb-[calc(6rem+env(safe-area-inset-bottom))]"}>
      <header className={upperStudent ? "sticky top-0 z-50 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl" : "sticky top-0 z-50 border-b border-sky-700/20 bg-gradient-to-r from-sky-700 to-cyan-700 px-4 py-3 shadow-lg shadow-sky-900/10"}>
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className={upperStudent ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-white hover:bg-white/10"}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className={upperStudent ? "flex items-center gap-2 text-lg font-bold text-foreground" : "flex items-center gap-2 text-lg font-bold text-white"}>
            <TrendingUp className={`h-5 w-5 ${upperStudent ? "text-primary" : ""}`} /> Academic Insights
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:py-7">
        {loadError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Some learning insights could not be loaded.</p>
              <p className="mt-1 text-muted-foreground">Available data is still shown. Retry to reconnect before relying on incomplete totals.</p>
            </div>
            <Button variant="outline" className="min-h-10 shrink-0" onClick={() => setRetryKey((value) => value + 1)}>Retry insights</Button>
          </div>
        )}
        {/* Academic Rank */}
        <Card className={upperStudent ? "border-border/50 bg-card/80" : "overflow-hidden border-sky-200 bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-lg shadow-sky-900/10"}>
          <CardContent className="flex items-center gap-4 p-5 text-left sm:p-6">
            <div className={upperStudent ? "text-3xl" : "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl ring-1 ring-white/20"}>{academicRank.emoji}</div>
            <div>
              <h3 className="text-lg font-bold">{academicRank.title}</h3>
              <p className={upperStudent ? "text-xs text-muted-foreground" : "text-xs text-sky-100"}>{user?.xp || 0} XP earned · keep building your streak</p>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Button */}
        <Button
          className={upperStudent ? "h-12 w-full" : "h-12 w-full border-0 bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800"}
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
            <Card className={upperStudent ? "border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5" : "border-sky-200 bg-white shadow-sm"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-5 w-5 text-primary" />
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {insights.map((ins, i) => (
            <motion.div key={ins.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={upperStudent ? "border-border/50 bg-card/80" : "border-slate-200/80 bg-white shadow-sm"}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1 text-muted-foreground">{ins.icon}<span className="text-xs">{ins.label}</span></div>
                  <p className={`text-xl font-bold ${ins.color}`}>{ins.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className={upperStudent ? "border-border/50 bg-card/80" : "border-slate-200/80 bg-white shadow-sm"}>
          <CardContent className="p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-primary">STUDY ACTIVITY</p>
                <h3 className="mt-1 font-semibold">Consistency over the last 30 days</h3>
              </div>
              <Badge variant="outline">{studyActivity.filter((day) => day.minutes > 0).length} active days</Badge>
            </div>
            {studyActivity.some((day) => day.minutes > 0) ? (
              <>
                <div className="flex h-36 items-end gap-1 rounded-xl bg-muted/30 px-2 py-3 sm:gap-1.5">
                  {studyActivity.map((day) => (
                    <div key={day.date} className="group relative flex h-full flex-1 items-end" title={`${day.minutes} minutes`}>
                      <div className={`w-full rounded-t-sm transition-colors ${day.minutes > 0 ? "bg-primary/75 group-hover:bg-primary" : "bg-border/40"}`} style={{ height: `${day.minutes > 0 ? Math.max(8, (day.minutes / maxStudyMinutes) * 100) : 4}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{studyActivity[0]?.date}</span>
                  <span>Today</span>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">Your activity chart will appear after your first Study Mode session.</p>
                <Button className="mt-3" variant="outline" onClick={() => navigate("/study-mode")}>Start a study session</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={upperStudent ? "border-primary/20 bg-primary/[0.06]" : "border-sky-200 bg-sky-50/70"}>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your next best move</p><h3 className="mt-1 font-semibold">{weakest ? `Focus on ${weakest.subject}` : "Keep building your learning profile"}</h3><p className="mt-1 text-sm text-muted-foreground">{weakest ? `${weakest.subject} is currently at ${weakest.accuracy}% across ${weakest.total} attempted questions. A focused practice set can turn this gap into progress.` : "Complete a practice quiz to unlock subject-level guidance based on your real results."}</p></div></div>
            <Button variant="outline" className="shrink-0 bg-background" onClick={() => weakest ? navigate(`/quiz?subject=${encodeURIComponent(weakest.subject)}`) : navigate("/quiz/filter")}>{weakest ? "Practice this subject" : "Start practice"}</Button>
          </CardContent>
        </Card>

        {/* Subject Performance */}
        {subjectAccuracies.length > 0 && (
          <Card className={upperStudent ? "border-border/50 bg-card/80" : "border-slate-200/80 bg-white shadow-sm"}>
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

        {subjectAccuracies.length === 0 && (
          <Card className={upperStudent ? "border-dashed bg-card/80" : "border-dashed border-slate-300 bg-white"}>
            <CardContent className="p-6 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No subject performance yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Complete a practice quiz to start seeing strengths and focus areas here.</p>
              <Button className="mt-4" onClick={() => navigate("/quiz/filter")}>Start practice</Button>
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
        <Card className={upperStudent ? "border-border/50 bg-card/80" : "border-slate-200/80 bg-white shadow-sm"}>
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
