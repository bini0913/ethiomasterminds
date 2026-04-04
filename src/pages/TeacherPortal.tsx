import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, Users, ClipboardList, Trophy, Bell, Settings, LogOut,
  Plus, Trash2, Edit, Send, Calendar, Clock, Target, Award, Search,
  UserPlus, FileText, BarChart3, CheckCircle, XCircle, Loader2
} from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  difficulty: string;
  is_approved: boolean;
  created_at: string;
  questions?: Question[];
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  points: number;
}

interface ClassData {
  id: string;
  name: string;
  class_code: string;
  description: string;
  grade: string;
  subject: string;
  student_count?: number;
}

interface Student {
  id: string;
  name: string;
  username: string;
  xp: number;
  level: number;
  avatar: string;
}

interface QuizResult {
  id: string;
  student_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  time_taken: number;
  xp_earned: number;
  completed_at: string;
  student?: Student;
  quiz?: Quiz;
}

const TeacherPortal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ name: string; username: string } | null>(null);
  
  // Quiz state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    subject: 'Math',
    grade: '9',
    difficulty: 'medium',
    time_limit: 30
  });
  
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: '',
    points: 10
  });
  
  // Class state
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [classForm, setClassForm] = useState({
    name: '',
    description: '',
    grade: '9',
    subject: 'Math'
  });
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  
  // Results state
  const [results, setResults] = useState<QuizResult[]>([]);
  
  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    target_type: 'class',
    target_id: ''
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Student search state
  const [showStudentSearch, setShowStudentSearch] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchQuizzes();
      fetchClasses();
      fetchResults();
      fetchAnnouncements();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', user?.id)
      .single();
    if (data) setProfile(data);
  };

  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('created_by', user?.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to fetch quizzes');
      return;
    }
    setQuizzes(data || []);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to fetch classes');
      return;
    }
    setClasses(data || []);
  };

  const fetchResults = async () => {
    const { data, error } = await supabase
      .from('quiz_results')
      .select(`
        *,
        quizzes:quiz_id (title, subject)
      `)
      .order('completed_at', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setResults(data);
    }
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('author_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setAnnouncements(data);
    }
  };

  const fetchClassStudents = async (classId: string) => {
    try {
      // Use the secure RPC function to get class students
      const { data, error } = await supabase.rpc('get_class_students', {
        class_uuid: classId
      });
      
      if (error) {
        console.error('Failed to fetch students:', error);
        toast.error('Failed to fetch students');
        return;
      }

      setClassStudents(data || []);
    } catch (err) {
      console.error('Error fetching class students:', err);
      setClassStudents([]);
    }
  };

  const searchStudents = async (query: string) => {
    if (!query.trim()) {
      setStudentSearchResults([]);
      return;
    }

    setSearchingStudents(true);
    try {
      const { data, error } = await supabase.rpc('find_student_by_username', {
        search_username: query.trim()
      });

      if (error) {
        console.error('Student search error:', error);
        toast.error('Search failed');
        return;
      }

      setStudentSearchResults(data || []);
    } catch (err) {
      console.error('Error searching students:', err);
    } finally {
      setSearchingStudents(false);
    }
  };

  const handleAddStudentToClass = async (studentId: string) => {
    if (!selectedClass) {
      toast.error('Please select a class first');
      return;
    }

    // Check if student is already in the class
    const existingStudent = classStudents.find(s => s.id === studentId);
    if (existingStudent) {
      toast.info('Student is already in this class');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('class_students')
      .insert({
        class_id: selectedClass.id,
        student_id: studentId
      });

    setLoading(false);
    if (error) {
      console.error('Add student error:', error);
      toast.error('Failed to add student');
      return;
    }

    toast.success('Student added to class!');
    fetchClassStudents(selectedClass.id);
    setShowStudentSearch(false);
    setStudentSearchQuery('');
    setStudentSearchResults([]);
  };

  const fetchQuizQuestions = async (quizId: string) => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index');
    
    if (!error && data) {
      const formattedQuestions = data.map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as string[] : []
      }));
      setQuestions(formattedQuestions);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizForm.title || !quizForm.subject) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        ...quizForm,
        created_by: user?.id
      })
      .select()
      .single();

    setLoading(false);
    if (error) {
      toast.error('Failed to create quiz');
      return;
    }

    toast.success('Quiz created successfully!');
    setShowQuizDialog(false);
    setQuizForm({ title: '', description: '', subject: 'Math', grade: '9', difficulty: 'medium', time_limit: 30 });
    fetchQuizzes();
  };

  const handleUpdateQuiz = async () => {
    if (!editingQuiz) return;

    setLoading(true);
    const { error } = await supabase
      .from('quizzes')
      .update(quizForm)
      .eq('id', editingQuiz.id);

    setLoading(false);
    if (error) {
      toast.error('Failed to update quiz');
      return;
    }

    toast.success('Quiz updated!');
    setEditingQuiz(null);
    setShowQuizDialog(false);
    fetchQuizzes();
  };

  const handleDeleteQuiz = async (quizId: string) => {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (error) {
      toast.error('Failed to delete quiz');
      return;
    }

    toast.success('Quiz deleted');
    fetchQuizzes();
  };

  const handleAddQuestion = async () => {
    if (!selectedQuizId || !questionForm.question_text || !questionForm.correct_answer) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('questions')
      .insert({
        quiz_id: selectedQuizId,
        question_text: questionForm.question_text,
        options: questionForm.options.filter(o => o.trim()),
        correct_answer: questionForm.correct_answer,
        explanation: questionForm.explanation,
        points: questionForm.points,
        order_index: questions.length
      });

    setLoading(false);
    if (error) {
      toast.error('Failed to add question');
      return;
    }

    toast.success('Question added!');
    setShowQuestionDialog(false);
    setQuestionForm({ question_text: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 10 });
    fetchQuizQuestions(selectedQuizId);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      toast.error('Failed to delete question');
      return;
    }

    toast.success('Question deleted');
    if (selectedQuizId) fetchQuizQuestions(selectedQuizId);
  };

  const handleCreateClass = async () => {
    if (!classForm.name) {
      toast.error('Please enter a class name');
      return;
    }

    setLoading(true);
    const classCode = `${classForm.subject.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    
    const { error } = await supabase
      .from('classes')
      .insert({
        ...classForm,
        class_code: classCode,
        teacher_id: user?.id
      });

    setLoading(false);
    if (error) {
      toast.error('Failed to create class');
      return;
    }

    toast.success('Class created! Code: ' + classCode);
    setShowClassDialog(false);
    setClassForm({ name: '', description: '', grade: '9', subject: 'Math' });
    fetchClasses();
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedClass) return;

    const { error } = await supabase
      .from('class_students')
      .delete()
      .eq('class_id', selectedClass.id)
      .eq('student_id', studentId);

    if (error) {
      toast.error('Failed to remove student');
      return;
    }

    toast.success('Student removed');
    fetchClassStudents(selectedClass.id);
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.content) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!user?.id) {
      toast.error('Not authenticated');
      return;
    }

    setLoading(true);
    const { data: createdAnnouncement, error } = await supabase
      .from('announcements')
      .insert({
        ...announcementForm,
        author_id: user.id,
        target_id: announcementForm.target_id || null
      })
      .select('id, title, content, target_type, target_id')
      .single();

    if (error) {
      setLoading(false);
      toast.error('Failed to create announcement');
      return;
    }

    const shouldShareToStudentSocial = ['all', 'students', 'class'].includes(createdAnnouncement.target_type);

    if (shouldShareToStudentSocial) {
      const socialPostContent = `📢 ${createdAnnouncement.title}

${createdAnnouncement.content}`;
      const teacherFirstName = (profile?.name || 'Teacher').trim().split(' ')[0];
      const { error: socialError } = await supabase
        .from('social_posts')
        .insert({
          author_id: user.id,
          content: socialPostContent,
          post_type: 'post',
          metadata: {
            source: 'announcement',
            announcement_id: createdAnnouncement.id,
            target_type: createdAnnouncement.target_type,
            target_id: createdAnnouncement.target_id,
            display_name: `Mr. ${teacherFirstName}`,
            hide_level: true
          }
        });

      if (socialError) {
        console.error('Error sharing announcement to social:', socialError);
        toast.error('Announcement created, but failed to share to social feed');
      }
    }

    setLoading(false);
    toast.success('Announcement sent!');
    setShowAnnouncementDialog(false);
    setAnnouncementForm({ title: '', content: '', target_type: 'class', target_id: '' });
    fetchAnnouncements();
  };

  const handleAssignQuiz = async (quizId: string, classId: string, dueDate?: Date) => {
    const { error } = await supabase
      .from('quiz_assignments')
      .insert({
        quiz_id: quizId,
        class_id: classId,
        assigned_by: user?.id,
        due_date: dueDate?.toISOString()
      });

    if (error) {
      toast.error('Failed to assign quiz');
      return;
    }

    toast.success('Quiz assigned to class!');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const stats = {
    totalQuizzes: quizzes.length,
    totalClasses: classes.length,
    totalStudents: classStudents.length,
    pendingApproval: quizzes.filter(q => !q.is_approved).length
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Teacher Portal
                </h1>
                <p className="text-sm text-muted-foreground">Welcome, {profile?.name || 'Teacher'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveTab('settings')}>
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-6 gap-2 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Quizzes</span>
              </TabsTrigger>
              <TabsTrigger value="classes" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Classes</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Results</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Announce</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Quizzes</p>
                          <p className="text-3xl font-bold">{stats.totalQuizzes}</p>
                        </div>
                        <BookOpen className="w-10 h-10 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="bg-gradient-to-br from-accent/20 to-accent/5 border-accent/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">My Classes</p>
                          <p className="text-3xl font-bold">{stats.totalClasses}</p>
                        </div>
                        <Users className="w-10 h-10 text-accent opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Quiz Results</p>
                          <p className="text-3xl font-bold">{results.length}</p>
                        </div>
                        <Trophy className="w-10 h-10 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Pending</p>
                          <p className="text-3xl font-bold">{stats.pendingApproval}</p>
                        </div>
                        <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button onClick={() => { setActiveTab('quizzes'); setShowQuizDialog(true); }} className="h-20 flex-col gap-2">
                    <Plus className="w-6 h-6" />
                    Create Quiz
                  </Button>
                  <Button onClick={() => { setActiveTab('classes'); setShowClassDialog(true); }} variant="secondary" className="h-20 flex-col gap-2">
                    <UserPlus className="w-6 h-6" />
                    New Class
                  </Button>
                  <Button onClick={() => setActiveTab('results')} variant="outline" className="h-20 flex-col gap-2">
                    <BarChart3 className="w-6 h-6" />
                    View Results
                  </Button>
                  <Button onClick={() => { setActiveTab('announcements'); setShowAnnouncementDialog(true); }} variant="outline" className="h-20 flex-col gap-2">
                    <Send className="w-6 h-6" />
                    Announce
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Quiz Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {results.slice(0, 10).map((result) => (
                      <div key={result.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                        <div>
                          <p className="font-medium">{(result as any).quizzes?.title || 'Quiz'}</p>
                          <p className="text-sm text-muted-foreground">
                            Score: {result.correct_answers}/{result.total_questions} • XP: +{result.xp_earned}
                          </p>
                        </div>
                        <Badge variant={result.score >= 70 ? 'default' : 'secondary'}>
                          {result.score}%
                        </Badge>
                      </div>
                    ))}
                    {results.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No results yet</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes" className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search quizzes..." 
                      className="pl-10 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingQuiz(null); setQuizForm({ title: '', description: '', subject: 'Math', grade: '9', difficulty: 'medium', time_limit: 30 }); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Quiz
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input 
                        placeholder="Quiz Title" 
                        value={quizForm.title}
                        onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                      />
                      <Textarea 
                        placeholder="Description" 
                        value={quizForm.description}
                        onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Select value={quizForm.subject} onValueChange={(v) => setQuizForm({ ...quizForm, subject: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Math">Math</SelectItem>
                            <SelectItem value="Science">Science</SelectItem>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="History">History</SelectItem>
                            <SelectItem value="Civics">Civics</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={quizForm.grade} onValueChange={(v) => setQuizForm({ ...quizForm, grade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[...Array(12)].map((_, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>Grade {i+1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Select value={quizForm.difficulty} onValueChange={(v) => setQuizForm({ ...quizForm, difficulty: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input 
                          type="number" 
                          placeholder="Time limit (min)" 
                          value={quizForm.time_limit}
                          onChange={(e) => setQuizForm({ ...quizForm, time_limit: parseInt(e.target.value) })}
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={editingQuiz ? handleUpdateQuiz : handleCreateQuiz}
                        disabled={loading}
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {quizzes
                  .filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((quiz) => (
                  <motion.div key={quiz.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">{quiz.title}</h3>
                              <Badge variant={quiz.is_approved ? 'default' : 'secondary'}>
                                {quiz.is_approved ? 'Approved' : 'Pending'}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm mb-3">{quiz.description}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline">{quiz.subject}</Badge>
                              <Badge variant="outline">Grade {quiz.grade}</Badge>
                              <Badge variant="outline">{quiz.difficulty}</Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedQuizId(quiz.id);
                                fetchQuizQuestions(quiz.id);
                                setShowQuestionDialog(true);
                              }}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Questions
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingQuiz(quiz);
                                setQuizForm({
                                  title: quiz.title,
                                  description: quiz.description || '',
                                  subject: quiz.subject,
                                  grade: quiz.grade || '9',
                                  difficulty: quiz.difficulty || 'medium',
                                  time_limit: 30
                                });
                                setShowQuizDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteQuiz(quiz.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {quizzes.length === 0 && (
                  <Card className="p-12 text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first quiz to get started</p>
                    <Button onClick={() => setShowQuizDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Quiz
                    </Button>
                  </Card>
                )}
              </div>

              {/* Questions Dialog */}
              <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>Manage Questions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Add Question Form */}
                    <Card className="p-4">
                      <h4 className="font-semibold mb-4">Add New Question</h4>
                      <div className="space-y-4">
                        <Textarea 
                          placeholder="Question text" 
                          value={questionForm.question_text}
                          onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {questionForm.options.map((opt, i) => (
                            <Input 
                              key={i}
                              placeholder={`Option ${i + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...questionForm.options];
                                newOptions[i] = e.target.value;
                                setQuestionForm({ ...questionForm, options: newOptions });
                              }}
                            />
                          ))}
                        </div>
                        <Input 
                          placeholder="Correct answer" 
                          value={questionForm.correct_answer}
                          onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
                        />
                        <Textarea 
                          placeholder="Explanation (optional)" 
                          value={questionForm.explanation}
                          onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                        />
                        <Button onClick={handleAddQuestion} disabled={loading}>
                          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Add Question
                        </Button>
                      </div>
                    </Card>

                    {/* Existing Questions */}
                    <div className="space-y-2">
                      <h4 className="font-semibold">Existing Questions ({questions.length})</h4>
                      {questions.map((q, i) => (
                        <Card key={q.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{i + 1}. {q.question_text}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Answer: {q.correct_answer} • Points: {q.points}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(q.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Classes Tab */}
            <TabsContent value="classes" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Classes</h2>
                <Dialog open={showClassDialog} onOpenChange={setShowClassDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Class</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input 
                        placeholder="Class Name" 
                        value={classForm.name}
                        onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      />
                      <Textarea 
                        placeholder="Description" 
                        value={classForm.description}
                        onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Select value={classForm.grade} onValueChange={(v) => setClassForm({ ...classForm, grade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[...Array(12)].map((_, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>Grade {i+1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={classForm.subject} onValueChange={(v) => setClassForm({ ...classForm, subject: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Math">Math</SelectItem>
                            <SelectItem value="Science">Science</SelectItem>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="History">History</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full" onClick={handleCreateClass} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Class
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.map((cls) => (
                  <motion.div key={cls.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <Card 
                      className="cursor-pointer hover:border-primary/50 transition-all"
                      onClick={() => {
                        setSelectedClass(cls);
                        fetchClassStudents(cls.id);
                      }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{cls.name}</h3>
                            <p className="text-sm text-muted-foreground">{cls.description}</p>
                          </div>
                          <Badge>{cls.subject}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            Grade {cls.grade}
                          </span>
                          <span className="font-mono bg-muted px-2 py-1 rounded">
                            {cls.class_code}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
                {classes.length === 0 && (
                  <Card className="col-span-full p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No classes yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first class to start teaching</p>
                    <Button onClick={() => setShowClassDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Class
                    </Button>
                  </Card>
                )}
              </div>

              {/* Selected Class Details */}
              {selectedClass && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedClass.name} - Students</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{classStudents.length} students</Badge>
                        <Dialog open={showStudentSearch} onOpenChange={setShowStudentSearch}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <UserPlus className="w-4 h-4 mr-1" />
                              Add Student
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Student to {selectedClass.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input 
                                    placeholder="Search by name or username..." 
                                    className="pl-10"
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        searchStudents(studentSearchQuery);
                                      }
                                    }}
                                  />
                                </div>
                                <Button onClick={() => searchStudents(studentSearchQuery)} disabled={searchingStudents}>
                                  {searchingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                                </Button>
                              </div>
                              
                              <ScrollArea className="h-64">
                                {studentSearchResults.length > 0 ? (
                                  <div className="space-y-2">
                                    {studentSearchResults.map((student) => (
                                      <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            {student.avatar?.startsWith('avatar') ? student.name?.charAt(0) || 'S' : student.avatar || student.name?.charAt(0)}
                                          </div>
                                          <div>
                                            <p className="font-medium">{student.name}</p>
                                            <p className="text-sm text-muted-foreground">@{student.username} • Level {student.level}</p>
                                          </div>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleAddStudentToClass(student.id)}
                                          disabled={loading || classStudents.some(s => s.id === student.id)}
                                        >
                                          {classStudents.some(s => s.id === student.id) ? 'Added' : 'Add'}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : studentSearchQuery && !searchingStudents ? (
                                  <p className="text-center text-muted-foreground py-8">
                                    No students found matching "{studentSearchQuery}"
                                  </p>
                                ) : (
                                  <p className="text-center text-muted-foreground py-8">
                                    Search for students by name or username
                                  </p>
                                )}
                              </ScrollArea>
                              
                              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                                Or share class code: <span className="font-mono font-bold">{selectedClass.class_code}</span>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {classStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              {student.name?.charAt(0) || 'S'}
                            </div>
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-sm text-muted-foreground">@{student.username} • Level {student.level} • {student.xp} XP</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveStudent(student.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {classStudents.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-2">No students in this class yet.</p>
                          <p className="text-sm text-muted-foreground">
                            Share the class code: <span className="font-mono font-bold">{selectedClass.class_code}</span>
                          </p>
                          <Button 
                            className="mt-4" 
                            variant="outline"
                            onClick={() => setShowStudentSearch(true)}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Search & Add Students
                          </Button>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Student Quiz Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {results.map((result) => (
                        <Card key={result.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{(result as any).quizzes?.title || 'Quiz'}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span>Score: {result.correct_answers}/{result.total_questions}</span>
                                <span>Time: {Math.floor((result.time_taken || 0) / 60)}m {(result.time_taken || 0) % 60}s</span>
                                <span>XP: +{result.xp_earned}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={result.score >= 70 ? 'default' : result.score >= 50 ? 'secondary' : 'destructive'}>
                                {result.score}%
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(result.completed_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {results.length === 0 && (
                        <p className="text-center text-muted-foreground py-12">No quiz results yet</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Announcements Tab */}
            <TabsContent value="announcements" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Announcements</h2>
                <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New Announcement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Announcement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input 
                        placeholder="Title" 
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      />
                      <Textarea 
                        placeholder="Content" 
                        rows={4}
                        value={announcementForm.content}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                      />
                      <Select 
                        value={announcementForm.target_type} 
                        onValueChange={(v) => setAnnouncementForm({ ...announcementForm, target_type: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="class">Specific Class</SelectItem>
                          <SelectItem value="students">All My Students</SelectItem>
                        </SelectContent>
                      </Select>
                      {announcementForm.target_type === 'class' && (
                        <Select 
                          value={announcementForm.target_id} 
                          onValueChange={(v) => setAnnouncementForm({ ...announcementForm, target_id: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                          <SelectContent>
                            {classes.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button className="w-full" onClick={handleCreateAnnouncement} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Send Announcement
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {announcements.map((ann) => (
                  <Card key={ann.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{ann.title}</h3>
                          <p className="text-muted-foreground mt-2">{ann.content}</p>
                          <p className="text-xs text-muted-foreground mt-4">
                            {new Date(ann.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline">{ann.target_type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {announcements.length === 0 && (
                  <Card className="p-12 text-center">
                    <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No announcements</h3>
                    <p className="text-muted-foreground mb-4">Send your first announcement to students</p>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Teacher Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl text-primary-foreground font-bold">
                      {profile?.name?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{profile?.name}</h3>
                      <p className="text-muted-foreground">@{profile?.username}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Quizzes</p>
                      <p className="text-2xl font-bold">{quizzes.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Classes</p>
                      <p className="text-2xl font-bold">{classes.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default TeacherPortal;
