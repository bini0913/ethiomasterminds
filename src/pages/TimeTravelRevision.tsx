import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Clock, Play, CheckCircle, XCircle, RotateCcw, 
  Calendar, Target, Sparkles, Loader2, ChevronRight,
  Brain, Flame, Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface MissedQuestion {
  id: string;
  questionId: string;
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
  subject: string;
  options: string[];
  timesReviewed: number;
  lastReviewed: string | null;
  scheduledFor: string;
}

interface RevisionStats {
  totalMissed: number;
  reviewed: number;
  mastered: number;
  dueToday: number;
}

const TimeTravelRevision: React.FC = () => {
  const { user } = useUser();
  const [missedQuestions, setMissedQuestions] = useState<MissedQuestion[]>([]);
  const [stats, setStats] = useState<RevisionStats>({ totalMissed: 0, reviewed: 0, mastered: 0, dueToday: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRevising, setIsRevising] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<MissedQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [revisionQueue, setRevisionQueue] = useState<MissedQuestion[]>([]);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    if (user?.id) {
      loadMissedQuestions();
    }
  }, [user?.id]);

  const loadMissedQuestions = async () => {
    if (!user?.id) return;

    try {
      // Get questions the user got wrong
      const { data: attempts, error } = await supabase
        .from('question_attempts')
        .select(`
          id,
          question_id,
          selected_answer,
          created_at,
          questions (
            id,
            question_text,
            correct_answer,
            options,
            quizzes (subject)
          )
        `)
        .eq('user_id', user.id)
        .eq('is_correct', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get revision schedule
      const { data: schedules } = await supabase
        .from('revision_schedule')
        .select('*')
        .eq('user_id', user.id);

      const scheduleMap = new Map(schedules?.map(s => [s.question_id, s]) || []);

      // Group by question (only keep unique questions)
      const questionMap = new Map<string, MissedQuestion>();
      
      for (const attempt of attempts || []) {
        if (!attempt.questions || questionMap.has(attempt.question_id)) continue;
        
        const schedule = scheduleMap.get(attempt.question_id);
        const options = Array.isArray(attempt.questions.options) 
          ? attempt.questions.options as string[]
          : [];

        questionMap.set(attempt.question_id, {
          id: attempt.id,
          questionId: attempt.question_id,
          questionText: attempt.questions.question_text,
          correctAnswer: attempt.questions.correct_answer,
          userAnswer: attempt.selected_answer,
          subject: (attempt.questions.quizzes as any)?.subject || 'General',
          options,
          timesReviewed: schedule?.times_reviewed || 0,
          lastReviewed: schedule?.last_reviewed_at || null,
          scheduledFor: schedule?.scheduled_for || new Date().toISOString(),
        });
      }

      const questions = Array.from(questionMap.values());
      setMissedQuestions(questions);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const dueToday = questions.filter(q => q.scheduledFor.split('T')[0] <= today).length;
      const mastered = questions.filter(q => q.timesReviewed >= 3).length;

      setStats({
        totalMissed: questions.length,
        reviewed: questions.filter(q => q.timesReviewed > 0).length,
        mastered,
        dueToday,
      });
    } catch (error) {
      console.error('Error loading missed questions:', error);
      toast.error('Failed to load revision data');
    } finally {
      setIsLoading(false);
    }
  };

  const startRevision = () => {
    const today = new Date().toISOString().split('T')[0];
    const dueQuestions = missedQuestions
      .filter(q => q.scheduledFor.split('T')[0] <= today && q.timesReviewed < 5)
      .slice(0, 10);

    if (dueQuestions.length === 0) {
      toast.info('No questions due for revision today!');
      return;
    }

    setRevisionQueue(dueQuestions);
    setCurrentQuestion(dueQuestions[0]);
    setIsRevising(true);
    setSessionStats({ correct: 0, total: 0 });
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !selectedAnswer) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    setShowResult(true);
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    // Update revision schedule
    if (user?.id) {
      const nextReviewDays = isCorrect 
        ? Math.pow(2, currentQuestion.timesReviewed + 1) // Exponential backoff: 2, 4, 8, 16 days
        : 1; // If wrong again, review tomorrow

      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);

      await supabase
        .from('revision_schedule')
        .upsert({
          user_id: user.id,
          question_id: currentQuestion.questionId,
          scheduled_for: nextReviewDate.toISOString(),
          last_reviewed_at: new Date().toISOString(),
          times_reviewed: currentQuestion.timesReviewed + 1,
          status: isCorrect ? 'reviewed' : 'pending',
          difficulty_rating: isCorrect ? Math.max(1, (currentQuestion.timesReviewed || 3) - 1) : 5,
        }, { onConflict: 'user_id,question_id' });
    }
  };

  const nextQuestion = () => {
    setShowResult(false);
    setSelectedAnswer('');

    const currentIndex = revisionQueue.findIndex(q => q.questionId === currentQuestion?.questionId);
    if (currentIndex < revisionQueue.length - 1) {
      setCurrentQuestion(revisionQueue[currentIndex + 1]);
    } else {
      // Session complete
      setIsRevising(false);
      setCurrentQuestion(null);
      toast.success(`Session complete! ${sessionStats.correct}/${sessionStats.total} correct`);
      loadMissedQuestions();
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Time-Travel Revision</h1>
              <p className="text-sm text-muted-foreground">Master your past mistakes</p>
            </div>
          </div>
          {!isRevising && stats.dueToday > 0 && (
            <Button onClick={startRevision} className="gap-2">
              <Play className="h-4 w-4" />
              Start Review ({stats.dueToday})
            </Button>
          )}
        </div>
      </header>

      <div className="container max-w-4xl mx-auto py-6 px-4 relative z-10">
        {isRevising && currentQuestion ? (
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="capitalize">
                  {currentQuestion.subject}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Question {sessionStats.total + 1} of {revisionQueue.length}
                </span>
              </div>
              <Progress 
                value={((sessionStats.total + 1) / revisionQueue.length) * 100} 
                className="h-2 mt-2" 
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-lg font-medium">{currentQuestion.questionText}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  You previously answered: <span className="text-destructive">{currentQuestion.userAnswer}</span>
                </p>
              </div>

              {!showResult ? (
                <>
                  <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                    <div className="space-y-3">
                      {currentQuestion.options.map((option, index) => (
                        <div
                          key={index}
                          className={`flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer ${
                            selectedAnswer === option
                              ? 'border-primary bg-primary/10'
                              : 'border-border/50 hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedAnswer(option)}
                        >
                          <RadioGroupItem value={option} id={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                            <span className="font-medium mr-2">
                              {String.fromCharCode(65 + index)})
                            </span>
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>

                  <Button 
                    onClick={submitAnswer} 
                    disabled={!selectedAnswer}
                    className="w-full"
                    size="lg"
                  >
                    Check Answer
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${
                    selectedAnswer === currentQuestion.correctAnswer
                      ? 'bg-green-500/20 border border-green-500/30'
                      : 'bg-red-500/20 border border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedAnswer === currentQuestion.correctAnswer ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="font-medium text-green-500">Correct!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="font-medium text-red-500">Not quite right</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm">
                      The correct answer is: <strong>{currentQuestion.correctAnswer}</strong>
                    </p>
                  </div>

                  <Button onClick={nextQuestion} className="w-full" size="lg">
                    {sessionStats.total < revisionQueue.length ? 'Next Question' : 'Finish Session'}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Total Mistakes</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalMissed}</p>
                </CardContent>
              </Card>
              <Card className="glass border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <RotateCcw className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Reviewed</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.reviewed}</p>
                </CardContent>
              </Card>
              <Card className="glass border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Mastered</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.mastered}</p>
                </CardContent>
              </Card>
              <Card className="glass border-amber-500/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-muted-foreground">Due Today</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-500">{stats.dueToday}</p>
                </CardContent>
              </Card>
            </div>

            {/* Empty State or Question List */}
            {missedQuestions.length === 0 ? (
              <Card className="glass border-border/50">
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-16 w-16 mx-auto text-primary/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Mistakes Yet!</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Complete some quizzes and any questions you get wrong will appear here
                    for spaced repetition review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Your Revision Queue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {missedQuestions.slice(0, 10).map((question) => {
                      const isDueToday = question.scheduledFor.split('T')[0] <= new Date().toISOString().split('T')[0];
                      const isMastered = question.timesReviewed >= 3;

                      return (
                        <div 
                          key={question.questionId}
                          className={`p-4 rounded-xl border ${
                            isMastered 
                              ? 'border-green-500/30 bg-green-500/5' 
                              : isDueToday 
                                ? 'border-amber-500/30 bg-amber-500/5' 
                                : 'border-border/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{question.questionText}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {question.subject}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Reviewed {question.timesReviewed}x
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {isMastered ? (
                                <Badge className="bg-green-500">Mastered</Badge>
                              ) : isDueToday ? (
                                <Badge className="bg-amber-500">Due Today</Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {new Date(question.scheduledFor).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeTravelRevision;
