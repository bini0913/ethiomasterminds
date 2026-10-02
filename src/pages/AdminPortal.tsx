import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Shield, Users, BookOpen, Trophy, Bell, LogOut, Plus, Trash2, UserCheck, Key,
  Database, Activity, BarChart3, Bot, Search, RefreshCw, Check, X, AlertTriangle,
  Loader2, Crown, Zap, Flag, FileText, MessageSquare, Coins, Target, RotateCcw, SlidersHorizontal
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Role = 'student' | 'teacher' | 'admin' | 'manager' | 'extreme_admin';

interface SystemUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  xp: number;
  season_xp?: number;
  total_xp?: number;
  level: number;
  coins?: number;
  role: Role;
  grade?: string;
  created_at: string;
}

interface SystemStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalQuizzes: number;
  totalQuestions: number;
  totalFlashcards: number;
  totalBooks: number;
  totalPosts: number;
  activeUsersNow: number;
  approvedQuizzes: number;
  pendingQuizzes: number;
  totalReports: number;
  pendingReports: number;
}

interface Report {
  id: string;
  reported_type: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter_id: string;
  reporter_name?: string;
  reported_content?: string;
}

interface PendingLibraryBook {
  id: string;
  title: string;
  author: string;
  subject: string;
  status: 'pending' | 'approved' | 'rejected';
  uploader_id: string;
  created_at: string;
  profiles?: {
    name: string;
    username: string | null;
  } | null;
}

interface SeasonStats {
  season_name: string;
  total_users: number;
  top_player: string;
  total_xp: number;
}

interface RewardPreviewRow {
  user_id: string;
  name: string;
  season_xp: number;
  projected_rank: number;
  projected_coins: number;
  projected_title?: string | null;
}

