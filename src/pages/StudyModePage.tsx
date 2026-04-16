import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import {
  ArrowLeft,
  Brain,
  Check,
  Clock,
  Coins,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

type TimerMode = "pomodoro" | "custom";
type SessionType = "focus" | "break" | "custom";
type TaskPriority = "low" | "medium" | "high";

type StudySession = {
  id: string;
  user_id: string;
  duration: number;
  type: SessionType;
  created_at: string;
};

type StudyTask = {
  id: string;
  user_id: string;
  title: string;
  subject: string | null;
  priority: TaskPriority;
  completed: boolean;
  linked_session_id: string | null;
  created_at: string;
};

type StudyRoom = {
  id: string;
  host_id: string;
  status: "open" | "live" | "completed" | "archived";
  title: string;
  created_at: string;
};

type RoomMember = {
  room_id: string;
  user_id: string;
  study_time: number;
  tasks_completed: number;
  focus_streak: number;
  joined_at: string;
};

const db = supabase as any;

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const StudyModePage: React.FC = () => {
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [timerMode, setTimerMode] = useState<TimerMode>("pomodoro");
  const [isBreak, setIsBreak] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(45);
  const [deepFocusMode, setDeepFocusMode] = useState(false);

  const [durationSeconds, setDurationSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("Math");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");

  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (timerMode === "pomodoro") {
      const next = isBreak ? 5 * 60 : 25 * 60;
      setDurationSeconds(next);
      setRemainingSeconds(next);
      setRunning(false);
      return;
    }

    const next = customMinutes * 60;
    setDurationSeconds(next);
    setRemainingSeconds(next);
    setRunning(false);
  }, [timerMode, customMinutes, isBreak]);

  const ensureMembership = async (roomId: string) => {
    if (!user) return;
    const { data } = await db
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      const { error } = await db.from("room_members").insert({ room_id: roomId, user_id: user.id });
      if (error) toast.error(error.message);
    }
  };

  const fetchMemberNames = async (members: RoomMember[]) => {
    if (members.length === 0) {
      setMemberNames({});
      return;
    }

    const ids = [...new Set(members.map((member) => member.user_id))];
    const { data, error } = await db.from("profiles").select("id,name").in("id", ids);

    if (error || !data) return;

    const names = data.reduce((acc: Record<string, string>, profile: { id: string; name: string }) => {
      acc[profile.id] = profile.name;
      return acc;
    }, {});

    setMemberNames(names);
  };

  const loadStudyData = async (selectedRoomId?: string) => {
    if (!user) return;
    setLoading(true);

    const [sessionsRes, tasksRes] = await Promise.all([
      db.from("study_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (sessionsRes.error) toast.error(sessionsRes.error.message);
    if (tasksRes.error) toast.error(tasksRes.error.message);

    setSessions((sessionsRes.data ?? []) as StudySession[]);
    setTasks((tasksRes.data ?? []) as StudyTask[]);

    let activeRoomId = selectedRoomId;

    if (!activeRoomId) {
      const membership = await db
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      activeRoomId = membership.data?.room_id;

      if (!activeRoomId) {
        const created = await db
          .from("study_rooms")
          .insert({ host_id: user.id, status: "live", title: `${user.name || "Student"}'s Study Room` })
          .select("*")
          .single();

        if (created.error) {
          toast.error(created.error.message);
          setLoading(false);
          return;
        }

        activeRoomId = created.data.id;
        await ensureMembership(activeRoomId);
      }
    }

    if (activeRoomId) {
      const roomRes = await db.from("study_rooms").select("*").eq("id", activeRoomId).maybeSingle();
      if (roomRes.error) {
        toast.error(roomRes.error.message);
      } else {
        setRoom((roomRes.data ?? null) as StudyRoom | null);
      }

      const membersRes = await db.from("room_members").select("*").eq("room_id", activeRoomId).order("study_time", { ascending: false });
      if (membersRes.error) {
        toast.error(membersRes.error.message);
      } else {
        const nextMembers = (membersRes.data ?? []) as RoomMember[];
        setRoomMembers(nextMembers);
        await fetchMemberNames(nextMembers);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadStudyData();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`study-mode-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions", filter: `user_id=eq.${user.id}` }, () => loadStudyData(room?.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` }, () => loadStudyData(room?.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: room ? `room_id=eq.${room.id}` : undefined }, () => loadStudyData(room?.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "study_rooms" }, () => loadStudyData(room?.id))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, room?.id]);

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          void completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  const getDailyStreak = (items: StudySession[]) => {
    const dateSet = new Set(items.map((session) => new Date(session.created_at).toISOString().split("T")[0]));
    let streak = 0;
    const cursor = startOfDay();

    while (dateSet.has(cursor.toISOString().split("T")[0])) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  };

  const completeSession = async () => {
    if (!user) return;

    const type: SessionType = timerMode === "custom" ? "custom" : isBreak ? "break" : "focus";

    const insert = await db
      .from("study_sessions")
      .insert({ user_id: user.id, duration: durationSeconds, type })
      .select("*")
      .single();

    if (insert.error) {
      toast.error(insert.error.message);
      return;
    }

    const minutes = Math.round(durationSeconds / 60);
    const nextSessions = [insert.data as StudySession, ...sessions];
    setSessions(nextSessions);

    if (room) {
      const member = roomMembers.find((m) => m.user_id === user.id);
      const streak = getDailyStreak(nextSessions);
      const nextStudyTime = (member?.study_time ?? 0) + (type === "break" ? 0 : minutes);

      const update = await db
        .from("room_members")
        .update({ study_time: nextStudyTime, focus_streak: streak })
        .eq("room_id", room.id)
        .eq("user_id", user.id);

      if (update.error) toast.error(update.error.message);
    }

    setRunning(false);
    setRemainingSeconds(durationSeconds);

    if (timerMode === "pomodoro") {
      setIsBreak((prev) => !prev);
    }

    if (type === "break") {
      toast.success("Break complete ✅");
      return;
    }

    toast.success(`Session saved live: +${Math.max(10, Math.round(minutes * 2))} XP • +${Math.max(2, Math.round(minutes / 5))} coins`);
    await loadStudyData(room?.id);
  };

  const createTask = async () => {
    if (!user) return;
    if (!taskTitle.trim()) {
      toast.error("Task title is required.");
      return;
    }

    const { error } = await db.from("tasks").insert({
      user_id: user.id,
      title: taskTitle.trim(),
      subject: taskSubject,
      priority: taskPriority,
      completed: false,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTaskTitle("");
    toast.success("Task created.");
    await loadStudyData(room?.id);
  };

  const toggleTask = async (task: StudyTask) => {
    const completed = !task.completed;
    const { error } = await db
      .from("tasks")
      .update({ completed, linked_session_id: task.linked_session_id ?? sessions[0]?.id ?? null })
      .eq("id", task.id)
      .eq("user_id", task.user_id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (completed && room && user) {
      const member = roomMembers.find((m) => m.user_id === user.id);
      await db
        .from("room_members")
        .update({ tasks_completed: (member?.tasks_completed ?? 0) + 1 })
        .eq("room_id", room.id)
        .eq("user_id", user.id);
    }

    await loadStudyData(room?.id);
  };

  const deleteTask = async (task: StudyTask) => {
    const { error } = await db.from("tasks").delete().eq("id", task.id).eq("user_id", task.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }

    await loadStudyData(room?.id);
  };

  const createRoom = async () => {
    if (!user) return;

    const created = await db
      .from("study_rooms")
      .insert({ host_id: user.id, status: "live", title: `${user.name || "Student"}'s Study Room` })
      .select("*")
      .single();

    if (created.error) {
      toast.error(created.error.message);
      return;
    }

    await ensureMembership(created.data.id);
    setJoinRoomId(created.data.id);
    await loadStudyData(created.data.id);
    toast.success("New live study room created.");
  };

  const joinRoom = async () => {
    if (!user) return;
    if (!joinRoomId.trim()) {
      toast.error("Enter a room id.");
      return;
    }

    await ensureMembership(joinRoomId.trim());
    await loadStudyData(joinRoomId.trim());
    toast.success("Joined room.");
  };

  const progress = Math.round(((durationSeconds - remainingSeconds) / durationSeconds) * 100);

  const totalMinutes = useMemo(
    () => Math.round(sessions.reduce((sum, session) => sum + session.duration / 60, 0)),
    [sessions]
  );

  const todaysMinutes = useMemo(() => {
    const today = startOfDay();
    return Math.round(
      sessions.filter((session) => new Date(session.created_at) >= today).reduce((sum, session) => sum + session.duration / 60, 0)
    );
  }, [sessions]);

  const weeklyMinutes = useMemo(() => {
    const start = startOfDay();
    start.setDate(start.getDate() - 6);
    return Math.round(
      sessions.filter((session) => new Date(session.created_at) >= start).reduce((sum, session) => sum + session.duration / 60, 0)
    );
  }, [sessions]);

  const completedTasks = tasks.filter((task) => task.completed).length;
  const taskProgress = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
  const dailyStreak = getDailyStreak(sessions);
  const weeklyStreak = Math.ceil(dailyStreak / 7);

  const leaderboard = useMemo(
    () =>
      [...roomMembers].sort(
        (a, b) => b.study_time - a.study_time || b.tasks_completed - a.tasks_completed || b.focus_streak - a.focus_streak
      ),
    [roomMembers]
  );

  const myMember = roomMembers.find((member) => member.user_id === user?.id);
  const xp = Math.max(0, Math.round(totalMinutes * 2 + completedTasks * 20));
  const coins = Math.max(0, Math.round(totalMinutes / 5 + completedTasks * 4));

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
        <Card className="bg-white/5 border-white/10 max-w-lg w-full">
          <CardHeader><CardTitle className="text-white">Study Mode</CardTitle></CardHeader>
          <CardContent>
            <p className="text-white/80">Please sign in to use live Study Mode data.</p>
            <Link to="/"><Button className="mt-4">Back Home</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${deepFocusMode ? "bg-black" : "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900"} text-white`}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-2">
              <ArrowLeft className="h-4 w-4" /> Back to Master Minds
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-violet-300" /> Study Mode (Live)
            </h1>
            <p className="text-sm text-white/70">Everything is now database-backed and live via Supabase Realtime.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-violet-600 hover:bg-violet-600">XP {xp}</Badge>
            <Badge className="bg-amber-500 hover:bg-amber-500 text-black"><Coins className="h-3.5 w-3.5 mr-1" /> {coins}</Badge>
            <div className="flex items-center gap-2">
              <Switch id="deep-focus" checked={deepFocusMode} onCheckedChange={setDeepFocusMode} />
              <Label htmlFor="deep-focus" className="text-white/90">Deep Focus</Label>
            </div>
          </div>
        </header>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Users className="h-5 w-5 text-cyan-300" /> Study Rooms (Live)</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-2">
            <Input value={room?.id ?? ""} readOnly className="bg-white/5 border-white/20" />
            <Input value={joinRoomId} onChange={(event) => setJoinRoomId(event.target.value)} placeholder="Paste room id to join" className="bg-white/5 border-white/20" />
            <div className="flex gap-2">
              <Button onClick={createRoom} className="flex-1">Create Room</Button>
              <Button onClick={joinRoom} variant="secondary" className="flex-1">Join Room</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-300" /> Study Timer</span>
                <div className="flex gap-2">
                  <Button size="sm" variant={timerMode === "pomodoro" ? "default" : "outline"} onClick={() => setTimerMode("pomodoro")}>Pomodoro</Button>
                  <Button size="sm" variant={timerMode === "custom" ? "default" : "outline"} onClick={() => setTimerMode("custom")}>Custom</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {timerMode === "pomodoro" ? (
                <div className="flex items-center gap-2">
                  <Button variant={!isBreak ? "default" : "outline"} onClick={() => setIsBreak(false)}>25m Focus</Button>
                  <Button variant={isBreak ? "default" : "outline"} onClick={() => setIsBreak(true)}>5m Break</Button>
                </div>
              ) : (
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="custom-minutes" className="text-white/80">Custom study length (10-120 min)</Label>
                  <Input
                    id="custom-minutes"
                    type="number"
                    min={10}
                    max={120}
                    value={customMinutes}
                    onChange={(event) => setCustomMinutes(Math.max(10, Math.min(120, Number(event.target.value) || 10)))}
                    className="bg-white/5 border-white/20"
                  />
                </div>
              )}

              <div className="flex flex-col items-center justify-center py-4">
                <div
                  className="h-52 w-52 rounded-full grid place-items-center border-4 border-white/10"
                  style={{ background: `conic-gradient(#8b5cf6 ${progress}%, rgba(255,255,255,0.08) ${progress}% 100%)` }}
                >
                  <div className="h-44 w-44 rounded-full bg-slate-950/90 flex flex-col items-center justify-center">
                    <span className="text-4xl font-semibold tracking-wider">{formatTime(remainingSeconds)}</span>
                    <span className="text-xs text-white/60 uppercase mt-1">{isBreak ? "Break" : "Focus"}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-5 flex-wrap justify-center">
                  <Button onClick={() => setRunning(true)} disabled={running || loading}><Play className="h-4 w-4 mr-1" />Start</Button>
                  <Button variant="outline" onClick={() => setRunning(false)} disabled={!running}><Pause className="h-4 w-4 mr-1" />Pause</Button>
                  <Button variant="secondary" onClick={() => { setRunning(false); setRemainingSeconds(durationSeconds); }}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
                  <Button variant="destructive" onClick={() => void completeSession()}>End</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Today</p><p className="font-bold">{todaysMinutes}m</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Week</p><p className="font-bold">{weeklyMinutes}m</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Daily streak</p><p className="font-bold flex items-center justify-center gap-1">{dailyStreak} <Flame className="h-4 w-4 text-orange-400" /></p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Weekly streak</p><p className="font-bold">{weeklyStreak}</p></CardContent></Card>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Swords className="h-5 w-5 text-amber-300" /> Live Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {leaderboard.map((member, index) => (
                <div key={`${member.room_id}-${member.user_id}`} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">#{index + 1} {memberNames[member.user_id] ?? member.user_id.slice(0, 8)}</p>
                    <Badge variant={member.user_id === user.id ? "default" : "secondary"}>{member.user_id === user.id ? "You" : "Live"}</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-2 grid grid-cols-3 gap-1">
                    <span>{member.study_time}m</span>
                    <span>{member.tasks_completed} tasks</span>
                    <span>{member.focus_streak} 🔥</span>
                  </div>
                </div>
              ))}
              <div className="text-xs text-white/70 pt-1">Win by: most study time, most tasks completed, best focus streak.</div>
            </CardContent>
          </Card>
        </div>

        {!deepFocusMode && (
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-300" /> Tasks</span>
                  <span className="text-sm text-white/70">{completedTasks}/{tasks.length} complete</span>
                </CardTitle>
                <Progress value={taskProgress} className="h-2 bg-white/10" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-5 gap-2">
                  <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" className="md:col-span-2 bg-white/5 border-white/20" />
                  <Input value={taskSubject} onChange={(event) => setTaskSubject(event.target.value)} placeholder="Subject" className="bg-white/5 border-white/20" />
                  <select
                    value={taskPriority}
                    onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}
                    className="bg-white/5 border border-white/20 rounded-md px-3 text-sm"
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                  <Button onClick={() => void createTask()}>Add</Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-auto pr-1">
                  {tasks.length === 0 && <p className="text-sm text-white/60">No tasks yet. Add one and start focusing.</p>}
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className={`font-medium ${task.completed ? "line-through text-white/50" : ""}`}>{task.title}</p>
                        <p className="text-xs text-white/70">{task.subject || "General"} • {task.priority}</p>
                      </div>
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
                <CardTitle className="text-white flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-300" /> Live Analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-white/80">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Room status</p>
                  <p className="font-semibold capitalize">{room?.status ?? "n/a"}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Your room rank</p>
                  <p className="font-semibold">#{Math.max(1, leaderboard.findIndex((m) => m.user_id === user.id) + 1)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Your live totals</p>
                  <p>{myMember?.study_time ?? 0} min • {myMember?.tasks_completed ?? 0} tasks • {myMember?.focus_streak ?? 0} streak</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Share progress</p>
                  <p>“Studied {todaysMinutes} minutes today”</p>
                  <Button variant="outline" className="mt-2 w-full"><Users className="h-4 w-4 mr-1" /> Challenge Friends (2h)</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyModePage;
