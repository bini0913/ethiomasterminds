import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { ArrowLeft, Brain, Check, Clock, Flame, Pause, Play, RotateCcw, StopCircle, Trophy, Users, Zap } from "lucide-react";

type StudyMode = "pomodoro" | "deep" | "custom";
type TimerState = "idle" | "running" | "paused" | "break" | "completed";

type StudySession = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  planned_duration: number | null;
  mode: StudyMode | null;
  status: "active" | "completed";
  created_at: string;
  competition_id: string | null;
};

type StudyTask = {
  id: string;
  user_id: string;
  task_title: string;
  completed: boolean;
  created_at: string;
};

type StudyCompetition = {
  id: string;
  name: string;
  created_by: string;
  start_time: string;
  end_time: string | null;
  status: "active" | "ended";
  created_at: string;
};

type StudyParticipant = {
  id: string;
  competition_id: string;
  user_id: string;
  total_study_time: number;
};

type StudyLiveStatus = {
  user_id: string;
  is_studying: boolean;
  current_session_start: string | null;
};

type StudySettings = {
  user_id: string;
  default_study_time: number;
  default_break_time: number;
  auto_start_break: boolean;
};

const db = supabase as any;

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const clampMinutes = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

const StudyModePage: React.FC = () => {
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [competitions, setCompetitions] = useState<StudyCompetition[]>([]);
  const [participants, setParticipants] = useState<StudyParticipant[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<StudyLiveStatus[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const [settings, setSettings] = useState<StudySettings | null>(null);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [mode, setMode] = useState<StudyMode>("pomodoro");
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [sessionTargetSeconds, setSessionTargetSeconds] = useState(25 * 60);
  const [breakTargetSeconds, setBreakTargetSeconds] = useState(5 * 60);
  const [countdownSeconds, setCountdownSeconds] = useState(25 * 60);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [markTaskOnComplete, setMarkTaskOnComplete] = useState(true);

  const [taskTitle, setTaskTitle] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");

  const activeCompetitions = useMemo(
    () => competitions.filter((competition) => competition.status === "active"),
    [competitions]
  );

  const progressPercent = useMemo(() => {
    const total = timerState === "break" ? breakTargetSeconds : sessionTargetSeconds;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, ((total - countdownSeconds) / total) * 100));
  }, [timerState, breakTargetSeconds, sessionTargetSeconds, countdownSeconds]);

  const editableTimer = timerState === "idle" || timerState === "completed";

  const loadNames = async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      setMemberNames({});
      return;
    }

    const { data, error } = await db.from("profiles").select("id,name,username").in("id", uniqueIds);
    if (error || !data) return;

    const nextNames = data.reduce((acc: Record<string, string>, row: { id: string; name: string | null; username: string | null }) => {
      acc[row.id] = row.name?.trim() || row.username?.trim() || `User ${row.id.slice(0, 8)}`;
      return acc;
    }, {});

    setMemberNames(nextNames);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [sessionsRes, tasksRes, competitionsRes, participantsRes, liveRes, settingsRes] = await Promise.all([
      db.from("study_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("study_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("study_competitions").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("study_participants").select("*").order("total_study_time", { ascending: false }),
      db.from("study_live_status").select("*").eq("is_studying", true),
      db.from("study_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (sessionsRes.error) toast.error(sessionsRes.error.message);
    if (tasksRes.error) toast.error(tasksRes.error.message);
    if (competitionsRes.error) toast.error(competitionsRes.error.message);
    if (participantsRes.error) toast.error(participantsRes.error.message);
    if (liveRes.error) toast.error(liveRes.error.message);
    if (settingsRes.error) toast.error(settingsRes.error.message);

    const nextSessions = (sessionsRes.data ?? []) as StudySession[];
    const currentActive = nextSessions.find((session) => session.status === "active") ?? null;

    setSessions(nextSessions);
    setTasks((tasksRes.data ?? []) as StudyTask[]);
    setCompetitions((competitionsRes.data ?? []) as StudyCompetition[]);
    setParticipants((participantsRes.data ?? []) as StudyParticipant[]);
    setLiveStatuses((liveRes.data ?? []) as StudyLiveStatus[]);
    setSettings((settingsRes.data as StudySettings | null) ?? null);

    if (settingsRes.data) {
      setStudyMinutes(settingsRes.data.default_study_time ?? 25);
      setBreakMinutes(settingsRes.data.default_break_time ?? 5);
      setSessionTargetSeconds((settingsRes.data.default_study_time ?? 25) * 60);
      setBreakTargetSeconds((settingsRes.data.default_break_time ?? 5) * 60);
      if (!currentActive && timerState === "idle") {
        setCountdownSeconds((settingsRes.data.default_study_time ?? 25) * 60);
      }
    }

    setActiveSession(currentActive);
    if (currentActive) {
      setTimerState("running");
      setMode((currentActive.mode as StudyMode) ?? "pomodoro");
      const planned = (currentActive.planned_duration ?? 25) * 60;
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(currentActive.start_time).getTime()) / 1000));
      setSessionTargetSeconds(planned);
      setCountdownSeconds(Math.max(0, planned - elapsed));
    }

    const idsToLoad = [
      ...((participantsRes.data ?? []) as StudyParticipant[]).map((entry) => entry.user_id),
      ...((liveRes.data ?? []) as StudyLiveStatus[]).map((entry) => entry.user_id),
      user.id,
    ];

    await loadNames(idsToLoad);

    if (!selectedCompetitionId && (competitionsRes.data ?? []).length > 0) {
      setSelectedCompetitionId(((competitionsRes.data ?? [])[0] as StudyCompetition).id);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`study-mode-full-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_tasks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_competitions" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_participants" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_live_status" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "study_settings" }, () => void loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activeSession) return;

    if (timerState !== "running" && timerState !== "break") return;
    const timer = window.setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSession?.id, timerState]);

  useEffect(() => {
    if (countdownSeconds > 0 || !activeSession) return;

    if (timerState === "running") {
      void onStopStudy(true);
      return;
    }

    if (timerState === "break") {
      setTimerState("completed");
      setCountdownSeconds(sessionTargetSeconds);
      toast.success("Break complete. Ready for next focus round 🚀");
    }
  }, [countdownSeconds, timerState, activeSession]);

  const saveSettings = async (nextStudyMinutes: number, nextBreakMinutes: number) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      default_study_time: clampMinutes(nextStudyMinutes, 5, 180),
      default_break_time: clampMinutes(nextBreakMinutes, 1, 30),
      auto_start_break: settings?.auto_start_break ?? true,
    };

    const { error } = await db.from("study_settings").upsert(payload, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else setSettings(payload);
  };

  const onStartStudy = async () => {
    if (!user) return;
    if (activeSession) {
      toast.info("You already have an active session.");
      return;
    }

    const plannedDuration = clampMinutes(studyMinutes, 5, 180);

    const { data, error } = await db
      .from("study_sessions")
      .insert({
        user_id: user.id,
        start_time: new Date().toISOString(),
        planned_duration: plannedDuration,
        mode,
        status: "active",
        competition_id: selectedCompetitionId || null,
      })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    const session = data as StudySession;
    setActiveSession(session);
    setSessions((prev) => [session, ...prev]);
    setTimerState("running");
    setSessionTargetSeconds(plannedDuration * 60);
    setCountdownSeconds(plannedDuration * 60);

    const { error: liveError } = await db.from("study_live_status").upsert({
      user_id: user.id,
      is_studying: true,
      current_session_start: session.start_time,
    });

    if (liveError) toast.error(liveError.message);
    await saveSettings(studyMinutes, breakMinutes);
    toast.success("Study session started 🔥");
  };

  const onPauseStudy = () => {
    if (!activeSession) return;
    setTimerState((prev) => (prev === "paused" ? "running" : "paused"));
  };

  const onStopStudy = async (autoBreak = false) => {
    if (!activeSession) {
      toast.info("No active session.");
      return;
    }

    const elapsedSeconds = Math.max(0, sessionTargetSeconds - countdownSeconds);
    if (elapsedSeconds < 60 && !autoBreak) {
      toast.info("Study for at least 1 minute before ending the session.");
      return;
    }

    const minutesCompleted = Math.max(1, Math.ceil(elapsedSeconds / 60));

    const { data, error } = await db.rpc("complete_study_session", {
      p_session_id: activeSession.id,
      p_duration_override: minutesCompleted,
      p_task_id: selectedTaskId || null,
      p_mark_task_complete: markTaskOnComplete,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    const rewardXp = (data?.xp_earned as number | undefined) ?? minutesCompleted * 10;
    const rewardCoins = (data?.coins_earned as number | undefined) ?? minutesCompleted;

    setActiveSession(null);
    setTimerState("completed");
    setCountdownSeconds(sessionTargetSeconds);

    const shouldStartBreak = mode === "pomodoro" && (settings?.auto_start_break ?? true) && autoBreak;
    if (shouldStartBreak) {
      setTimerState("break");
      setBreakTargetSeconds(clampMinutes(breakMinutes, 1, 30) * 60);
      setCountdownSeconds(clampMinutes(breakMinutes, 1, 30) * 60);
      setCompletedPomodoros((prev) => prev + 1);
      toast.success(`Focus complete 🎉 +${rewardXp} XP +${rewardCoins} coins. Break started.`);
    } else {
      toast.success(`Session completed ✅ +${rewardXp} XP +${rewardCoins} coins.`);
    }

    try {
      if ("vibrate" in navigator) navigator.vibrate(120);
    } catch {
      // no-op
    }

    await loadData();
  };

  const resetTimer = () => {
    if (activeSession) return;
    const next = clampMinutes(studyMinutes, 5, 180) * 60;
    setSessionTargetSeconds(next);
    setCountdownSeconds(next);
    setTimerState("idle");
  };

  const updateStudyMinutes = async (next: number) => {
    if (!editableTimer) return;
    const clamped = clampMinutes(next, 5, 180);
    setStudyMinutes(clamped);
    setSessionTargetSeconds(clamped * 60);
    setCountdownSeconds(clamped * 60);
    await saveSettings(clamped, breakMinutes);
  };

  const updateBreakMinutes = async (next: number) => {
    if (!editableTimer) return;
    const clamped = clampMinutes(next, 1, 30);
    setBreakMinutes(clamped);
    setBreakTargetSeconds(clamped * 60);
    await saveSettings(studyMinutes, clamped);
  };

  const addTask = async () => {
    if (!user) return;
    if (!taskTitle.trim()) {
      toast.error("Task title is required.");
      return;
    }

    const { error } = await db.from("study_tasks").insert({ user_id: user.id, task_title: taskTitle.trim(), completed: false });
    if (error) {
      toast.error(error.message);
      return;
    }

    setTaskTitle("");
    await loadData();
  };

  const toggleTask = async (task: StudyTask) => {
    const { error } = await db.from("study_tasks").update({ completed: !task.completed }).eq("id", task.id).eq("user_id", user?.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadData();
  };

  const deleteTask = async (task: StudyTask) => {
    const { error } = await db.from("study_tasks").delete().eq("id", task.id).eq("user_id", user?.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadData();
  };

  const createCompetition = async () => {
    if (!user) return;
    if (!competitionName.trim()) {
      toast.error("Competition name is required.");
      return;
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await db
      .from("study_competitions")
      .insert({ name: competitionName.trim(), created_by: user.id, start_time: now.toISOString(), end_time: in24h.toISOString(), status: "active" })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    const created = data as StudyCompetition;
    setCompetitionName("");
    setSelectedCompetitionId(created.id);

    const { error: joinError } = await db.from("study_participants").upsert({ competition_id: created.id, user_id: user.id, total_study_time: 0 });
    if (joinError) toast.error(joinError.message);

    toast.success("Competition created.");
    await loadData();
  };

  const joinCompetition = async () => {
    if (!user || !selectedCompetitionId) {
      toast.error("Select a competition first.");
      return;
    }

    const { error } = await db.from("study_participants").upsert({ competition_id: selectedCompetitionId, user_id: user.id, total_study_time: 0 });
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Joined competition.");
    await loadData();
  };

  const completedSessions = sessions.filter((session) => session.status === "completed");

  const todayMinutes = useMemo(() => {
    const dayStart = startOfDay();
    return completedSessions
      .filter((session) => new Date(session.created_at) >= dayStart)
      .reduce((sum, session) => sum + (session.duration ?? 0), 0);
  }, [completedSessions]);

  const weekMinutes = useMemo(() => {
    const start = startOfDay();
    start.setDate(start.getDate() - 6);
    return completedSessions
      .filter((session) => new Date(session.created_at) >= start)
      .reduce((sum, session) => sum + (session.duration ?? 0), 0);
  }, [completedSessions]);

  const streakDays = useMemo(() => {
    const sessionDays = new Set(completedSessions.map((s) => new Date(s.created_at).toDateString()));
    let streak = 0;
    const d = new Date();
    while (sessionDays.has(d.toDateString())) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [completedSessions]);

  const selectedCompetitionLeaderboard = useMemo(() => {
    if (!selectedCompetitionId) return [] as StudyParticipant[];
    return participants
      .filter((entry) => entry.competition_id === selectedCompetitionId)
      .sort((a, b) => b.total_study_time - a.total_study_time);
  }, [participants, selectedCompetitionId]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
        <Card className="bg-white/5 border-white/10 max-w-lg w-full">
          <CardHeader><CardTitle className="text-white">Study Mode</CardTitle></CardHeader>
          <CardContent>
            <p className="text-white/80">Please sign in to use live Study Mode.</p>
            <Link to="/"><Button className="mt-4">Back Home</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <header>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Master Minds
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-violet-300" /> Study Mode Elite (Realtime)
          </h1>
          <p className="text-sm text-white/70">Pomodoro flow • Real timestamps • XP rewards • Live competition • Task linking.</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-300" /> Focus Timer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <div className="relative w-64 h-64 mx-auto">
                  <svg className="w-64 h-64 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,0.12)" strokeWidth="8" fill="none" />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      stroke="url(#timerGradient)"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={339.292}
                      strokeDashoffset={339.292 - (339.292 * progressPercent) / 100}
                      className="transition-all duration-700"
                    />
                    <defs>
                      <linearGradient id="timerGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <p className="text-xs text-white/60 uppercase tracking-wide">{timerState === "break" ? "Break" : "Focus"}</p>
                    <p className="text-3xl font-bold tracking-wider">{formatSeconds(countdownSeconds)}</p>
                    <p className="text-xs text-white/60">{mode.toUpperCase()} • {timerState}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => void onStartStudy()} disabled={!!activeSession || loading}><Play className="h-4 w-4 mr-1" />Start</Button>
                    <Button variant="secondary" onClick={onPauseStudy} disabled={!activeSession || timerState === "break"}><Pause className="h-4 w-4 mr-1" />{timerState === "paused" ? "Resume" : "Pause"}</Button>
                    <Button variant="destructive" onClick={() => void onStopStudy(false)} disabled={!activeSession}><StopCircle className="h-4 w-4 mr-1" />Stop</Button>
                    <Button variant="outline" onClick={resetTimer} disabled={!!activeSession}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-white/60 mb-1">Mode</p>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as StudyMode)}
                        disabled={!editableTimer}
                        className="w-full bg-white/5 border border-white/20 rounded-md px-3 py-2 text-sm disabled:opacity-60"
                      >
                        <option value="pomodoro">Focus (Pomodoro)</option>
                        <option value="deep">Deep Work</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 mb-1">Study (min)</p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="secondary" onClick={() => void updateStudyMinutes(studyMinutes - 1)} disabled={!editableTimer}>-</Button>
                        <Input type="number" value={studyMinutes} onChange={(e) => void updateStudyMinutes(Number(e.target.value || 0))} disabled={!editableTimer} className="bg-white/5 border-white/20 text-center" />
                        <Button size="icon" variant="secondary" onClick={() => void updateStudyMinutes(studyMinutes + 1)} disabled={!editableTimer}>+</Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 mb-1">Break (min)</p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="secondary" onClick={() => void updateBreakMinutes(breakMinutes - 1)} disabled={!editableTimer || mode === "deep"}>-</Button>
                        <Input type="number" value={breakMinutes} onChange={(e) => void updateBreakMinutes(Number(e.target.value || 0))} disabled={!editableTimer || mode === "deep"} className="bg-white/5 border-white/20 text-center" />
                        <Button size="icon" variant="secondary" onClick={() => void updateBreakMinutes(breakMinutes + 1)} disabled={!editableTimer || mode === "deep"}>+</Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-white/60 mb-1">Link task to session</p>
                    <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="w-full bg-white/5 border border-white/20 rounded-md px-3 py-2 text-sm">
                      <option value="">No linked task</option>
                      {tasks.filter((task) => !task.completed).map((task) => (
                        <option key={task.id} value={task.id}>{task.task_title}</option>
                      ))}
                    </select>
                    <label className="mt-2 flex items-center gap-2 text-xs text-white/80">
                      <input type="checkbox" checked={markTaskOnComplete} onChange={(e) => setMarkTaskOnComplete(e.target.checked)} />
                      Mark linked task complete when session ends
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Today</p><p className="font-bold">{todayMinutes}m</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Week</p><p className="font-bold">{weekMinutes}m</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Streak</p><p className="font-bold">{streakDays} 🔥</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Pomodoros</p><p className="font-bold">{completedPomodoros}/4</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Live Studying</p><p className="font-bold flex items-center justify-center gap-1">{liveStatuses.length} <Flame className="h-4 w-4 text-orange-400" /></p></CardContent></Card>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Users className="h-5 w-5 text-emerald-300" /> Studying Now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {liveStatuses.length === 0 && <p className="text-sm text-white/60">No one is currently studying.</p>}
              {liveStatuses.map((entry) => (
                <div key={entry.user_id} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm">
                  <p>{memberNames[entry.user_id] ?? entry.user_id.slice(0, 8)} is studying 🔥</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Check className="h-5 w-5 text-emerald-300" /> Study Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Add a study task" className="bg-white/5 border-white/20" />
                <Button onClick={() => void addTask()}>Add</Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-auto">
                {tasks.length === 0 && <p className="text-sm text-white/60">No tasks yet.</p>}
                {tasks.map((task) => (
                  <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-2">
                    <p className={task.completed ? "line-through text-white/50" : ""}>{task.task_title}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant={task.completed ? "secondary" : "default"} onClick={() => void toggleTask(task)}>{task.completed ? "Undo" : "Complete"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => void deleteTask(task)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-300" /> Competitions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={competitionName} onChange={(e) => setCompetitionName(e.target.value)} placeholder="Competition name" className="bg-white/5 border-white/20" />
                <Button onClick={() => void createCompetition()}>Create</Button>
              </div>
              <select value={selectedCompetitionId} onChange={(e) => setSelectedCompetitionId(e.target.value)} className="w-full bg-white/5 border border-white/20 rounded-md px-3 py-2 text-sm">
                <option value="">Select competition</option>
                {activeCompetitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>{competition.name}</option>
                ))}
              </select>
              <Button variant="secondary" className="w-full" onClick={() => void joinCompetition()}>Join selected</Button>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <p className="text-sm font-medium text-white/90 flex items-center gap-1"><Zap className="h-4 w-4 text-yellow-300" /> Live Leaderboard</p>
                {selectedCompetitionLeaderboard.map((entry, index) => (
                  <div key={entry.id} className="text-xs bg-white/5 border border-white/10 rounded-md p-2 flex items-center justify-between gap-2">
                    <span className="truncate">#{index + 1} {memberNames[entry.user_id] ?? entry.user_id.slice(0, 8)}</span>
                    <Badge variant={entry.user_id === user.id ? "default" : "secondary"}>{entry.total_study_time}m</Badge>
                  </div>
                ))}
                {selectedCompetitionLeaderboard.length === 0 && <p className="text-xs text-white/60">No leaderboard data yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudyModePage;
