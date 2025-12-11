import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Shield, Users, BookOpen, Trophy, Bell, Settings, LogOut,
  Plus, Trash2, Edit, Send, UserCheck, UserX, Key, Database,
  Activity, Server, BarChart3, Bot, Search, RefreshCw, Check,
  X, AlertTriangle, Loader2, Crown, Zap
} from 'lucide-react';

interface SystemUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  xp: number;
  level: number;
  role: string;
  created_at: string;
  is_banned?: boolean;
}

interface AccessCode {
  id: string;
  code: string;
  code_type: string;
  is_used: boolean;
  used_by: string | null;
  created_at: string;
  expires_at: string | null;
}

interface Quiz {
  id: string;
  title: string;
  subject: string;
  grade: string;
  difficulty: string;
  is_approved: boolean;
  created_by: string;
  created_at: string;
  creator_name?: string;
}

interface NPCSettings {
  id: string;
  difficulty: string;
  answer_speed_ms: number;
  accuracy_percent: number;
  intelligence_scaling: boolean;
}

interface SystemStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalQuizzes: number;
  totalQuestions: number;
  approvedQuizzes: number;
  pendingQuizzes: number;
}

const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [npcSettings, setNPCSettings] = useState<NPCSettings | null>(null);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    totalQuizzes: 0,
    totalQuestions: 0,
    approvedQuizzes: 0,
    pendingQuizzes: 0
  });

  // Dialog states
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [codeForm, setCodeForm] = useState({ code: '', code_type: 'teacher' });
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    target_type: 'all'
  });

  useEffect(() => {
    fetchAllData();
  }, [user]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchAccessCodes(),
      fetchQuizzes(),
      fetchAnnouncements(),
      fetchNPCSettings(),
      fetchStats()
    ]);
  };

  const fetchUsers = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch users:', error);
      return;
    }

    // Fetch roles for each user
    const usersWithRoles = await Promise.all(
      (profiles || []).map(async (p) => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', p.id)
          .single();
        
        return {
          ...p,
          role: roleData?.role || 'student'
        };
      })
    );

    setUsers(usersWithRoles);
  };

  const fetchAccessCodes = async () => {
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAccessCodes(data);
    }
  };

  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setQuizzes(data);
    }
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnnouncements(data);
    }
  };

  const fetchNPCSettings = async () => {
    const { data, error } = await supabase
      .from('npc_settings')
      .select('*')
      .single();

    if (!error && data) {
      setNPCSettings(data);
    }
  };

  const fetchStats = async () => {
    const [profilesRes, quizzesRes, questionsRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }),
      supabase.from('quizzes').select('id, is_approved', { count: 'exact' }),
      supabase.from('questions').select('id', { count: 'exact' }),
      supabase.from('user_roles').select('role')
    ]);

    const roles = rolesRes.data || [];
    const quizzesData = quizzesRes.data || [];

    setStats({
      totalUsers: profilesRes.count || 0,
      totalStudents: roles.filter(r => r.role === 'student').length,
      totalTeachers: roles.filter(r => r.role === 'teacher').length,
      totalAdmins: roles.filter(r => r.role === 'admin' || r.role === 'manager').length,
      totalQuizzes: quizzesRes.count || 0,
      totalQuestions: questionsRes.count || 0,
      approvedQuizzes: quizzesData.filter(q => q.is_approved).length,
      pendingQuizzes: quizzesData.filter(q => !q.is_approved).length
    });
  };

  const handleCreateCode = async () => {
    if (!codeForm.code) {
      toast.error('Please enter a code');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('access_codes')
      .insert({
        code: codeForm.code.toUpperCase(),
        code_type: codeForm.code_type,
        created_by: user?.id
      });

    setLoading(false);
    if (error) {
      toast.error('Failed to create code');
      return;
    }

    toast.success('Access code created!');
    setShowCodeDialog(false);
    setCodeForm({ code: '', code_type: 'teacher' });
    fetchAccessCodes();
  };

  const handleDeleteCode = async (codeId: string) => {
    const { error } = await supabase
      .from('access_codes')
      .delete()
      .eq('id', codeId);

    if (error) {
      toast.error('Failed to delete code');
      return;
    }

    toast.success('Code deleted');
    fetchAccessCodes();
  };

  const handleApproveQuiz = async (quizId: string) => {
    const { error } = await supabase
      .from('quizzes')
      .update({ 
        is_approved: true, 
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', quizId);

    if (error) {
      toast.error('Failed to approve quiz');
      return;
    }

    toast.success('Quiz approved!');
    fetchQuizzes();
    fetchStats();
  };

  const handleRejectQuiz = async (quizId: string) => {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (error) {
      toast.error('Failed to reject quiz');
      return;
    }

    toast.success('Quiz rejected and deleted');
    fetchQuizzes();
    fetchStats();
  };

  const handleDeleteUser = async (userId: string) => {
    // Delete user roles first
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    // Delete profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      toast.error('Failed to delete user');
      return;
    }

    toast.success('User deleted');
    fetchUsers();
    fetchStats();
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'student' | 'teacher' | 'admin' | 'manager') => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update role');
      return;
    }

    toast.success('Role updated!');
    fetchUsers();
  };

  const handleUpdateNPCSettings = async () => {
    if (!npcSettings) return;

    setLoading(true);
    const { error } = await supabase
      .from('npc_settings')
      .update({
        difficulty: npcSettings.difficulty,
        answer_speed_ms: npcSettings.answer_speed_ms,
        accuracy_percent: npcSettings.accuracy_percent,
        intelligence_scaling: npcSettings.intelligence_scaling,
        updated_by: user?.id
      })
      .eq('id', npcSettings.id);

    setLoading(false);
    if (error) {
      toast.error('Failed to update NPC settings');
      return;
    }

    toast.success('NPC settings updated!');
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.content) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('announcements')
      .insert({
        ...announcementForm,
        author_id: user?.id
      });

    setLoading(false);
    if (error) {
      toast.error('Failed to create announcement');
      return;
    }

    toast.success('Announcement sent!');
    setShowAnnouncementDialog(false);
    setAnnouncementForm({ title: '', content: '', target_type: 'all' });
    fetchAnnouncements();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                    Admin Portal
                  </h1>
                  <p className="text-sm text-muted-foreground">System Control Panel</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={fetchAllData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-7 gap-2 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="codes" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">Codes</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Quizzes</span>
              </TabsTrigger>
              <TabsTrigger value="npc" className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <span className="hidden sm:inline">NPC</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Announce</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Leaderboard</span>
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Users</p>
                          <p className="text-3xl font-bold">{stats.totalUsers}</p>
                        </div>
                        <Users className="w-10 h-10 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Students</p>
                          <p className="text-3xl font-bold">{stats.totalStudents}</p>
                        </div>
                        <UserCheck className="w-10 h-10 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Teachers</p>
                          <p className="text-3xl font-bold">{stats.totalTeachers}</p>
                        </div>
                        <Crown className="w-10 h-10 text-purple-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Admins</p>
                          <p className="text-3xl font-bold">{stats.totalAdmins}</p>
                        </div>
                        <Shield className="w-10 h-10 text-red-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* More Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <BookOpen className="w-8 h-8 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                        <p className="text-sm text-muted-foreground">Total Quizzes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Database className="w-8 h-8 text-accent" />
                      <div>
                        <p className="text-2xl font-bold">{stats.totalQuestions}</p>
                        <p className="text-sm text-muted-foreground">Questions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Check className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{stats.approvedQuizzes}</p>
                        <p className="text-sm text-muted-foreground">Approved</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <AlertTriangle className="w-8 h-8 text-yellow-500" />
                      <div>
                        <p className="text-2xl font-bold">{stats.pendingQuizzes}</p>
                        <p className="text-sm text-muted-foreground">Pending</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Approvals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    Pending Quiz Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {quizzes.filter(q => !q.is_approved).slice(0, 5).map((quiz) => (
                      <div key={quiz.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                        <div>
                          <p className="font-medium">{quiz.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {quiz.subject} • Grade {quiz.grade} • {quiz.difficulty}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApproveQuiz(quiz.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleRejectQuiz(quiz.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {quizzes.filter(q => !q.is_approved).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No pending approvals</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-10 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Badge variant="outline">{users.length} users</Badge>
              </div>

              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr>
                          <th className="text-left p-4">User</th>
                          <th className="text-left p-4">Role</th>
                          <th className="text-left p-4">Level</th>
                          <th className="text-left p-4">XP</th>
                          <th className="text-left p-4">Joined</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                                  {u.name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <p className="font-medium">{u.name}</p>
                                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Select 
                                value={u.role} 
                                onValueChange={(v) => handleUpdateUserRole(u.id, v as 'student' | 'teacher' | 'admin' | 'manager')}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="student">Student</SelectItem>
                                  <SelectItem value="teacher">Teacher</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">Lvl {u.level}</Badge>
                            </td>
                            <td className="p-4">
                              <span className="flex items-center gap-1">
                                <Zap className="w-4 h-4 text-yellow-500" />
                                {u.xp}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Access Codes Tab */}
            <TabsContent value="codes" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Access Codes</h2>
                <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate Access Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input 
                        placeholder="Code (e.g., TEACHER2024)" 
                        value={codeForm.code}
                        onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                      />
                      <Select 
                        value={codeForm.code_type} 
                        onValueChange={(v) => setCodeForm({ ...codeForm, code_type: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">Teacher Code</SelectItem>
                          <SelectItem value="admin">Admin Code</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button className="w-full" onClick={handleCreateCode} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Generate Code
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {accessCodes.map((code) => (
                  <Card key={code.id} className={code.is_used ? 'opacity-60' : ''}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Key className={`w-5 h-5 ${code.code_type === 'admin' ? 'text-red-500' : 'text-blue-500'}`} />
                            <span className="font-mono text-lg font-bold">{code.code}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={code.code_type === 'admin' ? 'destructive' : 'default'}>
                              {code.code_type}
                            </Badge>
                            <Badge variant={code.is_used ? 'secondary' : 'outline'}>
                              {code.is_used ? 'Used' : 'Available'}
                            </Badge>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteCode(code.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {accessCodes.length === 0 && (
                  <Card className="col-span-full p-12 text-center">
                    <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No access codes</h3>
                    <p className="text-muted-foreground mb-4">Generate codes for teachers and admins</p>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes" className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search quizzes..." 
                    className="pl-10 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stats.approvedQuizzes} approved</Badge>
                  <Badge variant="secondary">{stats.pendingQuizzes} pending</Badge>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr>
                          <th className="text-left p-4">Quiz</th>
                          <th className="text-left p-4">Subject</th>
                          <th className="text-left p-4">Grade</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-left p-4">Created</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQuizzes.map((quiz) => (
                          <tr key={quiz.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="p-4">
                              <p className="font-medium">{quiz.title}</p>
                              <p className="text-sm text-muted-foreground">{quiz.difficulty}</p>
                            </td>
                            <td className="p-4">{quiz.subject}</td>
                            <td className="p-4">Grade {quiz.grade}</td>
                            <td className="p-4">
                              <Badge variant={quiz.is_approved ? 'default' : 'secondary'}>
                                {quiz.is_approved ? 'Approved' : 'Pending'}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {new Date(quiz.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                {!quiz.is_approved && (
                                  <Button size="sm" onClick={() => handleApproveQuiz(quiz.id)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleRejectQuiz(quiz.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* NPC Settings Tab */}
            <TabsContent value="npc" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    NPC Bot Settings
                  </CardTitle>
                  <CardDescription>
                    Configure AI opponent behavior for multiplayer games
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {npcSettings && (
                    <>
                      <div className="space-y-3">
                        <Label>Difficulty Level</Label>
                        <Select 
                          value={npcSettings.difficulty} 
                          onValueChange={(v) => setNPCSettings({ ...npcSettings, difficulty: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                            <SelectItem value="expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label>Answer Speed: {npcSettings.answer_speed_ms}ms</Label>
                        <Slider
                          value={[npcSettings.answer_speed_ms]}
                          onValueChange={([v]) => setNPCSettings({ ...npcSettings, answer_speed_ms: v })}
                          min={500}
                          max={10000}
                          step={100}
                        />
                        <p className="text-xs text-muted-foreground">
                          Lower = faster response time
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Label>Accuracy: {npcSettings.accuracy_percent}%</Label>
                        <Slider
                          value={[npcSettings.accuracy_percent]}
                          onValueChange={([v]) => setNPCSettings({ ...npcSettings, accuracy_percent: v })}
                          min={10}
                          max={100}
                          step={5}
                        />
                        <p className="text-xs text-muted-foreground">
                          Percentage of correct answers
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Intelligence Scaling</Label>
                          <p className="text-sm text-muted-foreground">
                            NPCs adapt to player skill level
                          </p>
                        </div>
                        <Switch
                          checked={npcSettings.intelligence_scaling}
                          onCheckedChange={(v) => setNPCSettings({ ...npcSettings, intelligence_scaling: v })}
                        />
                      </div>

                      <Button onClick={handleUpdateNPCSettings} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Settings
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Announcements Tab */}
            <TabsContent value="announcements" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">System Announcements</h2>
                <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New Announcement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create System Announcement</DialogTitle>
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
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="students">All Students</SelectItem>
                          <SelectItem value="teachers">All Teachers</SelectItem>
                        </SelectContent>
                      </Select>
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
                          <div className="flex items-center gap-2 mb-2">
                            <Bell className="w-4 h-4 text-primary" />
                            <h3 className="text-lg font-semibold">{ann.title}</h3>
                          </div>
                          <p className="text-muted-foreground">{ann.content}</p>
                          <p className="text-xs text-muted-foreground mt-4">
                            {new Date(ann.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge>{ann.target_type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Global Leaderboard Tab */}
            <TabsContent value="leaderboard" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Global Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr>
                          <th className="text-left p-4">Rank</th>
                          <th className="text-left p-4">User</th>
                          <th className="text-left p-4">Level</th>
                          <th className="text-left p-4">XP</th>
                          <th className="text-left p-4">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...users]
                          .sort((a, b) => b.xp - a.xp)
                          .map((u, i) => (
                          <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="p-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                i === 0 ? 'bg-yellow-500 text-yellow-950' :
                                i === 1 ? 'bg-gray-400 text-gray-950' :
                                i === 2 ? 'bg-orange-600 text-orange-950' :
                                'bg-muted'
                              }`}>
                                {i + 1}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                                  {u.name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <p className="font-medium">{u.name}</p>
                                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">Lvl {u.level}</Badge>
                            </td>
                            <td className="p-4">
                              <span className="flex items-center gap-1 font-bold">
                                <Zap className="w-4 h-4 text-yellow-500" />
                                {u.xp.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-4">
                              <Badge variant={
                                u.role === 'admin' || u.role === 'manager' ? 'destructive' :
                                u.role === 'teacher' ? 'default' : 'secondary'
                              }>
                                {u.role}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;
