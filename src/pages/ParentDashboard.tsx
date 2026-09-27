import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/ui/BackButton";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Award, BookOpen, CalendarClock, Check, Clock3, Flame, Heart, Home,
  LogOut, MessageCircle, Plus, Save, Send, Sparkles, Target, Trash2, TrendingDown,
  TrendingUp, Trophy, UserCheck, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "framer-motion";

type QuizRow = { id: string; score: number; correct_answers: number; total_questions: number; completed_at: string | null; xp_earned: number | null; quiz_id: string; subject?: string | null; };
type StudySessionRow = { id: string; created_at: string; duration: number | null; planned_duration: number | null; status: string; };
type ParentTask = { id: string; student_id: string; title: string; description: string | null; deadline: string | null; status: string; created_by: string; is_required: boolean; created_at: string; };
type ParentMessage = { id: string; student_id: string; message: string; emoji: string | null; read: boolean; created_at: string; };
type ParentGoals = { student_id: string; daily_study_minutes: number; weekly_quiz_target: number; daily_xp_target: number; bedtime_hour: number | null; };

const db = supabase as any;
const toDateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const ParentDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const [loadingData, setLoadingData] = useState(true);
  const [quizResults, setQuizResults] = useState<QuizRow[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRow[]>([]);
  const [tasks, setTasks] = useState<ParentTask[]>([]);
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [goals, setGoals] = useState<ParentGoals>({ student_id: "", daily_study_minutes: 60, weekly_quiz_target: 10, daily_xp_target: 200, bedtime_hour: null });
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [classRank, setClassRank] = useState<number | null>(null);
  const [classSize, setClassSize] = useState(0);
  const [positionDelta, setPositionDelta] = useState(0);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskRequired, setTaskRequired] = useState(true);

  const [newMessage, setNewMessage] = useState("");
  const [messageEmoji, setMessageEmoji] = useState("💪");

  const [aiInsights, setAiInsights] = useState<any>(null);
  const [earlyProgress, setEarlyProgress] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const isParentMode = localStorage.getItem("masterminds_login_mode") === "parent";
  const isEarlyStudent = getUserTier(user?.grade) === "early";

  const handleLeaveParentPortal = () => { localStorage.removeItem("masterminds_login_mode"); toast.success("Exited parent view."); window.location.href = "/"; };
  const handleSignOut = async () => { await logout(); window.location.href = "/"; };

  const loadAll = async () => {
    if (!user?.id) return;
    setLoadingData(true);
    const [quizRes, studyRes, tasksRes, msgRes, goalsRes, leaderboardRes, classMembershipRes, earlyProgressRes] = await Promise.all([
      supabase.from("quiz_results").select("id,score,correct_answers,total_questions,completed_at,xp_earned,quiz_id").eq("student_id", user.id).order("completed_at", { ascending: false }).limit(60),
      db.from("study_sessions").select("id,created_at,duration,planned_duration,status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(120),
      db.from("parent_tasks").select("*").eq("student_id", user.id).order("created_at", { ascending: false }),
      db.from("parent_messages").select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(20),
      db.from("parent_goals").select("*").eq("student_id", user.id).maybeSingle(),
      supabase.rpc("get_public_leaderboard", { limit_count: 500, timeframe: "all" }),
      supabase.from("class_students").select("class_id").eq("student_id", user.id).limit(1),
      db.from("early_activity_progress").select("activity_id,skill,attempts,correct_answers,completions,xp_earned").eq("user_id", user.id),
    ]);

    setQuizResults((quizRes.data ?? []) as QuizRow[]);
    setStudySessions((studyRes.data ?? []) as StudySessionRow[]);
    setTasks((tasksRes.data ?? []) as ParentTask[]);
    setMessages((msgRes.data ?? []) as ParentMessage[]);
    setEarlyProgress((earlyProgressRes.data ?? []) as any[]);
    if (goalsRes.data) setGoals(goalsRes.data);

    const leaderboard = (leaderboardRes.data ?? []) as Array<{ id: string; xp: number }>;
    const currentIndex = leaderboard.findIndex((r) => r.id === user.id);
    setGlobalRank(currentIndex >= 0 ? currentIndex + 1 : null);
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const recentXp = (quizRes.data ?? []).reduce((a: number, r: QuizRow) => r.completed_at && new Date(r.completed_at) >= sevenAgo ? a + (r.xp_earned ?? 0) : a, 0);
    if (currentIndex >= 0) {
      const oldXp = Math.max(0, user.xp - recentXp);
      setPositionDelta(leaderboard.filter(r => r.xp > oldXp).length + 1 - (currentIndex + 1));
    }

    const classId = classMembershipRes.data?.[0]?.class_id;
    if (classId) {
      const { data: classmates } = await supabase.from("class_students").select("student_id").eq("class_id", classId);
      const ids = (classmates ?? []).map((c: any) => c.student_id);
      if (ids.length > 0) {
        const { data: cps } = await supabase.from("profiles").select("id,xp").in("id", ids);
        const sorted = (cps ?? []).sort((a: any, b: any) => b.xp - a.xp);
        const ri = sorted.findIndex((p: any) => p.id === user.id);
        setClassRank(ri >= 0 ? ri + 1 : null);
        setClassSize(sorted.length);
      }
    }
    setLoadingData(false);
  };

  useEffect(() => { if (user?.id) void loadAll(); }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`parent-dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_results", filter: `student_id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions", filter: `user_id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "parent_tasks", filter: `student_id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "parent_messages", filter: `student_id=eq.${user.id}` }, () => void loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Derived metrics
  const averageScore = useMemo(() => quizResults.length === 0 ? 0 : Math.round(quizResults.reduce((s, r) => s + r.score, 0) / quizResults.length), [quizResults]);
  const accuracyPercent = useMemo(() => {
    const c = quizResults.reduce((s, r) => s + r.correct_answers, 0);
    const t = quizResults.reduce((s, r) => s + r.total_questions, 0);
    return t ? Math.round((c / t) * 100) : 0;
  }, [quizResults]);
  const weeklyStudyMinutes = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() - 7);
    return studySessions.reduce((s, r) => new Date(r.created_at) < t ? s : s + (r.duration ?? r.planned_duration ?? 0), 0);
  }, [studySessions]);
  const dailyStudyMinutes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return studySessions.reduce((s, r) => toDateOnly(r.created_at) !== today ? s : s + (r.duration ?? r.planned_duration ?? 0), 0);
  }, [studySessions]);
  const focusConsistency = useMemo(() => {
    const recent = new Set<string>(); const t = new Date(); t.setDate(t.getDate() - 7);
    studySessions.forEach(r => { if (new Date(r.created_at) >= t) recent.add(toDateOnly(r.created_at)); });
    return Math.round((recent.size / 7) * 100);
  }, [studySessions]);
  const earlyAttempts = earlyProgress.reduce((s,r)=>s+(r.attempts||0),0);
  const earlyCorrect = earlyProgress.reduce((s,r)=>s+(r.correct_answers||0),0);
  const earlyAccuracy = earlyAttempts ? Math.round(earlyCorrect/earlyAttempts*100) : 0;
  const earlyCompletions = earlyProgress.reduce((s,r)=>s+(r.completions||0),0);
  const earlySkills = Array.from(new Set(earlyProgress.map(r=>r.skill))).length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const overdueTasks = tasks.filter(t => t.status === "pending" && t.deadline && new Date(t.deadline) < new Date()).length;
  const dailyXP = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return quizResults.reduce((s, r) => r.completed_at && toDateOnly(r.completed_at) === today ? s + (r.xp_earned ?? 0) : s, 0);
  }, [quizResults]);

  // 7-day chart data
  const weeklyChart = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const studyMin = studySessions.filter(s => toDateOnly(s.created_at) === key).reduce((a, s) => a + (s.duration ?? s.planned_duration ?? 0), 0);
      const xp = quizResults.filter(q => q.completed_at && toDateOnly(q.completed_at) === key).reduce((a, q) => a + (q.xp_earned ?? 0), 0);
      const quizzes = quizResults.filter(q => q.completed_at && toDateOnly(q.completed_at) === key).length;
      return { day: label, study: studyMin, xp, quizzes };
    });
    return days;
  }, [studySessions, quizResults]);

  const performanceStatus = accuracyPercent >= 85 && weeklyStudyMinutes >= 300 ? "Excellent" : accuracyPercent >= 60 && weeklyStudyMinutes >= 120 ? "On track" : "Needs attention";
  const quickAlerts = useMemo(() => {
    const a: string[] = [];
    if (weeklyStudyMinutes < 120) a.push("Low activity: less than 2 study hours this week.");
    if (overdueTasks > 0) a.push(`${overdueTasks} parent task(s) overdue.`);
    if (positionDelta < 0) a.push(`Rank dropped by ${Math.abs(positionDelta)} position(s).`);
    if (dailyStudyMinutes < goals.daily_study_minutes / 2 && new Date().getHours() >= 18) a.push("Daily study goal not met yet today.");
    return a;
  }, [weeklyStudyMinutes, overdueTasks, positionDelta, dailyStudyMinutes, goals.daily_study_minutes]);

  // Tasks
  const resetTaskForm = () => { setTaskTitle(""); setTaskDescription(""); setTaskDeadline(""); setTaskRequired(true); setEditingTaskId(null); };
  const openCreateTask = () => { resetTaskForm(); setTaskDialogOpen(true); };
  const openEditTask = (t: ParentTask) => { setEditingTaskId(t.id); setTaskTitle(t.title); setTaskDescription(t.description ?? ""); setTaskDeadline(t.deadline ? t.deadline.slice(0, 10) : ""); setTaskRequired(t.is_required); setTaskDialogOpen(true); };
  const saveTask = async () => {
    if (!user?.id || !taskTitle.trim()) { toast.error("Task title is required."); return; }
    const payload: any = { student_id: user.id, title: taskTitle.trim(), description: taskDescription.trim() || null, deadline: taskDeadline || null, created_by: "parent", is_required: taskRequired };
    if (editingTaskId) {
      const { error } = await db.from("parent_tasks").update(payload).eq("id", editingTaskId);
      if (error) { toast.error(error.message); return; }
      toast.success("Task updated.");
    } else {
      payload.status = "pending";
      const { error } = await db.from("parent_tasks").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Task created.");
    }
    setTaskDialogOpen(false); resetTaskForm(); await loadAll();
  };
  const toggleTaskStatus = async (t: ParentTask) => {
    const { error } = await db.from("parent_tasks").update({ status: t.status === "pending" ? "completed" : "pending" }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    await loadAll();
  };
  const deleteTask = async (id: string) => {
    const { error } = await db.from("parent_tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted."); await loadAll();
  };

  // Messages
  const sendMessage = async () => {
    if (!user?.id || !newMessage.trim()) { toast.error("Write a message first."); return; }
    const { error } = await db.from("parent_messages").insert({ student_id: user.id, message: newMessage.trim(), emoji: messageEmoji });
    if (error) { toast.error(error.message); return; }
    setNewMessage(""); toast.success("Message sent to your child! 💌"); await loadAll();
  };
  const deleteMessage = async (id: string) => {
    await db.from("parent_messages").delete().eq("id", id); await loadAll();
  };

  // Goals
  const saveGoals = async () => {
    if (!user?.id) return;
    const { error } = await db.from("parent_goals").upsert({ ...goals, student_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Goals saved.");
  };

  // AI Insights
  const generateInsights = async () => {
    if (!user?.id) return;
    setAiLoading(true);
    try {
      const summary = `Student ${user.name} (Level ${user.level}, ${user.xp} XP). This week: ${(weeklyStudyMinutes / 60).toFixed(1)}h studied, ${quizResults.filter(q => q.completed_at && new Date(q.completed_at) > new Date(Date.now() - 7 * 86400000)).length} quizzes, accuracy ${accuracyPercent}%, focus consistency ${focusConsistency}%, rank change ${positionDelta}. Daily goal: ${goals.daily_study_minutes} min.`;
      const { data, error } = await supabase.functions.invoke("ai-helper", {
        body: {
          mode: "explain",
          messages: [{ role: "user", content: `You are an educational coach speaking directly to a parent. Based on this weekly data, give a warm 4-paragraph report: (1) one-line headline of how the child is doing, (2) two specific strengths, (3) two areas to support and concrete actions the parent can take this week, (4) a short motivating message for the parent. Use markdown headings and bullet lists. Data: ${summary}` }],
        },
      });
      if (error) throw error;
      setAiInsights(data.response);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate insights");
    } finally { setAiLoading(false); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated || !user) return <Navigate to="/" replace />;
  if (!isParentMode) return <Navigate to="/" replace />;

  const initials = (user.name || "S").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
  const goalProgress = Math.min(100, Math.round((dailyStudyMinutes / Math.max(1, goals.daily_study_minutes)) * 100));
  const xpGoalProgress = Math.min(100, Math.round((dailyXP / Math.max(1, goals.daily_xp_target)) * 100));

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground variant="minimal" />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" /> Parent Portal
              </h1>
              <p className="text-xs text-muted-foreground">Live monitoring · Smart insights · Coaching tools</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">Parent View</Badge>
            <Button variant="outline" size="sm" onClick={handleLeaveParentPortal}><Home className="h-4 w-4 mr-2" />Exit</Button>
            <Button variant="destructive" size="sm" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/15 via-accent/10 to-secondary/10 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="relative">
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-xl">
                    {initials}
                  </div>
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white border-0">
                    <Trophy className="h-3 w-3 mr-1" />Lv {user.level}
                  </Badge>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                  <p className="text-sm text-muted-foreground">{user.xp.toLocaleString()} XP · Rank {globalRank ? `#${globalRank}` : "—"} {classRank && `· Class #${classRank}/${classSize}`}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-lg bg-background/60 backdrop-blur p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock3 className="h-3 w-3" />Today</div>
                      <div className="text-lg font-bold">{dailyStudyMinutes}<span className="text-xs font-normal"> min</span></div>
                    </div>
                    <div className="rounded-lg bg-background/60 backdrop-blur p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Zap className="h-3 w-3" />Today XP</div>
                      <div className="text-lg font-bold">{dailyXP}</div>
                    </div>
                    <div className="rounded-lg bg-background/60 backdrop-blur p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Target className="h-3 w-3" />Accuracy</div>
                      <div className="text-lg font-bold">{accuracyPercent}%</div>
                    </div>
                    <div className="rounded-lg bg-background/60 backdrop-blur p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Flame className="h-3 w-3" />Week</div>
                      <div className="text-lg font-bold">{(weeklyStudyMinutes / 60).toFixed(1)}h</div>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-56 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span>Daily study goal</span><span className="font-bold">{goalProgress}%</span></div>
                    <Progress value={goalProgress} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span>Daily XP goal</span><span className="font-bold">{xpGoalProgress}%</span></div>
                    <Progress value={xpGoalProgress} className="h-2" />
                  </div>
                  <Badge variant={performanceStatus === "Excellent" ? "default" : performanceStatus === "On track" ? "secondary" : "destructive"} className="w-full justify-center py-1">
                    {performanceStatus}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alerts */}
        {quickAlerts.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-amber-600 text-base"><AlertTriangle className="h-4 w-4" />Smart Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">{quickAlerts.map(a => <p key={a}>• {a}</p>)}</CardContent>
          </Card>
        )}

        {isEarlyStudent && <Card className="mb-6 border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>Early Learning Snapshot</CardTitle><CardDescription>Play-based progress from Master Minds activities.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Skills</p><p className="text-2xl font-bold">{earlySkills}</p></div><div><p className="text-xs text-muted-foreground">Accuracy</p><p className="text-2xl font-bold">{earlyAccuracy}%</p></div><div><p className="text-xs text-muted-foreground">Activities</p><p className="text-2xl font-bold">{earlyCompletions}</p></div><div><p className="text-xs text-muted-foreground">Attempts</p><p className="text-2xl font-bold">{earlyAttempts}</p></div></div><div className="mt-4 space-y-2">{earlyProgress.slice(0,5).map(r=><div key={r.activity_id} className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-medium">{String(r.skill).replace(/-/g," ")}</span><span className="text-sm text-muted-foreground">{r.correct_answers}/{r.attempts}</span></div>)}</div></CardContent></Card>}
<Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="insights"><Sparkles className="h-4 w-4 mr-1.5" />Insights</TabsTrigger>
            <TabsTrigger value="activity"><TrendingUp className="h-4 w-4 mr-1.5" />Activity</TabsTrigger>
            <TabsTrigger value="tasks"><UserCheck className="h-4 w-4 mr-1.5" />Tasks</TabsTrigger>
            <TabsTrigger value="messages"><MessageCircle className="h-4 w-4 mr-1.5" />Messages</TabsTrigger>
            <TabsTrigger value="goals"><Target className="h-4 w-4 mr-1.5" />Goals</TabsTrigger>
          </TabsList>

          {/* AI Insights */}
          <TabsContent value="insights" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Weekly Coach Report</CardTitle>
                  <CardDescription>Personalized insights from your child's learning data.</CardDescription>
                </div>
                <Button onClick={generateInsights} disabled={aiLoading}>
                  {aiLoading ? "Generating…" : aiInsights ? "Regenerate" : "Generate Report"}
                </Button>
              </CardHeader>
              <CardContent>
                {aiInsights ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{aiInsights}</div>
                ) : (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <Sparkles className="h-10 w-10 mx-auto mb-2 text-primary/50" />
                    Click <b>Generate Report</b> for an AI-powered weekly summary tailored to your child.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Performance</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Avg score: <b>{averageScore}%</b></p>
                  <p>Accuracy: <b>{accuracyPercent}%</b></p>
                  <p>Quizzes: <b>{quizResults.length}</b></p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock3 className="h-4 w-4" />Habits</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Focus consistency: <b>{focusConsistency}%</b></p>
                  <p>Sessions/week: <b>{studySessions.filter(s => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000)).length}</b></p>
                  <p>Weekly minutes: <b>{weeklyStudyMinutes}</b></p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4" />Ranking</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Global: <b>{globalRank ? `#${globalRank}` : "—"}</b></p>
                  <p>Class: <b>{classRank ? `#${classRank}/${classSize}` : "—"}</b></p>
                  <p className="flex items-center gap-1">Change:
                    {positionDelta >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
                    <b>{positionDelta >= 0 ? `+${positionDelta}` : positionDelta}</b>
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Daily Study Minutes (7 days)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="study" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">XP Earned (7 days)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={weeklyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Line type="monotone" dataKey="xp" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="quizzes" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Recent Quiz Results</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {quizResults.length === 0 ? <p className="text-sm text-muted-foreground">No quiz history yet.</p> :
                  quizResults.slice(0, 8).map(r => (
                    <div key={r.id} className="border rounded-md p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">Quiz #{r.quiz_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString() : "In progress"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${r.score >= 80 ? 'text-emerald-500' : r.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{r.score}%</p>
                        <p className="text-xs text-muted-foreground">{r.correct_answers}/{r.total_questions}</p>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks */}
          <TabsContent value="tasks" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><UserCheck className="h-4 w-4" />Parent Tasks</CardTitle>
                  <CardDescription>Pending: {pendingTasks} · Completed: {completedTasks} · Overdue: {overdueTasks}</CardDescription>
                </div>
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild><Button onClick={openCreateTask}><Plus className="h-4 w-4 mr-2" />Add Task</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingTaskId ? "Edit task" : "Create parent task"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2"><Label>Title</Label><Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Math revision" /></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Cover chapter 5 and solve 10 questions." /></div>
                      <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} /></div>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskRequired} onChange={e => setTaskRequired(e.target.checked)} />Mark as required</label>
                    </div>
                    <DialogFooter><Button onClick={saveTask}><Save className="h-4 w-4 mr-2" />Save Task</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks yet. Add the first one.</p> :
                  tasks.map(t => (
                    <div key={t.id} className="border rounded-md p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {t.status === "completed" ? <Check className="h-4 w-4 text-emerald-600" /> : <CalendarClock className="h-4 w-4 text-amber-600" />}
                          {t.title}
                          {t.is_required && <Badge variant="destructive">Required</Badge>}
                          {t.status === "completed" && <Badge variant="secondary">Done</Badge>}
                        </p>
                        {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Deadline: {t.deadline ? new Date(t.deadline).toLocaleDateString() : "—"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleTaskStatus(t)}>{t.status === "pending" ? "Mark Done" : "Re-open"}</Button>
                        <Button variant="outline" size="sm" onClick={() => openEditTask(t)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteTask(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages */}
          <TabsContent value="messages" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />Send an Encouragement</CardTitle>
                <CardDescription>Your child sees these as little notes from you. Powerful motivation 💌</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {["💪", "🌟", "❤️", "🎉", "🙏", "🦁", "🚀", "🧠"].map(e => (
                    <button key={e} onClick={() => setMessageEmoji(e)}
                      className={`text-2xl p-2 rounded-lg border transition ${messageEmoji === e ? "border-primary bg-primary/10 scale-110" : "border-border hover:bg-muted"}`}>{e}</button>
                  ))}
                </div>
                <Textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="So proud of how hard you worked today!" rows={3} />
                <Button onClick={sendMessage} className="w-full"><Send className="h-4 w-4 mr-2" />Send to {user.name?.split(" ")[0]}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Recent Messages</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> :
                  messages.map(m => (
                    <div key={m.id} className="border rounded-lg p-3 flex items-start gap-3">
                      <div className="text-3xl">{m.emoji || "💬"}</div>
                      <div className="flex-1">
                        <p className="text-sm">{m.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()} · {m.read ? "Read" : "Unread"}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteMessage(m.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Goals */}
          <TabsContent value="goals" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />Daily & Weekly Goals</CardTitle>
                <CardDescription>Set healthy targets to keep your child consistent.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Daily study minutes</Label>
                    <Input type="number" min={10} max={480} value={goals.daily_study_minutes} onChange={e => setGoals({ ...goals, daily_study_minutes: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Daily XP target</Label>
                    <Input type="number" min={50} max={2000} value={goals.daily_xp_target} onChange={e => setGoals({ ...goals, daily_xp_target: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Weekly quiz target</Label>
                    <Input type="number" min={1} max={100} value={goals.weekly_quiz_target} onChange={e => setGoals({ ...goals, weekly_quiz_target: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Bedtime hour (0-23, optional reminder)</Label>
                    <Input type="number" min={0} max={23} value={goals.bedtime_hour ?? ""} onChange={e => setGoals({ ...goals, bedtime_hour: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <Button onClick={saveGoals}><Save className="h-4 w-4 mr-2" />Save Goals</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loadingData && (
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Flame className="h-4 w-4 animate-pulse" />Updating live metrics…
          </div>
        )}
      </main>
    </div>
  );
};

export default ParentDashboard;
