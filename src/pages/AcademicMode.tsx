import { db } from "@/integrations/untypedClient";
import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Brain, Target, CalendarDays, BarChart3, GraduationCap, TrendingUp, ArrowUpRight, Settings2, Loader2, CheckCircle2 } from "lucide-react";
import { getAcademicProfile, resolveAcademicGrade } from "@/lib/academicProfile";

const features = [
  { title: "Exam practice", eyebrow: "PREPARE", description: "Timed practice using approved quizzes and real question sets.", icon: Target, path: "/academic/exam", action: "Start an exam", featured: true },
  { title: "Entrance past papers", eyebrow: "PAST PAPERS", description: "Browse Ethiopian Grade 12 entrance exam papers by subject and year, with source links.", icon: GraduationCap, path: "/academic/entrance-papers", action: "Browse past papers" },
  { title: "Flashcards", eyebrow: "REMEMBER", description: "Review concepts with active recall and spaced practice.", icon: BookOpen, path: "/academic/flashcards", action: "Review cards" },
  { title: "Library", eyebrow: "LEARN", description: "Open your learning resources and selected textbooks without leaving Academic Prep.", icon: BookOpen, path: "/library", action: "Open library" },
  { title: "Topic coverage", eyebrow: "MASTER", description: "Track your progress and find topics that need attention.", icon: BarChart3, path: "/academic/topics", action: "View topics" },
  { title: "Study planner", eyebrow: "ORGANIZE", description: "Turn your study goal into realistic daily tasks.", icon: CalendarDays, path: "/academic/planner", action: "Plan your week" },
  { title: "Academic insights", eyebrow: "IMPROVE", description: "See your performance, strengths and areas to improve.", icon: TrendingUp, path: "/academic/insights", action: "See progress" },
  { title: "Learning DNA", eyebrow: "UNDERSTAND", description: "Explore patterns from your recorded study and practice activity.", icon: Brain, path: "/learning-dna", action: "Explore your profile" },
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
  const [recentResult, setRecentResult] = useState<{ score: number; total_questions: number; completed_at?: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [topicProgress, setTopicProgress] = useState<Array<{subject:string;topic:string;completion_percentage:number;accuracy_percentage:number;questions_attempted:number;questions_correct:number}>>([]);
  const [learnMode, setLearnMode] = useState<"focus" | "review" | "plan">("focus");
  const [selectedSubject, setSelectedSubject] = useState("all");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
      const p = await getAcademicProfile(user.id);
      if (cancelled) return;
      if (!p) {
        navigate("/academic/setup", { replace: true });
        return;
      }
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const topicsRequest = tier === "upper"
        ? db.from("upper_student_topic_progress").select("subject,topic,accuracy_percentage,questions_attempted,correct_answers").eq("user_id", user.id)
        : db.from("topic_progress").select("subject,topic,completion_percentage,accuracy_percentage,questions_attempted,questions_correct").eq("user_id", user.id);
      const [todayRes, resultsRes, topicsRes] = await Promise.all([
        db.from("study_plans").select("id,completed").eq("user_id", user.id).eq("scheduled_date", today),
        db.from("quiz_results").select("score,total_questions,completed_at").eq("student_id", user.id).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
        topicsRequest,
      ]);
      if (cancelled) return;
      if (todayRes.error || resultsRes.error || topicsRes.error) setLoadError(true);
      setProfile(p);
      setTodayCount(todayRes.data?.length || 0);
      setTodayCompleted(todayRes.data?.filter((item) => item.completed).length || 0);
      setRecentResult(resultsRes.data || null);
      setTopicProgress((topicsRes.data || []).map((row: any) => ({
        subject: row.subject,
        topic: row.topic,
        completion_percentage: row.completion_percentage ?? null,
        accuracy_percentage: row.accuracy_percentage,
        questions_attempted: row.questions_attempted,
        questions_correct: row.questions_correct ?? row.correct_answers ?? null,
      })) as typeof topicProgress);
      } catch (error) {
        console.error("Academic Mode data load failed:", error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, navigate, reloadKey]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading your study space…</div>;

  const grade = resolveAcademicGrade(user?.grade, profile?.grade, 9);
  const subjects: string[] = Array.isArray(profile?.subjects)
    ? profile.subjects.filter((subject: unknown): subject is string => typeof subject === "string" && subject.trim().length > 0).map((subject: string) => subject.trim())
    : [];
  const recentScore = recentResult?.score == null ? null : Math.max(0, Math.min(100, Number(recentResult.score)));
  const syllabusRows = subjects.map((subject: string) => {
    const key = subject.toLowerCase() === "math" ? "mathematics" : subject.toLowerCase();
    const rows = topicProgress.filter((row) => {
      const topicSubject = row.subject?.toLowerCase();
      return topicSubject === key || (key === "mathematics" && topicSubject === "math");
    });
    const attempted = rows.filter((row) => Number.isFinite(Number(row.questions_attempted)) && Number(row.questions_attempted) > 0);
    const completed = rows.filter((row) => Number(row.completion_percentage) >= 100 || (Number(row.accuracy_percentage) >= 80 && Number(row.questions_attempted) >= 5));
    const coverageValues = rows.map((row) => Number(row.completion_percentage) || (Number(row.accuracy_percentage) || 0)).filter((value) => Number.isFinite(value));
    const coverage = coverageValues.length ? Math.round(coverageValues.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / coverageValues.length) : 0;
    return { subject, total: rows.length, attempted: attempted.length, completed: completed.length, pct: coverage };
  });
  const focusSubject = [...syllabusRows].filter((row) => row.total > 0).sort((a, b) => a.pct - b.pct)[0];
  const activeSubject = selectedSubject === "all" ? focusSubject?.subject || subjects[0] : selectedSubject;
  const activeSubjectLabel = activeSubject ? formatSubject(activeSubject) : "your subjects";
  const nextAction = learnMode === "review"
    ? { label: "Review flashcards", path: "/academic/flashcards", icon: BookOpen }
    : learnMode === "plan"
      ? { label: "Plan a study session", path: "/academic/planner", icon: CalendarDays }
      : { label: activeSubject ? `Practice ${activeSubjectLabel}` : "Start practice", path: "/academic/exam", icon: Target };
  const NextActionIcon = nextAction.icon;

  return (
    <div className={tier === "upper" ? "tier-upper mm-academic-upper min-h-screen bg-background text-foreground" : "tier-middle min-h-screen bg-slate-50/80 text-slate-950"}>
      <header className={tier === "upper" ? "border-b border-border/70 bg-background/95 backdrop-blur-xl" : "border-b border-sky-100 bg-white/90 backdrop-blur-xl"}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className={tier === "upper" ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-500/20"}><GraduationCap className="h-6 w-6" /></div>
            <div className="min-w-0"><p className={tier === "upper" ? "text-xs font-semibold uppercase tracking-[0.16em] text-primary" : "text-xs font-bold uppercase tracking-[0.16em] text-sky-600"}>Master Minds · Learn</p><h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Learn</h1></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/academic/setup")}><Settings2 className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Edit profile</span><span className="sm:hidden">Edit</span></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8">
        {tier === "upper" && <section className="space-y-3" aria-labelledby="syllabus-mastery-title">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Syllabus mastery center</p><h2 id="syllabus-mastery-title" className="mt-1 text-xl font-bold sm:text-2xl">Your subjects, your progress</h2><p className="mt-1 text-sm text-muted-foreground">A compact view of your saved topic progress.</p></div><Button variant="outline" size="sm" onClick={() => navigate("/academic/topics")}>Open Topic Coverage <ArrowUpRight className="ml-2 h-4 w-4"/></Button></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {syllabusRows.map((row) => <Card key={row.subject} className={`border-border bg-card transition-colors ${activeSubject === row.subject ? "border-primary/50 ring-1 ring-primary/20" : ""}`}><CardContent className="p-3.5 sm:p-4"><div className="flex items-center justify-between gap-3"><button type="button" onClick={() => setSelectedSubject(row.subject)} className="truncate text-left font-semibold hover:text-primary">{formatSubject(row.subject)}</button><Badge variant="outline" className="shrink-0 text-[11px]">{row.total ? `${row.pct}%` : "Not measured"}</Badge></div><Progress value={row.total ? row.pct : 0} className="mt-3 h-1.5"/><div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{row.total ? `${row.completed}/${row.total} topics mastered` : "No topics recorded yet"}</span><button type="button" onClick={() => navigate("/academic/exam", { state: { subject: row.subject } })} className="shrink-0 font-semibold text-primary hover:underline">Practice <ArrowUpRight className="ml-0.5 inline h-3 w-3" /></button></div></CardContent></Card>)}
          </div>
        </section>}
        <section className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4" aria-labelledby="study-command-title">
          <div className="flex min-w-0 items-center gap-3"><div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"><NextActionIcon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Grade {grade} · {profile?.curriculum === "oromia" ? "Oromia" : "Addis Ababa"} curriculum</p><h2 id="study-command-title" className="truncate text-base font-bold sm:text-lg">{learnMode === "focus" ? `Continue with ${activeSubjectLabel}` : learnMode === "review" ? "Review what you have learned" : "Plan your next study session"}</h2><p className="truncate text-xs text-muted-foreground">{todayCount ? `${todayCompleted}/${todayCount} tasks done today` : "No tasks scheduled today"} · {recentScore == null ? "No exam score yet" : `Latest score ${Math.round(recentScore)}%`}</p></div></div><div className="flex flex-wrap items-center gap-2 sm:justify-end"><Button size="sm" onClick={() => navigate(nextAction.path, activeSubject ? { state: { subject: activeSubject } } : undefined)}><NextActionIcon className="mr-2 h-4 w-4" />{nextAction.label}</Button><Button size="sm" variant="outline" onClick={() => navigate("/academic/planner")}><CalendarDays className="mr-2 h-4 w-4" />Plan</Button></div>
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Study tools</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Choose how you want to learn</h2><p className="mt-1 text-sm text-muted-foreground">Focus, review, or plan.</p></div><Badge variant="outline" className="w-fit">{subjects.length} subjects</Badge></div>
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-muted/30 p-1" role="tablist" aria-label="Learning mode">
            {([['focus', 'Focus', 'Build skill', Target], ['review', 'Review', 'Remember', CheckCircle2], ['plan', 'Plan', 'Stay on track', CalendarDays]] as const).map(([value, label, description, Icon]) => <button key={value} type="button" role="tab" aria-selected={learnMode === value} onClick={() => setLearnMode(value)} className={`rounded-xl px-3 py-3 text-left transition ${learnMode === value ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><span className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" />{label}</span><span className="mt-0.5 block text-[11px]">{description}</span></button>)}
          </div>
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Filter by subject"><span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Show:</span><button type="button" onClick={() => setSelectedSubject("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedSubject === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40"}`}>All subjects</button>{subjects.map((subject) => <button key={subject} type="button" onClick={() => setSelectedSubject(subject)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedSubject === subject ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40"}`}>{formatSubject(subject)}</button>)}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {features.filter((feature) => learnMode === "focus" ? ["/academic/exam", "/academic/topics", "/academic/entrance-papers"].includes(feature.path) : learnMode === "review" ? ["/academic/flashcards", "/library", "/academic/insights"].includes(feature.path) : ["/academic/planner", "/learning-dna"].includes(feature.path)).map((feature) => { const Icon = feature.icon; return <button key={feature.path} type="button" onClick={() => navigate(feature.path)} className={`mm-academic-feature ${tier === "upper" ? "btn-3d-card" : "border-slate-200/80 bg-white hover:border-sky-300 hover:shadow-sky-100/80"} group rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              <div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div>
              <p className="mt-3 text-[10px] font-bold tracking-[0.16em] text-primary">{feature.eyebrow}</p><h3 className="mt-0.5 text-base font-semibold">{feature.title}</h3><p className="mt-1 text-xs leading-4 text-muted-foreground">{feature.description}</p><span className="mt-3 inline-flex items-center text-xs font-semibold">{feature.action}<ArrowUpRight className="ml-1 h-3 w-3" /></span>
            </button>; })}
          </div>
        </section>
        {loadError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Some dashboard totals couldn't load. Your study tools are still available; try loading the totals again.</p><Button variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setReloadKey((key) => key + 1)}>Retry dashboard data</Button></div>}
      </main>
    </div>
  );
};

export default AcademicMode;