const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [logSearch, setLogSearch] = useState('');

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [socialPosts, setSocialPosts] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [pendingLibraryBooks, setPendingLibraryBooks] = useState<PendingLibraryBook[]>([]);
  const [moderatingBookId, setModeratingBookId] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; createdAt: string }>>([]);
  const [activityLog, setActivityLog] = useState<Array<{ id: string; actor: string; action: string; target: string; at: string }>>([]);
  const [dailyActivity, setDailyActivity] = useState<Array<{ day: string; users: number; quizzes: number; posts: number }>>([]);

  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    totalQuizzes: 0,
    totalQuestions: 0,
    totalFlashcards: 0,
    totalBooks: 0,
    totalPosts: 0,
    activeUsersNow: 0,
    approvedQuizzes: 0,
    pendingQuizzes: 0,
    totalReports: 0,
    pendingReports: 0,
  });

  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', target_type: 'all' });
  const [controlUserIdentifier, setControlUserIdentifier] = useState('');
  const [xpAmount, setXpAmount] = useState('50');
  const [levelAmount, setLevelAmount] = useState('1');
  const [coinAmount, setCoinAmount] = useState('50');
  const [resetMode, setResetMode] = useState<'level' | 'full'>('full');
  const [seasonConversionRate, setSeasonConversionRate] = useState('1');
  const [seasonConfirmText, setSeasonConfirmText] = useState('');
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [rewardPreview, setRewardPreview] = useState<RewardPreviewRow[]>([]);
  const [systemSettings, setSystemSettings] = useState({
    feature_social_enabled: true,
    feature_xp_enabled: true,
    feature_ai_enabled: true,
    strict_moderation: true,
    max_ai_requests_per_day: 50,
  });

  const logAction = (action: string, target = 'platform') => {
    setActivityLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, actor: user?.name || 'System', action, target, at: new Date().toISOString() }, ...prev].slice(0, 200));
  };

  const pushNotification = (text: string) => {
    setNotifications((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, createdAt: new Date().toISOString() }, ...prev].slice(0, 20));
  };

  const fetchAllData = async () => {
    await Promise.all([fetchUsers(), fetchContent(), fetchReports(), fetchAnnouncements(), fetchStatsAndCharts(), fetchSeasonControlData()]);
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-live-monitoring')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        pushNotification('New user joined');
        logAction('Realtime event: new user');
        fetchUsers();
        fetchStatsAndCharts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        pushNotification('Profile / XP update synced');
        logAction('Realtime event: profile update');
        fetchUsers();
        fetchStatsAndCharts();
        fetchSeasonControlData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_runtime_state' }, () => fetchSeasonControlData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_history' }, () => fetchSeasonControlData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_posts' }, () => {
        pushNotification('New social post published');
        logAction('Realtime event: new post');
        fetchStatsAndCharts();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_results' }, () => {
        pushNotification('New quiz activity');
        logAction('Realtime event: quiz completed');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        pushNotification('New message activity');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
    const usersWithRoles = await Promise.all((profiles || []).map(async (p: any) => {
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', p.id).single();
      return {
        ...p,
        role: (roleData?.role || 'student') as Role,
      } as SystemUser;
    }));
    setUsers(usersWithRoles);
  };

  const fetchContent = async () => {
    const [quizRes, questionRes, flashRes, postRes, bookRes, libraryRes] = await Promise.all([
      supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('flashcards').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('study_plans').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('library_books').select('id,title,author,subject,status,uploader_id,created_at').order('created_at', { ascending: false }).limit(300),
    ]);
    setQuizzes(quizRes.data || []);
    setQuestions(questionRes.data || []);
    setFlashcards(flashRes.data || []);
    setSocialPosts(postRes.data || []);
    setBooks(bookRes.data || []);

    const pendingRows = ((libraryRes.data || []) as PendingLibraryBook[]).filter((book) => book.status === 'pending');
    const uploaderIds = Array.from(new Set(pendingRows.map((book) => book.uploader_id).filter(Boolean)));
    if (!uploaderIds.length) {
      setPendingLibraryBooks(pendingRows);
      return;
    }

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id,name,username')
      .in('id', uploaderIds);

    const profileMap = new Map((profileRows || []).map((profile: any) => [profile.id, profile]));
    setPendingLibraryBooks(
      pendingRows.map((book) => ({
        ...book,
        profiles: profileMap.get(book.uploader_id) || null,
      })),
    );
  };

  const fetchSeasonControlData = async () => {
    const rate = Number(seasonConversionRate);
    const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0.1;

    const [statsRes, previewRes] = await Promise.all([
      (supabase as any).rpc('admin_get_current_season_stats'),
      (supabase as any).rpc('admin_get_season_rewards_preview', {
        p_conversion_rate: safeRate,
        p_limit: 10,
      }),
    ]);

    if (!statsRes.error && statsRes.data) {
      setSeasonStats(statsRes.data as SeasonStats);
    }

    if (!previewRes.error && Array.isArray(previewRes.data)) {
      setRewardPreview(previewRes.data as RewardPreviewRow[]);
    }
  };

  useEffect(() => {
    fetchSeasonControlData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonConversionRate]);

  const fetchReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200);
    const enriched = await Promise.all((data || []).map(async (report: any) => {
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', report.reporter_id).single();
      return { ...report, reporter_name: profile?.name || 'Unknown' };
    }));
    setReports(enriched);
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
    setAnnouncements(data || []);
  };

  const fetchStatsAndCharts = async () => {
    const [profilesRes, quizzesRes, questionsRes, flashcardsRes, rolesRes, reportsRes, postsRes, presenceRes, booksRes, resultsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }),
      supabase.from('quizzes').select('id,is_approved', { count: 'exact' }),
      supabase.from('questions').select('id', { count: 'exact' }),
      supabase.from('flashcards').select('id', { count: 'exact' }),
      supabase.from('user_roles').select('role'),
      supabase.from('reports').select('id,status', { count: 'exact' }),
      supabase.from('social_posts').select('id,created_at', { count: 'exact' }),
      supabase.from('user_presence').select('id,last_seen', { count: 'exact' }),
      supabase.from('study_plans').select('id', { count: 'exact' }),
      supabase.from('quiz_results').select('completed_at').limit(1000),
    ]);

    const roles = rolesRes.data || [];
    const quizRows = quizzesRes.data || [];
    const reportRows = reportsRes.data || [];

    setStats({
      totalUsers: profilesRes.count || 0,
      totalStudents: roles.filter((r: any) => r.role === 'student').length,
      totalTeachers: roles.filter((r: any) => r.role === 'teacher').length,
      totalAdmins: roles.filter((r: any) => ['admin', 'manager'].includes(r.role)).length,
      totalQuizzes: quizzesRes.count || 0,
      totalQuestions: questionsRes.count || 0,
      totalFlashcards: flashcardsRes.count || 0,
      totalBooks: booksRes.count || 0,
      totalPosts: postsRes.count || 0,
      activeUsersNow: (presenceRes.data || []).filter((p: any) => new Date(p.last_seen).getTime() > Date.now() - 10 * 60 * 1000).length,
      approvedQuizzes: quizRows.filter((q: any) => q.is_approved).length,
      pendingQuizzes: quizRows.filter((q: any) => !q.is_approved).length,
      totalReports: reportsRes.count || 0,
      pendingReports: reportRows.filter((r: any) => r.status === 'pending').length,
    });

    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    setDailyActivity(days.map((day) => ({
      day: day.slice(5),
      users: (presenceRes.data || []).filter((p: any) => p.last_seen?.slice(0, 10) === day).length,
      quizzes: (resultsRes.data || []).filter((r: any) => r.completed_at?.slice(0, 10) === day).length,
      posts: (postsRes.data || []).filter((p: any) => p.created_at?.slice(0, 10) === day).length,
    })));
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.content || !user?.id) {
      toast.error('Missing required fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('announcements').insert({ ...announcementForm, author_id: user.id });
    setLoading(false);

    if (error) {
      toast.error('Failed to create announcement');
      return;
    }

    toast.success('Announcement sent');
    pushNotification(`Announcement: ${announcementForm.title}`);
    logAction('Created announcement', announcementForm.title);
    setAnnouncementForm({ title: '', content: '', target_type: 'all' });
    setShowAnnouncementDialog(false);
    fetchAnnouncements();
  };

  const handleDeleteUser = async (userId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) {
      toast.error('Failed to delete user');
      return;
    }
    toast.success('User deleted');
    logAction('Deleted user', userId);
    fetchUsers();
    fetchStatsAndCharts();
  };

  const handleUpdateUserRole = async (userId: string, newRole: Role) => {
    if (!isAdmin && (newRole === 'admin' || newRole === 'manager')) {
      toast.error('Managers cannot assign admin/manager roles');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    const response = await supabase.functions.invoke('assign-role', {
      body: { role: newRole, target_user_id: userId },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.error) {
      toast.error('Failed to update role');
      return;
    }

    toast.success('Role updated');
    logAction(`Changed role to ${newRole}`, userId);
    fetchUsers();
  };

  const handleBulkAction = async (action: 'delete' | 'promote_teacher' | 'suspend' | 'ban') => {
    if (!selectedUsers.length) {
      toast.error('Select users first');
      return;
    }

    if (action === 'delete') await Promise.all(selectedUsers.map((id) => handleDeleteUser(id)));
    if (action === 'promote_teacher') await Promise.all(selectedUsers.map((id) => handleUpdateUserRole(id, 'teacher')));
    if (action === 'suspend') await Promise.all(selectedUsers.map((id) => supabase.from('profiles').update({ is_suspended: true } as never).eq('id', id)));
    if (action === 'ban') await Promise.all(selectedUsers.map((id) => supabase.from('profiles').update({ is_banned: true } as never).eq('id', id)));

    toast.success(`Bulk action executed: ${action}`);
    logAction(`Bulk action: ${action}`, `${selectedUsers.length} users`);
    setSelectedUsers([]);
    fetchUsers();
  };

  const handleResetPassword = async (target: SystemUser) => {
    if (!target.email) {
      toast.error('No email on profile');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(target.email, { redirectTo: window.location.origin });
    if (error) {
      toast.error('Failed to send reset email');
      return;
    }
    toast.success('Password reset email sent');
    logAction('Triggered password reset', target.id);
  };

  const handleModerateReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    const { error } = await supabase.from('reports').update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', reportId);
    if (error) {
      toast.error('Failed to update report');
      return;
    }
    toast.success(`Report ${status}`);
    pushNotification(`Report ${status}`);
    logAction(`Report ${status}`, reportId);
    fetchReports();
    fetchStatsAndCharts();
  };

  const handleDeleteContent = async (type: 'quiz' | 'question' | 'flashcard' | 'social', id: string) => {
    const table = type === 'social' ? 'social_posts' : `${type}s`;
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete ${type}`);
      return;
    }
    toast.success(`${type} deleted`);
    logAction(`Deleted ${type}`, id);
    fetchContent();
    fetchStatsAndCharts();
  };

  const handleApproveContent = async (type: 'quiz' | 'question' | 'flashcard' | 'social', id: string) => {
    if (type === 'quiz') {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_approved: true } as never)
        .eq('id', id);

      if (error) {
        toast.error('Failed to approve quiz');
        return;
      }

      toast.success('Quiz approved');
      logAction('Approved quiz', id);
      fetchContent();
      fetchStatsAndCharts();
      return;
    }

    toast.success(`${type} reviewed`);
    logAction(`Reviewed ${type}`, id);
  };

  const handleModerateLibraryBook = async (bookId: string, status: 'approved' | 'rejected') => {
    if (!user?.id) return;

    setModeratingBookId(bookId);
    const moderatedAt = new Date().toISOString();

    const { error: bookError } = await supabase
      .from('library_books')
      .update({ status })
      .eq('id', bookId);

    if (bookError) {
      setModeratingBookId(null);
      toast.error(`Failed to ${status} book`);
      return;
    }

    const uploadPatch = {
      status,
      moderated_by: user.id,
      moderated_at: moderatedAt,
      moderation_note: status === 'approved' ? 'Approved by admin portal.' : 'Rejected by admin portal.',
    };

    const { data: uploadRow } = await supabase.from('book_uploads').select('id').eq('book_id', bookId).maybeSingle();
    if (uploadRow?.id) {
      await supabase.from('book_uploads').update(uploadPatch).eq('id', uploadRow.id);
    } else {
      const { data: bookRow } = await supabase.from('library_books').select('uploader_id').eq('id', bookId).single();
      await supabase.from('book_uploads').insert({
        book_id: bookId,
        uploader_id: bookRow?.uploader_id,
        ...uploadPatch,
      });
    }

    toast.success(`Book ${status}`);
    pushNotification(`Library book ${status}`);
    logAction(`Library book ${status}`, bookId);
    setModeratingBookId(null);
    fetchContent();
    fetchStatsAndCharts();
  };

  const resolveTargetUser = () => {
    const identifier = controlUserIdentifier.trim().toLowerCase();
    if (!identifier) return null;
    return users.find(
      (item) => item.id.toLowerCase() === identifier || (item.username || '').toLowerCase() === identifier,
    ) || null;
  };

  const ensureAdminPower = () => {
    if (user?.role !== 'admin' && user?.role !== 'extreme_admin') {
      toast.error('Access denied: only admin can modify XP, level, coins, or reset users.');
      return false;
    }
    return true;
  };

  const handleAddXP = async () => {
    if (!ensureAdminPower()) return;
    const identifier = controlUserIdentifier.trim();
    const amount = Number(xpAmount);
    if (!identifier || !Number.isFinite(amount)) {
      toast.error('Provide a valid username/user ID and XP amount.');
      return;
    }

    const { error } = await (supabase as any).rpc('admin_update_user_xp', {
      p_user_identifier: identifier,
      p_xp_amount: Math.abs(amount),
      p_action: amount >= 0 ? 'add' : 'remove',
    });

    if (error) {
      toast.error(error.message || 'Failed to update XP.');
      return;
    }

    toast.success('XP updated successfully');
    pushNotification(`XP updated for ${identifier}`);
    logAction(`Adjusted XP by ${amount}`, identifier);
    fetchAllData();
  };

  const handleSetLevel = async () => {
    if (!ensureAdminPower()) return;
    const identifier = controlUserIdentifier.trim();
    const nextLevel = Math.max(1, Number(levelAmount) || 1);
    if (!identifier) {
      toast.error('Provide a valid username/user ID.');
      return;
    }

    const { error } = await (supabase as any).rpc('admin_set_user_level', {
      p_user_identifier: identifier,
      p_level: nextLevel,
    });

    if (error) {
      toast.error(error.message || 'Failed to update level.');
      return;
    }

    toast.success('Level updated successfully');
    pushNotification(`Level set to ${nextLevel} for ${identifier}`);
    logAction(`Set level to ${nextLevel}`, identifier);
    fetchAllData();
  };

  const handleResetUserProgress = async () => {
    if (!ensureAdminPower()) return;
    const identifier = controlUserIdentifier.trim();
    if (!identifier) {
      toast.error('Provide a valid username/user ID.');
      return;
    }

    const { error } = await (supabase as any).rpc('admin_reset_user_progress', {
      p_user_identifier: identifier,
      p_reset_mode: resetMode,
    });

    if (error) {
      toast.error(error.message || 'Failed to reset user.');
      return;
    }

    toast.success('User progress reset successfully');
    pushNotification(`Progress reset for ${identifier}`);
    logAction(`Reset user (${resetMode})`, identifier);
    fetchAllData();
  };

  const handleCoinAdjustment = async () => {
    if (!ensureAdminPower()) return;
    const target = resolveTargetUser() as (SystemUser & { coins?: number }) | null;
    const amount = Number(coinAmount);
    if (!target || !Number.isFinite(amount)) {
      toast.error('Provide a valid username/user ID and coin amount.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ coins: Math.max(0, (target.coins || 0) + amount) } as never)
      .eq('id', target.id);
    if (error) {
      toast.error('Failed to update coins.');
      return;
    }

    toast.success('Coins updated successfully');
    pushNotification(`Coins updated for ${target.name}`);
    logAction(`Adjusted coins by ${amount}`, target.id);
    fetchAllData();
  };

  const handleEndSeason = async () => {
    if (!ensureAdminPower()) return;

    const confirmed = window.confirm('Are you sure you want to end the current season and reset season XP leaderboard? Type CONFIRM in the panel first.');
    if (!confirmed) return;
    if (seasonConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      toast.error('Type CONFIRM to proceed.');
      return;
    }

    const rate = Number(seasonConversionRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error('Conversion rate must be greater than 0.');
      return;
    }

    const { data, error } = await (supabase as any).rpc('admin_end_season', {
      p_conversion_rate: rate,
      p_reason: 'Admin triggered season close',
      p_confirm_text: seasonConfirmText.trim().toUpperCase(),
    });

    if (error) {
      toast.error(error.message || 'Season reset failed');
      return;
    }

    toast.success(`Season reset complete. Next: ${data?.next_season || 'created'}`);
    pushNotification('Season ended and leaderboard reset');
    logAction('Ended season and started next one');
    setSeasonConfirmText('');
    fetchAllData();
  };
  const handleForceStartNewSeason = async () => {
    if (!ensureAdminPower()) return;

    const confirmed = window.confirm('Force start a new season now? This closes the active season immediately.');
    if (!confirmed) return;

    const { data, error } = await (supabase as any).rpc('admin_force_start_new_season', {
      p_reason: 'Admin forced next season from control panel',
    });

    if (error) {
      toast.error(error.message || 'Failed to start next season');
      return;
    }

    toast.success(`Forced new season: ${data?.next_season || 'created'}`);
    pushNotification('Admin forced a new season start');
    logAction('Forced new season start');
    fetchAllData();
  };

  const bootstrapSuperAdmin = async () => {
    if (!isAdmin || !user?.id) return;
    const confirmed = window.confirm('Make this current admin account the one-time Super Admin? This can only run when no Super Admin exists.');
    if (!confirmed) return;
    const { error } = await (supabase as any).rpc('extreme_admin_bootstrap_self');
    if (error) {
      toast.error(error.message || 'Super Admin bootstrap failed');
      return;
    }
    toast.success('Super Admin access enabled. Open the Super Admin Control Center.');
    window.location.href = '/super-admin';
  };

  const saveSystemSettings = () => {
    if (!isAdmin) {
      toast.error('Admin only: system settings');
      return;
    }
    toast.success('System settings saved');
    logAction('Updated system settings');
  };

  const filteredUsers = useMemo(() => users
    .filter((u) => (searchQuery ? `${u.name} ${u.username}`.toLowerCase().includes(searchQuery.toLowerCase()) : true))
    .filter((u) => (gradeFilter === 'all' ? true : String(u.grade || '').includes(gradeFilter)))
    .filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter)), [users, searchQuery, gradeFilter, roleFilter]);

  const contentRows = useMemo(() => [
    ...quizzes.map((x: any) => ({ id: x.id, type: 'quiz', title: x.title, grade: x.grade, subject: x.subject, created_at: x.created_at })),
    ...flashcards.map((x: any) => ({ id: x.id, type: 'flashcard', title: x.term || x.question || 'Flashcard', grade: x.grade, subject: x.subject, created_at: x.created_at })),
    ...questions.map((x: any) => ({ id: x.id, type: 'question', title: x.question_text || x.question || 'Question', grade: x.grade, subject: x.subject, created_at: x.created_at })),
    ...socialPosts.map((x: any) => ({ id: x.id, type: 'social', title: x.content?.slice(0, 80) || 'Social Post', grade: 'all', subject: x.post_type, created_at: x.created_at })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [quizzes, flashcards, questions, socialPosts]);

  const filteredLogs = useMemo(() => activityLog.filter((log) => `${log.actor} ${log.action} ${log.target}`.toLowerCase().includes(logSearch.toLowerCase())), [activityLog, logSearch]);

  const contentMix = [
    { name: 'Quizzes', value: stats.totalQuizzes, color: '#ef4444' },
    { name: 'Flashcards', value: stats.totalFlashcards, color: '#3b82f6' },
    { name: 'Questions', value: stats.totalQuestions, color: '#22c55e' },
    { name: 'Posts', value: stats.totalPosts, color: '#a855f7' },
  ].filter((x) => x.value > 0);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground variant="minimal" />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton />
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Master Minds Admin & Manager</h1>
                <p className="text-sm text-muted-foreground">{isAdmin ? 'Admin mode: full power' : 'Manager mode: limited controls'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={bootstrapSuperAdmin} className="hidden sm:inline-flex">
                  <Shield className="mr-2 h-4 w-4" /> Super Admin
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="w-4 h-4" />
                    {notifications.length > 0 && <span className="absolute -top-1 -right-1 text-[10px] px-1 rounded-full bg-destructive text-white">{notifications.length}</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  {notifications.length === 0 && <DropdownMenuItem>No new notifications</DropdownMenuItem>}
                  {notifications.map((n) => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start">
                      <span>{n.text}</span>
                      <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString()}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={fetchAllData}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
              <Button variant="ghost" size="icon" onClick={async () => { await logout(); navigate('/'); }}><LogOut className="w-5 h-5" /></Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Quick actions</h2>
                <Badge variant="secondary">Jump to tools</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { title: 'Manage Users', description: 'Roles, access, and account actions', icon: Users, tab: 'users' },
                { title: 'XP Control', description: 'Add XP and tune progression', icon: Zap, tab: 'control' },
                { title: 'Level Control', description: 'Set level and reset progress', icon: Target, tab: 'control' },
                { title: 'Reset System', description: 'Account progress reset tools', icon: RotateCcw, tab: 'control' },
                { title: 'Tournament Control', description: 'Leaderboard and event updates', icon: Trophy, tab: 'leaderboard' },
                { title: 'System Settings', description: 'Platform feature toggles', icon: SlidersHorizontal, tab: 'settings' },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="border-border/70 bg-card/80 transition-all hover:shadow-[0_0_25px_rgba(99,102,241,0.28)]"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-primary" />
                      <p className="font-semibold">{item.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <Button
                      className="w-full min-h-12"
                      variant="outline"
                      onClick={() => setActiveTab(item.tab)}
                    >
                      Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
              </div>
            </section>

            <TabsList className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-muted/50 p-2 rounded-xl max-h-[56vh] overflow-y-auto">
              <TabsTrigger className="min-h-12 py-3" value="dashboard"><BarChart3 className="w-4 h-4 mr-1" />Dashboard</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="users"><Users className="w-4 h-4 mr-1" />Users</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="control"><Shield className="w-4 h-4 mr-1" />Control</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="content"><FileText className="w-4 h-4 mr-1" />Content</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="analytics"><Activity className="w-4 h-4 mr-1" />Analytics</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="reports"><Flag className="w-4 h-4 mr-1" />Reports</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="announcements"><MessageSquare className="w-4 h-4 mr-1" />Notify</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="settings"><Bot className="w-4 h-4 mr-1" />Settings</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="logs"><Activity className="w-4 h-4 mr-1" />Logs</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="leaderboard"><Trophy className="w-4 h-4 mr-1" />Leaderboard</TabsTrigger>
              <TabsTrigger className="min-h-12 py-3" value="monitoring"><Bell className="w-4 h-4 mr-1" />Live</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Overview metrics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {[
                  ['Total Users', stats.totalUsers, Users, 'border-sky-500/40 bg-sky-500/5'],
                  ['Active (10m)', stats.activeUsersNow, Activity, 'border-emerald-500/40 bg-emerald-500/5'],
                  ['Flashcards', stats.totalFlashcards, Database, 'border-violet-500/40 bg-violet-500/5'],
                  ['Books/Plans', stats.totalBooks, BookOpen, 'border-amber-500/40 bg-amber-500/5'],
                  ['Quizzes', stats.totalQuizzes, Crown, 'border-rose-500/40 bg-rose-500/5'],
                ].map(([label, value, IconComp, colorClass], i) => {
                  const LucideIcon = IconComp as React.ComponentType<{ className?: string }>;
                  return (
                  <motion.div key={String(label)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className={String(colorClass)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{String(label)}</p><div className="flex items-center justify-between"><p className="text-2xl font-bold">{value as number}</p><LucideIcon className="w-5 h-5 text-primary" /></div></CardContent></Card>
                  </motion.div>
                  );
                })}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Trends & composition</h3>
                <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 border-primary/30 bg-primary/5">
                  <CardHeader><CardTitle>Daily Activity</CardTitle></CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyActivity}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line type="monotone" dataKey="users" stroke="#3b82f6" /><Line type="monotone" dataKey="quizzes" stroke="#f97316" /><Line type="monotone" dataKey="posts" stroke="#22c55e" /></LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="border-secondary/50 bg-secondary/20">
                  <CardHeader><CardTitle>Content Mix</CardTitle></CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contentMix} dataKey="value" nameKey="name" innerRadius={36} outerRadius={80}>{contentMix.map((s) => <Cell key={s.name} fill={s.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                  </CardContent>
                </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-64" placeholder="Search users" /></div>
                <Select value={gradeFilter} onValueChange={setGradeFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades</SelectItem><SelectItem value="1">Grade 1</SelectItem><SelectItem value="5">Grade 5</SelectItem><SelectItem value="8">Grade 8</SelectItem><SelectItem value="12">Grade 12</SelectItem></SelectContent></Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="all">All Roles</SelectItem><SelectItem value="student">Student</SelectItem><SelectItem value="teacher">Teacher</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
                <Badge variant="outline">{filteredUsers.length} users</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('promote_teacher')}>Bulk Promote</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('suspend')}>Bulk Suspend</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('ban')}>Bulk Ban</Button>
                <Button variant="destructive" size="sm" onClick={() => handleBulkAction('delete')}>Bulk Delete</Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">User Control Panel (Admin Only)</CardTitle>
                  <CardDescription>Add/Remove XP, set level, reset level/full progress, and adjust coins by user ID or username.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target user (ID or username)</Label>
                    <Input
                      value={controlUserIdentifier}
                      onChange={(e) => setControlUserIdentifier(e.target.value)}
                      placeholder="user uuid or username"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label>Add / Remove XP</Label>
                      <Input value={xpAmount} onChange={(e) => setXpAmount(e.target.value)} type="number" placeholder="XP amount" />
                      <Button className="w-full" onClick={handleAddXP}><Zap className="w-4 h-4 mr-2" />Apply XP</Button>
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label>Set Level</Label>
                      <Input value={levelAmount} onChange={(e) => setLevelAmount(e.target.value)} type="number" min={1} placeholder="Level" />
                      <Button className="w-full" onClick={handleSetLevel}><Target className="w-4 h-4 mr-2" />Update Level</Button>
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label>Reset User</Label>
                      <Select value={resetMode} onValueChange={(value) => setResetMode(value as 'level' | 'full')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="level">Reset Level</SelectItem>
                          <SelectItem value="full">Full Reset</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="destructive" className="w-full" onClick={handleResetUserProgress}><RotateCcw className="w-4 h-4 mr-2" />Apply Reset</Button>
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label>Add / Remove Coins</Label>
                      <Input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} type="number" placeholder="Coins (+/-)" />
                      <Button className="w-full" onClick={handleCoinAdjustment}><Coins className="w-4 h-4 mr-2" />Apply Coins</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card><CardContent className="p-0"><ScrollArea className="h-[560px]"><table className="w-full"><thead className="sticky top-0 bg-muted/90"><tr><th className="p-3 text-left">Select</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Grade</th><th className="p-3 text-left">XP</th><th className="p-3 text-left">Joined</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{filteredUsers.map((u) => (<tr key={u.id} className="border-b border-border/50"><td className="p-3"><input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={(e) => setSelectedUsers((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))} /></td><td className="p-3"><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">@{u.username}</p></td><td className="p-3"><Select value={u.role} onValueChange={(v) => handleUpdateUserRole(u.id, v as Role)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="teacher">Teacher</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></td><td className="p-3">{u.grade || '-'}</td><td className="p-3"><span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500" />{u.xp}</span></td><td className="p-3 text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => handleResetPassword(u)}><Key className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td></tr>))}</tbody></table></ScrollArea></CardContent></Card>
            </TabsContent>

            <TabsContent value="control" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />User Control Panel</CardTitle>
                  <CardDescription>Admin-only controls for XP, level, reset (not season), and coins. Use user ID or username.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target user (user ID or username)</Label>
                    <Input
                      value={controlUserIdentifier}
                      onChange={(e) => setControlUserIdentifier(e.target.value)}
                      placeholder="e.g. 8f6... or @student_username"
                    />
                  </div>
                  <Accordion type="multiple" defaultValue={['user-controls']} className="w-full">
                    <AccordionItem value="user-controls">
                      <AccordionTrigger>▶ User Controls</AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
                            <Label>Add / Remove XP</Label>
                            <Input value={xpAmount} onChange={(e) => setXpAmount(e.target.value)} type="number" placeholder="XP amount" />
                            <Button className="w-full min-h-12" onClick={handleAddXP}><Zap className="w-4 h-4 mr-2" />Apply XP</Button>
                          </div>
                          <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
                            <Label>Set Level</Label>
                            <Input value={levelAmount} onChange={(e) => setLevelAmount(e.target.value)} type="number" min={1} placeholder="Level" />
                            <Button className="w-full min-h-12" onClick={handleSetLevel}><Target className="w-4 h-4 mr-2" />Update Level</Button>
                          </div>
                          <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
                            <Label>Reset User</Label>
                            <Select value={resetMode} onValueChange={(value) => setResetMode(value as 'level' | 'full')}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="level">Reset Level</SelectItem>
                                <SelectItem value="full">Full Reset</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="destructive" className="w-full min-h-12" onClick={handleResetUserProgress}><RotateCcw className="w-4 h-4 mr-2" />Apply Reset</Button>
                          </div>
                          <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
                            <Label>Add / Remove Coins</Label>
                            <Input value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} type="number" placeholder="Coins amount (+/-)" />
                            <Button className="w-full min-h-12" onClick={handleCoinAdjustment}><Coins className="w-4 h-4 mr-2" />Apply Coins</Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="tournament-controls">
                      <AccordionTrigger>▶ Tournament Controls</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Button className="min-h-12" variant="outline" onClick={() => setActiveTab('leaderboard')}>
                            <Trophy className="w-4 h-4 mr-2" />Open Leaderboard Control
                          </Button>
                          <Button className="min-h-12" variant="outline" onClick={fetchAllData}>
                            <RefreshCw className="w-4 h-4 mr-2" />Refresh Tournament/Ranking Data
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="system-settings">
                      <AccordionTrigger>▶ System Settings</AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <p className="text-sm text-muted-foreground mb-3">Only admin can change platform-level controls.</p>
                        <Button className="min-h-12 w-full md:w-auto" onClick={() => setActiveTab('settings')}>
                          <SlidersHorizontal className="w-4 h-4 mr-2" />Open System Settings
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Library Upload Approvals</CardTitle>
                  <CardDescription>When students upload books, they appear here until admin or manager approves/rejects them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingLibraryBooks.length === 0 && <p className="text-sm text-muted-foreground">No pending library uploads right now.</p>}
                  {pendingLibraryBooks.map((book) => (
                    <div key={book.id} className="border rounded-xl p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">{book.author} • {book.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded by {book.profiles?.name || 'Unknown user'} ({book.profiles?.username ? `@${book.profiles.username}` : 'no username'}) on {new Date(book.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{book.status}</Badge>
                          <Button
                            size="sm"
                            disabled={moderatingBookId === book.id}
                            onClick={() => handleModerateLibraryBook(book.id, 'approved')}
                          >
                            {moderatingBookId === book.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={moderatingBookId === book.id}
                            onClick={() => handleModerateLibraryBook(book.id, 'rejected')}
                          >
                            {moderatingBookId === book.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card><CardHeader><CardTitle>Content Management</CardTitle><CardDescription>Manage quizzes, flashcards, questions, and social content.</CardDescription></CardHeader><CardContent className="p-0"><ScrollArea className="h-[620px]"><table className="w-full"><thead className="sticky top-0 bg-muted/90"><tr><th className="p-3 text-left">Type</th><th className="p-3 text-left">Title</th><th className="p-3 text-left">Grade</th><th className="p-3 text-left">Subject</th><th className="p-3 text-left">Created</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{contentRows.map((item: any) => (<tr key={`${item.type}-${item.id}`} className="border-b border-border/50"><td className="p-3"><Badge variant="outline">{item.type}</Badge></td><td className="p-3 max-w-md truncate">{item.title}</td><td className="p-3">{item.grade || '-'}</td><td className="p-3">{item.subject || '-'}</td><td className="p-3 text-sm text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td><td className="p-3 text-right"><Button size="sm" variant="outline" className="mr-2" onClick={() => toast.info('Inline edit can be wired to your preferred editor modal.')}>Edit</Button><Button size="sm" onClick={() => handleApproveContent(item.type, item.id)} className="mr-2"><Check className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDeleteContent(item.type, item.id)}><Trash2 className="w-4 h-4" /></Button></td></tr>))}</tbody></table></ScrollArea></CardContent></Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card><CardHeader><CardTitle>User Growth & Activity Trends</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyActivity}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="users" fill="#3b82f6" /><Bar dataKey="quizzes" fill="#f97316" /></BarChart></ResponsiveContainer></CardContent></Card>
                <Card><CardHeader><CardTitle>Most Active Students (Top XP)</CardTitle></CardHeader><CardContent className="space-y-3">{[...users].sort((a, b) => b.xp - a.xp).slice(0, 7).map((u, i) => (<div key={u.id} className="flex items-center justify-between p-2 rounded bg-muted/40"><span>#{i + 1} {u.name}</span><Badge>{u.xp} XP</Badge></div>))}</CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle>Weak Subject Trends</CardTitle><CardDescription>Based on low-volume quizzes by subject.</CardDescription></CardHeader><CardContent>{Object.entries(quizzes.reduce((acc: Record<string, number>, q: any) => { acc[q.subject || 'Unknown'] = (acc[q.subject || 'Unknown'] || 0) + 1; return acc; }, {})).sort((a, b) => Number(a[1]) - Number(b[1])).slice(0, 6).map(([subject, count]) => (<div key={subject} className="flex justify-between border-b py-2"><span>{subject}</span><span className="text-muted-foreground">{String(count)} quizzes</span></div>))}</CardContent></Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Flag className="w-4 h-4 text-destructive" />Reports & Flags</CardTitle></CardHeader><CardContent><ScrollArea className="h-[620px]"><div className="space-y-3">{reports.map((report) => (<div key={report.id} className="border rounded-xl p-3"><div className="flex items-center gap-2 mb-2"><Badge variant={report.status === 'pending' ? 'destructive' : 'outline'}>{report.status}</Badge><Badge variant="outline">{report.reported_type}</Badge><span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</span></div><p className="text-sm">{report.reason}</p><p className="text-xs text-muted-foreground">Reporter: {report.reporter_name}</p>{report.description && <p className="text-sm italic mt-1">"{report.description}"</p>} {report.status === 'pending' && <div className="flex gap-2 mt-3"><Button size="sm" onClick={() => handleModerateReport(report.id, 'resolved')}><Check className="w-3 h-3 mr-1" />Resolve</Button><Button size="sm" variant="outline" onClick={() => handleModerateReport(report.id, 'dismissed')}><X className="w-3 h-3 mr-1" />Dismiss</Button></div>}</div>))}</div></ScrollArea></CardContent></Card>
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4">
              <div className="flex justify-between"><h2 className="text-xl font-semibold">Notifications & Announcements</h2><Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}><DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New Notification</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create Alert / Announcement</DialogTitle></DialogHeader><div className="space-y-3"><Input placeholder="Title" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} /><Textarea placeholder="Message" rows={4} value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} /><Select value={announcementForm.target_type} onValueChange={(v) => setAnnouncementForm({ ...announcementForm, target_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="students">Students</SelectItem><SelectItem value="teachers">Teachers</SelectItem></SelectContent></Select><Button className="w-full" disabled={loading} onClick={handleCreateAnnouncement}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send</Button></div></DialogContent></Dialog></div>
              <div className="space-y-3">{announcements.map((ann) => (<Card key={ann.id}><CardContent className="p-4"><div className="flex justify-between"><div><p className="font-medium">{ann.title}</p><p className="text-sm text-muted-foreground">{ann.content}</p><p className="text-xs text-muted-foreground mt-2">{new Date(ann.created_at).toLocaleString()}</p></div><Badge>{ann.target_type}</Badge></div></CardContent></Card>))}</div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {!isAdmin ? <Card><CardContent className="py-14 text-center"><Shield className="w-10 h-10 mx-auto mb-2 text-destructive" /><p className="font-semibold">Managers cannot access sensitive controls.</p><p className="text-sm text-muted-foreground">Only Admin can configure platform/system settings.</p></CardContent></Card> : <Card><CardHeader><CardTitle>System Settings (Admin only)</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex items-center justify-between"><Label>Enable Social Feed</Label><Switch checked={systemSettings.feature_social_enabled} onCheckedChange={(v) => setSystemSettings({ ...systemSettings, feature_social_enabled: v })} /></div><div className="flex items-center justify-between"><Label>Enable XP System</Label><Switch checked={systemSettings.feature_xp_enabled} onCheckedChange={(v) => setSystemSettings({ ...systemSettings, feature_xp_enabled: v })} /></div><div className="flex items-center justify-between"><Label>Enable AI Features</Label><Switch checked={systemSettings.feature_ai_enabled} onCheckedChange={(v) => setSystemSettings({ ...systemSettings, feature_ai_enabled: v })} /></div><div className="flex items-center justify-between"><Label>Strict Moderation</Label><Switch checked={systemSettings.strict_moderation} onCheckedChange={(v) => setSystemSettings({ ...systemSettings, strict_moderation: v })} /></div><div className="space-y-2"><Label>AI usage limit / day</Label><Input type="number" value={systemSettings.max_ai_requests_per_day} onChange={(e) => setSystemSettings({ ...systemSettings, max_ai_requests_per_day: Number(e.target.value) || 0 })} /></div><Button onClick={saveSystemSettings}>Save Settings</Button></CardContent></Card>}
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="pl-10 w-96" placeholder="Search logs" /></div>
              <Card><CardHeader><CardTitle>Activity Logs</CardTitle><CardDescription>Who did what, when, and on what target.</CardDescription></CardHeader><CardContent className="p-0"><ScrollArea className="h-[600px]"><table className="w-full"><thead className="sticky top-0 bg-muted/90"><tr><th className="p-3 text-left">Who</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Target</th><th className="p-3 text-left">Time</th></tr></thead><tbody>{filteredLogs.map((entry) => (<tr key={entry.id} className="border-b border-border/50"><td className="p-3">{entry.actor}</td><td className="p-3">{entry.action}</td><td className="p-3">{entry.target}</td><td className="p-3 text-muted-foreground">{new Date(entry.at).toLocaleString()}</td></tr>))}</tbody></table></ScrollArea></CardContent></Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Season</CardTitle>
                  <CardDescription>Live status powered by database RPC + realtime subscriptions.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Season</p>
                    <p className="font-semibold">{seasonStats?.season_name || 'Loading...'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Total users</p>
                    <p className="font-semibold">{seasonStats?.total_users ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Top player</p>
                    <p className="font-semibold">{seasonStats?.top_player || '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 md:col-span-3">
                    <p className="text-sm text-muted-foreground">Total XP</p>
                    <p className="font-semibold">{(seasonStats?.total_xp ?? 0).toLocaleString()} XP</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Season Control</CardTitle>
                  <CardDescription>Global-only season reset: close current season, convert season XP to wallet coins, archive winners, zero every student season XP, and open the next season.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-w-xs space-y-2">
                    <Label>XP → Coins conversion rate</Label>
                    <Input value={seasonConversionRate} onChange={(e) => setSeasonConversionRate(e.target.value)} type="number" min="0.01" step="0.01" />
                  </div>
                  <div className="max-w-xs space-y-2">
                    <Label>Type CONFIRM to end season</Label>
                    <Input value={seasonConfirmText} onChange={(e) => setSeasonConfirmText(e.target.value)} placeholder="CONFIRM" />
                  </div>
                  <Button variant="destructive" onClick={handleEndSeason}><Trophy className="w-4 h-4 mr-2" />End Season + Reset Leaderboard</Button>
                  <p className="text-sm text-muted-foreground pt-2 border-t">Season XP resets are global-only from this panel (no single-user or class season reset actions).</p>
                  <Button variant="secondary" onClick={handleForceStartNewSeason}><RefreshCw className="w-4 h-4 mr-2" />Force Start New Season</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Rewards Preview</CardTitle>
                  <CardDescription>Projected payout before reset with rank bonuses included.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rewardPreview.map((row) => (
                    <div key={row.user_id} className="flex items-center justify-between border rounded-lg p-2">
                      <span>#{row.projected_rank} {row.name}</span>
                      <Badge variant="outline">{row.season_xp} XP → {row.projected_coins} coins {row.projected_title ? `• ${row.projected_title}` : ''}</Badge>
                    </div>
                  ))}
                  {rewardPreview.length === 0 && <p className="text-sm text-muted-foreground">No reward preview available.</p>}
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle>Most Active Students (Season XP)</CardTitle></CardHeader><CardContent className="space-y-2">{[...users].filter((u) => u.role === 'student').sort((a, b) => (b.season_xp ?? b.xp ?? 0) - (a.season_xp ?? a.xp ?? 0)).slice(0, 20).map((u, i) => (<div key={u.id} className="flex items-center justify-between border rounded-lg p-2"><span>#{i + 1} {u.name}</span><Badge variant="outline">Lvl {u.level} • {(u.season_xp ?? u.xp ?? 0)} season XP</Badge></div>))}</CardContent></Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4">
              <Card><CardHeader><CardTitle>Real-time Monitoring</CardTitle><CardDescription>Live stream from Supabase subscriptions (users, posts, quiz activity, messages).</CardDescription></CardHeader><CardContent className="space-y-3">{notifications.map((n) => (<div key={n.id} className="border rounded-lg p-3 flex items-center justify-between"><div className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /><p>{n.text}</p></div><p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleTimeString()}</p></div>))}{notifications.length === 0 && <p className="text-muted-foreground">No live events yet.</p>}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;
