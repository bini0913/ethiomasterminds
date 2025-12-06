import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import { 
  Users, BookOpen, BarChart2, Plus, ChevronLeft, Search, 
  FileText, Settings, LogOut, Bell
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const TeacherDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && user.role !== "teacher") {
      toast.error("Access denied");
      navigate("/");
    }
  }, [user, navigate]);

  const stats = [
    { label: "Total Students", value: 48, icon: Users, color: "from-primary to-accent" },
    { label: "Questions Created", value: 156, icon: FileText, color: "from-secondary to-glow-cyan" },
    { label: "Quizzes Given", value: 23, icon: BookOpen, color: "from-accent to-glow-pink" },
    { label: "Avg. Score", value: "78%", icon: BarChart2, color: "from-glow-green to-emerald-500" }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />
      
      <div className="relative z-10">
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ChevronLeft className="h-5 w-5" />
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
              <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
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
            <Card className="glass border-border/30">
              <CardHeader>
                <CardTitle className="font-display flex items-center justify-between">
                  <span className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Question Bank</span>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input placeholder="Search questions..." className="mb-4" />
                <div className="space-y-2">
                  {[
                    { q: "What is 5 + 7?", cat: "Math", diff: "easy" },
                    { q: "What planet is closest to the sun?", cat: "Science", diff: "medium" },
                    { q: "What is the past tense of run?", cat: "English", diff: "easy" }
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{item.q}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{item.cat}</Badge>
                          <Badge className={item.diff === 'easy' ? 'bg-glow-green' : 'bg-glow-yellow'}>{item.diff}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/30">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Users className="h-5 w-5" /> Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { name: "Abebe Kebede", grade: 6, score: 85 },
                    { name: "Tigist Alemu", grade: 6, score: 92 },
                    { name: "Dawit Haile", grade: 5, score: 78 }
                  ].map((s, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">👤</div>
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">Grade {s.grade}</p>
                        </div>
                      </div>
                      <Badge className="bg-glow-green text-background">{s.score}%</Badge>
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
