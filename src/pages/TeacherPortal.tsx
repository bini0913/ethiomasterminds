import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendRemoteNotifications } from '@/lib/staffNotifications';
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
  UserPlus, FileText, BarChart3, CheckCircle, XCircle, Loader2, Download,
  RefreshCw, Save, Copy, MoreHorizontal
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

interface DirectoryStudent extends Student {
  classNames: string[];
  classIds: string[];
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
  const [refreshing, setRefreshing] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name: string; username: string } | null>(null);
  
  // Quiz state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentForm, setAssignmentForm] = useState({ quiz_id: '', class_id: '', due_date: '' });
  const [assigningQuiz, setAssigningQuiz] = useState(false);
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
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    description: '',
    grade: '9',
    subject: 'Math'
  });
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<DirectoryStudent[]>([]);
  const [studentDirectoryQuery, setStudentDirectoryQuery] = useState('');
  
  // Results state
  const [results, setResults] = useState<QuizResult[]>([]);
  const [resultSearchQuery, setResultSearchQuery] = useState('');
  const [resultQuizFilter, setResultQuizFilter] = useState('all');
  
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
    if (!user) return;
    void Promise.all([
      fetchProfile(),
      fetchQuizzes(),
      fetchClasses(),
      fetchResults(),
      fetchAnnouncements(),
      fetchAssignments(),
    ]).catch((error) => {
      console.error("Teacher portal initial data load failed:", error);
      toast.error("Some teacher workspace data could not be loaded. Please refresh and try again.");
    });
  }, [user]);

  const refreshPortal = async () => {
    setRefreshing(true);
    setPortalError(null);
    try {
      await Promise.all([
        fetchProfile(),
        fetchQuizzes(),
        fetchClasses(),
        fetchResults(),
        fetchAnnouncements(),
        fetchAssignments(),
      ]);
      toast.success('Teacher workspace refreshed');
    } catch (error) {
      console.error('Teacher portal refresh failed:', error);
      setPortalError('Some workspace data could not be refreshed. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

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
      setPortalError('Quizzes could not be loaded. Use Refresh to try again.');
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
      setPortalError('Classes could not be loaded. Use Refresh to try again.');
      return;
    }
    setClasses(data || []);
  };

  const fetchAllStudents = useCallback(async () => {
    if (!classes.length) {
      setAllStudents([]);
      return;
    }

    const results = await Promise.all(classes.map(async (cls) => {
      const { data, error } = await supabase.rpc('get_class_students', { class_uuid: cls.id });
      if (error) {
        console.error(`Failed to load students for ${cls.name}:`, error);
        return [] as Array<{ student: Student; className: string; classId: string }>;
      }
      return (data || []).map((student: Student) => ({ student, className: cls.name, classId: cls.id }));
    }));

    const directory = new Map<string, DirectoryStudent>();
    results.flat().forEach(({ student, className, classId }) => {
      const existing = directory.get(student.id);
      if (existing) {
        if (!existing.classNames.includes(className)) existing.classNames.push(className);
        if (!existing.classIds.includes(classId)) existing.classIds.push(classId);
      } else {
        directory.set(student.id, { ...student, classNames: [className], classIds: [classId] });
      }
    });
    setAllStudents(Array.from(directory.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
  }, [classes]);

  useEffect(() => {
    void fetchAllStudents();
  }, [fetchAllStudents]);

  const fetchResults = async () => {
    if (!user?.id) {
      setResults([]);
      return;
    }

    // Teachers should only see results for quizzes they created.
    const { data: ownQuizzes, error: quizError } = await supabase
      .from('quizzes')
      .select('id')
      .eq('created_by', user.id);

    if (quizError) {
      toast.error('Failed to fetch quiz results');
      setPortalError('Results could not be loaded. Use Refresh to try again.');
      setResults([]);
      return;
    }

    const quizIds = (ownQuizzes || []).map((quiz) => quiz.id);
    if (!quizIds.length) {
      setResults([]);
      return;
    }

    const { data, error } = await supabase
      .from('quiz_results')
      .select(`
        *,
        quizzes:quiz_id (title, subject)
      `)
      .in('quiz_id', quizIds)
      .order('completed_at', { ascending: false })
      .limit(100);

    if (error) {
      toast.error('Failed to fetch quiz results');
      setPortalError('Results could not be loaded. Use Refresh to try again.');
      setResults([]);
      return;
    }
    setResults(data || []);
  };

  const fetchAssignments = async () => {
    if (!user?.id) {
      setAssignments([]);
      return;
    }
    const { data, error } = await supabase
      .from('quiz_assignments')
      .select('id, quiz_id, class_id, assigned_by, due_date, quizzes(title, subject), classes(name, grade)')
      .eq('assigned_by', user.id);
    if (error) {
      console.error('Failed to fetch quiz assignments:', error);
      setPortalError('Assignments could not be loaded. Use Refresh to try again.');
      return;
    }
    setAssignments(data || []);
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
        setPortalError('Class students could not be loaded. Use Refresh to try again.');
        toast.error('Failed to fetch students');
        return;
      }

      setClassStudents(data || []);
    } catch (err) {
      console.error('Error fetching class students:', err);
      setClassStudents([]);
    }
  };

  const openClassEditor = (cls?: ClassData) => {
    setEditingClass(cls || null);
    setClassForm({
      name: cls?.name || '',
      description: cls?.description || '',
      grade: cls?.grade || '9',
      subject: cls?.subject || 'Math',
    });
    setShowClassDialog(true);
  };

  const handleSaveClass = async () => {
    if (!classForm.name.trim()) {
      toast.error('Please enter a class name');
      return;
    }

    setLoading(true);
    const classCode = editingClass?.class_code || `${classForm.subject.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const request = editingClass
      ? supabase.from('classes').update({ ...classForm }).eq('id', editingClass.id)
      : supabase.from('classes').insert({ ...classForm, class_code: classCode, teacher_id: user?.id });
    const { error } = await request;
    setLoading(false);

    if (error) {
      toast.error(editingClass ? 'Failed to update class' : 'Failed to create class');
      return;
    }

    toast.success(editingClass ? 'Class updated' : `Class created! Code: ${classCode}`);
    setShowClassDialog(false);
    setEditingClass(null);
    setClassForm({ name: '', description: '', grade: '9', subject: 'Math' });
    await fetchClasses();
  };

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm('Delete this class? Its memberships and class assignments will also be removed.')) return;
    setLoading(true);
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    setLoading(false);

    if (error) {
      toast.error('Failed to delete class');
      return;
    }

    if (selectedClass?.id === classId) {
      setSelectedClass(null);
      setClassStudents([]);
    }
    toast.success('Class deleted');
    await fetchClasses();
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

    // Deliver the same announcement as a real push notification to the
    // students targeted by this teacher. The database announcement remains
    // the source of truth if a device is offline or has notifications disabled.
    let recipientIds: string[] = [];
    if (createdAnnouncement.target_type === 'class' && createdAnnouncement.target_id) {
      const { data: members } = await supabase
        .from('class_students')
        .select('student_id')
        .eq('class_id', createdAnnouncement.target_id);
      recipientIds = (members || []).map((member) => member.student_id);
    } else if (createdAnnouncement.target_type === 'students') {
      const { data: memberships } = await supabase
        .from('class_students')
        .select('student_id, classes!inner(teacher_id)')
        .eq('classes.teacher_id', user.id);
      recipientIds = Array.from(new Set((memberships || []).map((member: any) => member.student_id)));
    }

    const sentCount = await sendRemoteNotifications(
      recipientIds.map((studentId) => ({
        userId: studentId,
        kind: 'teacher_announcement',
        title: createdAnnouncement.title,
        body: createdAnnouncement.content,
        data: { route: '/notifications', announcement_id: createdAnnouncement.id },
      })),
    );

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
            display_name: `MR. ${teacherFirstName}`,
            hide_level: true
          }
        });

      if (socialError) {
        console.error('Error sharing announcement to social:', socialError);
        toast.error('Announcement created, but failed to share to social feed');
      }
    }

    setLoading(false);
    toast.success(
      sentCount > 0
        ? `Announcement sent! ${sentCount} student device(s) notified.`
        : 'Announcement saved. No student device was available for push notification.',
    );
    setShowAnnouncementDialog(false);
    setAnnouncementForm({ title: '', content: '', target_type: 'class', target_id: '' });
    fetchAnnouncements();
  };

  const handleAssignQuiz = async (quizId: string, classId: string, dueDate?: Date) => {
    if (!user?.id || !quizId || !classId) {
      toast.error('Choose a quiz and class first');
      return;
    }
    setAssigningQuiz(true);
    const selectedQuiz = quizzes.find(quiz => quiz.id === quizId);
    const selectedClass = classes.find(cls => cls.id === classId);
    if (selectedQuiz?.grade && selectedClass?.grade && selectedQuiz.grade !== selectedClass.grade) {
      setAssigningQuiz(false);
      toast.error(`This quiz is for Grade ${selectedQuiz.grade}, but the class is Grade ${selectedClass.grade}.`);
      return;
    }

    const { error } = await (supabase.rpc as any)('create_teacher_assignment', {
      p_quiz_id: quizId,
      p_class_id: classId,
      p_due_date: dueDate?.toISOString() ?? null,
    });

    if (error) {
      setAssigningQuiz(false);
      console.error('Failed to assign quiz:', error);
      toast.error('Could not assign this quiz. Please check your class permissions and try again.');
      return;
    }

    const { data: members, error: membersError } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId);
    const studentIds = Array.from(new Set((members || []).map((member: { student_id: string }) => member.student_id).filter(Boolean)));
    const sentCount = membersError ? 0 : await sendRemoteNotifications(studentIds.map(studentId => ({
      userId: studentId,
      kind: 'quiz_assignment',
      title: `New assignment: ${selectedQuiz?.title || 'Quiz'}`,
      body: `Your teacher assigned ${selectedQuiz?.title || 'a quiz'}${dueDate ? `, due ${dueDate.toLocaleDateString()}` : ''}. Open Master Minds to get started.`,
      data: { route: '/notifications', quiz_id: quizId, class_id: classId },
    })));

    await fetchAssignments();
    setAssigningQuiz(false);
    setAssignmentForm({ quiz_id: '', class_id: '', due_date: '' });
    toast.success(sentCount > 0
      ? `Quiz assigned. ${sentCount} student device(s) notified.`
      : 'Quiz assigned successfully. Students can see it in their assignments when they open Master Minds.');
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Remove this assignment? Students will no longer see it as assigned work.')) return;
    const { error } = await supabase.from('quiz_assignments').delete().eq('id', assignmentId);
    if (error) {
      toast.error('Could not remove assignment');
      return;
    }
    toast.success('Assignment removed');
    await fetchAssignments();
  };

  const exportResults = () => {
    const visibleResults = results.filter(result => {
      const quizTitle = (result as any).quizzes?.title || '';
      const studentLabel = getStudentLabel(result.student_id);
      return (resultQuizFilter === 'all' || (result as any).quiz_id === resultQuizFilter)
        && `${quizTitle} ${studentLabel}`.toLowerCase().includes(resultSearchQuery.toLowerCase().trim());
    });
    const rows = [
      ['Quiz', 'Student', 'Score', 'Correct', 'Total', 'Time (seconds)', 'Completed at'],
      ...visibleResults.map(result => [
        (result as any).quizzes?.title || 'Quiz',
        getStudentLabel(result.student_id),
        String(result.score),
        String(result.correct_answers),
        String(result.total_questions),
        String(result.time_taken || 0),
        new Date(result.completed_at).toISOString(),
      ]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `master-minds-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${visibleResults.length} result(s) exported`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const stats = {
    totalQuizzes: quizzes.length,
    totalClasses: classes.length,
    totalStudents: allStudents.length,
    pendingApproval: quizzes.filter(q => !q.is_approved).length
  };
  const averageScore = results.length
    ? Math.round(results.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / results.length)
    : null;
  const studentsNeedingSupport = new Set(results.filter(result => Number(result.score) < 50).map(result => result.student_id)).size;
  const getStudentLabel = (studentId: string) => {
    const student = allStudents.find(item => item.id === studentId);
    return student ? `${student.name || 'Student'}${student.username ? ` (@${student.username})` : ''}` : 'Student';
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                  Teacher Portal
                </h1>
                <p className="text-sm text-muted-foreground">Welcome, {profile?.name || 'Teacher'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" aria-label="Open teacher settings" onClick={() => setActiveTab('settings')}>
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Refresh teacher workspace" onClick={refreshPortal} disabled={refreshing}>
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-3 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8">
          {portalError && (
            <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <span>{portalError}</span>
              <Button size="sm" variant="outline" onClick={refreshPortal} disabled={refreshing}>Try again</Button>
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <TabsTrigger value="dashboard" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Quizzes</span>
              </TabsTrigger>
              <TabsTrigger value="classes" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Classes</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Students</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Assignments</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Results</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Announce</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 gap-2 rounded-xl px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Button onClick={() => { setActiveTab('quizzes'); setShowQuizDialog(true); }} className="h-20 flex-col gap-2">
                    <Plus className="w-6 h-6" />
                    Create Quiz
                  </Button>
                  <Button onClick={() => { setActiveTab('classes'); setShowClassDialog(true); }} variant="secondary" className="h-20 flex-col gap-2">
                    <UserPlus className="w-6 h-6" />
                    New Class
                  </Button>
                  <Button onClick={() => setActiveTab('students')} variant="outline" className="h-20 flex-col gap-2">
                    <Users className="w-6 h-6" />
                    Students
                  </Button>
                  <Button onClick={() => setActiveTab('assignments')} variant="outline" className="h-20 flex-col gap-2">
                    <ClipboardList className="w-6 h-6" />
                    Assign Work
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

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                  <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />Class performance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Average recorded quiz score</p><p className="mt-1 text-3xl font-extrabold">{averageScore === null ? '—' : `${averageScore}%`}</p></div><Badge variant="secondary">{results.length} result{results.length === 1 ? '' : 's'}</Badge></div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, averageScore ?? 0))}%` }} /></div>
                    <p className="mt-2 text-xs text-muted-foreground">Calculated from quiz results available to your teacher account.</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-600" />Students to check in with</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Unique students with a recorded score below 50%</p><p className="mt-1 text-3xl font-extrabold">{studentsNeedingSupport}</p></div><Button variant="outline" size="sm" onClick={() => setActiveTab('results')}>Review results</Button></div>
                    <p className="mt-3 text-xs text-muted-foreground">A supportive follow-up prompt based on recorded results, not a permanent student label.</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardHeader>
                  <CardTitle>Recent Quiz Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {results.slice(0, 10).map((result) => (
                      <div key={result.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                        <div>
                          <p className="font-medium">{(result as any).quizzes?.title || 'Quiz'}</p>
                          <p className="text-xs text-muted-foreground">By {getStudentLabel(result.student_id)}</p>
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
            <TabsContent value="students" className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Student directory</h2>
                  <p className="mt-1 text-sm text-muted-foreground">One view of students across all your classes.</p>
                </div>
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Search students" placeholder="Search by name or username" className="pl-9" value={studentDirectoryQuery} onChange={(e) => setStudentDirectoryQuery(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Card className="border-slate-200 shadow-sm dark:border-slate-800"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Unique students</p><p className="mt-1 text-2xl font-bold">{allStudents.length}</p></CardContent></Card>
                <Card className="border-slate-200 shadow-sm dark:border-slate-800"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Classes</p><p className="mt-1 text-2xl font-bold">{classes.length}</p></CardContent></Card>
                <Card className="col-span-2 border-slate-200 shadow-sm dark:border-slate-800 sm:col-span-1"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Average quiz score</p><p className="mt-1 text-2xl font-bold">{averageScore === null ? '—' : `${averageScore}%`}</p></CardContent></Card>
              </div>
              <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allStudents.filter(student => `${student.name || ''} ${student.username || ''}`.toLowerCase().includes(studentDirectoryQuery.toLowerCase().trim())).map(student => (
                      <div key={student.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{student.name?.charAt(0)?.toUpperCase() || 'S'}</div>
                          <div className="min-w-0"><p className="truncate font-semibold">{student.name || 'Student'}</p><p className="truncate text-sm text-muted-foreground">@{student.username || 'student'} · Level {student.level ?? 1} · {student.xp ?? 0} XP</p><div className="mt-1 flex flex-wrap gap-1">{student.classNames.map(className => <Badge key={className} variant="secondary" className="font-normal">{className}</Badge>)}</div></div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { const cls = classes.find(item => student.classNames.includes(item.name)); if (cls) { setSelectedClass(cls); fetchClassStudents(cls.id); setActiveTab('classes'); } }}>Open class</Button>
                      </div>
                    ))}
                    {allStudents.filter(student => `${student.name || ''} ${student.username || ''}`.toLowerCase().includes(studentDirectoryQuery.toLowerCase().trim())).length === 0 && <div className="px-4 py-12 text-center"><Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold">{studentDirectoryQuery ? 'No students match that search' : 'Your classes are ready for students'}</p><p className="mt-1 text-sm text-muted-foreground">{studentDirectoryQuery ? 'Try a different name or username.' : 'Create a class and share its class code, or add students from the Classes tab.'}</p><Button className="mt-4" onClick={() => { setActiveTab('classes'); setShowClassDialog(true); }}>Create a class</Button></div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="classes" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Classes</h2>
                <Dialog open={showClassDialog} onOpenChange={setShowClassDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openClassEditor()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingClass ? 'Edit Class' : 'Create New Class'}</DialogTitle>
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
                      <Button className="w-full" onClick={handleSaveClass} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingClass ? 'Save Class' : 'Create Class'}
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
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold">{cls.name}</h3>
                            <p className="text-sm text-muted-foreground">{cls.description}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge>{cls.subject}</Badge>
                            <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${cls.name}`} onClick={(event) => { event.stopPropagation(); openClassEditor(cls); }}><Edit className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${cls.name}`} onClick={(event) => { event.stopPropagation(); void handleDeleteClass(cls.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
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
            <TabsContent value="assignments" className="space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Assignments</h2>
                <p className="mt-1 text-sm text-muted-foreground">Send a quiz to a class, set a due date, and notify students.</p>
              </div>
              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardHeader><CardTitle>Create assignment</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2"><label className="text-sm font-medium">Quiz</label><Select value={assignmentForm.quiz_id} onValueChange={value => setAssignmentForm(current => ({ ...current, quiz_id: value }))}><SelectTrigger><SelectValue placeholder="Choose a quiz" /></SelectTrigger><SelectContent>{quizzes.map(quiz => <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Class</label><Select value={assignmentForm.class_id} onValueChange={value => setAssignmentForm(current => ({ ...current, class_id: value }))}><SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger><SelectContent>{classes.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name} · Grade {cls.grade}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-sm font-medium" htmlFor="assignment-due-date">Due date (optional)</label><Input id="assignment-due-date" type="date" min={new Date().toISOString().slice(0, 10)} value={assignmentForm.due_date} onChange={event => setAssignmentForm(current => ({ ...current, due_date: event.target.value }))} /></div>
                  <div className="flex items-end"><Button className="w-full" disabled={assigningQuiz || !assignmentForm.quiz_id || !assignmentForm.class_id} onClick={() => handleAssignQuiz(assignmentForm.quiz_id, assignmentForm.class_id, assignmentForm.due_date ? new Date(`${assignmentForm.due_date}T23:59:59`) : undefined)}>{assigningQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{assigningQuiz ? 'Assigning…' : 'Assign to students'}</Button></div>
                </CardContent>
                {(quizzes.length === 0 || classes.length === 0) && <div className="mx-6 mb-5 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-muted-foreground dark:border-slate-700">{quizzes.length === 0 ? 'Create a quiz first' : 'Create a class first'} to start assigning work.</div>}
              </Card>
              <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Assigned work</h3><Badge variant="secondary">{assignments.length} total</Badge></div>
              <div className="grid gap-3 md:grid-cols-2">
                {assignments.map(assignment => {
                  const due = assignment.due_date ? new Date(assignment.due_date) : null;
                  const overdue = due ? due.getTime() < Date.now() : false;
                  const assignedStudentIds = allStudents.filter(student => student.classIds.includes(assignment.class_id)).map(student => student.id);
                  const completedStudentIds = new Set(results.filter(result => (result as any).quiz_id === assignment.quiz_id && assignedStudentIds.includes(result.student_id)).map(result => result.student_id));
                  const completedCount = completedStudentIds.size;
                  const completionPercent = assignedStudentIds.length ? Math.round((completedCount / assignedStudentIds.length) * 100) : 0;
                  return <Card key={assignment.id} className="border-slate-200 shadow-sm dark:border-slate-800"><CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{assignment.quizzes?.title || 'Quiz assignment'}</p><p className="mt-1 text-sm text-muted-foreground">{assignment.classes?.name || 'Class'}{assignment.classes?.grade ? ` · Grade ${assignment.classes.grade}` : ''}</p></div><div className="flex items-center gap-2"><Badge variant={overdue ? 'destructive' : 'secondary'}>{overdue ? 'Past due' : due ? 'Due date set' : 'No due date'}</Badge><Button variant="ghost" size="icon" aria-label="Remove assignment" onClick={() => void handleDeleteAssignment(assignment.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div><div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{due ? `Due ${due.toLocaleDateString()}` : 'Flexible deadline'}</span><span>{assignment.quizzes?.subject || 'Quiz'}</span></div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Student progress</span><span className="font-semibold">{completedCount} / {assignedStudentIds.length} completed</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${completionPercent}%` }} /></div></div></CardContent></Card>;
                })}
              </div>
              {assignments.length === 0 && <Card className="border-dashed border-slate-300 shadow-none dark:border-slate-700"><CardContent className="py-12 text-center"><ClipboardList className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold">No assignments yet</p><p className="mt-1 text-sm text-muted-foreground">Choose a quiz and class above to send the first assignment.</p></CardContent></Card>}
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Student Quiz Results</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportResults} disabled={!results.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
                    <Input aria-label="Search results" placeholder="Search quiz or student" value={resultSearchQuery} onChange={(event) => setResultSearchQuery(event.target.value)} />
                    <Select value={resultQuizFilter} onValueChange={setResultQuizFilter}>
                      <SelectTrigger aria-label="Filter results by quiz"><SelectValue placeholder="All quizzes" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All quizzes</SelectItem>
                        {quizzes.map((quiz) => <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {results.filter(result => {
                        const quizTitle = (result as any).quizzes?.title || '';
                        const studentLabel = getStudentLabel(result.student_id);
                        return (resultQuizFilter === 'all' || (result as any).quiz_id === resultQuizFilter) && `${quizTitle} ${studentLabel}`.toLowerCase().includes(resultSearchQuery.toLowerCase().trim());
                      }).map((result) => (
                        <Card key={result.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{(result as any).quizzes?.title || 'Quiz'}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Completed by {getStudentLabel(result.student_id)}</p>
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
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-3xl font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900">
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
