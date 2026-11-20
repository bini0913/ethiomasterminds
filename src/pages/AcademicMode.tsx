import { db } from "@/integrations/untypedClient";
import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Brain, Target, CalendarDays, BarChart3, GraduationCap, TrendingUp, ArrowUpRight, Settings2, ClipboardCheck, Sparkles, Loader2, CheckCircle2, Flame, Zap, Trophy } from "lucide-react";
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
  const [weekDone, setWeekDone] = useState(0);
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
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      const start = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
      const topicsRequest = tier === "upper"
        ? db.from("upper_student_topic_progress").select("subject,topic,accuracy_percentage,questions_attempted,correct_answers").eq("user_id", user.id)
        : db.from("topic_progress").select("subject,topic,completion_percentage,accuracy_percentage,questions_attempted,questions_correct").eq("user_id", user.id);
      const [todayRes, weekRes, resultsRes, topicsRes] = await Promise.all([
        db.from("study_plans").select("id,completed").eq("user_id", user.id).eq("scheduled_date", today),
        db.from("study_plans").select("id,completed").eq("user_id", user.id).gte("scheduled_date", start).lte("scheduled_date", today),
        db.from("quiz_results").select("score,total_questions,completed_at").eq("student_id", user.id).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
        topicsRequest,
      ]);
      if (cancelled) return;
      if (todayRes.error || weekRes.error || resultsRes.error || topicsRes.error) setLoadError(true);
      setProfile(p);
      setTodayCount(todayRes.data?.length || 0);
      setTodayCompleted(todayRes.data?.filter((item) => item.completed).length || 0);
      setWeekDone(weekRes.data?.filter((item) => item.completed).length || 0);
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
    const coverageValues = rows.map((row) => Number(row.completion_percentage) || (Number(row.accuracy_percentage) || 0)).filter((value) => Number.isFinite(value));
    const coverage = coverageValues.length ? Math.round(coverageValues.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / coverageValues.length) : 0;
    return { subject, total: rows.length, attempted: attempted.length, completed: completed.length, pct: coverage };
  });
  const focusSubject = [...syllabusRows].filter((row) => row.total > 0).sort((a, b) => a.pct - b.pct)[0];
  const trackedQuestions = safeTopicProgress.reduce((sum, row) => sum + (Number(row.questions_attempted) || 0), 0);
  const activeSubject = selectedSubject === "all" ? focusSubject?.subject || subjects[0] : selectedSubject;
  const activeSubjectRow = syllabusRows.find((row) => row.subject === activeSubject);
  const activeSubjectLabel = activeSubject ? formatSubject(activeSubject) : "your subjects";
  const nextAction = learnMode === "review"
    ? { label: "Review flashcards", path: "/academic/flashcards", icon: BookOpen }
    : learnMode === "plan"
      ? { label: "Plan a study session", path: "/academic/planner", icon: CalendarDays }
      : { label: activeSubject ? `Practice ${activeSubjectLabel}` : "Start practice", path: "/academic/exam", icon: Target };
  const NextActionIcon = nextAction.icon;
  const progressDegrees = Math.max(0, Math.min(100, todayProgress)) * 3.6;

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

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
        {tier === "upper" && <section className="space-y-3" aria-labelledby="syllabus-mastery-title">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Syllabus mastery center</p><h2 id="syllabus-mastery-title" className="mt-1 text-xl font-bold sm:text-2xl">Your subjects, your progress</h2><p className="mt-1 text-sm text-muted-foreground">Completion is calculated from saved topic progress. Subjects without recorded topics remain unmeasured, not marked complete.</p></div><Button variant="outline" onClick={() => navigate("/academic/topics")}>Open Topic Coverage <ArrowUpRight className="ml-2 h-4 w-4"/></Button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {syllabusRows.map((row) => <Card key={row.subject} className="border-border bg-card"><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{formatSubject(row.subject)}</h3><Badge variant="outline">{row.total ? `${row.pct}%` : "Not measured"}</Badge></div><Progress value={row.total ? row.pct : 0} className="mt-4 h-2"/><p className="mt-2 text-xs text-muted-foreground">{row.total ? `${row.completed} of ${row.total} tracked topics mastered · ${row.attempted} attempted` : "Complete practice to start building your topic record."}</p><Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/academic/exam", { state: { subject: row.subject } })}>Practice {formatSubject(row.subject)} <ArrowUpRight className="ml-2 h-4 w-4"/></Button></CardContent></Card>)}
          </div>
        </section>}
        <section className={tier === "upper" ? "mm-academic-hero relative overflow-hidden rounded-3xl border border-border/70 shadow-sm" : "relative overflow-hidden rounded-[2rem] border border-sky-200/70 bg-gradient-to-br from-sky-600 via-cyan-600 to-sky-700 text-white shadow-xl shadow-sky-900/10"}>
          <div className={tier === "upper" ? "absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-primary/[0.09] to-transparent md:block" : "absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"} />
          {tier !== "upper" && <div className="absolute bottom-0 right-0 hidden h-40 w-72 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_68%)] md:block" />}
          <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center md:p-9">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2"><Badge className={tier === "upper" ? "" : "border-white/20 bg-white/15 text-white hover:bg-white/20"}>Grade {grade}</Badge><Badge variant="outline" className={tier === "upper" ? "" : "border-white/25 bg-transparent text-white"}>{profile?.curriculum === "oromia" ? "Oromia curriculum" : "Addis Ababa curriculum"}</Badge></div>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Learn with direction, not guesswork.</h2>
              <p className={tier === "upper" ? "text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base" : "mt-3 max-w-xl text-sm leading-6 text-sky-50 sm:text-base"}>Your study space is tailored to your grade, subjects and goal. Practice, review your mistakes and build steady progress—one session at a time.</p>
              <div className="mt-5 flex flex-wrap gap-2">{subjects.length ? subjects.map((item: string) => <button key={item} type="button" onClick={() => setSelectedSubject(item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${activeSubject === item ? (tier === "upper" ? "border-primary bg-primary text-primary-foreground" : "border-white bg-white text-sky-700") : (tier === "upper" ? "border-border bg-background hover:border-primary/50" : "border-white/30 bg-white/10 text-white hover:bg-white/20")}`}>{formatSubject(item)}</button>) : <span className="text-sm text-muted-foreground">Add your subjects in your study profile.</span>}</div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button className={tier === "upper" ? "btn-3d-primary bg-primary text-primary-foreground h-11 font-bold" : "h-11 border-0 bg-white text-sky-700 shadow-lg hover:bg-sky-50"} onClick={() => navigate("/academic/exam", activeSubject ? { state: { subject: activeSubject } } : undefined)}><Target className="mr-2 h-4 w-4" />{activeSubject ? `Practice ${activeSubjectLabel}` : "Start exam practice"}</Button><Button variant="outline" className={tier === "upper" ? "h-11 border-border bg-card text-foreground hover:bg-muted" : "h-11 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"} onClick={() => navigate("/academic/planner")}><CalendarDays className="mr-2 h-4 w-4" />Plan study time</Button></div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-56 md:grid-cols-1">
              <div className={tier === "upper" ? "mm-academic-metric border bg-background p-4 text-foreground" : "rounded-2xl border border-white/20 bg-white/10 p-4 text-white backdrop-blur-sm"}><div className="flex items-center gap-2 text-sky-100"><CalendarDays className="h-4 w-4" /><span className="text-xs font-medium">Today's plan</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{todayCompleted}<span className="text-base font-medium text-sky-100">/{todayCount}</span></p>{todayCount > 0 && <Progress value={todayProgress} className="mt-3 h-1.5 bg-white/20" />}{todayCount === 0 && <p className="mt-1 text-xs text-sky-100">No tasks scheduled yet</p>}</div>
              <div className={tier === "upper" ? "mm-academic-metric border bg-background p-4 text-foreground" : "rounded-2xl border border-white/20 bg-white/10 p-4 text-white backdrop-blur-sm"}><div className="flex items-center gap-2 text-sky-100"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-medium">Last exam score</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{recentScore == null ? "—" : `${Math.round(recentScore)}%`}</p><p className="mt-1 text-xs text-sky-100">{recentScore == null ? "Complete an exam to begin tracking" : `${recentResult?.total_questions || 0} questions in latest attempt`}</p></div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-labelledby="next-move-title">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-5 shadow-sm sm:p-6">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary"><Zap className="h-3.5 w-3.5" />Next best move</span>{activeSubject && <Badge variant="outline">{activeSubjectLabel}</Badge>}</div>
                <h2 id="next-move-title" className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">{learnMode === "focus" && activeSubjectRow ? `Build momentum in ${activeSubjectLabel}` : learnMode === "review" ? "Make today’s learning stick" : "Turn your goal into a plan"}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{learnMode === "focus" && activeSubjectRow ? `${activeSubjectRow.pct}% coverage across ${activeSubjectRow.total} tracked topics. A short focused session can move your weakest area forward.` : learnMode === "review" ? "Refresh concepts you have already studied with active recall and spaced practice." : "Choose a realistic session and keep your progress visible instead of guessing what to study next."}</p>
                <Button className="mt-5" onClick={() => navigate(nextAction.path, activeSubject ? { state: { subject: activeSubject } } : undefined)}><NextActionIcon className="mr-2 h-4 w-4" />{nextAction.label}<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
              </div>
              <div className="flex shrink-0 items-center gap-4 rounded-2xl border bg-background/70 p-4 sm:flex-col sm:gap-2 sm:p-3"><div className="relative h-20 w-20 rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${progressDegrees}deg, hsl(var(--muted)) ${progressDegrees}deg)` }}><div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-full bg-card"><span className="text-lg font-bold tabular-nums">{todayProgress}%</span><span className="text-[10px] text-muted-foreground">today</span></div></div><p className="text-sm font-semibold sm:text-center">{todayCount ? `${todayCompleted}/${todayCount} tasks` : "No plan yet"}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <button type="button" onClick={() => navigate("/academic/topics")} className="rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><BarChart3 className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-bold tabular-nums">{activeSubjectRow?.pct ?? 0}%</p><p className="text-xs text-muted-foreground">subject coverage</p></button>
            <button type="button" onClick={() => navigate("/academic/exam", activeSubject ? { state: { subject: activeSubject } } : undefined)} className="rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><Flame className="h-5 w-5 text-orange-500" /><p className="mt-3 text-2xl font-bold tabular-nums">{trackedQuestions}</p><p className="text-xs text-muted-foreground">questions practiced</p></button>
          </div>
        </section>

        {tier === "upper" && <section className="grid gap-3 md:grid-cols-3" aria-labelledby="daily-path-title">
          <div className="md:col-span-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Today’s learning path</p><h2 id="daily-path-title" className="mt-1 text-xl font-bold">Choose one useful next step</h2></div>
          <button type="button" onClick={() => navigate(focusSubject ? "/academic/exam" : "/quiz/filter")} className="rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><div className="flex items-center justify-between"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Target className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div><h3 className="mt-4 font-semibold">{focusSubject ? `Practice ${formatSubject(focusSubject.subject)}` : "Start practice"}</h3><p className="mt-1 text-sm text-muted-foreground">{focusSubject ? `${focusSubject.pct}% coverage · ${focusSubject.attempted} tracked topics` : "Build your first subject insight"}</p></button>
          <button type="button" onClick={() => navigate("/academic/flashcards")} className="rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><div className="flex items-center justify-between"><span className="rounded-xl bg-primary/10 p-2 text-primary"><BookOpen className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div><h3 className="mt-4 font-semibold">Review and remember</h3><p className="mt-1 text-sm text-muted-foreground">Use active recall to strengthen today’s learning.</p></button>
          <button type="button" onClick={() => navigate("/academic/planner")} className="rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><div className="flex items-center justify-between"><span className="rounded-xl bg-primary/10 p-2 text-primary"><CalendarDays className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div><h3 className="mt-4 font-semibold">Plan the next session</h3><p className="mt-1 text-sm text-muted-foreground">{todayCount ? `${todayCompleted} of ${todayCount} tasks completed today` : "No tasks scheduled yet"}</p></button>
        </section>}

        {tier === "upper" && <section className="mm-academic-insight relative overflow-hidden rounded-3xl border border-primary/20 bg-primary/[0.06] p-5 sm:p-6" aria-labelledby="learning-profile-title">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4"><div className="hidden h-16 w-16 shrink-0 items-end justify-center gap-1 rounded-2xl border border-primary/20 bg-background p-3 sm:flex"><span className="h-5 w-1.5 rounded-full bg-primary/40" /><span className="h-8 w-1.5 rounded-full bg-primary/70" /><span className="h-11 w-1.5 rounded-full bg-primary" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your learning profile</p><h2 id="learning-profile-title" className="mt-1 text-xl font-bold">{focusSubject ? `Build confidence in ${formatSubject(focusSubject.subject)}` : "Start building your learning profile"}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{focusSubject ? `${focusSubject.pct}% coverage so far across ${focusSubject.attempted} tracked topics. Use focused practice to turn your next gap into progress.` : trackedQuestions ? `${trackedQuestions} practice questions are recorded. Keep studying to unlock more useful recommendations.` : "Complete a practice set and your Academic Hub will begin tailoring recommendations from real activity."}</p></div></div>
            <Button variant="outline" className="shrink-0 bg-background" onClick={() => navigate("/learning-dna")}>Explore my profile <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>}

        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your learning studio</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Choose how you want to learn</h2><p className="mt-1 text-sm text-muted-foreground">Switch modes depending on what you need right now.</p></div><Badge variant="outline" className="w-fit">{subjects.length} subjects</Badge></div>
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-muted/30 p-1" role="tablist" aria-label="Learning mode">
            {([['focus', 'Focus', 'Build skill', Target], ['review', 'Review', 'Remember', CheckCircle2], ['plan', 'Plan', 'Stay on track', CalendarDays]] as const).map(([value, label, description, Icon]) => <button key={value} type="button" role="tab" aria-selected={learnMode === value} onClick={() => setLearnMode(value)} className={`rounded-xl px-3 py-3 text-left transition ${learnMode === value ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><span className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" />{label}</span><span className="mt-0.5 block text-[11px]">{description}</span></button>)}
          </div>
          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Filter by subject"><span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Show:</span><button type="button" onClick={() => setSelectedSubject("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedSubject === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40"}`}>All subjects</button>{subjects.map((subject) => <button key={subject} type="button" onClick={() => setSelectedSubject(subject)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedSubject === subject ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40"}`}>{formatSubject(subject)}</button>)}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.filter((feature) => learnMode === "focus" ? ["/academic/exam", "/academic/topics", "/academic/entrance-papers"].includes(feature.path) : learnMode === "review" ? ["/academic/flashcards", "/library", "/academic/insights"].includes(feature.path) : ["/academic/planner", "/learning-dna"].includes(feature.path)).map((feature) => { const Icon = feature.icon; return <button key={feature.path} type="button" onClick={() => navigate(feature.path)} className={`mm-academic-feature ${tier === "upper" ? "btn-3d-card" : "border-slate-200/80 bg-white hover:border-sky-300 hover:shadow-sky-100/80"} group rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              <div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div>
              <p className="mt-4 text-[11px] font-bold tracking-[0.16em] text-primary">{feature.eyebrow}</p><h3 className="mt-1 text-lg font-semibold">{feature.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{feature.description}</p><span className="mt-4 inline-flex items-center text-sm font-semibold">{feature.action}<ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></span>
            </button>; })}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><GraduationCap className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Study level</p><p className="font-semibold">Grade {grade}</p></div></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BookOpen className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Study subjects</p><p className="font-semibold">{subjects.length} selected</p></div></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Sparkles className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Weekly tasks completed</p><p className="font-semibold">{weekDone} completed</p></div></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Trophy className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Latest result</p><p className="font-semibold">{recentScore == null ? "Keep practicing" : `${Math.round(recentScore)}% score`}</p></div></CardContent></Card>
        </section>
        {loadError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Some dashboard totals couldn't load. Your study tools are still available; try loading the totals again.</p><Button variant="outline" size="sm" className="min-h-10 shrink-0" onClick={() => setReloadKey((key) => key + 1)}>Retry dashboard data</Button></div>}
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="leading-6 text-muted-foreground"><span className="font-semibold text-foreground">Personalized, connected practice.</span> Exam results feed your progress, topics show your mastery, and your planner helps you focus on the next useful task. AI Tutor is unchanged.</p></div>
      </main>
    </div>
  );
};

export default AcademicMode;
