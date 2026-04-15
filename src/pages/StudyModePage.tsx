import { useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Clock3, Flame, Medal, Play, Pause, Square, Trophy, Users, Zap } from "lucide-react";

type TimerType = "pomodoro" | "custom" | "deep_focus";
type TaskPriority = "low" | "medium" | "high";

type StudyTask = {
  id: string;
  title: string;
  subject: string;
  priority: TaskPriority;
  completed: boolean;
};

type SessionRecord = {
  id: string;
  duration: number;
  type: TimerType;
  createdAt: string;
  completedTasks: number;
};

type RoomMember = {
  userId: string;
  name: string;
  studyTime: number;
  tasksCompleted: number;
  streak: number;
  isLive: boolean;
};

const STORAGE_KEY = "masterminds-study-mode";

const minutes = (value: number) => value * 60;

const StudyModePage = () => {
  const { toast } = useToast();
  const { user } = useUser();

  const [timerType, setTimerType] = useState<TimerType>("pomodoro");
  const [customMinutes, setCustomMinutes] = useState(50);
  const [remainingSeconds, setRemainingSeconds] = useState(minutes(25));
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [deepFocusMode, setDeepFocusMode] = useState(false);

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);

  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([
    { userId: "friend-1", name: "Alex", studyTime: 42, tasksCompleted: 4, streak: 5, isLive: true },
    { userId: "friend-2", name: "Mina", studyTime: 39, tasksCompleted: 6, streak: 3, isLive: true },
  ]);
  const [friendName, setFriendName] = useState("");
  const [inRoom, setInRoom] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    setTasks(parsed.tasks ?? []);
    setSessions(parsed.sessions ?? []);
    setXp(parsed.xp ?? 0);
    setCoins(parsed.coins ?? 0);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, sessions, xp, coins }));
  }, [tasks, sessions, xp, coins]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
      if (inRoom) {
        setRoomMembers((previous) =>
          previous.map((member) =>
            member.userId === user?.id ? { ...member, studyTime: member.studyTime + 1 / 60 } : member,
          ),
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, inRoom, user?.id]);

  useEffect(() => {
    if (remainingSeconds !== 0) return;

    if (timerType === "pomodoro" && !isBreak) {
      setIsBreak(true);
      setRemainingSeconds(minutes(5));
      toast({ title: "Break time", description: "You completed a focus block. Take 5 minutes." });
      return;
    }

    completeSession();
  }, [remainingSeconds]);

  useEffect(() => {
    if (!deepFocusMode) return;
    const root = document.documentElement;
    root.classList.add("study-focus-mode");

    if (document.fullscreenElement == null) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }

    return () => {
      root.classList.remove("study-focus-mode");
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, [deepFocusMode]);

  const totalSeconds = useMemo(() => {
    if (timerType === "pomodoro") return isBreak ? minutes(5) : minutes(25);
    if (timerType === "custom") return minutes(Math.max(10, Math.min(120, customMinutes)));
    return minutes(90);
  }, [timerType, customMinutes, isBreak]);

  const progressValue = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const taskProgress = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  const dailyStudyMinutes = sessions
    .filter((session) => new Date(session.createdAt).toDateString() === new Date().toDateString())
    .reduce((total, session) => total + session.duration / 60, 0);

  const streakDays = useMemo(() => {
    const days = new Set(sessions.map((session) => new Date(session.createdAt).toDateString()));
    let streak = 0;
    const pointer = new Date();

    while (days.has(pointer.toDateString())) {
      streak += 1;
      pointer.setDate(pointer.getDate() - 1);
    }

    return streak;
  }, [sessions]);

  const weeklyMinutes = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return sessions
      .filter((session) => new Date(session.createdAt).getTime() >= sevenDaysAgo)
      .reduce((total, session) => total + session.duration / 60, 0);
  }, [sessions]);

  const bestDay = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((session) => {
      const dateKey = new Date(session.createdAt).toDateString();
      map.set(dateKey, (map.get(dateKey) ?? 0) + session.duration / 60);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [sessions]);

  const consistency = sessions.length === 0 ? 0 : Math.round((new Set(sessions.map((s) => new Date(s.createdAt).toDateString())).size / 14) * 100);

  const leaderboard = [...roomMembers]
    .sort((a, b) => b.studyTime - a.studyTime || b.tasksCompleted - a.tasksCompleted || b.streak - a.streak)
    .slice(0, 10);

  const setTimerPreset = (nextType: TimerType) => {
    setTimerType(nextType);
    setIsBreak(false);
    setIsRunning(false);
    if (nextType === "pomodoro") setRemainingSeconds(minutes(25));
    if (nextType === "custom") setRemainingSeconds(minutes(Math.max(10, Math.min(120, customMinutes))));
    if (nextType === "deep_focus") {
      setRemainingSeconds(minutes(90));
      setDeepFocusMode(true);
    }
  };

  const addTask = () => {
    if (!title.trim()) return;
    setTasks((previous) => [
      ...previous,
      { id: crypto.randomUUID(), title: title.trim(), subject: subject.trim() || "General", priority, completed: false },
    ]);
    setTitle("");
    setSubject("");
  };

  const completeSession = async () => {
    const duration = totalSeconds;
    setIsRunning(false);
    setIsBreak(false);

    const completedInSession = tasks.filter((task) => task.completed).length;
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      duration,
      type: timerType,
      createdAt: new Date().toISOString(),
      completedTasks: completedInSession,
    };
    setSessions((previous) => [session, ...previous]);

    const rewardXP = Math.max(25, Math.round(duration / 30));
    const rewardCoins = Math.max(10, Math.round(duration / 90));
    setXp((previous) => previous + rewardXP);
    setCoins((previous) => previous + rewardCoins);

    toast({
      title: `+${rewardXP} XP • +${rewardCoins} coins`,
      description: `Study streak: ${Math.max(1, streakDays)} day${streakDays === 1 ? "" : "s"} 🔥`,
    });

    try {
      if (user?.id) {
        await (supabase as any).from("study_sessions").insert({
          user_id: user.id,
          duration,
          type: timerType,
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      // Study mode should still work offline/local.
    }

    if (timerType === "custom") {
      setRemainingSeconds(minutes(Math.max(10, Math.min(120, customMinutes))));
    } else if (timerType === "deep_focus") {
      setRemainingSeconds(minutes(90));
    } else {
      setRemainingSeconds(minutes(25));
    }
  };

  const scheduleReminder = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Reminders unavailable", description: "Your browser does not support notifications." });
      return;
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") {
      toast({ title: "Permission needed", description: "Enable notifications to get study reminders." });
      return;
    }

    window.setTimeout(() => {
      new Notification("Master Minds Study Reminder", { body: "Time to start your next focus session 🎯" });
    }, 30_000);

    toast({ title: "Reminder set", description: "We will ping you in 30 seconds for a demo reminder." });
  };

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressValue / 100) * circumference;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <BackButton to="/" />
          <Badge className="bg-indigo-500/20 text-indigo-200">Study Mode</Badge>
        </div>

        <Card className="border-indigo-400/20 bg-slate-900/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Focus Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Button variant={timerType === "pomodoro" ? "default" : "outline"} onClick={() => setTimerPreset("pomodoro")}>🔵 Pomodoro</Button>
              <Button variant={timerType === "custom" ? "default" : "outline"} onClick={() => setTimerPreset("custom")}>🟢 Custom</Button>
              <Button variant={timerType === "deep_focus" ? "default" : "outline"} onClick={() => setTimerPreset("deep_focus")}>🔥 Deep Focus</Button>
            </div>

            {timerType === "custom" && (
              <div className="max-w-sm space-y-2">
                <Label>Custom minutes (10-120)</Label>
                <Input
                  type="number"
                  min={10}
                  max={120}
                  value={customMinutes}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setCustomMinutes(next);
                    setRemainingSeconds(minutes(Math.max(10, Math.min(120, next || 10))));
                  }}
                />
              </div>
            )}

            <div className="flex flex-col items-center gap-4 py-2">
              <svg width="180" height="180" viewBox="0 0 180 180" className="drop-shadow-lg">
                <circle cx="90" cy="90" r={radius} stroke="rgba(148,163,184,0.2)" strokeWidth="10" fill="none" />
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  stroke="rgb(99,102,241)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 90 90)"
                  className="transition-all duration-700 ease-out"
                />
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-slate-100 text-2xl font-bold">
                  {`${Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`}
                </text>
              </svg>

              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => setIsRunning(true)}><Play className="h-4 w-4 mr-1" />Start</Button>
                <Button variant="secondary" onClick={() => setIsRunning(false)}><Pause className="h-4 w-4 mr-1" />Pause</Button>
                <Button variant="destructive" onClick={completeSession}><Square className="h-4 w-4 mr-1" />End</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-slate-800/70 border-slate-700"><CardContent className="pt-6"><p className="text-sm text-slate-400">Today</p><p className="text-2xl font-semibold">{(dailyStudyMinutes / 60).toFixed(1)}h</p></CardContent></Card>
              <Card className="bg-slate-800/70 border-slate-700"><CardContent className="pt-6"><p className="text-sm text-slate-400">Weekly</p><p className="text-2xl font-semibold">{(weeklyMinutes / 60).toFixed(1)}h</p></CardContent></Card>
              <Card className="bg-slate-800/70 border-slate-700"><CardContent className="pt-6"><p className="text-sm text-slate-400">Streak</p><p className="text-2xl font-semibold inline-flex items-center gap-1"><Flame className="h-5 w-5 text-orange-400" />{streakDays}d</p></CardContent></Card>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-indigo-400/20 bg-slate-900/60">
            <CardHeader>
              <CardTitle>📋 Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={taskProgress} />
              <div className="grid gap-2 md:grid-cols-3">
                <Input placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} />
                <Input placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
                <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addTask}>Add task</Button>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border border-slate-700 p-3 bg-slate-800/50">
                    <div>
                      <p className={task.completed ? "line-through text-slate-400" : ""}>{task.title}</p>
                      <p className="text-xs text-slate-400">{task.subject} • {task.priority}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTasks((previous) => previous.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))}>✓</Button>
                      <Button variant="destructive" size="sm" onClick={() => setTasks((previous) => previous.filter((item) => item.id !== task.id))}>✕</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-indigo-400/20 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Study Competition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Invite friend" value={friendName} onChange={(event) => setFriendName(event.target.value)} className="max-w-xs" />
                <Button
                  onClick={() => {
                    if (!friendName.trim()) return;
                    setRoomMembers((previous) => [...previous, { userId: crypto.randomUUID(), name: friendName.trim(), studyTime: 0, tasksCompleted: 0, streak: 1, isLive: true }]);
                    setFriendName("");
                  }}
                >Invite</Button>
                <Button variant="secondary" onClick={() => {
                  setInRoom((previous) => !previous);
                  if (!inRoom && user?.id) {
                    setRoomMembers((previous) => {
                      const exists = previous.some((member) => member.userId === user.id);
                      if (exists) return previous;
                      return [...previous, { userId: user.id, name: user.name, studyTime: 0, tasksCompleted: completedTasks, streak: streakDays || 1, isLive: true }];
                    });
                  }
                }}>{inRoom ? "Leave room" : "Join room"}</Button>
              </div>

              <div className="space-y-2">
                {leaderboard.map((member, index) => (
                  <div key={member.userId} className="flex items-center justify-between rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                    <p className="font-medium">#{index + 1} {member.name}</p>
                    <div className="text-xs text-slate-300 flex gap-3">
                      <span>⏳ {member.studyTime.toFixed(1)}m</span>
                      <span>✅ {member.tasksCompleted}</span>
                      <span>🔥 {member.streak}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-indigo-400/20 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Rewards, Reminders & Analytics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-700 p-4 bg-slate-800/40">
              <p className="text-slate-400 text-sm">XP</p>
              <p className="text-2xl font-semibold inline-flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-300" />{xp}</p>
            </div>
            <div className="rounded-lg border border-slate-700 p-4 bg-slate-800/40">
              <p className="text-slate-400 text-sm">Coins</p>
              <p className="text-2xl font-semibold inline-flex items-center gap-2"><Medal className="h-5 w-5 text-amber-300" />{coins}</p>
            </div>
            <div className="rounded-lg border border-slate-700 p-4 bg-slate-800/40">
              <p className="text-slate-400 text-sm">Best day</p>
              <p className="text-sm font-semibold">{bestDay ? `${bestDay[0]} • ${(bestDay[1] / 60).toFixed(1)}h` : "No data"}</p>
            </div>
            <div className="rounded-lg border border-slate-700 p-4 bg-slate-800/40">
              <p className="text-slate-400 text-sm">Consistency</p>
              <p className="text-2xl font-semibold">{consistency}%</p>
              <p className="text-xs text-slate-500">last 14 days</p>
            </div>

            <div className="md:col-span-2 lg:col-span-4 rounded-lg border border-slate-700 p-4 bg-slate-800/40 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={deepFocusMode} onCheckedChange={setDeepFocusMode} />
                <Label>Deep Focus Mode (fullscreen + minimal UI)</Label>
              </div>
              <Button variant="outline" onClick={scheduleReminder}><Bell className="h-4 w-4 mr-1" />Set reminder</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudyModePage;
