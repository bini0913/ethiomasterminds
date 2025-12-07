import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { 
  ShieldCheck, Users, Database, Key, 
  Settings, LogOut, Bell, TrendingUp, Server, UserPlus,
  Check, X, Clock, FileText, Home, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingItem {
  id: string;
  type: 'question' | 'quiz';
  title: string;
  teacher: string;
  subject: string;
  submittedAt: Date;
}

interface SystemUser {
  id: string;
  name: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'active' | 'suspended';
  lastActive: Date;
}

const AdminDashboard: React.FC = () => {
  const { user, logout, getAllUsers, deleteUserById } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; username?: string; role: string; level: number }>>([]);

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([
    { id: '1', type: 'question', title: "What planet is closest to the sun?", teacher: "Teacher One", subject: "Science", submittedAt: new Date() },
    { id: '2', type: 'quiz', title: "Grade 5 Math Quiz - Set 3", teacher: "Teacher Two", subject: "Math", submittedAt: new Date(Date.now() - 3600000) },
    { id: '3', type: 'question', title: "What is photosynthesis?", teacher: "Teacher One", subject: "Science", submittedAt: new Date(Date.now() - 7200000) },
  ]);

  const [generatedCodes, setGeneratedCodes] = useState<Array<{ code: string; type: string; createdAt: Date }>>([]);

  // Fetch users on mount
  React.useEffect(() => {
    const fetchUsers = async () => {
      const users = await getAllUsers();
      setAllUsers(users);
    };
    fetchUsers();
  }, [getAllUsers]);
  
  const stats = [
    { label: "Total Users", value: allUsers.length, icon: Users, color: "from-primary to-accent" },
    { label: "Teachers", value: allUsers.filter(u => u.role === 'teacher').length, icon: UserPlus, color: "from-secondary to-glow-cyan" },
    { label: "Pending Approvals", value: pendingItems.length, icon: Clock, color: "from-glow-yellow to-orange-500" },
    { label: "Server Status", value: "Online", icon: Server, color: "from-glow-green to-emerald-500" }
  ];

  const generateCode = (type: 'teacher' | 'admin') => {
    const code = `${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    setGeneratedCodes(prev => [{ code, type, createdAt: new Date() }, ...prev]);
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} Code Generated`, {
      description: code
    });
  };

  const handleApprove = (id: string) => {
    setPendingItems(prev => prev.filter(item => item.id !== id));
    toast.success("Item approved and published");
  };

  const handleReject = (id: string) => {
    setPendingItems(prev => prev.filter(item => item.id !== id));
    toast.info("Item rejected and returned to teacher");
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      deleteUserById(id);
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-glow-pink flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">Full System Control</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-glow-green/20 text-glow-green">
                {pendingItems.length} Pending
              </Badge>
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="approvals">Approvals ({pendingItems.length})</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="codes">Access Codes</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" /> Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: "Daily Active Users", value: 456 },
                        { label: "Quizzes Completed Today", value: 1234 },
                        { label: "Questions in Database", value: 5678 },
                        { label: "API Requests (24h)", value: "45K" }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <Badge variant="secondary">{item.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Clock className="h-5 w-5" /> Recent Pending Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {pendingItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">by {item.teacher}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-glow-green" onClick={() => handleApprove(item.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleReject(item.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Approvals Tab */}
            <TabsContent value="approvals" className="mt-6">
              <Card className="glass border-border/30">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Pending Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Check className="h-12 w-12 mx-auto mb-2 text-glow-green" />
                      <p>All items have been reviewed!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingItems.map((item) => (
                        <div key={item.id} className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{item.type}</Badge>
                                <Badge variant="outline">{item.subject}</Badge>
                              </div>
                              <p className="font-medium">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Submitted by {item.teacher} • {new Date(item.submittedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-glow-green hover:bg-glow-green/80" onClick={() => handleApprove(item.id)}>
                                <Check className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(item.id)}>
                                <X className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="mt-6">
              <Card className="glass border-border/30">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Users className="h-5 w-5" /> All Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {allUsers.map((u) => (
                      <div key={u.id} className="p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                            👤
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.name}</p>
                            <p className="text-xs text-muted-foreground">@{u.username || 'unknown'} • Level {u.level}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            u.role === 'admin' ? 'bg-accent' :
                            u.role === 'teacher' ? 'bg-secondary' :
                            'bg-primary'
                          }>{u.role}</Badge>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Access Codes Tab */}
            <TabsContent value="codes" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Key className="h-5 w-5" /> Generate Access Codes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Note: With the new authentication system, users can log in with username and password only. 
                      These codes are for internal reference.
                    </p>
                    <Button 
                      onClick={() => generateCode('teacher')} 
                      className="w-full bg-gradient-to-r from-secondary to-glow-cyan"
                    >
                      Generate Teacher Reference Code
                    </Button>
                    <Button 
                      onClick={() => generateCode('admin')} 
                      className="w-full bg-gradient-to-r from-accent to-glow-pink"
                    >
                      Generate Admin Reference Code
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display">Generated Codes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {generatedCodes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6">No codes generated yet</p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {generatedCodes.map((item, i) => (
                          <div key={i} className="p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                            <div>
                              <p className="font-mono text-sm">{item.code}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.type} • {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline">{item.type}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <footer className="text-center py-4 text-xs text-muted-foreground">
          Created by Biniam Bogale
        </footer>
      </div>
    </div>
  );
};

export default AdminDashboard;
