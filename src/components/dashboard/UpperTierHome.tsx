import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, Flame, GraduationCap, LibraryBig, Play, Sparkles, Target, Timer, Trophy, Zap } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { getXpProgressInLevel } from "@/lib/rankSystem";

type TopicRow = { subject: string; topic: string; accuracy_percentage: number | null; questions_attempted: number | null };
type ResultRow = { correct_answers: number | null; total_questions: number | null; completed_at: string | null };

const actions = [
  { title: "Academic preparation", detail: "Plan subjects and prepare for exams", to: "/academic", icon: GraduationCap },
  { title: "Exam mode", detail: "Start a timed practice session", to: "/academic/exam", icon: Target },
  { title: "Flashcards", detail: "Review and strengthen recall", to: "/academic/flashcards", icon: BrainCircuit },
  { title: "Textbooks & library", detail: "Continue from your learning resources", to: "/library", icon: LibraryBig },
];

const UpperTierHome: React.FC = () => {
  const { user } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [recentResults, setRecentResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const xp = Number(user?.xp) || 0;
  const level = Number(user?.level) || 1;
  const xpProgress = getXpProgressInLevel(xp);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Student";
  const grade = user?.grade ? (/grade/i.test(user.grade) ? user.grade : "Grade " + user.grade) : "Grades 9–12";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const [topicResponse, resultResponse] = await Promise.all([
        supabase.from("topic_progress")
          .select("subject,topic,accuracy_percentage,questions_attempted")
          .eq("user_id", user.id)
          .gt("questions_attempted", 0)
          .order("accuracy_percentage", { ascending: true })
          .limit(6),
        supabase.from("quiz_results")
          .select("correct_answers,total_questions,completed_at")
          .eq("student_id", user.id)
          .order("completed_at", { ascending: false })
          .limit(5),
      ]);
      if (!active) return;
      if (topicResponse.error || resultResponse.error) {
        console.error("Grades 9–12 dashboard data could not be fully loaded:", topicResponse.error || resultResponse.error);
        setLoadError("Some learning information is temporarily unavailable. Your saved account data has not been changed.");
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

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{grade} · Your learning workspace</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting}, {firstName}.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">A clear place to study, practise, track progress and learn with others.</p>
        </div>
        <Link to="/study-mode" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-105 sm:self-auto">
          <Play className="h-4 w-4 fill-current" /> Start a study session
        </Link>
      </section>

      <section className="relative overflow-hidden rounded-[28px] bg-[#0b625a] p-5 text-white shadow-[0_16px_38px_rgba(11,98,90,.16)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-1/4 h-56 w-56 rounded-full bg-[#137f72]/70 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"><Sparkles className="h-3.5 w-3.5" /> Learn · Compete · Level up</span>
            <h2 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">Make your next study session count.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Pick up your preparation, practise a topic or join a study session. Your progress is based on activity saved to your account.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/academic/exam" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0b625a] transition hover:bg-[#e4f3ef]"><Target className="h-4 w-4" /> Open exam mode</Link>
              <Link to="/academic/planner" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10"><CalendarDays className="h-4 w-4" /> Study planner</Link>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 md:min-w-[220px] md:flex-col md:gap-2 md:text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white/25 text-lg font-extrabold tabular-nums" style={{ background: "conic-gradient(#ffffff " + xpProgress.percentage + "%, rgba(255,255,255,.14) 0)" }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0b625a]">{xpProgress.percentage}%</span>
            </div>
            <div><p className="text-sm font-bold">Level {level} progress</p><p className="text-xs text-white/70">{nextLevelXp.toLocaleString()} XP to next level</p></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Experience", value: xp.toLocaleString() + " XP", icon: Zap },
          { label: "Level", value: String(level), icon: GraduationCap },
          { label: "Study streak", value: String(Number(dailyStreak) || 0) + " days", icon: Flame },
          { label: "Coins", value: (Number(coins) || 0).toLocaleString(), icon: Trophy },
        ].map((stat) => {
          const Icon = stat.icon;
          return <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" /></span>
            <p className="mt-3 text-xl font-extrabold tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
          </div>;
        })}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Your learning tools</p><h2 className="mt-1 text-xl font-extrabold sm:text-2xl">Choose what to work on</h2></div>
          <Link to="/academic" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">Academic hub <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return <Link key={action.to} to={action.to} className="group flex min-h-[132px] flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
              <span className="mt-3 font-bold">{action.title}</span>
              <span className="mt-1 text-xs leading-5 text-muted-foreground">{action.detail}</span>
              <ArrowRight className="ml-auto mt-2 h-4 w-4 text-primary transition group-hover:translate-x-1" />
            </Link>;
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Recorded performance</p><h2 className="mt-1 text-lg font-extrabold">Topic coverage</h2></div>
            <Link to="/academic/topics" aria-label="Open topic coverage" className="flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-primary/10"><ArrowRight className="h-4 w-4" /></Link>
          </div>
          {loading ? <div className="mt-5 space-y-3" aria-label="Loading topic coverage"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /></div> :
            topics.length ? <div className="mt-5 space-y-4">
              {topics.slice(0, 5).map((topic, index) => {
                const accuracy = Math.max(0, Math.min(100, Number(topic.accuracy_percentage) || 0));
                return <div key={topic.subject + topic.topic + index}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{topic.topic}</span><span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{accuracy}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: accuracy + "%" }} /></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{topic.subject} · {Number(topic.questions_attempted) || 0} questions attempted</p>
                </div>;
              })}
            </div> : <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-center"><BookOpen className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">No topic results recorded yet</p><p className="mt-1 text-xs text-muted-foreground">Complete practice to build your real topic coverage.</p><Link to="/quiz" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Start practising <ArrowRight className="h-4 w-4" /></Link></div>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Recent activity</p></div>
          <h2 className="mt-1 text-lg font-extrabold">Your practice record</h2>
          {loadError && <p role="status" className="mt-3 rounded-lg bg-warning/10 p-3 text-xs text-muted-foreground">{loadError}</p>}
          {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading saved activity…</p> : recentResults.length ? <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-secondary/70 p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">Latest recorded practice</p><p className="text-xs text-muted-foreground">{recentResults[0].completed_at ? new Date(recentResults[0].completed_at).toLocaleString() : "Saved attempt"}</p></div><span className="text-sm font-extrabold tabular-nums">{Number(recentResults[0].correct_answers) || 0}/{Number(recentResults[0].total_questions) || 0}</span></div>
            <div className="flex items-center justify-between border-t border-border pt-3"><span className="text-sm text-muted-foreground">Accuracy across latest {recentResults.length} attempts</span><strong className="text-lg tabular-nums">{recentAccuracy === null ? "—" : recentAccuracy + "%"}</strong></div>
          </div> : <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-center"><Clock3 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">Your activity will appear here</p><p className="mt-1 text-xs text-muted-foreground">We only show results saved to your account.</p></div>}
          <Link to="/academic/insights" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">View academic insights <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link to="/multiplayer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersIcon /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">Study and compete together</strong><span className="text-xs text-muted-foreground">Open the multiplayer arena and invite a friend.</span></span><ArrowRight className="h-4 w-4 text-primary" />
        </Link>
        <Link to="/learning-dna" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f3ef] text-[#0b625a] dark:bg-[#183c38] dark:text-[#78d7c6]"><BrainCircuit className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">Understand your learning</strong><span className="text-xs text-muted-foreground">Explore your Learning DNA and study patterns.</span></span><ArrowRight className="h-4 w-4 text-primary" />
        </Link>
      </section>
    </div>
  );
};

function UsersIcon() {
  return <Trophy className="h-5 w-5" />;
}

export default UpperTierHome;
