import React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, GraduationCap, Library, Loader2, Target, Timer, TrendingUp } from "lucide-react";

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

const UpperStudentDashboard: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { learningData, isLoading, error, reload } = useLearningDNA(user?.id);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const topicCount = Object.keys(learningData?.topicMastery ?? {}).length;
  const attemptCount = learningData?.totalAttempts ?? 0;

  const actions = [
    { title: "Exam preparation", description: "Continue exam practice and entrance-paper preparation.", label: "Open Exam Hub", path: "/academic/exam", icon: Target },
    { title: "Focus Studio", description: "Start a focused session or join your study room.", label: "Start studying", path: "/study-mode", icon: Timer },
    { title: "Topic coverage", description: "Review topics and identify what needs more practice.", label: "View topics", path: "/academic/topics", icon: TrendingUp },
    { title: "Flashcards", description: "Use active recall to strengthen what you have learned.", label: "Review cards", path: "/academic/flashcards", icon: BrainCircuit },
    { title: "Study planner", description: "Organize the next steps in your study schedule.", label: "Open planner", path: "/academic/planner", icon: CalendarDays },
    { title: "Digital library", description: "Return to your learning resources and textbooks.", label: "Open library", path: "/library", icon: Library },
  ];

  return <main className="upper-tier-studio mx-auto w-full max-w-[1440px] space-y-6 px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.6fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">MASTER MINDS SECONDARY · GRADES 9–12</p>
          <h1 className="mt-2">{firstName ? `${greeting()}, ${firstName}` : "Your Academic Studio"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">A focused space for exam preparation, independent study, and steady progress. Pick one useful next step and get started.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate("/study-mode")} className="min-h-11"><Timer className="mr-2 h-4 w-4"/>Start Study Mode</Button>
            <Button variant="outline" onClick={() => navigate("/academic")} className="min-h-11"><GraduationCap className="mr-2 h-4 w-4"/>Academic Preparation</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <Clock3 className="h-5 w-5 text-primary"/>
            <p className="mt-3 text-2xl font-bold tabular-nums">{isLoading ? "—" : attemptCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Recorded attempts</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <BookOpen className="h-5 w-5 text-primary"/>
            <p className="mt-3 text-2xl font-bold tabular-nums">{isLoading ? "—" : topicCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Topics tracked</p>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="daily-workout-title" className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.6fr)]">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Daily entrance workout</p>
        <h2 id="daily-workout-title" className="mt-2 text-xl font-bold sm:text-2xl">Ten focused questions. One useful step forward.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Start a 10-question practice session using the subjects in your Academic Prep setup. Questions are labelled by source in Exam Mode.</p>
        <Button className="mt-4 min-h-11" onClick={() => navigate("/academic/exam", { state: { workoutQuestionCount: 10 } })}><Target className="mr-2 h-4 w-4"/>Start Today's Workout (10 Questions)<ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Academic calendar</p>
        <p className="mt-2 text-lg font-bold">2017 E.C.</p>
        <p className="text-sm text-muted-foreground">2024/25 G.C.</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Ethiopian calendar labels are used in the entrance-paper archive to avoid mixing E.C. and G.C. exam years.</p>
      </div>
    </section>

    <section aria-labelledby="daily-workspace-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="daily-workspace-title" className="text-xl font-bold">Your workspace</h2><p className="mt-1 text-sm text-muted-foreground">Direct access to the tools you use most.</p></div>
        <Button variant="ghost" onClick={() => navigate("/learning-dna")} className="min-h-11">Learning DNA <ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map(({title,description,label,path,icon:Icon}) => <Card key={path} className="min-w-0 transition-colors hover:border-primary/40">
          <CardContent className="flex h-full flex-col p-5">
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></span>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p>
            <Button variant="outline" className="mt-4 min-h-11 w-full justify-between" onClick={() => navigate(path)}>{label}<ArrowRight className="h-4 w-4"/></Button>
          </CardContent>
        </Card>)}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-5 w-5"/></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Your learning record</h2>
          {isLoading ? <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading your saved learning activity…</p> :
            error ? <><p className="mt-1 text-sm text-muted-foreground">Your learning record could not be loaded right now.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>Try again</Button></> :
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{attemptCount || topicCount ? `Your account currently has ${attemptCount} recorded attempts across ${topicCount} tracked topics.` : "Your saved progress will appear here as you complete study activity."} Open Learning DNA for the detailed view.</p>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Open Learning DNA" onClick={() => navigate("/learning-dna")}><ArrowRight className="h-5 w-5"/></Button>
      </div>
    </section>
  </main>;
};

export default UpperStudentDashboard;
