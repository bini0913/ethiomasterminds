import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  Check,
  Clock,
  Coins,
  Flame,
  Play,
  Pause,
  RotateCcw,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

type TimerMode = "pomodoro" | "custom";
type SessionType = "focus" | "break" | "custom";
type TaskPriority = "low" | "medium" | "high";

interface StudySession {
  id: string;
  duration: number;
  type: SessionType;
  createdAt: string;
}

interface StudyTask {
  id: string;
  title: string;
  subject: string;
  priority: TaskPriority;
  completed: boolean;
  createdAt: string;
  linkedSessionId?: string;
}

interface StudyRoomMember {
  roomId: string;
  userId: string;
  name: string;
  studyTime: number;
  tasksCompleted: number;
  streak: number;
  isLive: boolean;
}

interface StoredState {
  sessions: StudySession[];
  tasks: StudyTask[];
  coins: number;
  xp: number;
}

const STORAGE_KEY = "masterminds-study-mode-v1";

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const startOfDay = (date = new Date()) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const StudyModePage: React.FC = () => {
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

  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [studyRoomMembers, setStudyRoomMembers] = useState<StudyRoomMember[]>([
    { roomId: "room-ethiopia-legends", userId: "me", name: "You", studyTime: 0, tasksCompleted: 0, streak: 1, isLive: true },
    { roomId: "room-ethiopia-legends", userId: "alex", name: "Alex", studyTime: 38, tasksCompleted: 2, streak: 4, isLive: true },
    { roomId: "room-ethiopia-legends", userId: "sara", name: "Sara", studyTime: 27, tasksCompleted: 3, streak: 3, isLive: true },
    { roomId: "room-ethiopia-legends", userId: "yosef", name: "Yosef", studyTime: 21, tasksCompleted: 1, streak: 2, isLive: false },
  ]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as StoredState;
      setSessions(parsed.sessions ?? []);
      setTasks(parsed.tasks ?? []);
      setCoins(parsed.coins ?? 0);
      setXp(parsed.xp ?? 0);
    } catch {
      toast.warning("Could not load previous Study Mode data.");
    }
  }, []);

  useEffect(() => {
    const data: StoredState = { sessions, tasks, coins, xp };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [sessions, tasks, coins, xp]);

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

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval);
          completeSession();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStudyRoomMembers((previous) =>
        previous.map((member) => {
          if (!member.isLive || member.userId === "me") return member;
          return {
            ...member,
            studyTime: member.studyTime + Math.floor(Math.random() * 2),
            tasksCompleted: member.tasksCompleted + (Math.random() > 0.92 ? 1 : 0),
          };
        })
      );
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const completeSession = () => {
    const sessionType: SessionType = timerMode === "custom" ? "custom" : isBreak ? "break" : "focus";
    const minutes = Math.round(durationSeconds / 60);

    const session: StudySession = {
      id: crypto.randomUUID(),
      duration: durationSeconds,
      type: sessionType,
      createdAt: new Date().toISOString(),
    };

    setSessions((previous) => [session, ...previous]);
    setRunning(false);

    if (sessionType === "focus" || sessionType === "custom") {
      const gainedXp = Math.max(10, Math.round(minutes * 2));
      const gainedCoins = Math.max(2, Math.round(minutes / 5));

      setXp((previous) => previous + gainedXp);
      setCoins((previous) => previous + gainedCoins);

      setStudyRoomMembers((previous) =>
        previous.map((member) =>
          member.userId === "me"
            ? {
                ...member,
                studyTime: member.studyTime + minutes,
                streak: getDailyStreak([...sessions, session]),
              }
            : member
        )
      );

      toast.success(`Session complete: +${gainedXp} XP • +${gainedCoins} coins`);
    } else {
      toast.success("Break complete. Great discipline.");
    }

    if (timerMode === "pomodoro") {
      setIsBreak((previous) => !previous);
    }
  };

  const getTotalMinutes = (items: StudySession[]) => Math.round(items.reduce((total, item) => total + item.duration / 60, 0));

  const todaysMinutes = useMemo(() => {
    const todayStart = startOfDay();
    return getTotalMinutes(sessions.filter((session) => new Date(session.createdAt) >= todayStart));
  }, [sessions]);

  const weeklyMinutes = useMemo(() => {
    const boundary = new Date();
    boundary.setDate(boundary.getDate() - 6);
    boundary.setHours(0, 0, 0, 0);
    return getTotalMinutes(sessions.filter((session) => new Date(session.createdAt) >= boundary));
  }, [sessions]);

  const dailyMap = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((session) => {
      const key = new Date(session.createdAt).toISOString().split("T")[0];
      map.set(key, (map.get(key) ?? 0) + Math.round(session.duration / 60));
    });
    return map;
  }, [sessions]);

  const bestDay = useMemo(() => {
    if (dailyMap.size === 0) return { date: "-", minutes: 0 };
    let winner = { date: "-", minutes: 0 };
    dailyMap.forEach((minutes, date) => {
      if (minutes > winner.minutes) {
        winner = { date, minutes };
      }
    });
    return winner;
  }, [dailyMap]);

  const getDailyStreak = (items: StudySession[]) => {
    const set = new Set(items.map((session) => new Date(session.createdAt).toISOString().split("T")[0]));
    let streak = 0;
    const cursor = startOfDay();

    while (set.has(cursor.toISOString().split("T")[0])) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  };

  const dailyStreak = useMemo(() => getDailyStreak(sessions), [sessions]);
  const weeklyStreak = useMemo(() => Math.ceil(dailyStreak / 7), [dailyStreak]);

  const consistency = useMemo(() => {
    const past14 = new Array(14).fill(0).map((_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - index);
      return day.toISOString().split("T")[0];
    });

    const activeDays = past14.filter((day) => (dailyMap.get(day) ?? 0) > 0).length;
    return Math.round((activeDays / 14) * 100);
  }, [dailyMap]);

  const progress = Math.round(((durationSeconds - remainingSeconds) / durationSeconds) * 100);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const addTask = () => {
    if (!taskTitle.trim()) {
      toast.error("Task title is required.");
      return;
    }

    const task: StudyTask = {
      id: crypto.randomUUID(),
      title: taskTitle.trim(),
      subject: taskSubject,
      priority: taskPriority,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((previous) => [task, ...previous]);
    setTaskTitle("");
    toast.success("Task added to your plan.");
  };

  const toggleTask = (taskId: string) => {
    let taskWasCompleted = false;

    setTasks((previous) =>
      previous.map((task) => {
        if (task.id !== taskId) return task;
        const next = !task.completed;
        taskWasCompleted = next;
        return { ...task, completed: next, linkedSessionId: task.linkedSessionId ?? sessions[0]?.id };
      })
    );

    if (taskWasCompleted) {
      setXp((previous) => previous + 20);
      setCoins((previous) => previous + 4);
      setStudyRoomMembers((previous) =>
        previous.map((member) =>
          member.userId === "me"
            ? {
                ...member,
                tasksCompleted: member.tasksCompleted + 1,
              }
            : member
        )
      );
      toast.success("Task complete: +20 XP • +4 coins");
    }
  };

  const deleteTask = (taskId: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
  };

  const leaderboard = useMemo(
    () => [...studyRoomMembers].sort((a, b) => b.studyTime - a.studyTime || b.tasksCompleted - a.tasksCompleted),
    [studyRoomMembers]
  );

  useEffect(() => {
    if (!running || remainingSeconds <= 0) return;

    if (remainingSeconds === 300) {
      toast("5 minutes left. Finish strong 💪");
    }
  }, [running, remainingSeconds]);

  return (
    <div className={`min-h-screen ${deepFocusMode ? "bg-black" : "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900"} text-white`}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-2">
              <ArrowLeft className="h-4 w-4" /> Back to Master Minds
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-violet-300" /> Study Mode
            </h1>
            <p className="text-sm text-white/70">Pomodoro focus + streak rewards + live friend competition. Vercel-ready client experience.</p>
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
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isNaN(next)) return;
                      setCustomMinutes(Math.max(10, Math.min(120, next)));
                    }}
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
                <div className="flex gap-2 mt-5">
                  <Button onClick={() => setRunning(true)} disabled={running || remainingSeconds === 0}><Play className="h-4 w-4 mr-1" />Start</Button>
                  <Button variant="outline" onClick={() => setRunning(false)} disabled={!running}><Pause className="h-4 w-4 mr-1" />Pause</Button>
                  <Button variant="secondary" onClick={() => {
                    setRunning(false);
                    setRemainingSeconds(durationSeconds);
                  }}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
                  <Button variant="destructive" onClick={completeSession}>End</Button>
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
                <div key={member.userId} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">#{index + 1} {member.name}</p>
                    <Badge variant={member.isLive ? "default" : "secondary"}>{member.isLive ? "Live" : "Idle"}</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-2 grid grid-cols-3 gap-1">
                    <span>{member.studyTime}m</span>
                    <span>{member.tasksCompleted} tasks</span>
                    <span>{member.streak} 🔥</span>
                  </div>
                </div>
              ))}
              <div className="text-xs text-white/70 pt-1">Win by: most time, most tasks, best consistency.</div>
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
                  <Input placeholder="Task title" className="md:col-span-2 bg-white/5 border-white/20" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
                  <Input placeholder="Subject" className="bg-white/5 border-white/20" value={taskSubject} onChange={(event) => setTaskSubject(event.target.value)} />
                  <select
                    value={taskPriority}
                    onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}
                    className="bg-white/5 border border-white/20 rounded-md px-3 text-sm"
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                  <Button onClick={addTask}>Add</Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-auto pr-1">
                  {tasks.length === 0 && <p className="text-sm text-white/60">No tasks yet. Add one and start focusing.</p>}
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className={`font-medium ${task.completed ? "line-through text-white/50" : ""}`}>{task.title}</p>
                        <p className="text-xs text-white/70">{task.subject} • {task.priority}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={task.completed ? "secondary" : "default"} onClick={() => toggleTask(task.id)}>{task.completed ? "Undo" : "Complete"}</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteTask(task.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-300" /> Analytics & Rewards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-white/80">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Best day</p>
                  <p className="font-semibold">{bestDay.date} • {bestDay.minutes} min</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Consistency (last 14 days)</p>
                  <p className="font-semibold">{consistency}%</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Badges</p>
                  <p>🎯 Focus Starter • 🔥 Streak Builder • 🏆 Room Challenger</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-xs">Social</p>
                  <p>Share: “Studied {todaysMinutes} minutes today”</p>
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
