import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Brain, Target, CalendarDays, ChartNoAxesCombined, GraduationCap, TrendingUp, ArrowUpRight, Settings2, ClipboardCheck, Sparkles, Loader2 } from "lucide-react";
import { getAcademicProfile, normalizeGrade } from "@/lib/academicProfile";

const features = [
  { title: "Exam practice", eyebrow: "PREPARE", description: "Timed practice using approved quizzes and real question sets.", icon: Target, path: "/academic/exam", action: "Start an exam", featured: true },
  { title: "Flashcards", eyebrow: "REMEMBER", description: "Review concepts with active recall and spaced practice.", icon: BookOpen, path: "/academic/flashcards", action: "Review cards" },
  { title: "Topic coverage", eyebrow: "MASTER", description: "Track your progress and find topics that need attention.", icon: ChartNoAxesCombined, path: "/academic/topics", action: "View topics" },
  { title: "Study planner", eyebrow: "ORGANIZE", description: "Turn your study goal into realistic daily tasks.", icon: CalendarDays, path: "/academic/planner", action: "Plan your week" },
  { title: "Academic insights", eyebrow: "IMPROVE", description: "See your performance, strengths and areas to improve.", icon: TrendingUp, path: "/academic/insights", action: "See progress" },
];

const formatSubject = (subject: string) => subject === "math" ? "Mathematics" : subject.replace(/\b\w/g, (letter) => letter.toUpperCase());

const AcademicMode: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [weekDone, setWeekDone] = useState(0);
  const [recentResult, setRecentResult] = useState<{ score: number; total_questions: number; created_at?: string } | null>(null);
  const [loadError, setLoadError] = useState(false);

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
      const [todayRes, weekRes, resultsRes] = await Promise.all([
        supabase.from("study_plans").select("id,completed").eq("user_id", user.id).eq("scheduled_date", today),
        supabase.from("study_plans").select("id,completed").eq("user_id", user.id).gte("scheduled_date", start).lte("scheduled_date", today),
        supabase.from("quiz_results").select("score,total_questions,created_at").eq("student_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      if (todayRes.error || weekRes.error) setLoadError(true);
      setProfile(p);
      setTodayCount(todayRes.data?.length || 0);
      setTodayCompleted(todayRes.data?.filter((item) => item.completed).length || 0);
      setWeekDone(weekRes.data?.filter((item) => item.completed).length || 0);
      setRecentResult(resultsRes.data || null);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, navigate]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading your study space…</div>;

  const grade = normalizeGrade(profile?.grade, normalizeGrade(user?.grade, 9));
  const goalLabels: Record<string, string> = { class: "School / Class", ministry_exam: "Ministry Exam", university_entrance: "University Entrance", national_exam: "National / Regional Exam", custom: "Custom goal" };
  const goal = profile?.study_goal_detail || goalLabels[profile?.study_goal] || "Study goal";
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects : [];
  const todayProgress = todayCount ? Math.round((todayCompleted / todayCount) * 100) : 0;
  const recentScore = recentResult?.score == null ? null : Math.max(0, Math.min(100, Number(recentResult.score)));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><GraduationCap className="h-6 w-6" /></div>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Minds · Study</p><h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Academic Prep</h1></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/academic/setup")}><Settings2 className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Edit profile</span><span className="sm:hidden">Edit</span></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-12 sm:px-6 sm:py-8">
        <section className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-primary/[0.04] md:block" />
          <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center md:p-9">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">Grade {grade}</Badge><Badge variant="outline">{profile?.curriculum === "oromia" ? "Oromia curriculum" : "Addis Ababa curriculum"}</Badge></div>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Make every study session count.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Your study space is tailored to your grade, subjects and goal. Practice, review your mistakes and build steady progress—one session at a time.</p>
              <div className="mt-5 flex flex-wrap gap-2">{subjects.length ? subjects.map((item: string) => <Badge key={item} variant="outline" className="bg-background font-medium">{formatSubject(item)}</Badge>) : <span className="text-sm text-muted-foreground">Add your subjects in your study profile.</span>}</div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button className="h-11" onClick={() => navigate("/academic/exam")}><Target className="mr-2 h-4 w-4" />Start exam practice</Button><Button variant="outline" className="h-11" onClick={() => navigate("/academic/planner")}><CalendarDays className="mr-2 h-4 w-4" />Plan study time</Button></div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-56 md:grid-cols-1">
              <div className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /><span className="text-xs font-medium">Today's plan</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{todayCompleted}<span className="text-base font-medium text-muted-foreground">/{todayCount}</span></p>{todayCount > 0 && <Progress value={todayProgress} className="mt-3 h-1.5" />}{todayCount === 0 && <p className="mt-1 text-xs text-muted-foreground">No tasks scheduled yet</p>}</div>
              <div className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-muted-foreground"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-medium">Last exam score</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{recentScore == null ? "—" : `${Math.round(recentScore)}%`}</p><p className="mt-1 text-xs text-muted-foreground">{recentScore == null ? "Complete an exam to begin tracking" : `${recentResult?.total_questions || 0} questions in latest attempt`}</p></div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your learning tools</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Choose your next step</h2><p className="mt-1 text-sm text-muted-foreground">Everything works with your saved study profile.</p></div><Badge variant="outline" className="hidden sm:flex">{subjects.length} subjects</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => { const Icon = feature.icon; return <button key={feature.path} type="button" onClick={() => navigate(feature.path)} className={`group rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${feature.featured ? "border-primary/30 bg-primary/[0.035] sm:col-span-2 lg:col-span-1" : ""}`}>
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
        {loadError && <p className="text-sm text-muted-foreground">Some dashboard totals couldn't load. Your study tools are still available; refresh to try again.</p>}
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="leading-6 text-muted-foreground"><span className="font-semibold text-foreground">Personalized, connected practice.</span> Exam results feed your progress, topics show your mastery, and your planner helps you focus on the next useful task. AI Tutor is unchanged.</p></div>
      </main>
    </div>
  );
};

export default AcademicMode;
