import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, Target, TrendingUp, Sparkles, RefreshCw, 
  BookOpen, Zap, Award, ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';

interface TopicMastery {
  mastery: number;
  status: string;
}

interface LearningData {
  topicMastery: Record<string, TopicMastery>;
  strengths: string[];
  weaknesses: string[];
  learningStyle: string;
  predictedPath: {
    recommendedFocus: string[];
    studyTips: string[];
    predictedCareerPaths: string[];
  } | null;
  totalAttempts: number;
}

const LearningDNA: React.FC = () => {
  const { user } = useUser();
  const [learningData, setLearningData] = useState<LearningData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadLearningDNA();
    }
  }, [user?.id]);

  const loadLearningDNA = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('learning_dna')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const topicMastery = (data.topic_mastery as unknown as Record<string, TopicMastery>) || {};
        setLearningData({
          topicMastery,
          strengths: (data.strengths as string[]) || [],
          weaknesses: (data.weaknesses as string[]) || [],
          learningStyle: data.learning_style || 'balanced',
          predictedPath: data.predicted_path as any,
          totalAttempts: 0,
        });
      }
    } catch (error) {
      console.error('Error loading learning DNA:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeLearningDNA = async () => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-learning-dna');

      if (error) throw error;

      if (data.success) {
        setLearningData(data.data);
        toast.success('Learning DNA updated!');
      }
    } catch (error: any) {
      console.error('Error analyzing learning DNA:', error);
      toast.error(error.message || 'Failed to analyze learning DNA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'mastered': return 'bg-green-500';
      case 'learning': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'mastered': return { text: 'Mastered', variant: 'default' as const };
      case 'learning': return { text: 'Learning', variant: 'secondary' as const };
      default: return { text: 'Needs Work', variant: 'destructive' as const };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Learning DNA</h1>
              <p className="text-sm text-muted-foreground">Your personalized learning map</p>
            </div>
          </div>
          <Button 
            onClick={analyzeLearningDNA} 
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'Update Analysis'}
          </Button>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-6 px-4 relative z-10 space-y-6">
        {!learningData || Object.keys(learningData.topicMastery).length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <Brain className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Learning Data Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Complete some quizzes to build your Learning DNA. We'll analyze your 
                performance to create a personalized learning map.
              </p>
              <Button onClick={analyzeLearningDNA} disabled={isAnalyzing}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze Now'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Brain Map - Topic Mastery */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Brain Map - Topic Mastery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(learningData.topicMastery).map(([topic, data]) => {
                    const badge = getStatusBadge(data.status);
                    return (
                      <div 
                        key={topic}
                        className="p-4 rounded-xl border border-border/50 bg-card/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{topic}</span>
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                        </div>
                        <Progress value={data.mastery} className="h-2 mb-2" />
                        <p className="text-sm text-muted-foreground">{data.mastery}% mastery</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass border-green-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-500">
                    <Award className="h-5 w-5" />
                    Your Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {learningData.strengths.length === 0 ? (
                    <p className="text-muted-foreground">Keep practicing to discover your strengths!</p>
                  ) : (
                    <div className="space-y-2">
                      {learningData.strengths.map((strength, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                        >
                          <Zap className="h-4 w-4 text-green-500" />
                          <span className="capitalize">{strength}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-amber-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-500">
                    <Target className="h-5 w-5" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {learningData.weaknesses.length === 0 ? (
                    <p className="text-muted-foreground">Great job! No weak areas identified.</p>
                  ) : (
                    <div className="space-y-2">
                      {learningData.weaknesses.map((weakness, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                        >
                          <BookOpen className="h-4 w-4 text-amber-500" />
                          <span className="capitalize">{weakness}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Learning Style */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Your Learning Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold capitalize">{learningData.learningStyle} Learner</h3>
                    <p className="text-muted-foreground">
                      {learningData.learningStyle === 'analytical' && 'You take your time to deeply understand concepts.'}
                      {learningData.learningStyle === 'quick-thinker' && 'You process information quickly and efficiently.'}
                      {learningData.learningStyle === 'balanced' && 'You have a well-rounded approach to learning.'}
                      {learningData.learningStyle === 'visual' && 'You learn best with visual aids and diagrams.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Predictions */}
            {learningData.predictedPath && (
              <Card className="glass border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    AI-Powered Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Recommended Focus Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {learningData.predictedPath.recommendedFocus.map((focus, index) => (
                        <Badge key={index} variant="secondary" className="text-sm">
                          {focus}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Study Tips</h4>
                    <div className="space-y-2">
                      {learningData.predictedPath.studyTips.map((tip, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <span className="text-sm">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Potential Career Paths</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {learningData.predictedPath.predictedCareerPaths.map((career, index) => (
                        <div 
                          key={index} 
                          className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-center"
                        >
                          <span className="font-medium">{career}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LearningDNA;
