import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import { 
  ShieldCheck, Users, Database, Key, ChevronLeft, 
  Settings, LogOut, Bell, TrendingUp, Server, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';

const AdminDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Access denied");
      navigate("/");
    }
  }, [user, navigate]);

  const stats = [
    { label: "Total Users", value: "1,234", icon: Users, color: "from-primary to-accent" },
    { label: "Active Teachers", value: 28, icon: UserPlus, color: "from-secondary to-glow-cyan" },
    { label: "Questions", value: "5,678", icon: Database, color: "from-accent to-glow-pink" },
    { label: "Server Status", value: "Online", icon: Server, color: "from-glow-green to-emerald-500" }
  ];

  const generateCode = (type: string) => {
    const code = `${type.toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
    toast.success(`${type} Code Generated: ${code}`);
  };

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-glow-pink flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">Full System Control</p>
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
                <CardTitle className="font-display flex items-center gap-2">
                  <Key className="h-5 w-5" /> Code Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => generateCode('TEACH')} className="w-full bg-gradient-to-r from-secondary to-glow-cyan">
                  Generate Teacher Code
                </Button>
                <Button onClick={() => generateCode('ADMIN')} className="w-full bg-gradient-to-r from-accent to-glow-pink">
                  Generate Admin Code
                </Button>
                <div className="text-xs text-muted-foreground text-center">
                  Default codes: TEACH2025, ADMIN2025
                </div>
              </CardContent>
            </Card>

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
                    { label: "Storage Used", value: "2.3 GB" },
                    { label: "API Requests", value: "45K" }
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <Badge variant="secondary">{item.value}</Badge>
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

export default AdminDashboard;
