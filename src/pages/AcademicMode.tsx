import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Brain, Target, CalendarDays, BarChart3, GraduationCap, TrendingUp, ArrowUpRight, Settings2, ClipboardCheck, Sparkles, Loader2 } from "lucide-react";
import { getAcademicProfile, normalizeGrade } from "@/lib/academicProfile";

const features = [
  { title: "Exam practice", eyebrow: "PREPARE", description: "Timed practice using approved quizzes and real question sets.", icon: Target, path: "/academic/exam", action: "Start an exam", featured: true },
  { title: "Entrance past papers", eyebrow: "PAST PAPERS", description: "Browse Ethiopian Grade 12 entrance exam papers by subject and year, with source links.", icon: GraduationCap, path: "/academic/entrance-papers", action: "Browse past papers" },
  { title: "Flashcards", eyebrow: "REMEMBER", description: "Review concepts with active recall and spaced practice.", icon: BookOpen, path: "/academic/flashcards", action: "Review cards" },
  { title: "Library", eyebrow: "LEARN", description: "Open your learning resources and selected textbooks without leaving Academic Prep.", icon: BookOpen, path: "/library", action: "Open library" },
  { title: "Topic coverage", eyebrow: "MASTER", description: "Track your progress and find topics that need attention.", icon: BarChart3, path: "/academic/topics", action: "View topics" },
  { title: "Study planner", eyebrow: "ORGANIZE", description: "Turn your study goal into realistic daily tasks.", icon: CalendarDays, path: "/academic/planner", action: "Plan your week" },
  { title: "Academic insights", eyebrow: "IMPROVE", description: "See your performance, strengths and areas to improve.", icon: TrendingUp, path: "/academic/insights", action: "See progress" },
];

