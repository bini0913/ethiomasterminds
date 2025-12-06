import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { 
  Users, BookOpen, BarChart2, Plus, Search, 
  FileText, Settings, LogOut, Bell, Check, X, Clock, Home
} from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id: string;
  text: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  grade: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
}

interface Student {
  id: string;
  name: string;
  grade: number;
  score: number;
  quizzesTaken: number;
}

const TeacherDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  
  // Form state for creating questions
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    subject: 'Math',
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
    grade: '5',
    options: ['', '', '', ''],
    correctAnswer: 0
  });

  // Mock data
  const [questions, setQuestions] = useState<Question[]>([
    { id: '1', text: "What is 5 + 7?", subject: "Math", difficulty: "easy", grade: "5", status: "approved" },
    { id: '2', text: "What planet is closest to the sun?", subject: "Science", difficulty: "medium", grade: "6", status: "pending" },
    { id: '3', text: "What is the past tense of 'run'?", subject: "English", difficulty: "easy", grade: "5", status: "approved" },
    { id: '4', text: "What is the capital of Ethiopia?", subject: "General Knowledge", difficulty: "easy", grade: "5", status: "draft" }
  ]);

  const [students] = useState<Student[]>([
    { id: '1', name: "Abebe Kebede", grade: 6, score: 85, quizzesTaken: 12 },
    { id: '2', name: "Tigist Alemu", grade: 6, score: 92, quizzesTaken: 15 },
    { id: '3', name: "Dawit Haile", grade: 5, score: 78, quizzesTaken: 8 },
    { id: '4', name: "Marta Bekele", grade: 7, score: 88, quizzesTaken: 10 },
    { id: '5', name: "Yonas Tadesse", grade: 5, score: 72, quizzesTaken: 6 }
  ]);

  React.useEffect(() => {
    if (user && user.role !== "teacher") {
      toast.error("Access denied - Teacher account required");
      navigate("/");
    }
  }, [user, navigate]);

  const stats = [
    { label: "Total Students", value: students.length, icon: Users, color: "from-primary to-accent" },
    { label: "Questions Created", value: questions.length, icon: FileText, color: "from-secondary to-glow-cyan" },
    { label: "Pending Approval", value: questions.filter(q => q.status === 'pending').length, icon: Clock, color: "from-glow-yellow to-orange-500" },
    { label: "Avg. Score", value: `${Math.round(students.reduce((a, b) => a + b.score, 0) / students.length)}%`, icon: BarChart2, color: "from-glow-green to-emerald-500" }
  ];

  const handleCreateQuestion = () => {
    if (!newQuestion.text.trim()) {
      toast.error("Please enter a question");
      return;
    }

    const question: Question = {
      id: `q-${Date.now()}`,
      text: newQuestion.text,
      subject: newQuestion.subject,
      difficulty: newQuestion.difficulty,
      grade: newQuestion.grade,
      status: 'draft'
    };

    setQuestions(prev => [question, ...prev]);
    setNewQuestion({
      text: '',
      subject: 'Math',
      difficulty: 'easy',
      grade: '5',
      options: ['', '', '', ''],
      correctAnswer: 0
    });
    setIsCreateQuizOpen(false);
    toast.success("Question saved as draft");
  };

  const submitForApproval = (id: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, status: 'pending' } : q
    ));
    toast.success("Question submitted for admin approval");
  };

  const filteredQuestions = questions.filter(q => 
    q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: Question['status']) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-glow-green text-background"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge className="bg-glow-yellow text-background"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackButton to="/" />
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-10 w-10">
                <Home className="h-5 w-5" />
              </Button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary to-glow-cyan flex items-center justify-center">
                <Users className="h-5 w-5 text-background" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold">Teacher Dashboard</h1>
                <p className="text-xs text-muted-foreground">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}><Settings className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="glass border-border/30">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-display font-bold">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Question Bank */}
            <Card className="glass border-border/30">
              <CardHeader>
                <CardTitle className="font-display flex items-center justify-between">
                  <span className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Question Bank</span>
                  <Dialog open={isCreateQuizOpen} onOpenChange={setIsCreateQuizOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Question</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create New Question</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="text-sm font-medium">Question Text</label>
                          <Textarea 
                            placeholder="Enter your question..."
                            value={newQuestion.text}
                            onChange={(e) => setNewQuestion(prev => ({ ...prev, text: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Subject</label>
                            <Select value={newQuestion.subject} onValueChange={(v) => setNewQuestion(prev => ({ ...prev, subject: v }))}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Math">Math</SelectItem>
                                <SelectItem value="Science">Science</SelectItem>
                                <SelectItem value="English">English</SelectItem>
                                <SelectItem value="General Knowledge">General Knowledge</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Difficulty</label>
                            <Select value={newQuestion.difficulty} onValueChange={(v: 'easy' | 'medium' | 'hard') => setNewQuestion(prev => ({ ...prev, difficulty: v }))}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Grade Level</label>
                          <Select value={newQuestion.grade} onValueChange={(v) => setNewQuestion(prev => ({ ...prev, grade: v }))}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(12)].map((_, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>Grade {i + 1}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 pt-4">
                          <Button variant="outline" onClick={() => setIsCreateQuizOpen(false)} className="flex-1">
                            Cancel
                          </Button>
                          <Button onClick={handleCreateQuestion} className="flex-1">
                            Save Draft
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search questions..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredQuestions.map((item) => (
                    <div key={item.id} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.text}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">{item.subject}</Badge>
                            <Badge className={
                              item.difficulty === 'easy' ? 'bg-glow-green/20 text-glow-green' : 
                              item.difficulty === 'medium' ? 'bg-glow-yellow/20 text-glow-yellow' : 
                              'bg-destructive/20 text-destructive'
                            }>{item.difficulty}</Badge>
                            <Badge variant="outline">Grade {item.grade}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(item.status)}
                          {item.status === 'draft' && (
                            <Button size="sm" variant="outline" onClick={() => submitForApproval(item.id)}>
                              Submit for Approval
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Students List */}
            <Card className="glass border-border/30">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Users className="h-5 w-5" /> My Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {students.map((s) => (
                    <div key={s.id} className="p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                          👤
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">Grade {s.grade} • {s.quizzesTaken} quizzes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={s.score >= 80 ? "bg-glow-green text-background" : s.score >= 60 ? "bg-glow-yellow text-background" : "bg-destructive"}>
                          {s.score}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <footer className="text-center py-4 text-xs text-muted-foreground">
          Created by Biniam Bogale
        </footer>
      </div>
    </div>
  );
};

export default TeacherDashboard;
