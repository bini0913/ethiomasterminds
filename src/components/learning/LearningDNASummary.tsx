import { Link } from "react-router-dom";
import { ArrowRight, Brain, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/status-state";
import type { LearningData } from "@/hooks/useLearningDNA";

interface LearningDNASummaryProps {
  data: LearningData | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const TopicList = ({ label, items }: { label: string; items: string[] }) =>
  items.length > 0 ? (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.slice(0, 3).map((item) => <span key={item} className="rounded-md bg-secondary px-2.5 py-1 text-sm text-secondary-foreground">{item}</span>)}
      </div>
    </div>
  ) : null;

export function LearningDNASummary({ data, isLoading, error, onRetry }: LearningDNASummaryProps) {
  if (isLoading) return <Card><LoadingState label="Loading your Learning DNA…" className="min-h-56" /></Card>;
  if (error) return <Card><ErrorState title="Learning DNA is unavailable" description="We couldn't load your academic learning map." actionLabel="Try again" onAction={onRetry} className="min-h-56" /></Card>;

  const hasData = Boolean(data && Object.keys(data.topicMastery).length > 0);
  if (!hasData) {
    return (
      <Card className="border-primary/30 shadow-sm">
        <CardContent className="flex min-h-56 flex-col items-start justify-center p-6 sm:p-8">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Brain className="h-5 w-5" /></span>
          <h2 className="text-xl font-semibold tracking-tight">Build your Learning DNA</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Understand your strengths, focus areas, and recommended study priorities.</p>
          <Button asChild className="mt-5"><Link to="/learning-dna">Build Learning DNA <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-primary"><Brain className="h-5 w-5" /><p className="text-sm font-semibold">Learning DNA</p></div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Your academic learning map</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your current analysis to choose your next study priority.</p>
          </div>
          <Button variant="outline" asChild><Link to="/learning-dna">View Learning DNA <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <TopicList label="Strengths" items={data!.strengths} />
          <TopicList label="Focus next" items={data!.weaknesses} />
          <TopicList label="Recommended" items={data!.predictedPath?.recommendedFocus || []} />
        </div>
        {data!.strengths.length === 0 && data!.weaknesses.length === 0 && (data!.predictedPath?.recommendedFocus.length || 0) === 0 && (
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><Target className="h-4 w-4 text-primary" /> Your analysis is ready; open Learning DNA to review your academic map.</div>
        )}
      </CardContent>
    </Card>
  );
}
