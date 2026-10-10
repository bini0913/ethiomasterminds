import React, { useState } from "react";
import { BrainCircuit, Target, Sparkles, RefreshCw, BookOpen, Zap, Award, ChevronRight, Loader2, Lightbulb } from "lucide-react";
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
  const { learningData, isLoading, error, reload, setLearningData } = useLearningDNA(user?.id);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeLearningDNA = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("analyze-learning-dna");
      if (functionError) throw functionError;
      if (!data?.success || !data?.data) {
        throw new Error(data?.error || "The analysis could not be completed. Please try again.");
      }
      setLearningData(data.data as LearningData);
      toast.success("Learning DNA updated!");
      await reload();
    } catch (analysisError: unknown) {
      console.error("Error analyzing learning DNA:", analysisError);
      toast.error(analysisError instanceof Error ? analysisError.message : "Failed to analyze learning DNA");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const statusBadge = (status: string) => status === "mastered" ? { text: "Mastered", variant: "default" as const } : status === "learning" ? { text: "Learning", variant: "secondary" as const } : { text: "Needs work", variant: "destructive" as const };
  const hasData = Boolean(learningData && Object.keys(learningData.topicMastery).length > 0);

  return <div className={tier === "upper" ? "tier-upper min-h-screen bg-background text-foreground" : "min-h-screen bg-background text-foreground"}>
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><BackButton /><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-upper-intelligence text-upper-intelligence-foreground"><BrainCircuit className="h-5 w-5" /></span><div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight">Learning DNA</h1><p className="truncate text-sm text-muted-foreground">Your academic learning map</p></div></div>
        <Button onClick={analyzeLearningDNA} disabled={isAnalyzing} className="shrink-0 gap-2">{isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}<span className="hidden sm:inline">{isAnalyzing ? "Analyzing…" : "Update Analysis"}</span><span className="sm:hidden">Update</span></Button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl space-y-7 px-4 py-6 pb-28 sm:px-8 sm:py-9">
      {isLoading ? <Card className="border-upper-intelligence/60"><LoadingState label="Loading your Learning DNA…" className="min-h-72" /></Card> : error ? <Card className="border-upper-intelligence/60"><ErrorState title="Learning DNA is unavailable" description="We couldn't load your academic learning map." actionLabel="Try again" onAction={() => void reload()} className="min-h-72" /></Card> : !hasData ? <Card className="border-upper-intelligence/70 shadow-card"><CardContent className="py-14 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-upper-intelligence text-upper-intelligence-foreground"><BrainCircuit className="h-7 w-7" /></span><p className="text-xs font-semibold uppercase tracking-[0.14em] text-upper-intelligence-foreground">Academic personalization</p><h2 className="mt-2 text-xl font-semibold">Build your Learning DNA</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Understand your strengths and find what to focus on next.</p><Button onClick={analyzeLearningDNA} disabled={isAnalyzing} className="mt-6 min-h-11">{isAnalyzing ? "Analyzing…" : "Analyze Now"}</Button></CardContent></Card> : <>
        <section className="grid gap-6 lg:grid-cols-5" aria-label="Learning DNA overview">
          <Card className="lg:col-span-3 border-upper-intelligence/50 shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Topic mastery</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{Object.entries(learningData!.topicMastery).map(([topic, topicData]) => { const badge = statusBadge(topicData.status); return <div key={topic} className="rounded-lg border border-border bg-muted/30 p-4"><div className="mb-3 flex gap-2"><span className="min-w-0 flex-1 font-medium capitalize">{topic}</span><Badge variant={badge.variant}>{badge.text}</Badge></div><Progress value={topicData.mastery} className="h-2" /><p className="mt-2 text-sm text-muted-foreground">{topicData.mastery}% mastery</p></div>; })}</div></CardContent></Card>
          <Card className="lg:col-span-2 shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Learning approach</CardTitle></CardHeader><CardContent><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><BrainCircuit className="h-5 w-5" /></span><div><h2 className="font-semibold capitalize">{learningData!.learningStyle} learner</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{learningData!.learningStyle === "analytical" ? "You take time to deeply understand concepts." : learningData!.learningStyle === "quick-thinker" ? "You process information quickly and efficiently." : learningData!.learningStyle === "visual" ? "You learn best with visual aids and diagrams." : "You have a well-rounded approach to learning."}</p></div></div></CardContent></Card>
        </section>
        <section className="grid gap-6 md:grid-cols-2"><Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />Your strengths</CardTitle></CardHeader><CardContent>{learningData!.strengths.length ? <div className="space-y-2">{learningData!.strengths.map((strength) => <div key={strength} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3"><Zap className="h-4 w-4 text-primary" /><span className="capitalize">{strength}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Keep practicing to discover your strengths.</p>}</CardContent></Card><Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Focus areas</CardTitle></CardHeader><CardContent>{learningData!.weaknesses.length ? <div className="space-y-2">{learningData!.weaknesses.map((weakness) => <div key={weakness} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3"><BookOpen className="h-4 w-4 text-primary" /><span className="capitalize">{weakness}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No focus areas have been identified yet.</p>}</CardContent></Card></section>
        {learningData!.predictedPath && <Card className="border-upper-intelligence/50 shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-upper-intelligence-foreground" />Recommendations</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-3"><div><h2 className="font-medium">Recommended focus</h2><div className="mt-3 flex flex-wrap gap-2">{learningData!.predictedPath.recommendedFocus.map((focus) => <Badge key={focus} variant="secondary">{focus}</Badge>)}</div></div><div className="lg:col-span-2"><h2 className="font-medium">Study tips</h2><div className="mt-3 space-y-2">{learningData!.predictedPath.studyTips.map((tip) => <div key={tip} className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{tip}</div>)}</div>{learningData!.predictedPath.predictedCareerPaths.length > 0 && <><h2 className="mt-6 font-medium">Potential career paths</h2><div className="mt-3 flex flex-wrap gap-2">{learningData!.predictedPath.predictedCareerPaths.map((career) => <Badge key={career} variant="outline">{career}</Badge>)}</div></>}</div></CardContent></Card>}
      </>}
    </main>
  </div>;
};
export default LearningDNA;