const formatSubject = (subject: unknown): string => {
  if (typeof subject !== "string" || !subject.trim()) return "General subject";
  const normalized = subject.trim();
  return normalized.toLowerCase() === "math"
    ? "Mathematics"
    : normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const AcademicMode: React.FC = () => {
  const { user } = useUser();
  const tier = useTier();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [weekDone, setWeekDone] = useState(0);
  const [recentResult, setRecentResult] = useState<{ score: number; total_questions: number; completed_at?: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [topicProgress, setTopicProgress] = useState<Array<{subject:string;topic:string;completion_percentage:number;accuracy_percentage:number;questions_attempted:number;questions_correct:number}>>([]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(false);
      const p = await getAcademicProfile(user.id).catch(() => null);
      if (cancelled) return;
      if (!p) {
        navigate("/academic/setup", { replace: true });
        return;
      }
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      const start = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
      const [todayRes, weekRes, resultsRes, topicsRes] = await Promise.all([
        supabase.from("study_plans").select("id,completed").eq("user_id", user.id).eq("scheduled_date", today),
        supabase.from("study_plans").select("id,completed").eq("user_id", user.id).gte("scheduled_date", start).lte("scheduled_date", today),
        supabase.from("quiz_results").select("score,total_questions,created_at").eq("student_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("topic_progress").select("subject,topic,completion_percentage,accuracy_percentage,questions_attempted,questions_correct").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      if (todayRes.error || weekRes.error || resultsRes.error || topicsRes.error) setLoadError(true);
      setProfile(p);
      setTodayCount(todayRes.data?.length || 0);
      setTodayCompleted(todayRes.data?.filter((item) => item.completed).length || 0);
      setWeekDone(weekRes.data?.filter((item) => item.completed).length || 0);
      setRecentResult(resultsRes.data || null);
      setTopicProgress((topicsRes.data || []) as typeof topicProgress);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, navigate, reloadKey]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading your study space…</div>;

  const grade = normalizeGrade(profile?.grade, normalizeGrade(user?.grade, 9));
  const goalLabels: Record<string, string> = { class: "School / Class", ministry_exam: "Ministry Exam", university_entrance: "University Entrance", national_exam: "National / Regional Exam", custom: "Custom goal" };
  const goal = profile?.study_goal_detail || goalLabels[profile?.study_goal] || "Study goal";
  const subjects: string[] = Array.isArray(profile?.subjects)
    ? profile.subjects.filter((subject: unknown): subject is string => typeof subject === "string" && subject.trim().length > 0).map((subject: string) => subject.trim())
    : [];
  const safeTopicProgress = Array.isArray(topicProgress)
    ? topicProgress.filter((row): row is NonNullable<typeof row> => Boolean(row && typeof row === "object"))
    : [];
  const todayProgress = todayCount ? Math.round((todayCompleted / todayCount) * 100) : 0;
  const recentScore = recentResult?.score == null ? null : Math.max(0, Math.min(100, Number(recentResult.score)));
  const syllabusRows = subjects.map((subject: string) => {
    const key = subject.toLowerCase() === "math" ? "mathematics" : subject.toLowerCase();
    const rows = topicProgress.filter((row) => {
      const topicSubject = row.subject?.toLowerCase();
      return topicSubject === key || (key === "mathematics" && topicSubject === "math");
    });
    const attempted = rows.filter((row) => Number.isFinite(Number(row.questions_attempted)) && Number(row.questions_attempted) > 0);
    const completed = rows.filter((row) => Number(row.completion_percentage) >= 100 || (Number(row.accuracy_percentage) >= 80 && Number(row.questions_attempted) >= 5));
    return { subject, total: rows.length, attempted: attempted.length, completed: completed.length, pct: rows.length ? Math.round((completed.length / rows.length) * 100) : 0 };
  });

  return (
    <div className={tier === "upper" ? "tier-upper mm-academic-upper min-h-screen bg-background text-foreground" : "min-h-screen bg-muted/30"}>
      <header className={tier === "upper" ? "border-b border-border/70 bg-background/95 backdrop-blur-xl" : "border-b bg-background"}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className={tier === "upper" ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"}><GraduationCap className="h-6 w-6" /></div>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Minds · {tier === "upper" ? "Academic workspace" : "Study"}</p><h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Academic Prep</h1></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/academic/setup")}><Settings2 className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Edit profile</span><span className="sm:hidden">Edit</span></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
        {tier === "upper" && <section className="space-y-3" aria-labelledby="syllabus-mastery-title">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Syllabus mastery center</p><h2 id="syllabus-mastery-title" className="mt-1 text-xl font-bold sm:text-2xl">Your subjects, your progress</h2><p className="mt-1 text-sm text-muted-foreground">Completion is calculated from saved topic progress. Subjects without recorded topics remain unmeasured, not marked complete.</p></div><Button variant="outline" onClick={() => navigate("/academic/topics")}>Open Topic Coverage <ArrowUpRight className="ml-2 h-4 w-4"/></Button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {syllabusRows.map((row) => <Card key={row.subject} className="border-border bg-card"><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{formatSubject(row.subject)}</h3><Badge variant="outline">{row.total ? `${row.pct}%` : "Not measured"}</Badge></div><Progress value={row.total ? row.pct : 0} className="mt-4 h-2"/><p className="mt-2 text-xs text-muted-foreground">{row.total ? `${row.completed} of ${row.total} tracked topics mastered · ${row.attempted} attempted` : "Complete practice to start building your topic record."}</p><Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/academic/exam", { state: { subject: row.subject } })}>Practice {formatSubject(row.subject)} <ArrowUpRight className="ml-2 h-4 w-4"/></Button></CardContent></Card>)}
          </div>
        </section>}
        <section className={tier === "upper" ? "mm-academic-hero relative overflow-hidden rounded-3xl border border-border/70 shadow-sm" : "relative overflow-hidden rounded-3xl border bg-card shadow-sm"}>
          <div className={tier === "upper" ? "absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-primary/[0.09] to-transparent md:block" : "absolute inset-y-0 right-0 hidden w-1/3 bg-primary/[0.04] md:block"} />
          <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center md:p-9">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">Grade {grade}</Badge><Badge variant="outline">{profile?.curriculum === "oromia" ? "Oromia curriculum" : "Addis Ababa curriculum"}</Badge></div>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Prepare with a plan, not guesswork.</h2>
              <p className={tier === "upper" ? "text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base" : "mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base"}>Your study space is tailored to your grade, subjects and goal. Practice, review your mistakes and build steady progress—one session at a time.</p>
              <div className="mt-5 flex flex-wrap gap-2">{subjects.length ? subjects.map((item: string) => <Badge key={item} variant="outline" className="bg-background font-medium">{formatSubject(item)}</Badge>) : <span className="text-sm text-muted-foreground">Add your subjects in your study profile.</span>}</div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button className={tier === "upper" ? "btn-3d-primary bg-primary text-primary-foreground h-11 font-bold" : "h-11"} onClick={() => navigate("/academic/exam")}><Target className="mr-2 h-4 w-4" />Start exam practice</Button><Button variant="outline" className={tier === "upper" ? "h-11 border-border bg-card text-foreground hover:bg-muted" : "h-11"} onClick={() => navigate("/academic/planner")}><CalendarDays className="mr-2 h-4 w-4" />Plan study time</Button></div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-56 md:grid-cols-1">
              <div className={tier === "upper" ? "mm-academic-metric border bg-background p-4 text-foreground" : "rounded-2xl border bg-background p-4"}><div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /><span className="text-xs font-medium">Today's plan</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{todayCompleted}<span className="text-base font-medium text-muted-foreground">/{todayCount}</span></p>{todayCount > 0 && <Progress value={todayProgress} className="mt-3 h-1.5" />}{todayCount === 0 && <p className="mt-1 text-xs text-muted-foreground">No tasks scheduled yet</p>}</div>
              <div className={tier === "upper" ? "mm-academic-metric border bg-background p-4 text-foreground" : "rounded-2xl border bg-background p-4"}><div className="flex items-center gap-2 text-muted-foreground"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-medium">Last exam score</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{recentScore == null ? "—" : `${Math.round(recentScore)}%`}</p><p className="mt-1 text-xs text-muted-foreground">{recentScore == null ? "Complete an exam to begin tracking" : `${recentResult?.total_questions || 0} questions in latest attempt`}</p></div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your learning tools</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Choose your next step</h2><p className="mt-1 text-sm text-muted-foreground">Everything works with your saved study profile.</p></div><Badge variant="outline" className="hidden sm:flex">{subjects.length} subjects</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => { const Icon = feature.icon; return <button key={feature.path} type="button" onClick={() => navigate(feature.path)} className={`mm-academic-feature ${tier === "upper" ? "btn-3d-card" : ""} group rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${feature.featured ? "border-primary/30 bg-primary/[0.035] sm:col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div>
              <p className="mt-4 text-[11px] font-bold tracking-[0.16em] text-primary">{feature.eyebrow}</p><h3 className="mt-1 text-lg font-semibold">{feature.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{feature.description}</p><span className="mt-4 inline-flex items-center text-sm font-semibold">{feature.action}<ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></span>
            </button>; })}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><GraduationCap className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Study level</p><p className="font-semibold">Grade {grade}</p></div></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BookOpen className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Study subjects</p><p className="font-semibold">{subjects.length} selected</p></div></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Sparkles className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Weekly tasks completed</p><p className="font-semibold">{weekDone} completed</p></div></CardContent></Card>
        </section>
        {loadError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Some dashboard totals couldn't load. Your study tools are still available; try loading the totals again.</p><Button variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setReloadKey((key) => key + 1)}>Retry dashboard data</Button></div>}
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="leading-6 text-muted-foreground"><span className="font-semibold text-foreground">Personalized, connected practice.</span> Exam results feed your progress, topics show your mastery, and your planner helps you focus on the next useful task. AI Tutor is unchanged.</p></div>
      </main>
    </div>
  );
};

export default AcademicMode;
