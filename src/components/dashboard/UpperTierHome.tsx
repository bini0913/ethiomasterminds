import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2,
  Clock3, Play, Sparkles, Users,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { db } from "@/integrations/untypedClient";
import { getXpProgressInLevel } from "@/lib/rankSystem";

type TopicRow = {
  subject: string;
  topic: string;
  accuracy_percentage: number | null;
  questions_attempted: number | null;
};
type ResultRow = {
  correct_answers: number | null;
  total_questions: number | null;
  completed_at: string | null;
};

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const UpperTierHome: React.FC = () => {
  const { user } = useUser();
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [recentResults, setRecentResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const xp = Number(user?.xp) || 0;
  const level = Number(user?.level) || 1;
  const xpProgress = getXpProgressInLevel(xp);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Student";
  const grade = user?.grade
    ? (/grade/i.test(user.grade) ? user.grade : `Grade ${user.grade}`)
    : "Grades 9–12";
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    if (!user?.id) {
      setTopics([]);
      setRecentResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const [topicResponse, resultResponse] = await Promise.all([
        db.from("topic_progress")
          .select("subject,topic,accuracy_percentage,questions_attempted")
          .eq("user_id", user.id)
          .gt("questions_attempted", 0)
          .order("accuracy_percentage", { ascending: true })
          .limit(6),
        db.from("quiz_results")
          .select("correct_answers,total_questions,completed_at")
          .eq("student_id", user.id)
          .order("completed_at", { ascending: false })
          .limit(30),
      ]);
      if (!active) return;
      if (topicResponse.error || resultResponse.error) {
        console.error("Grades 9–12 dashboard data could not be fully loaded:", topicResponse.error || resultResponse.error);
        setLoadError("Some saved learning information is temporarily unavailable. Your account data has not been changed.");
      }
      setTopics((topicResponse.data || []) as TopicRow[]);
      setRecentResults((resultResponse.data || []) as ResultRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const totals = useMemo(() => recentResults.reduce((sum, result) => ({
    correct: sum.correct + (Number(result.correct_answers) || 0),
    questions: sum.questions + (Number(result.total_questions) || 0),
  }), { correct: 0, questions: 0 }), [recentResults]);
  const recentAccuracy = totals.questions ? Math.round((totals.correct / totals.questions) * 100) : null;
  const nextLevelXp = Math.max(0, xpProgress.max - xpProgress.current);
  const weeklyActivity = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return { date, count: 0 };
    });
    const counts = new Map(days.map(day => [dayKey(day.date), day]));
    recentResults.forEach(result => {
      if (!result.completed_at) return;
      const date = new Date(result.completed_at);
      if (Number.isNaN(date.getTime())) return;
      const bucket = counts.get(dayKey(date));
      if (bucket) bucket.count += 1;
    });
    return days;
  }, [recentResults]);
  const maxActivity = Math.max(1, ...weeklyActivity.map(day => day.count));
  const focusTopic = topics[0] || null;

  return (
    <div className="space-y-7 pb-4">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{grade} · {dateLabel}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting}, {firstName}.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Your space to learn with direction, practise with purpose and see your progress.</p>
        </div>
        <Link to="/study-mode" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-105 sm:self-auto">
          <Play className="h-4 w-4 fill-current" /> Start focus session
        </Link>
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
                ? `Your recorded accuracy in ${focusTopic.subject} is ${Math.round(Math.max(0, Math.min(100, Number(focusTopic.accuracy_percentage) || 0)))}%. Continue practising to strengthen this topic.`
                : "Start a learning activity. Your saved topic coverage and practice history will appear here as you use Master Minds."}
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

      <section className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Recorded performance</p><h2 className="mt-1 text-lg font-extrabold">Topic coverage</h2></div>
            <Link to="/academic/topics" aria-label="Open topic coverage" className="flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-primary/10"><ArrowRight className="h-4 w-4" /></Link>
          </div>
          {loading ? <div className="mt-5 space-y-3" aria-label="Loading topic coverage"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /></div> :
            topics.length ? <div className="mt-5 space-y-4">{topics.slice(0, 5).map((topic, index) => {
              const accuracy = Math.max(0, Math.min(100, Number(topic.accuracy_percentage) || 0));
              return <div key={topic.subject + topic.topic + index}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{topic.topic}</span><span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{accuracy}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: accuracy + "%" }} /></div>
                <p className="mt-1 text-[11px] text-muted-foreground">{topic.subject} · {Number(topic.questions_attempted) || 0} questions attempted</p>
              </div>;
            })}</div> : <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-center"><BookOpen className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">No topic results recorded yet</p><p className="mt-1 text-xs text-muted-foreground">Complete practice to build your real topic coverage.</p><Link to="/quiz" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Start practising <ArrowRight className="h-4 w-4" /></Link></div>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Last 7 days</p></div>
          <h2 className="mt-1 text-lg font-extrabold">Practice activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">Completed quiz attempts recorded to your account.</p>
          {loadError && <p role="status" className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-muted-foreground">{loadError}</p>}
          {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading saved activity…</p> : <>
            <div className="mt-6 flex h-28 items-end justify-between gap-2">
              {weeklyActivity.map((day, index) => <div key={dayKey(day.date)} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{day.count || ""}</span>
                <div className="flex h-20 w-full items-end rounded-md bg-muted/70"><div className={`w-full rounded-md ${index === 6 ? "bg-primary" : "bg-primary/55"}`} style={{ height: `${day.count ? Math.max(8, day.count / maxActivity * 100) : 0}%` }} /></div>
                <span className="text-[10px] text-muted-foreground">{day.date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              </div>)}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Accuracy across loaded attempts</span><strong className="text-lg tabular-nums">{recentAccuracy === null ? "—" : recentAccuracy + "%"}</strong></div>
            {recentResults.length > 0 && <div className="mt-4 space-y-2">{recentResults.slice(0, 3).map((result, index) => <div key={result.completed_at + "-" + index} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Completed practice</p><p className="text-[11px] text-muted-foreground">{result.completed_at ? new Date(result.completed_at).toLocaleString() : "Saved attempt"}</p></div><span className="text-xs font-bold tabular-nums">{Number(result.correct_answers) || 0}/{Number(result.total_questions) || 0}</span></div>)}</div>}
            {!recentResults.length && <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center"><Clock3 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-xs font-semibold">No completed practice recorded yet</p></div>}
          </>}
          <Link to="/academic/insights" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">View academic insights <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link to="/learning-dna" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">Understand your learning</strong><span className="text-xs text-muted-foreground">Explore your Learning DNA and study patterns.</span></span><ArrowRight className="h-4 w-4 text-primary" />
        </Link>
        <Link to="/leaderboard" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Trophy className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">Achievements & rankings</strong><span className="text-xs text-muted-foreground">See your position and earned rewards.</span></span><ArrowRight className="h-4 w-4 text-primary" />
        </Link>
      </section>
    </div>
  );
};

export default UpperTierHome;
