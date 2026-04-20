import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { ArrowLeft, Brain, Check, Clock, Flame, Pause, Play, RotateCcw, Trophy, Users } from "lucide-react";

type StudySession = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  status: "active" | "completed";
  created_at: string;
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

const StudyModePage: React.FC = () => {
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [competitions, setCompetitions] = useState<StudyCompetition[]>([]);
  const [participants, setParticipants] = useState<StudyParticipant[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<StudyLiveStatus[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [taskTitle, setTaskTitle] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");

  const activeCompetitions = useMemo(
    () => competitions.filter((competition) => competition.status === "active"),
    [competitions]
  );

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

    const [sessionsRes, tasksRes, competitionsRes, participantsRes, liveRes] = await Promise.all([
      db.from("study_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("study_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      db.from("study_competitions").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("study_participants").select("*").order("total_study_time", { ascending: false }),
      db.from("study_live_status").select("*").eq("is_studying", true),
    ]);

    if (sessionsRes.error) toast.error(sessionsRes.error.message);
    if (tasksRes.error) toast.error(tasksRes.error.message);
    if (competitionsRes.error) toast.error(competitionsRes.error.message);
    if (participantsRes.error) toast.error(participantsRes.error.message);
    if (liveRes.error) toast.error(liveRes.error.message);

    const nextSessions = (sessionsRes.data ?? []) as StudySession[];
    const currentActive = nextSessions.find((session) => session.status === "active") ?? null;

    setSessions(nextSessions);
    setTasks((tasksRes.data ?? []) as StudyTask[]);
    setCompetitions((competitionsRes.data ?? []) as StudyCompetition[]);
    setParticipants((participantsRes.data ?? []) as StudyParticipant[]);
    setLiveStatuses((liveRes.data ?? []) as StudyLiveStatus[]);
    setActiveSession(currentActive);

    if (currentActive) {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(currentActive.start_time).getTime()) / 1000)));
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedCompetitionId]);

  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(activeSession.start_time).getTime()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id]);

  const onStartStudy = async () => {
    if (!user) return;
    if (activeSession) {
      toast.info("You already have an active session.");
      return;
    }

    const { data, error } = await db
      .from("study_sessions")
      .insert({ user_id: user.id, start_time: new Date().toISOString(), status: "active" })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    const session = data as StudySession;
    setActiveSession(session);
    setSessions((prev) => [session, ...prev]);
    setElapsedSeconds(0);

    const { error: liveError } = await db.from("study_live_status").upsert({
      user_id: user.id,
      is_studying: true,
      current_session_start: session.start_time,
    });

    if (liveError) toast.error(liveError.message);
    toast.success("Study session started 🔥");
  };

  const onStopStudy = async () => {
    if (!activeSession) {
      toast.info("No active session.");
      return;
    }

    const { error } = await db.rpc("stop_study_session", { p_session_id: activeSession.id });
    if (error) {
      toast.error(error.message);
      return;
    }

    setActiveSession(null);
    setElapsedSeconds(0);
    toast.success("Session completed and synced to database ✅");
    await loadData();
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
            <Brain className="h-7 w-7 text-violet-300" /> Study Mode (Realtime)
          </h1>
          <p className="text-sm text-white/70">Real timestamps • Saved sessions • Todo tasks • Live competitions.</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-300" /> Study Timer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-5xl font-bold tracking-wider">{formatSeconds(elapsedSeconds)}</div>
              <div className="flex gap-2">
                <Button onClick={() => void onStartStudy()} disabled={!!activeSession || loading}><Play className="h-4 w-4 mr-1" />Start Study</Button>
                <Button variant="destructive" onClick={() => void onStopStudy()} disabled={!activeSession}><Pause className="h-4 w-4 mr-1" />Stop Study</Button>
                <Button variant="secondary" onClick={() => setElapsedSeconds(0)} disabled={!!activeSession}><RotateCcw className="h-4 w-4 mr-1" />Reset UI</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Today</p><p className="font-bold">{todayMinutes}m</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Week</p><p className="font-bold">{weekMinutes}m</p></CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-3"><p className="text-xs text-white/60">Completed Sessions</p><p className="font-bold">{completedSessions.length}</p></CardContent></Card>
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
                  <p>{memberNames[entry.user_id] ?? entry.user_id.slice(0, 8)} is studying now 🔥</p>
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
                <p className="text-sm font-medium text-white/90">Live Leaderboard</p>
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
