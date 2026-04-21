import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useUser } from "@/context/UserContext";
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
import { AlertTriangle, Award, BookOpen, CalendarClock, Check, Clock3, Flame, Home, LogOut, Plus, Save, Trash2, TrendingDown, TrendingUp, UserCheck } from "lucide-react";

type QuizRow = {
  id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  completed_at: string | null;
  xp_earned: number | null;
  quiz_id: string;
};

type StudySessionRow = {
  id: string;
  created_at: string;
  duration: number | null;
  planned_duration: number | null;
  status: "active" | "completed";
};

type ParentTask = {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: "pending" | "completed";
  created_by: string;
  is_required: boolean;
  created_at: string;
};

const db = supabase as any;

const toDateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const ParentDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const [loadingData, setLoadingData] = useState(true);
  const [quizResults, setQuizResults] = useState<QuizRow[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRow[]>([]);
  const [tasks, setTasks] = useState<ParentTask[]>([]);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [classRank, setClassRank] = useState<number | null>(null);
  const [classSize, setClassSize] = useState<number>(0);
  const [positionDelta, setPositionDelta] = useState<number>(0);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskRequired, setTaskRequired] = useState(true);

  const isParentMode = localStorage.getItem("masterminds_login_mode") === "parent";

  const handleLeaveParentPortal = () => {
    localStorage.removeItem("masterminds_login_mode");
    toast.success("Exited parent view.");
    window.location.href = "/";
  };

  const handleSignOut = async () => {
    await logout();
    window.location.href = "/";
  };

  const loadAll = async () => {
    if (!user?.id) return;
    setLoadingData(true);

    const [quizRes, studyRes, tasksRes, leaderboardRes, classMembershipRes] = await Promise.all([
      supabase
        .from("quiz_results")
        .select("id,score,correct_answers,total_questions,completed_at,xp_earned,quiz_id")
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(60),
      db
        .from("study_sessions")
        .select("id,created_at,duration,planned_duration,status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(120),
      db
        .from("parent_tasks")
        .select("id,student_id,title,description,deadline,status,created_by,is_required,created_at")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_public_leaderboard", { limit_count: 500, timeframe: "all" }),
      supabase.from("class_students").select("class_id").eq("student_id", user.id).limit(1),
    ]);

    if (quizRes.error) toast.error(quizRes.error.message);
    if (studyRes.error) toast.error(studyRes.error.message);
    if (tasksRes.error) toast.error(tasksRes.error.message);
    if (leaderboardRes.error) toast.error(leaderboardRes.error.message);

    setQuizResults((quizRes.data ?? []) as QuizRow[]);
    setStudySessions((studyRes.data ?? []) as StudySessionRow[]);
    setTasks((tasksRes.data ?? []) as ParentTask[]);

    const leaderboard = (leaderboardRes.data ?? []) as Array<{ id: string; xp: number }>;
    const currentIndex = leaderboard.findIndex((row) => row.id === user.id);
    setGlobalRank(currentIndex >= 0 ? currentIndex + 1 : null);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentXp = (quizRes.data ?? []).reduce((acc: number, row: QuizRow) => {
      if (!row.completed_at) return acc;
      return new Date(row.completed_at) >= sevenDaysAgo ? acc + (row.xp_earned ?? 0) : acc;
    }, 0);

    if (currentIndex >= 0) {
      const simulatedOldXp = Math.max(0, user.xp - recentXp);
      const previousPosition = leaderboard.filter((row) => row.xp > simulatedOldXp).length + 1;
      setPositionDelta(previousPosition - (currentIndex + 1));
    }

    const classId = classMembershipRes.data?.[0]?.class_id;
    if (classId) {
      const { data: classmates } = await supabase.from("class_students").select("student_id").eq("class_id", classId);
      const classmateIds = (classmates ?? []).map((c: any) => c.student_id);

      if (classmateIds.length > 0) {
        const { data: classProfiles } = await supabase.from("profiles").select("id,xp").in("id", classmateIds);
        const sorted = (classProfiles ?? []).sort((a: any, b: any) => b.xp - a.xp);
        const rankIndex = sorted.findIndex((p: any) => p.id === user.id);
        setClassRank(rankIndex >= 0 ? rankIndex + 1 : null);
        setClassSize(sorted.length);
      }
    }

    setLoadingData(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    void loadAll();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`parent-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_results", filter: `student_id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions", filter: `user_id=eq.${user.id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "parent_tasks", filter: `student_id=eq.${user.id}` }, () => void loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const averageScore = useMemo(() => {
    if (quizResults.length === 0) return 0;
    const total = quizResults.reduce((sum, row) => sum + row.score, 0);
    return Math.round(total / quizResults.length);
  }, [quizResults]);

  const accuracyPercent = useMemo(() => {
    const correct = quizResults.reduce((sum, row) => sum + row.correct_answers, 0);
    const total = quizResults.reduce((sum, row) => sum + row.total_questions, 0);
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }, [quizResults]);

  const weeklyStudyMinutes = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7);
    return studySessions.reduce((sum, row) => {
      if (new Date(row.created_at) < threshold) return sum;
      return sum + (row.duration ?? row.planned_duration ?? 0);
    }, 0);
  }, [studySessions]);

  const dailyStudyMinutes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return studySessions.reduce((sum, row) => {
      if (toDateOnly(row.created_at) !== today) return sum;
      return sum + (row.duration ?? row.planned_duration ?? 0);
    }, 0);
  }, [studySessions]);

  const sessionsPerDay = useMemo(() => {
    const map = new Map<string, number>();
    studySessions.forEach((row) => {
      const key = toDateOnly(row.created_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    if (map.size === 0) return 0;
    return Number((studySessions.length / map.size).toFixed(1));
  }, [studySessions]);

  const focusConsistency = useMemo(() => {
    const recent = new Set<string>();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7);

    studySessions.forEach((row) => {
      if (new Date(row.created_at) >= threshold) recent.add(toDateOnly(row.created_at));
    });

    return Math.round((recent.size / 7) * 100);
  }, [studySessions]);

  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const pendingTasks = tasks.filter((task) => task.status === "pending").length;
  const overdueTasks = tasks.filter((task) => task.status === "pending" && task.deadline && new Date(task.deadline) < new Date()).length;

  const performanceStatus = useMemo(() => {
    if (accuracyPercent >= 85 && weeklyStudyMinutes >= 300) return "Excellent";
    if (accuracyPercent >= 60 && weeklyStudyMinutes >= 120) return "متوسط";
    return "Needs Improvement";
  }, [accuracyPercent, weeklyStudyMinutes]);

  const quickAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (weeklyStudyMinutes < 120) alerts.push("Low activity warning: less than 2 study hours this week.");
    if (overdueTasks > 0) alerts.push(`Missed tasks: ${overdueTasks} task(s) are overdue.`);
    if (positionDelta < 0) alerts.push(`Rank dropped by ${Math.abs(positionDelta)} position(s).`);
    return alerts;
  }, [weeklyStudyMinutes, overdueTasks, positionDelta]);

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskDeadline("");
    setTaskRequired(true);
    setEditingTaskId(null);
  };

  const openCreateTask = () => {
    resetTaskForm();
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: ParentTask) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskDeadline(task.deadline ? task.deadline.slice(0, 10) : "");
    setTaskRequired(task.is_required);
    setTaskDialogOpen(true);
  };

  const saveTask = async () => {
    if (!user?.id || !taskTitle.trim()) {
      toast.error("Task title is required.");
      return;
    }

    const payload = {
      student_id: user.id,
      title: taskTitle.trim(),
      description: taskDescription.trim() || null,
      deadline: taskDeadline || null,
      status: "pending",
      created_by: "parent",
      is_required: taskRequired,
    };

    if (editingTaskId) {
      const { error } = await db.from("parent_tasks").update({ ...payload, status: undefined }).eq("id", editingTaskId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Task updated.");
    } else {
      const { error } = await db.from("parent_tasks").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Task created.");
    }

    setTaskDialogOpen(false);
    resetTaskForm();
    await loadAll();
  };

  const toggleTaskStatus = async (task: ParentTask) => {
    const nextStatus = task.status === "pending" ? "completed" : "pending";
    const { error } = await db.from("parent_tasks").update({ status: nextStatus }).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadAll();
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await db.from("parent_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task deleted.");
    await loadAll();
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (!isParentMode) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground variant="minimal" />

      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold">Parent Portal</h1>
              <p className="text-sm text-muted-foreground">Live monitoring dashboard for {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Parent View Mode</Badge>
            <Button variant="outline" size="sm" onClick={handleLeaveParentPortal}>
              <Home className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Name</CardDescription><CardTitle className="text-base">{user.name}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Level</CardDescription><CardTitle>{user.level}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total XP</CardDescription><CardTitle>{user.xp}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Global Rank</CardDescription><CardTitle>{globalRank ? `#${globalRank}` : "—"}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Class Rank</CardDescription><CardTitle>{classRank ? `#${classRank}/${classSize}` : "—"}</CardTitle></CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Progress & Stats</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Quiz accuracy: <b>{accuracyPercent}%</b></p>
              <Progress value={accuracyPercent} />
              <p>Average score: <b>{averageScore}%</b></p>
              <p>Completed tasks: <b>{completedTasks}</b></p>
              <p>Weekly study time: <b>{(weeklyStudyMinutes / 60).toFixed(1)}h</b></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Study Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Today: <b>{dailyStudyMinutes} min</b></p>
              <p>This week: <b>{weeklyStudyMinutes} min</b></p>
              <p>Sessions/day: <b>{sessionsPerDay}</b></p>
              <p>Focus consistency: <b>{focusConsistency}%</b></p>
              <Progress value={focusConsistency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-4 w-4" /> Leaderboard Status</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2">Current rank: <b>{globalRank ? `#${globalRank}` : "N/A"}</b></p>
              <p className="flex items-center gap-2">
                Position change:
                {positionDelta >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
                <b>{positionDelta >= 0 ? `+${positionDelta}` : positionDelta}</b>
              </p>
              <p>Performance status: <Badge>{performanceStatus}</Badge></p>
              <p className="text-muted-foreground">Weekly summary: Your child studied {(weeklyStudyMinutes / 60).toFixed(1)}h this week and changed rank by {positionDelta >= 0 ? `+${positionDelta}` : positionDelta}.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Smart Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {quickAlerts.length === 0 ? (
              <p className="text-emerald-600">No active alerts. Everything looks stable.</p>
            ) : (
              quickAlerts.map((alert) => <p key={alert}>• {alert}</p>)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Results / Quiz History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quizResults.slice(0, 8).map((row) => (
              <div key={row.id} className="border rounded-md p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">Quiz #{row.quiz_id.slice(0, 8)}</p>
                  <p className="text-muted-foreground">{row.completed_at ? new Date(row.completed_at).toLocaleString() : "In progress"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{row.score}%</p>
                  <p className="text-muted-foreground">{row.correct_answers}/{row.total_questions} correct</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Parent To-Do Tasks</CardTitle>
              <CardDescription>Parent-controlled task list with live sync.</CardDescription>
            </div>
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateTask}><Plus className="h-4 w-4 mr-2" />Add Task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTaskId ? "Edit task" : "Create parent task"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Math revision" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Cover chapter 5 and solve 10 questions." />
                  </div>
                  <div className="space-y-2">
                    <Label>Deadline</Label>
                    <Input type="date" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={taskRequired} onChange={(e) => setTaskRequired(e.target.checked)} />
                    Mark as required
                  </label>
                </div>
                <DialogFooter>
                  <Button onClick={saveTask}><Save className="h-4 w-4 mr-2" />Save Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-muted-foreground">Pending: {pendingTasks} • Completed: {completedTasks}</div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet. Add your first parent task.</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="border rounded-md p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {task.status === "completed" ? <Check className="h-4 w-4 text-emerald-600" /> : <CalendarClock className="h-4 w-4 text-amber-600" />}
                      {task.title}
                      {task.is_required && <Badge variant="destructive">Required</Badge>}
                    </p>
                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString() : "Not set"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleTaskStatus(task)}>{task.status === "pending" ? "Mark Done" : "Re-open"}</Button>
                    <Button variant="outline" size="sm" onClick={() => openEditTask(task)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteTask(task.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {loadingData && (
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Flame className="h-4 w-4 animate-pulse" />
            Updating live metrics...
          </div>
        )}
      </main>
    </div>
  );
};

export default ParentDashboard;
