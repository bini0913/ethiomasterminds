import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import StudyCallBar from "@/components/study/StudyCallBar";
import StudyLeaderboard from "@/components/study/StudyLeaderboard";
import StudyShareCard from "@/components/study/StudyShareCard";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
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
  paused_at?: string | null;
  paused_seconds?: number | null;
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

type StudyStats = {
  today_minutes: number;
  week_minutes: number;
  streak_days: number;
  pomodoros_today: number;
};

const EMPTY_STUDY_STATS: StudyStats = { today_minutes: 0, week_minutes: 0, streak_days: 0, pomodoros_today: 0 };

const db = supabase as any;

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const clampMinutes = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

const StudyModePage: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";

  const [loading, setLoading] = useState(true);
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
  const [breakDeadlineMs, setBreakDeadlineMs] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(25 * 60);
  const [studyStats, setStudyStats] = useState<StudyStats>(EMPTY_STUDY_STATS);

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [markTaskOnComplete, setMarkTaskOnComplete] = useState(true);

  const [taskTitle, setTaskTitle] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");

  const activeCompetitions = useMemo(
    () => competitions.filter((competition) => competition.status === "active" && (!competition.end_time || new Date(competition.end_time).getTime() > Date.now())),
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

    try {
      const { data, error } = await db.rpc("get_friend_profiles", { _user_ids: uniqueIds });
      if (error) throw error;
      if (!data) return;

      const nextNames = data.reduce((acc: Record<string, string>, row: { id: string; name: string | null; username: string | null }) => {
        acc[row.id] = row.name?.trim() || row.username?.trim() || `User ${row.id.slice(0, 8)}`;
        return acc;
      }, {});

      setMemberNames(nextNames);
    } catch (error) {
      console.error("Study Mode participant names could not be loaded:", error);
    }
  };

  const loadData = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      try {
        const { error: expiryError } = await db.rpc("expire_study_competitions");
        if (expiryError) console.error("Could not expire old study competitions", expiryError);
      } catch (error) {
        console.warn("Study competition expiry check failed:", error);
      }

      const [sessionsRes, tasksRes, competitionsRes, participantsRes, liveRes, settingsRes, statsRes] = await Promise.all([
      db.from("study_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("study_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("study_competitions").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("study_participants").select("*").order("total_study_time", { ascending: false }),
      db.from("study_live_status").select("*").eq("is_studying", true).gte("updated_at", new Date(Date.now() - 90_000).toISOString()),
      db.from("study_settings").select("*").eq("user_id", user.id).maybeSingle(),
      db.rpc("get_study_mode_stats", { p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }),
    ]);

    if (sessionsRes.error) toast.error(sessionsRes.error.message);
    if (tasksRes.error) toast.error(tasksRes.error.message);
    if (competitionsRes.error) toast.error(competitionsRes.error.message);
    if (participantsRes.error) toast.error(participantsRes.error.message);
    if (liveRes.error) toast.error(liveRes.error.message);
    if (settingsRes.error) toast.error(settingsRes.error.message);
    if (statsRes.error) console.error("Study statistics load failed", statsRes.error);
    if (!statsRes.error && statsRes.data) {
      setStudyStats({
        today_minutes: Number(statsRes.data.today_minutes) || 0,
        week_minutes: Number(statsRes.data.week_minutes) || 0,
        streak_days: Number(statsRes.data.streak_days) || 0,
        pomodoros_today: Number(statsRes.data.pomodoros_today) || 0,
      });
    }

    const nextSessions = (sessionsRes.data ?? []) as StudySession[];
    const currentActive = nextSessions.find((session) => session.status === "active") ?? null;

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
      const isPaused = Boolean(currentActive.paused_at);
      setTimerState(isPaused ? "paused" : "running");
      setMode((currentActive.mode as StudyMode) ?? "pomodoro");
      const planned = (currentActive.planned_duration ?? 25) * 60;
      const wallElapsed = Math.max(0, (Date.now() - new Date(currentActive.start_time).getTime()) / 1000);
      const currentPause = currentActive.paused_at ? Math.max(0, (Date.now() - new Date(currentActive.paused_at).getTime()) / 1000) : 0;
      const pausedSeconds = Math.max(0, Number(currentActive.paused_seconds) || 0) + currentPause;
      const elapsed = Math.max(0, Math.floor(wallElapsed - pausedSeconds));
      setSessionTargetSeconds(planned);
      setCountdownSeconds(Math.max(0, planned - elapsed));
    }

    const idsToLoad = [
      ...((participantsRes.data ?? []) as StudyParticipant[]).map((entry) => entry.user_id),
      ...((liveRes.data ?? []) as StudyLiveStatus[]).map((entry) => entry.user_id),
      user.id,
    ];

    await loadNames(idsToLoad);

    const availableCompetitions = ((competitionsRes.data ?? []) as StudyCompetition[]).filter(
      (competition) => competition.status === "active" && (!competition.end_time || new Date(competition.end_time).getTime() > Date.now())
    );
    setSelectedCompetitionId((current) =>
      current && availableCompetitions.some((competition) => competition.id === current)
        ? current
        : availableCompetitions[0]?.id ?? ""
    );

    } catch (error) {
      console.error("Study Mode data load failed:", error);
      toast.error("Your Study Mode data could not be refreshed. Please try again.");
    } finally {
      setLoading(false);
    }
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
    if (timerState === "break") {
      if (breakDeadlineMs === null) return;
      const tick = () => setCountdownSeconds(Math.max(0, Math.ceil((breakDeadlineMs - Date.now()) / 1000)));
      tick();
      const timer = window.setInterval(tick, 250);
      return () => window.clearInterval(timer);
    }
    if (timerState !== "running" || !activeSession) return;
    const timer = window.setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, timerState, breakDeadlineMs]);

  useEffect(() => {
    if (countdownSeconds > 0) return;
    if (timerState === "running" && activeSession) {
      void onStopStudy(true);
      return;
    }
    if (timerState === "break") {
      setTimerState("completed");
      setBreakDeadlineMs(null);
      setCountdownSeconds(sessionTargetSeconds);
      toast.success("Break complete. Ready for next focus round 🚀");
    }
  }, [countdownSeconds, timerState, activeSession?.id, sessionTargetSeconds]);

  useEffect(() => {
    if (!user?.id || !activeSession?.id) return;
    const heartbeat = () => {
      void db.rpc("heartbeat_study_presence", { p_session_id: activeSession.id })
        .then(({ error }) => { if (error) console.warn("Study presence heartbeat failed:", error); })
        .catch((error) => console.warn("Study presence heartbeat failed:", error));
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    return () => window.clearInterval(timer);
  }, [user?.id, activeSession?.id]);

  useEffect(() => {
    const syncTimer = () => {
      if (document.visibilityState !== "visible") return;
      if (timerState === "break" && breakDeadlineMs !== null) {
        setCountdownSeconds(Math.max(0, Math.ceil((breakDeadlineMs - Date.now()) / 1000)));
        return;
      }
      if (timerState !== "running" || !activeSession) return;
      const planned = (activeSession.planned_duration ?? 25) * 60;
      const wallElapsed = Math.max(0, (Date.now() - new Date(activeSession.start_time).getTime()) / 1000);
      const pausedSeconds = Math.max(0, Number(activeSession.paused_seconds) || 0);
      setCountdownSeconds(Math.max(0, planned - Math.floor(wallElapsed - pausedSeconds)));
    };
    document.addEventListener("visibilitychange", syncTimer);
    return () => document.removeEventListener("visibilitychange", syncTimer);
  }, [activeSession?.id, activeSession?.start_time, activeSession?.planned_duration, activeSession?.paused_seconds, timerState, breakDeadlineMs]);

  const saveSettings = async (nextStudyMinutes: number, nextBreakMinutes: number) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      default_study_time: clampMinutes(nextStudyMinutes, 5, 180),
      default_break_time: clampMinutes(nextBreakMinutes, 1, 30),
      auto_start_break: settings?.auto_start_break ?? true,
    };

    try {
      const { error } = await db.from("study_settings").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      setSettings(payload);
    } catch (error) {
      console.error("Study settings save failed:", error);
      toast.error("Your Study Mode settings could not be saved.");
    }
  };

  const onStartStudy = async () => {
    if (!user) return;
    if (activeSession) {
      toast.info("You already have an active session.");
      return;
    }

    const plannedDuration = clampMinutes(studyMinutes, 5, 180);

    let data: unknown;
    try {
      const result = await db.rpc("start_study_session", {
        p_planned_duration: plannedDuration,
        p_mode: mode,
        p_competition_id: selectedCompetitionId || null,
      });
      if (result.error) throw result.error;
      data = result.data;
    } catch (error) {
      console.error("Could not start Study Mode session:", error);
      toast.error(error instanceof Error ? error.message : "Could not start your study session. Please retry.");
      return;
    }

    const session = data as StudySession;
    setActiveSession(session);
    setTimerState("running");
    setBreakDeadlineMs(null);
    setSessionTargetSeconds(plannedDuration * 60);
    setCountdownSeconds(plannedDuration * 60);

    await saveSettings(studyMinutes, breakMinutes);
    toast.success("Study session started 🔥");
  };

  const onPauseStudy = async () => {
    if (!activeSession) return;
    const isPaused = timerState === "paused";
    try {
      const { error } = await db.rpc(isPaused ? "resume_study_session" : "pause_study_session", { p_session_id: activeSession.id });
      if (error) throw error;
    } catch (error) {
      console.error("Could not update Study Mode pause state:", error);
      toast.error(error instanceof Error ? error.message : "Could not update your study session.");
      return;
    }
    const now = new Date().toISOString();
    setActiveSession((current) => current ? {
      ...current,
      paused_at: isPaused ? null : now,
      paused_seconds: (Number(current.paused_seconds) || 0) + (isPaused && current.paused_at ? Math.max(0, Math.floor((Date.now() - new Date(current.paused_at).getTime()) / 1000)) : 0),
    } : current);
    setTimerState(isPaused ? "running" : "paused");
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

    let data: { xp_earned?: number; coins_earned?: number } | null = null;
    try {
      const result = await db.rpc("complete_study_session", {
        p_session_id: activeSession.id,
        p_duration_override: null,
        p_task_id: selectedTaskId || null,
        p_mark_task_complete: markTaskOnComplete,
      });
      if (result.error) throw result.error;
      data = result.data as { xp_earned?: number; coins_earned?: number } | null;
    } catch (error) {
      console.error("Could not complete Study Mode session:", error);
      toast.error(error instanceof Error ? error.message : "Your study session could not be completed. Please retry.");
      return;
    }

    // Rewards are written by the server RPC. Never infer or display a reward
    // from the client timer when the RPC response omits its authoritative totals.
    const rewardXp = typeof data?.xp_earned === "number" && Number.isFinite(data.xp_earned)
      ? Math.max(0, Math.floor(data.xp_earned))
      : null;
    const rewardCoins = typeof data?.coins_earned === "number" && Number.isFinite(data.coins_earned)
      ? Math.max(0, Math.floor(data.coins_earned))
      : null;

    setActiveSession(null);
    setTimerState("completed");
    setCountdownSeconds(sessionTargetSeconds);

    const shouldStartBreak = mode === "pomodoro" && (settings?.auto_start_break ?? true) && autoBreak;
    if (shouldStartBreak) {
      const nextBreakSeconds = clampMinutes(breakMinutes, 1, 30) * 60;
      setTimerState("break");
      setBreakTargetSeconds(nextBreakSeconds);
      setBreakDeadlineMs(Date.now() + nextBreakSeconds * 1000);
      setCountdownSeconds(nextBreakSeconds);
      toast.success(
        rewardXp !== null && rewardCoins !== null
          ? `Focus complete. +${rewardXp} XP and +${rewardCoins} coins. Break started.`
          : "Focus session completed. Reward totals could not be confirmed."
      );
    } else {
      setBreakDeadlineMs(null);
      toast.success(
        rewardXp !== null && rewardCoins !== null
          ? `Session completed. +${rewardXp} XP and +${rewardCoins} coins.`
          : "Session completed. Reward totals could not be confirmed."
      );
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
    setBreakDeadlineMs(null);
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

  const updateAutoStartBreak = async (enabled: boolean) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      default_study_time: clampMinutes(studyMinutes, 5, 180),
      default_break_time: clampMinutes(breakMinutes, 1, 30),
      auto_start_break: enabled,
    };
    try {
      const { error } = await db.from("study_settings").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      setSettings(payload);
    } catch (error) {
      console.error("Auto-start break preference save failed:", error);
      toast.error("Your break preference could not be saved.");
    }
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

    const { data, error } = await db.rpc("create_study_competition", { p_name: competitionName.trim() });

    if (error) {
      toast.error(error.message);
      return;
    }

    const created = data as StudyCompetition;
    setCompetitionName("");
    setSelectedCompetitionId(created.id);

    toast.success("Competition created and joined.");
    await loadData();
  };

  const joinCompetition = async () => {
    if (!user || !selectedCompetitionId) {
      toast.error("Select a competition first.");
      return;
    }

    const { error } = await db.rpc("join_study_competition", { p_competition_id: selectedCompetitionId });
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Joined competition.");
    await loadData();
  };

  const todayMinutes = studyStats.today_minutes;
  const weekMinutes = studyStats.week_minutes;
  const streakDays = studyStats.streak_days;

  const selectedCompetitionLeaderboard = useMemo(() => {
    if (!selectedCompetitionId) return [] as StudyParticipant[];
    return participants
      .filter((entry) => entry.competition_id === selectedCompetitionId)
      .sort((a, b) => b.total_study_time - a.total_study_time);
  }, [participants, selectedCompetitionId]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center p-6">
        <Card className="bg-card border-border max-w-lg w-full">
          <CardHeader><CardTitle className="text-foreground">Study Mode</CardTitle></CardHeader>
          <CardContent>
            <p className="text-foreground/80">Please sign in to use live Study Mode.</p>
            <Link to="/"><Button className="mt-4">Back Home</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBreak = timerState === "break";
  const isRunning = timerState === "running";
  const isPaused = timerState === "paused";
  const ringColor = isBreak ? "hsl(var(--accent))" : isPaused ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))";
  const stateLabel = isBreak ? "Break time" : isRunning ? "Focusing" : isPaused ? "Paused" : timerState === "completed" ? "Session done" : "Ready";
  const presets = [["pomodoro", 25, "Focus", "25 min"], ["deep", 50, "Deep work", "50 min"], ["custom", 15, "Sprint", "15 min"]] as const;
  const openTasks = tasks.filter((t) => !t.completed);
  const doneTasks = tasks.length - openTasks.length;
  const stats = [
    { label: "Today", value: `${todayMinutes}m`, icon: Clock },
    { label: "This week", value: `${weekMinutes}m`, icon: Brain },
    { label: "Streak", value: `${streakDays}d`, icon: Flame },
    { label: "Pomodoros", value: `${studyStats.pomodoros_today}/4`, icon: Trophy },
  ];
  const R = 54, C = 2 * Math.PI * R;

  return (
    <div className={`${upperStudent ? "tier-upper " : ""}min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]`}>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {!upperStudent && <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Home</Link>}
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Study Mode</h1>
            <p className="text-sm text-muted-foreground">One task. One timer. Earn XP for every focused minute.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 ${liveStatuses.length ? "animate-ping" : ""}`} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" /></span>
            {liveStatuses.length} studying now
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="rounded-3xl border-2 border-border bg-card p-5 shadow-[0_4px_0_hsl(var(--border))] sm:p-8">
              <div className="mx-auto mb-6 grid max-w-md grid-cols-3 gap-2" role="group" aria-label="Session length">
                {presets.map(([m, min, label, sub]) => {
                  const on = mode === m && studyMinutes === min;
                  return (
                    <button key={label} type="button" disabled={!editableTimer} aria-pressed={on}
                      onClick={() => { setMode(m); void updateStudyMinutes(min); }}
                      className={`rounded-2xl border-2 border-b-4 px-2 py-2.5 text-center transition-all active:translate-y-0.5 active:border-b-2 disabled:opacity-50 ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                      <span className="block text-sm font-bold">{label}</span>
                      <span className="block text-xs opacity-70">{sub}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-[18rem] sm:max-w-[20rem]">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r={R} stroke="hsl(var(--muted))" strokeWidth="9" fill="none" />
                  <circle cx="60" cy="60" r={R} stroke={ringColor} strokeWidth="9" fill="none" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C - (C * progressPercent) / 100} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className={`mb-1 rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${isBreak ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"}`}>{stateLabel}</span>
                  <span className="text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl" aria-live="polite">{formatSeconds(countdownSeconds)}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{Math.round(progressPercent)}% complete</span>
                </div>
              </div>

              <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3">
                {!activeSession ? (
                  <>
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl" onClick={resetTimer} aria-label="Reset timer"><RotateCcw className="h-5 w-5" /></Button>
                    <Button className="h-14 flex-1 rounded-2xl text-base font-extrabold uppercase tracking-wide shadow-[0_4px_0_hsl(var(--primary)/0.55)] active:translate-y-1 active:shadow-none" onClick={() => void onStartStudy()} disabled={loading || isBreak}>
                      <Play className="mr-2 h-5 w-5" /> Start focus
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" className="h-14 flex-1 rounded-2xl text-base font-bold shadow-[0_4px_0_hsl(var(--border))] active:translate-y-1 active:shadow-none" onClick={onPauseStudy} disabled={isBreak}>
                      {isPaused ? <><Play className="mr-2 h-5 w-5" />Resume</> : <><Pause className="mr-2 h-5 w-5" />Pause</>}
                    </Button>
                    <Button variant="destructive" className="h-14 flex-1 rounded-2xl text-base font-bold shadow-[0_4px_0_hsl(var(--destructive)/0.55)] active:translate-y-1 active:shadow-none" onClick={() => void onStopStudy(false)}>
                      <StopCircle className="mr-2 h-5 w-5" />Finish
                    </Button>
                  </>
                )}
              </div>

              <div className="mx-auto mt-5 max-w-md">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="sm-task">Working on</label>
                <select id="sm-task" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-medium">
                  <option value="">No task selected</option>
                  {openTasks.map((t) => <option key={t.id} value={t.id}>{t.task_title}</option>)}
                </select>
                {selectedTaskId && <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={markTaskOnComplete} onChange={(e) => setMarkTaskOnComplete(e.target.checked)} /> Tick this task off when I finish</label>}
              </div>

              <details className="mx-auto mt-4 max-w-md rounded-xl border border-border bg-background/60 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none font-semibold text-muted-foreground">Custom timer settings</summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([["Study (min)", studyMinutes, updateStudyMinutes, false], ["Break (min)", breakMinutes, updateBreakMinutes, mode === "deep"]] as const).map(([label, val, fn, off]) => (
                    <div key={label}>
                      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => void fn(val - 1)} disabled={!editableTimer || off}>-</Button>
                        <Input type="number" value={val} onChange={(e) => void fn(Number(e.target.value || 0))} disabled={!editableTimer || off} className="h-9 text-center" />
                        <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => void fn(val + 1)} disabled={!editableTimer || off}>+</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={settings?.auto_start_break ?? true} onChange={(e) => void updateAutoStartBreak(e.target.checked)} disabled={!editableTimer || mode !== "pomodoro"} />
                  Start a break automatically after a Focus session
                </label>
              </details>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border-2 border-border bg-card p-4 shadow-[0_3px_0_hsl(var(--border))]">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-2xl font-extrabold tabular-nums">{value}</p>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="font-bold">Share your progress</p>
                <p className="text-sm text-muted-foreground">Make a story card with today's study stats.</p>
              </div>
              <StudyShareCard name={user.name?.trim() || "A Master Minds student"} level={user.level ?? 1} todayMinutes={todayMinutes} weekMinutes={weekMinutes} streakDays={streakDays} />
            </section>

            <div className="hidden lg:block"><StudyLeaderboard /></div>
          </main>

          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold"><Check className="h-5 w-5 text-primary" /> Tasks</h2>
                <span className="text-xs font-semibold text-muted-foreground">{doneTasks}/{tasks.length} done</span>
              </div>
              <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void addTask(); }}>
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Add a task…" className="h-11 rounded-xl" />
                <Button type="submit" className="h-11 rounded-xl px-4 font-bold">Add</Button>
              </form>
              <ul className="max-h-72 space-y-1.5 overflow-auto">
                {tasks.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Add what you want to finish today.</li>}
                {tasks.map((task) => (
                  <li key={task.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                    <button type="button" onClick={() => void toggleTask(task)} aria-label={task.completed ? "Mark not done" : "Mark done"}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${task.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {task.completed && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-sm ${task.completed ? "text-muted-foreground line-through" : "font-medium"}`}>{task.task_title}</span>
                    <button type="button" onClick={() => void deleteTask(task)} className="text-xs text-muted-foreground opacity-70 hover:text-destructive group-hover:opacity-100" aria-label="Delete task">✕</button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-primary" /> Study room</h2>
              <StudyCallBar />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {liveStatuses.length === 0 && <p className="text-sm text-muted-foreground">Nobody else is studying right now. Start first!</p>}
                {liveStatuses.map((e) => (
                  <span key={e.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />{memberNames[e.user_id] ?? "A student"}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-primary" /> Study challenges</h2>
              <form className="mb-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void createCompetition(); }}>
                <Input value={competitionName} onChange={(e) => setCompetitionName(e.target.value)} placeholder="Challenge name" className="h-11 rounded-xl" />
                <Button type="submit" variant="outline" className="h-11 rounded-xl font-bold">Create</Button>
              </form>
              <div className="flex gap-2">
                <select value={selectedCompetitionId} onChange={(e) => setSelectedCompetitionId(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 text-sm">
                  <option value="">Pick a challenge</option>
                  {activeCompetitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button variant="secondary" className="h-11 rounded-xl font-bold" onClick={() => void joinCompetition()}>Join</Button>
              </div>
              {selectedCompetitionId && (
                <ol className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {selectedCompetitionLeaderboard.length === 0 && <li className="text-xs text-muted-foreground">No minutes logged yet.</li>}
                  {selectedCompetitionLeaderboard.map((entry, i) => (
                    <li key={entry.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${entry.user_id === user.id ? "bg-primary/10" : ""}`}>
                      <span className="w-6 text-center font-extrabold text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{memberNames[entry.user_id] ?? "Student"}</span>
                      <Badge variant={entry.user_id === user.id ? "default" : "secondary"}><Zap className="mr-1 h-3 w-3" />{entry.total_study_time}m</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <div className="lg:hidden"><StudyLeaderboard /></div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default StudyModePage;
