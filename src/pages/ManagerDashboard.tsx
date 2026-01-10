import React, { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { 
  Crown, 
  Users, 
  BookOpen, 
  Shield, 
  Settings, 
  BarChart3,
  TrendingUp,
  Globe,
  Award,
  Calendar,
  UserPlus,
  Eye,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface GlobalStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalManagers: number;
  totalQuizzes: number;
  completedQuizResults: number;
  activeTournaments: number;
  pendingQuizzes: number;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  level: number;
  xp: number;
  createdAt: string;
}

interface PendingQuiz {
  id: string;
  title: string;
  subject: string;
  createdBy: string;
  creatorName: string;
  questionCount: number;
  createdAt: string;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  participants: number;
  maxParticipants: number;
  startTime: string;
  prizeCoins: number;
  prizeGems: number;
}

const ManagerDashboard: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    totalManagers: 0,
    totalQuizzes: 0,
    completedQuizResults: 0,
    activeTournaments: 0,
    pendingQuizzes: 0
  });
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    grade: ''
  });
  const [newTournament, setNewTournament] = useState({
    name: '',
    description: '',
    subject: 'Mixed',
    maxParticipants: 32,
    prizeCoins: 1000,
    prizeGems: 50,
    startTime: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchGlobalStats(),
        fetchUsers(),
        fetchPendingQuizzes(),
        fetchTournaments()
      ]);
    } catch (error) {
      console.error('Error loading manager dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    // Count users by role
    const { data: roleCounts } = await supabase
      .from('user_roles')
      .select('role');

    const roleStats = (roleCounts || []).reduce((acc: any, r) => {
      acc[r.role] = (acc[r.role] || 0) + 1;
      return acc;
    }, {});

    // Count quizzes
    const { count: totalQuizzes } = await supabase
      .from('quizzes')
      .select('*', { count: 'exact', head: true });

    const { count: pendingQuizzes } = await supabase
      .from('quizzes')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', false);

    // Count quiz results
    const { count: completedQuizResults } = await supabase
      .from('quiz_results')
      .select('*', { count: 'exact', head: true });

    // Count active tournaments
    const { count: activeTournaments } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .in('status', ['upcoming', 'active']);

    setGlobalStats({
      totalUsers: Object.values(roleStats).reduce((a: number, b: any) => a + b, 0) as number,
      totalStudents: roleStats.student || 0,
      totalTeachers: roleStats.teacher || 0,
      totalAdmins: roleStats.admin || 0,
      totalManagers: roleStats.manager || 0,
      totalQuizzes: totalQuizzes || 0,
      completedQuizResults: completedQuizResults || 0,
      activeTournaments: activeTournaments || 0,
      pendingQuizzes: pendingQuizzes || 0
    });
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        level,
        xp,
        created_at,
        user_roles!inner(role)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const userList: UserRecord[] = data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: '', // Email is in auth.users, not accessible here
        role: u.user_roles?.[0]?.role || 'student',
        level: u.level || 1,
        xp: u.xp || 0,
        createdAt: u.created_at
      }));
      setUsers(userList);
    }
  };

  const fetchPendingQuizzes = async () => {
    const { data, error } = await supabase
      .from('quizzes')
      .select(`
        id,
        title,
        subject,
        created_by,
        created_at,
        profiles!inner(name),
        questions(count)
      `)
      .eq('is_approved', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const quizList: PendingQuiz[] = data.map((q: any) => ({
        id: q.id,
        title: q.title,
        subject: q.subject,
        createdBy: q.created_by,
        creatorName: q.profiles?.name || 'Unknown',
        questionCount: q.questions?.[0]?.count || 0,
        createdAt: q.created_at
      }));
      setPendingQuizzes(quizList);
    }
  };

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        status,
        max_participants,
        start_time,
        prize_coins,
        prize_gems,
        tournament_participants(count)
      `)
      .order('start_time', { ascending: false })
      .limit(20);

    if (!error && data) {
      const tournList: Tournament[] = data.map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        participants: t.tournament_participants?.[0]?.count || 0,
        maxParticipants: t.max_participants || 32,
        startTime: t.start_time,
        prizeCoins: t.prize_coins || 0,
        prizeGems: t.prize_gems || 0
      }));
      setTournaments(tournList);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          data: {
            name: newUserData.name,
            username: newUserData.email.split('@')[0]
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Assign role via edge function
        const { error: roleError } = await supabase.functions.invoke('assign-role', {
          body: { userId: authData.user.id, role: newUserData.role }
        });

        if (roleError) {
          console.error('Role assignment error:', roleError);
        }
      }

      toast.success(`${newUserData.role} account created successfully!`);
      setNewUserData({ name: '', email: '', password: '', role: 'student', grade: '' });
      fetchUsers();
      fetchGlobalStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    }
  };

  const approveQuiz = async (quizId: string) => {
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
    } else {
      toast.success('Quiz approved!');
      fetchPendingQuizzes();
      fetchGlobalStats();
    }
  };

  const rejectQuiz = async (quizId: string) => {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (error) {
      toast.error('Failed to delete quiz');
    } else {
      toast.success('Quiz rejected and deleted');
      fetchPendingQuizzes();
      fetchGlobalStats();
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.functions.invoke('assign-role', {
      body: { userId, role: newRole }
    });

    if (error) {
      toast.error('Failed to change role');
    } else {
      toast.success('User role updated!');
      fetchUsers();
      fetchGlobalStats();
    }
  };

  const createTournament = async () => {
    if (!newTournament.name || !newTournament.startTime) {
      toast.error('Please fill in tournament name and start time');
      return;
    }

    const { error } = await supabase
      .from('tournaments')
      .insert({
        name: newTournament.name,
        description: newTournament.description,
        subject: newTournament.subject,
        max_participants: newTournament.maxParticipants,
        prize_coins: newTournament.prizeCoins,
        prize_gems: newTournament.prizeGems,
        start_time: newTournament.startTime,
        end_time: new Date(new Date(newTournament.startTime).getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: user?.id,
        status: 'upcoming'
      });

    if (error) {
      toast.error('Failed to create tournament');
    } else {
      toast.success('Tournament created!');
      setNewTournament({
        name: '',
        description: '',
        subject: 'Mixed',
        maxParticipants: 32,
        prizeCoins: 1000,
        prizeGems: 50,
        startTime: ''
      });
      fetchTournaments();
      fetchGlobalStats();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-background dark:to-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Crown className="h-8 w-8 text-yellow-500" />
              Master Control Dashboard
            </h1>
            <p className="text-muted-foreground">Welcome back, {user?.name}! You have complete system oversight and control.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDashboardData}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2">
              Master Manager
            </Badge>
          </div>
        </div>

        {/* Global Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs">Total Users</p>
                  <p className="text-2xl font-bold">{globalStats.totalUsers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-xs">Students</p>
                  <p className="text-2xl font-bold">{globalStats.totalStudents.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs">Teachers</p>
                  <p className="text-2xl font-bold">{globalStats.totalTeachers}</p>
                </div>
                <Globe className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs">Tournaments</p>
                  <p className="text-2xl font-bold">{globalStats.activeTournaments}</p>
                </div>
                <Award className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-xs">Total Quizzes</p>
                  <p className="text-2xl font-bold">{globalStats.totalQuizzes.toLocaleString()}</p>
                </div>
                <BookOpen className="h-8 w-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users ({globalStats.totalUsers})</TabsTrigger>
            <TabsTrigger value="quizzes">Pending ({globalStats.pendingQuizzes})</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { role: 'Students', count: globalStats.totalStudents, color: 'bg-blue-500' },
                      { role: 'Teachers', count: globalStats.totalTeachers, color: 'bg-green-500' },
                      { role: 'Admins', count: globalStats.totalAdmins, color: 'bg-purple-500' },
                      { role: 'Managers', count: globalStats.totalManagers, color: 'bg-orange-500' }
                    ].map((stat) => (
                      <div key={stat.role} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                          <span className="font-medium">{stat.role}</span>
                        </div>
                        <Badge variant="secondary">{stat.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Platform Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Quiz Results</p>
                      <p className="text-2xl font-bold">{globalStats.completedQuizResults.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Pending Approvals</p>
                      <p className="text-2xl font-bold text-amber-500">{globalStats.pendingQuizzes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* Create User Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create New User Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Full Name</Label>
                    <Input
                      id="user-name"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email Address</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password</Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={handleCreateUser} className="w-full md:w-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User Account
                </Button>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                            👤
                          </div>
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">Level {u.level} • {u.xp} XP</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={u.role} onValueChange={(role) => changeUserRole(u.id, role)}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="teacher">Teacher</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quizzes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Quiz Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingQuizzes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending quizzes to approve</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {pendingQuizzes.map((quiz) => (
                        <div key={quiz.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                          <div>
                            <h4 className="font-medium">{quiz.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {quiz.subject} • {quiz.questionCount} questions • by {quiz.creatorName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(quiz.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => approveQuiz(quiz.id)}>
                              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectQuiz(quiz.id)}>
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-6">
            {/* Create Tournament */}
            <Card>
              <CardHeader>
                <CardTitle>Create Tournament</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tournament Name</Label>
                    <Input
                      value={newTournament.name}
                      onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                      placeholder="e.g., Weekly Math Championship"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={newTournament.subject} onValueChange={(v) => setNewTournament({...newTournament, subject: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mixed">Mixed</SelectItem>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="datetime-local"
                      value={newTournament.startTime}
                      onChange={(e) => setNewTournament({...newTournament, startTime: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Participants</Label>
                    <Input
                      type="number"
                      value={newTournament.maxParticipants}
                      onChange={(e) => setNewTournament({...newTournament, maxParticipants: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prize (Coins)</Label>
                    <Input
                      type="number"
                      value={newTournament.prizeCoins}
                      onChange={(e) => setNewTournament({...newTournament, prizeCoins: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prize (Gems)</Label>
                    <Input
                      type="number"
                      value={newTournament.prizeGems}
                      onChange={(e) => setNewTournament({...newTournament, prizeGems: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <Button onClick={createTournament}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Tournament
                </Button>
              </CardContent>
            </Card>

            {/* Tournaments List */}
            <Card>
              <CardHeader>
                <CardTitle>All Tournaments</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {tournaments.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">{t.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t.participants}/{t.maxParticipants} participants • 
                            Prize: {t.prizeCoins} 🪙 + {t.prizeGems} 💎
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(t.startTime).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                          {t.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Feature Toggles</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Multiplayer Mode', enabled: true },
                      { label: 'Tournaments', enabled: true },
                      { label: 'AI Helper', enabled: true },
                      { label: 'Daily Missions', enabled: true }
                    ].map((feature) => (
                      <div key={feature.label} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>{feature.label}</span>
                        <Switch defaultChecked={feature.enabled} />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ManagerDashboard;
