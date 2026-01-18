import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, Plus, BookOpen, Trophy, TrendingUp, Brain,
  Calendar, Clock, Target, Sparkles, Loader2, Link2,
  ChevronRight, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface LinkedStudent {
  id: string;
  name: string;
  grade: string;
  level: number;
  xp: number;
  avatar: string | null;
}

interface StudentInsights {
  student: {
    name: string;
    grade: string;
    level: number;
    xp: number;
  };
  stats: {
    totalQuizzes: number;
    avgScore: number;
    totalXP: number;
    currentStreak: number;
    longestStreak: number;
    recentActivity: number;
  };
  learningDna: {
    strengths: string[];
    weaknesses: string[];
    learningStyle: string;
  };
  aiInsights: {
    overallSummary: string;
    strengths: string[];
    areasToSupport: string[];
    suggestedActivities: string[];
    motivationalNote: string;
  } | null;
}

const ParentDashboard: React.FC = () => {
  const { user } = useUser();
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [insights, setInsights] = useState<StudentInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadLinkedStudents();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentInsights(selectedStudent);
    }
  }, [selectedStudent]);

  const loadLinkedStudents = async () => {
    if (!user?.id) return;

    try {
      const { data: links } = await supabase
        .from('parent_links')
        .select('student_id')
        .eq('parent_id', user.id)
        .eq('status', 'active');

      if (links && links.length > 0) {
        const studentIds = links.map(l => l.student_id);
        const { data: students } = await supabase
          .from('profiles')
          .select('id, name, grade, level, xp, avatar')
          .in('id', studentIds);

        setLinkedStudents(students || []);
        if (students && students.length > 0 && !selectedStudent) {
          setSelectedStudent(students[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading linked students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudentInsights = async (studentId: string) => {
    setIsLoadingInsights(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-parent-insights', {
        body: { studentId },
      });

      if (error) throw error;

      if (data.success) {
        setInsights(data.data);
      }
    } catch (error: any) {
      console.error('Error loading insights:', error);
      toast.error(error.message || 'Failed to load insights');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const linkStudent = async () => {
    if (!linkCode.trim() || !user?.id) return;

    setIsLinking(true);
    
    try {
      // Find the link by code
      const { data: link, error: linkError } = await supabase
        .from('parent_links')
        .select('*')
        .eq('link_code', linkCode.trim().toUpperCase())
        .eq('status', 'pending')
        .single();

      if (linkError || !link) {
        throw new Error('Invalid or expired link code');
      }

      // Update the link
      const { error: updateError } = await supabase
        .from('parent_links')
        .update({ 
          parent_id: user.id,
          status: 'active',
          linked_at: new Date().toISOString()
        })
        .eq('id', link.id);

      if (updateError) throw updateError;

      toast.success('Student linked successfully!');
      setLinkCode('');
      setLinkDialogOpen(false);
      loadLinkedStudents();
    } catch (error: any) {
      console.error('Error linking student:', error);
      toast.error(error.message || 'Failed to link student');
    } finally {
      setIsLinking(false);
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Parent Dashboard</h1>
              <p className="text-sm text-muted-foreground">Track your child's learning journey</p>
            </div>
          </div>
          
          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Link Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link a Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Enter the link code provided by your child's teacher or from your child's account.
                </p>
                <Input
                  placeholder="Enter link code (e.g., ABC123)"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  className="text-center text-lg tracking-widest"
                />
                <Button 
                  onClick={linkStudent} 
                  disabled={isLinking || !linkCode.trim()}
                  className="w-full"
                >
                  {isLinking ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Link Student
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-6 px-4 relative z-10">
        {linkedStudents.length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Students Linked</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Link your child's account to view their learning progress, achievements, and get AI-powered insights.
              </p>
              <Button onClick={() => setLinkDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Link Your First Student
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Student Selector */}
            <div className="lg:col-span-1">
              <Card className="glass border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Your Students</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {linkedStudents.map((student) => (
                    <Button
                      key={student.id}
                      variant={selectedStudent === student.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedStudent(student.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-2 text-white text-sm">
                        {student.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs opacity-70">Grade {student.grade}</p>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Student Insights */}
            <div className="lg:col-span-3 space-y-6">
              {isLoadingInsights ? (
                <Card className="glass border-border/50">
                  <CardContent className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">Loading insights...</p>
                  </CardContent>
                </Card>
              ) : insights ? (
                <>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="glass border-border/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-muted-foreground">Quizzes</span>
                        </div>
                        <p className="text-2xl font-bold">{insights.stats.totalQuizzes}</p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-border/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-muted-foreground">Avg Score</span>
                        </div>
                        <p className="text-2xl font-bold">{insights.stats.avgScore}%</p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-border/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          <span className="text-sm text-muted-foreground">Total XP</span>
                        </div>
                        <p className="text-2xl font-bold">{insights.stats.totalXP}</p>
                      </CardContent>
                    </Card>
                    <Card className="glass border-border/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <span className="text-sm text-muted-foreground">Streak</span>
                        </div>
                        <p className="text-2xl font-bold">{insights.stats.currentStreak} days</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* AI Insights */}
                  {insights.aiInsights && (
                    <Card className="glass border-primary/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          AI Insights for You
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm">{insights.aiInsights.overallSummary}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-green-500" />
                              What's Going Well
                            </h4>
                            <div className="space-y-2">
                              {insights.aiInsights.strengths.map((strength, index) => (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <ChevronRight className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                                  <span>{strength}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Target className="h-4 w-4 text-blue-500" />
                              How You Can Help
                            </h4>
                            <div className="space-y-2">
                              {insights.aiInsights.areasToSupport.map((area, index) => (
                                <div key={index} className="flex items-start gap-2 text-sm">
                                  <ChevronRight className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                                  <span>{area}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Suggested Activities Together</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {insights.aiInsights.suggestedActivities.map((activity, index) => (
                              <div 
                                key={index} 
                                className="p-3 rounded-lg bg-muted/50 text-sm text-center"
                              >
                                {activity}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                          <p className="text-sm italic text-center">{insights.aiInsights.motivationalNote}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Learning DNA Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="glass border-green-500/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500 text-base">
                          <Trophy className="h-4 w-4" />
                          Strong Subjects
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {insights.learningDna.strengths.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Still being assessed</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {insights.learningDna.strengths.map((strength, index) => (
                              <Badge key={index} variant="secondary" className="capitalize">
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="glass border-amber-500/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-500 text-base">
                          <Brain className="h-4 w-4" />
                          Needs More Practice
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {insights.learningDna.weaknesses.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No weak areas identified yet</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {insights.learningDna.weaknesses.map((weakness, index) => (
                              <Badge key={index} variant="outline" className="capitalize">
                                {weakness}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="glass border-border/50">
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Unable to load insights. Please try again.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => selectedStudent && loadStudentInsights(selectedStudent)}
                    >
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;
