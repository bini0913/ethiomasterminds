import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2,
  Clock3, Flame, Play, Sparkles, Target, Trophy, Users,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { db } from "@/integrations/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { getXpProgressInLevel } from "@/lib/rankSystem";

type TopicRow = {
  subject: string;
  topic: string;
  accuracy_percentage: number | null;
  questions_attempted: number | null;
  correct_answers: number | null;
  last_practiced_at: string | null;
};
type ResultRow = {
  correct_answers: number | null;
  total_questions: number | null;
  completed_at: string | null;
};
type DailyRow = {
  activity_date: string;
  quiz_count: number;
  question_count: number;
  correct_count: number;
  xp_earned: number;
};
type ExamTarget = {
  exam_name: string;
  exam_date: string;
  created_at: string;
};

const ADDIS_TIME_ZONE = "Africa/Addis_Ababa";
const addisDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADDIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
};
const offsetDateKey = (key: string, offset: number) => {
  const date = new Date(key + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const dayDifference = (from: string, to: string) => {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
};
const formatDay = (key: string) => new Date(key + "T00:00:00+03:00").toLocaleDateString(undefined, {
  timeZone: ADDIS_TIME_ZONE,
  weekday: "short",
});

const getCurrentStreak = (rows: DailyRow[], today: string) => {
  const dates = Array.from(new Set(rows.map((row) => row.activity_date))).sort().reverse();
  if (!dates.length || (dates[0] !== today && dates[0] !== offsetDateKey(today, -1))) return 0;
  let streak = 0;
  let expected = dates[0];
  for (const date of dates) {
    if (date !== expected) break;
    streak += 1;
    expected = offsetDateKey(expected, -1);
  }
  return streak;
};

const getLongestStreak = (rows: DailyRow[]) => {
  const dates = Array.from(new Set(rows.map((row) => row.activity_date))).sort();
  let longest = 0;
  let current = 0;
  let previous = "";
  for (const date of dates) {
    current = previous && dayDifference(previous, date) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
};

const UpperTierHome: React.FC = () => {
  const { user } = useUser();
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [recentResults, setRecentResults] = useState<ResultRow[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyRow[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [examTarget, setExamTarget] = useState<ExamTarget | null>(null);
  const [examDateInput, setExamDateInput] = useState("");
  const [examNameInput, setExamNameInput] = useState("Grade 12 Exit Exam");
  const [savingExam, setSavingExam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const xp = Number(user?.xp) || 0;
  const level = Math.max(1, Number(user?.level) || 1);
  // The server progression functions advance one level per 100 total XP.
  const xpProgress = getXpProgressInLevel(xp, 100);
  const firstName = typeof user?.name === "string"
    ? user.name.trim().split(/\\s+/)[0] || "Student"
    : "Student";
  const grade = user?.grade
    ? (/grade/i.test(user.grade) ? user.grade : `Grade ${user.grade}`)
    : "Grades 9–12";
  const now = new Date();
  const todayKey = addisDateKey(now);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString(undefined, {
    timeZone: ADDIS_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setTopics([]);
      setRecentResults([]);
      setDailyActivity([]);
      setSelectedSubjects([]);
      setExamTarget(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const yearAgo = offsetDateKey(todayKey, -365);
    const [topicResponse, activityResponse, resultResponse, profileResponse, examResponse] = await Promise.all([
      db.from("upper_student_topic_progress")
        .select("subject,topic,accuracy_percentage,questions_attempted,correct_answers,last_practiced_at")
        .eq("user_id", user.id)
        .order("accuracy_percentage", { ascending: true })
        .limit(100),
      db.from("upper_student_daily_activity")
        .select("activity_date,quiz_count,question_count,correct_count,xp_earned")
        .eq("user_id", user.id)
        .gte("activity_date", yearAgo)
        .order("activity_date", { ascending: false })
        .limit(400),
      db.from("quiz_results")
        .select("correct_answers,total_questions,completed_at")
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(5),
      db.from("academic_profiles")
        .select("subjects")
        .eq("user_id", user.id)
        .maybeSingle(),
      db.from("student_exam_targets")
        .select("exam_name,exam_date,created_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const errors = [
      topicResponse.error,
      activityResponse.error,
      resultResponse.error,
      profileResponse.error,
      examResponse.error,
    ].filter(Boolean);

    if (errors.length) {
      console.error("Grades 9–12 home data load failed:", errors);
      setLoadError("Some saved learning data could not be loaded. Your records have not been changed. Retry to reconnect.");
    }

    setTopics((topicResponse.data || []) as TopicRow[]);
    setDailyActivity((activityResponse.data || []) as DailyRow[]);
    setRecentResults((resultResponse.data || []) as ResultRow[]);
    setSelectedSubjects(Array.isArray(profileResponse.data?.subjects) ? profileResponse.data.subjects : []);
    setExamTarget((examResponse.data || null) as ExamTarget | null);
    setLoading(false);
  }, [user?.id, todayKey]);

  useEffect(() => {
    let active = true;
    void loadDashboard();
    if (!user?.id) return () => { active = false; };

    const channel = supabase
      .channel("upper-tier-home-" + user.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "upper_student_daily_activity",
        filter: "user_id=eq." + user.id,
      }, () => { if (active) void loadDashboard(); })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "upper_student_topic_progress",
        filter: "user_id=eq." + user.id,
      }, () => { if (active) void loadDashboard(); })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadDashboard, retryCount]);

  const totals = useMemo(() => dailyActivity.reduce((sum, day) => ({
    correct: sum.correct + (Number(day.correct_count) || 0),
    questions: sum.questions + (Number(day.question_count) || 0),
    quizzes: sum.quizzes + (Number(day.quiz_count) || 0),
    xp: sum.xp + (Number(day.xp_earned) || 0),
  }), { correct: 0, questions: 0, quizzes: 0, xp: 0 }), [dailyActivity]);

  const recentAccuracy = totals.questions > 0
    ? Math.round((totals.correct / totals.questions) * 100)
    : null;
  const currentStreak = useMemo(() => getCurrentStreak(dailyActivity, todayKey), [dailyActivity, todayKey]);
  const longestStreak = useMemo(() => getLongestStreak(dailyActivity), [dailyActivity]);
  const nextLevelXp = Math.max(0, xpProgress.max - xpProgress.current);
  const weeklyActivity = useMemo(() => {
    const dailyByDate = new Map(dailyActivity.map((day) => [day.activity_date, day]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = offsetDateKey(todayKey, index - 6);
      const row = dailyByDate.get(date);
      return {
        date,
        count: Number(row?.quiz_count) || 0,
        questions: Number(row?.question_count) || 0,
      };
    });
  }, [dailyActivity, todayKey]);
  const weeklyQuizCount = weeklyActivity.reduce((sum, day) => sum + day.count, 0);
  const maxActivity = Math.max(1, ...weeklyActivity.map((day) => day.count));
  const focusTopic = topics[0] || null;
  const coveredSubjects = new Set(topics.map((topic) => topic.subject)).size;
  const daysToExam = examTarget ? dayDifference(todayKey, examTarget.exam_date) : null;

  const saveExamTarget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!examDateInput || !examNameInput.trim()) return;
    setSavingExam(true);
    const { data, error } = await supabase.rpc("set_upper_student_exam_target_once", {
      p_exam_date: examDateInput,
      p_exam_name: examNameInput.trim(),
    });
    setSavingExam(false);
    if (error) {
      console.error("One-time exam target save failed:", error);
      toast.error(error.message?.includes("already been set")
        ? "An exam date has already been saved for this account."
        : error.message || "Your exam date could not be saved.");
      await loadDashboard();
      return;
    }
    toast.success("Your exam countdown is now saved.");
    setExamTarget({
      exam_name: String((data as any)?.exam_name || examNameInput.trim()),
      exam_date: String((data as any)?.exam_date || examDateInput),
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-7 pb-4">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{grade} · {dateLabel}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting}, {firstName}.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Your learning dashboard, built from your saved practice and study progress.</p>
        </div>
        <Link to="/study-mode" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-105 sm:self-auto">
          <Play className="h-4 w-4 fill-current" /> Start focus session
        </Link>
      </section>

      {loadError && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <span>{loadError}</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="font-bold text-primary underline-offset-2 hover:underline">Retry loading</button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current streak</span><Flame className="h-4 w-4 text-orange-500" /></div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums">{loading ? "—" : currentStreak}<span className="ml-1 text-sm font-semibold text-muted-foreground">days</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{longestStreak ? `Longest: ${longestStreak} days` : "Complete a practice quiz to start a streak."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Practice this week</span><Activity className="h-4 w-4 text-primary" /></div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums">{loading ? "—" : weeklyQuizCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Completed quizzes in the last 7 days</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Practice accuracy</span><Target className="h-4 w-4 text-emerald-600" /></div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums">{loading ? "—" : recentAccuracy === null ? "—" : recentAccuracy + "%"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{totals.questions.toLocaleString()} questions recorded over the last year</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topics practised</span><BookOpen className="h-4 w-4 text-primary" /></div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums">{loading ? "—" : topics.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{coveredSubjects} of {selectedSubjects.length} selected subjects started</p>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-[#0b625a] via-[#137f72] to-[#0b766c] p-5 text-white shadow-[0_18px_48px_rgba(15,45,70,.18)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-1/4 h-56 w-56 rounded-full bg-[#49b4a0]/30 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"><Sparkles className="h-3.5 w-3.5" /> Learn · Compete · Level up</span>
            <h2 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">{focusTopic ? "Build confidence in " + focusTopic.topic : "Make your next study session count."}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
              {focusTopic
                ? `Your recorded accuracy in ${focusTopic.subject} is ${Math.round(Number(focusTopic.accuracy_percentage) || 0)}% across ${Number(focusTopic.questions_attempted) || 0} attempted questions.`
                : "Your topic coverage will build automatically from completed quizzes. Every saved answer is used to update your real progress."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to={focusTopic ? "/academic/topics" : "/academic"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0b625a] transition hover:bg-slate-100"><BookOpen className="h-4 w-4" /> {focusTopic ? "Review topic coverage" : "Open academic hub"}</Link>
              <Link to="/academic/planner" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10"><CalendarDays className="h-4 w-4" /> Study planner</Link>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 lg:flex-col lg:gap-2 lg:text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white/25 text-lg font-extrabold tabular-nums" style={{ background: `conic-gradient(#ffffff ${xpProgress.percentage}%, rgba(255,255,255,.14) 0)` }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0b625a]">{xpProgress.percentage}%</span>
            </div>
            <div><p className="text-sm font-bold">Level {level} progress</p><p className="text-xs text-white/70">{nextLevelXp.toLocaleString()} XP to next level</p></div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Recorded performance</p><h2 className="mt-1 text-lg font-extrabold">Topic coverage</h2></div>
            <Link to="/academic/topics" aria-label="Open topic coverage" className="flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-primary/10"><ArrowRight className="h-4 w-4" /></Link>
          </div>
          {loading ? <div className="mt-5 space-y-3" aria-label="Loading topic coverage"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /></div> :
            topics.length ? <div className="mt-5 space-y-4">{topics.slice(0, 6).map((topic) => {
              const accuracy = Math.max(0, Math.min(100, Number(topic.accuracy_percentage) || 0));
              return <div key={topic.subject + topic.topic}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{topic.topic}</span><span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{accuracy}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: accuracy + "%" }} /></div>
                <p className="mt-1 text-[11px] text-muted-foreground">{topic.subject} · {Number(topic.questions_attempted) || 0} questions attempted</p>
              </div>;
            })}</div> : <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-center"><BookOpen className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">No topic results recorded yet</p><p className="mt-1 text-xs text-muted-foreground">Complete a quiz using approved question-bank content to build your real topic coverage.</p><Link to="/quiz" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Start practising <ArrowRight className="h-4 w-4" /></Link></div>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Last 7 days</p></div>
          <h2 className="mt-1 text-lg font-extrabold">Practice activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">Completed quizzes saved to your account.</p>
          {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading saved activity…</p> : <>
            <div className="mt-6 flex h-28 items-end justify-between gap-2">
              {weeklyActivity.map((day) => <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${day.count} completed quizzes · ${day.questions} questions`}>
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{day.count || ""}</span>
                <div className="flex h-20 w-full items-end rounded-md bg-muted/70"><div className="w-full rounded-md bg-primary/75" style={{ height: `${day.count ? Math.max(8, day.count / maxActivity * 100) : 0}%` }} /></div>
                <span className="text-[10px] text-muted-foreground">{formatDay(day.date)}</span>
              </div>)}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Questions answered correctly</span><strong className="text-lg tabular-nums">{totals.correct.toLocaleString()}/{totals.questions.toLocaleString()}</strong></div>
            {recentResults.length > 0 && <div className="mt-4 space-y-2">{recentResults.slice(0, 3).map((result, index) => <div key={(result.completed_at || "saved") + "-" + index} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Completed practice</p><p className="text-[11px] text-muted-foreground">{result.completed_at ? new Date(result.completed_at).toLocaleString() : "Saved attempt"}</p></div><span className="text-xs font-bold tabular-nums">{Number(result.correct_answers) || 0}/{Number(result.total_questions) || 0}</span></div>)}</div>}
            {!recentResults.length && <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center"><Clock3 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-xs font-semibold">No completed practice recorded yet</p></div>}
          </>}
          <Link to="/academic/insights" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">View academic insights <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Exam countdown</p></div>
          {examTarget ? <div className="mt-3">
            <p className="text-sm font-semibold">{examTarget.exam_name}</p>
            <p className="mt-2 text-4xl font-extrabold tabular-nums">{daysToExam !== null && daysToExam > 0 ? daysToExam : 0}<span className="ml-2 text-base font-semibold text-muted-foreground">days</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{daysToExam === 0 ? "Your exam date is today." : daysToExam !== null && daysToExam < 0 ? "This saved exam date has passed." : `Scheduled for ${new Date(examTarget.exam_date + "T00:00:00+03:00").toLocaleDateString(undefined, { timeZone: ADDIS_TIME_ZONE, dateStyle: "long" })}`}</p>
            <p className="mt-3 rounded-lg bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">This date is saved once and locked to protect your countdown.</p>
          </div> : <form className="mt-4 space-y-3" onSubmit={saveExamTarget}>
            <p className="text-sm text-muted-foreground">Set your target exam date once. It will be saved to your account and cannot be changed afterwards.</p>
            <label className="block space-y-1.5"><span className="text-xs font-semibold">Exam name</span><input required minLength={2} maxLength={100} value={examNameInput} onChange={(event) => setExamNameInput(event.target.value)} placeholder="e.g. Grade 12 Exit Exam" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" /></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold">Exam date</span><input required type="date" min={todayKey} value={examDateInput} onChange={(event) => setExamDateInput(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" /></label>
            <button type="submit" disabled={savingExam || !examDateInput || examNameInput.trim().length < 2} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{savingExam ? "Saving…" : "Save exam date once"} <ArrowRight className="h-4 w-4" /></button>
          </form>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/study-mode" className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wider text-primary">Focus session</span><strong className="mt-1 block">Study mode</strong><span className="text-xs text-muted-foreground">Start or join a focused learning session.</span></span>
            <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-1" />
          </Link>
          <Link to="/multiplayer" className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600"><Users className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wider text-sky-600">Play together</span><strong className="mt-1 block">Challenge a friend</strong><span className="text-xs text-muted-foreground">Open the multiplayer arena.</span></span>
            <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-1" />
          </Link>
          <Link to="/learning-dna" className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600"><BrainCircuit className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm">Learning DNA</strong><span className="text-xs text-muted-foreground">Explore your real study patterns.</span></span>
            <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-1" />
          </Link>
          <Link to="/leaderboard" className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Trophy className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm">Achievements & rankings</strong><span className="text-xs text-muted-foreground">See your position and earned rewards.</span></span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default UpperTierHome;
