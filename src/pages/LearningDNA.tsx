import React, { useState } from "react";
import {
  Activity, BookOpen, BrainCircuit, CalendarCheck, ChevronRight,
  Layers, Lightbulb, Loader2, RefreshCw, Sparkles, Target, Trophy, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import BackButton from "@/components/ui/BackButton";
import { LoadingState, ErrorState } from "@/components/ui/status-state";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { supabase } from "@/integrations/supabase/client";
import { useLearningDNA, type LearningData } from "@/hooks/useLearningDNA";

const LearningDNA: React.FC = () => {
  const { user } = useUser();
  const tier = useTier();
  const { learningData, attemptCount, isLoading, error, reload, setLearningData } = useLearningDNA(user?.id);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeLearningDNA = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("analyze-learning-dna");
      if (functionError) throw functionError;
      if (data?.status === "insufficient_data") {
        setLearningData(null);
        toast.info(data.message || "Complete a learning activity to start building your Learning DNA.");
        await reload();
        return;
      }
      if (!data?.success || !data?.data) {
        throw new Error(data?.error || "The analysis could not be completed. Please try again.");
      }
      setLearningData(data.data as LearningData);
      toast.success("Your Learning DNA has been updated!");
      await reload();
    } catch (analysisError: unknown) {
      console.error("Error analyzing Learning DNA:", analysisError);
      toast.error(analysisError instanceof Error ? analysisError.message : "Failed to analyze Learning DNA");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const statusBadge = (status: string) =>
    status === "mastered"
      ? { text: "Strong evidence", variant: "default" as const }
      : status === "learning"
        ? { text: "Developing", variant: "secondary" as const }
        : status === "developing"
          ? { text: "More practice needed", variant: "outline" as const }
          : { text: "Focus area", variant: "destructive" as const };

  const hasData = Boolean(learningData && (
    learningData.totalActivityEvents > 0 || Object.keys(learningData.topicMastery || {}).length > 0
  ));
  const activity = learningData?.activitySummary;
  const insights = learningData?.aiInsights;
  const panelClass = tier === "upper" ? "mm-dna-panel shadow-sm" : "shadow-sm";
  const statCards = activity ? [
    { label: "Quiz answers", value: activity.quizzes.attempts, detail: activity.quizzes.accuracy === null ? "Accuracy not available" : activity.quizzes.accuracy + "% accuracy", icon: Target },
    { label: "Books read", value: activity.reading.booksOpened, detail: activity.reading.booksCompleted + " completed · " + activity.reading.averageCompletionPercent + "% average progress", icon: BookOpen },
    { label: "Study sessions", value: activity.study.sessions, detail: activity.study.activeDaysLast30 + " active days in the last 30 days", icon: CalendarCheck },
    { label: "Study plans", value: activity.study.totalPlans, detail: activity.study.planCompletionPercent === null ? "No plan completion data" : activity.study.planCompletionPercent + "% completed", icon: Activity },
    { label: "Multiplayer matches", value: activity.multiplayer.matches, detail: activity.multiplayer.wins + " wins · " + (activity.multiplayer.averageAccuracy === null ? "accuracy unavailable" : activity.multiplayer.averageAccuracy + "% answer accuracy"), icon: Trophy },
    { label: "Flashcard reviews", value: activity.flashcards.reviewedCards, detail: activity.flashcards.totalRepetitions + " recorded repetitions", icon: Layers },
    { label: "Study Mode calls", value: activity.studyModeCalls.acceptedOrJoined, detail: "Accepted or joined invitations", icon: Zap },
  ] : [];

  return <div className={tier === "upper" ? "tier-upper mm-learning-dna min-h-screen bg-background text-foreground" : "min-h-screen bg-background text-foreground"}>
    {tier === "upper" && <style>{`
      .mm-learning-dna .mm-dna-panel{border-radius:1.15rem;border-color:var(--border);box-shadow:0 3px 12px rgba(15,23,42,.045)}
      .mm-learning-dna .mm-dna-topic{border-radius:.9rem;background:var(--card);transition:border-color .18s,transform .18s}
      .mm-learning-dna .mm-dna-topic:hover{border-color:rgba(99,102,241,.45);transform:translateY(-1px)}
      @media(max-width:640px){.mm-learning-dna .mm-dna-panel{border-radius:1rem}.mm-learning-dna main{padding-top:1.1rem}}
    `}</style>}
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton />
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-upper-intelligence text-upper-intelligence-foreground"><BrainCircuit className="h-5 w-5" /></span>
          <div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight">Learning DNA</h1><p className="truncate text-sm text-muted-foreground">Your complete learning journey</p></div>
        </div>
        <Button onClick={analyzeLearningDNA} disabled={isAnalyzing} className="shrink-0 gap-2">
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">{isAnalyzing ? "Analyzing…" : "Update Analysis"}</span>
          <span className="sm:hidden">Update</span>
        </Button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl space-y-7 px-4 py-6 pb-28 sm:px-8 sm:py-9">
      {isLoading ? (
        <Card className={panelClass}><LoadingState label="Loading your Learning DNA…" className="min-h-72" /></Card>
      ) : error ? (
        <Card className={panelClass}><ErrorState title="Learning DNA is unavailable" description="We couldn't load your private learning report." actionLabel="Try again" onAction={() => void reload()} className="min-h-72" /></Card>
      ) : !hasData ? (
        <Card className={tier === "upper" ? "mm-dna-panel border-upper-intelligence/70 shadow-card" : "border-upper-intelligence/70 shadow-card"}>
          <CardContent className="py-14 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-upper-intelligence text-upper-intelligence-foreground"><BrainCircuit className="h-7 w-7" /></span>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-upper-intelligence-foreground">Personal learning intelligence</p>
            <h2 className="mt-2 text-xl font-semibold">Build your Learning DNA</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Learning DNA brings together your quiz answers, books and reading progress, study sessions, study plans, flashcards, Study Mode and multiplayer results. It only reports activity that Master Minds has actually recorded.
            </p>
            {attemptCount > 0 && <p className="mt-3 text-sm text-muted-foreground">{attemptCount} quiz answers are already recorded.</p>}
            <Button onClick={analyzeLearningDNA} disabled={isAnalyzing} className="mt-6 min-h-11">{isAnalyzing ? "Analyzing…" : "Analyze My Learning Activity"}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {insights && <Card className={tier === "upper" ? "mm-dna-panel border-upper-intelligence/50 shadow-card" : "border-upper-intelligence/50 shadow-card"}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Grok's learning overview</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-foreground">{insights.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">Generated from your recorded Master Minds activity. Insights are educational guidance, not a judgement or diagnosis.</p>
            </CardContent>
          </Card>}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Learning activity summary">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return <Card key={stat.label} className={panelClass}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0"><p className="text-sm text-muted-foreground">{stat.label}</p><p className="text-2xl font-semibold tabular-nums">{stat.value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.detail}</p></div>
                </CardContent>
              </Card>;
            })}
          </section>

          {activity && <section className="grid gap-6 lg:grid-cols-2">
            <Card className={panelClass}>
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Your reading activity</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {activity.reading.books.length ? activity.reading.books.map((book) => <div key={book.title + book.subject} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{book.title}</p><p className="text-xs text-muted-foreground">{book.subject}</p></div><Badge variant="secondary">{book.completionPercent}%</Badge></div>
                  <Progress value={book.completionPercent} className="mt-3 h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">Last page reached: {book.lastPageReached} · Reading time recorded: {Math.round(book.timeSpentSeconds / 60)} min</p>
                </div>) : <p className="text-sm text-muted-foreground">No reading progress has been recorded yet.</p>}
              </CardContent>
            </Card>
            <Card className={panelClass}>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" />Consistency and follow-through</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><div className="mb-2 flex justify-between text-sm"><span>Study plan completion</span><span className="font-medium">{activity.study.planCompletionPercent === null ? "No data" : activity.study.planCompletionPercent + "%"}</span></div><Progress value={activity.study.planCompletionPercent ?? 0} /></div>
                <div><div className="mb-2 flex justify-between text-sm"><span>Study task completion</span><span className="font-medium">{activity.study.taskCompletionPercent === null ? "No data" : activity.study.taskCompletionPercent + "%"}</span></div><Progress value={activity.study.taskCompletionPercent ?? 0} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Completed sessions</p><p className="text-xl font-semibold">{activity.study.completedSessions}/{activity.study.sessions}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Active study days (30d)</p><p className="text-xl font-semibold">{activity.study.activeDaysLast30}</p></div>
                </div>
                <p className="text-xs text-muted-foreground">These are activity measures, not a score of your character. A missed plan or interrupted session does not define you.</p>
              </CardContent>
            </Card>
          </section>}

          {insights && <section className="grid gap-6 md:grid-cols-2">
            {[
              { title: "Learning patterns", icon: BrainCircuit, items: insights.learningPatterns },
              { title: "Reading insights", icon: BookOpen, items: insights.readingInsights },
              { title: "Study discipline", icon: CalendarCheck, items: insights.disciplineInsights },
              { title: "Multiplayer insights", icon: Trophy, items: insights.multiplayerInsights },
            ].map((section) => {
              const Icon = section.icon;
              return <Card key={section.title} className={panelClass}>
                <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{section.title}</CardTitle></CardHeader>
                <CardContent>{section.items.length ? <ul className="space-y-2">{section.items.map((item, index) => <li key={index} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm leading-6"><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary" />{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">Not enough recorded evidence yet.</p>}</CardContent>
              </Card>;
            })}
          </section>}

          {Object.keys(learningData!.topicMastery).length > 0 && <Card className={panelClass}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Quiz topic mastery</CardTitle></CardHeader>
            <CardContent><div className="grid gap-3 sm:grid-cols-2">{Object.entries(learningData!.topicMastery).map(([topic, topicData]) => {
              const badge = statusBadge(topicData.status);
              return <div key={topic} className="mm-dna-topic rounded-lg border border-border p-4">
                <div className="mb-3 flex gap-2"><span className="min-w-0 flex-1 font-medium">{topic}</span><Badge variant={badge.variant}>{badge.text}</Badge></div>
                <Progress value={topicData.mastery} className="h-2" /><p className="mt-2 text-sm text-muted-foreground">{topicData.mastery}% from recorded answers</p>
              </div>;
            })}</div></CardContent>
          </Card>}

          {insights && <Card className={panelClass}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Your next steps</CardTitle></CardHeader>
            <CardContent>
              {insights.recommendations.length ? <div className="grid gap-2 md:grid-cols-2">{insights.recommendations.map((item, index) => <div key={index} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm leading-6"><Zap className="mt-1 h-4 w-4 shrink-0 text-primary" />{item}</div>)}</div> : <p className="text-sm text-muted-foreground">Recommendations will appear as more activity is recorded.</p>}
              {insights.evidenceLimitations.length > 0 && <div className="mt-5 rounded-lg bg-muted/50 p-4"><h3 className="text-sm font-semibold">What this report cannot tell yet</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">{insights.evidenceLimitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
            </CardContent>
          </Card>}

          {learningData!.dataCoverage && <Card className={panelClass}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Data coverage</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">{Object.entries(learningData!.dataCoverage.sources).map(([source, available]) => <Badge key={source} variant={available ? "secondary" : "outline"}>{source.replace(/([A-Z])/g, " $1")}: {available ? "connected" : "unavailable"}</Badge>)}</div>
              {learningData!.dataCoverage.sampleLimits.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Some sources reached their report sample limit. The report uses the most recent returned records.</p>}
            </CardContent>
          </Card>}
        </>
      )}
    </main>
  </div>;
};

export default LearningDNA;
