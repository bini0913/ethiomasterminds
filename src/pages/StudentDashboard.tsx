import { db } from "@/integrations/untypedClient";
import React, { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useFriends } from '@/context/FriendsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trophy, 
  BookOpen, 
  Users, 
  Target, 
  Star, 
  Award,
  TrendingUp,
  Calendar,
  Play,
  Brain,
  Zap,
  Gamepad2,
  Flame,
  MessageCircle,
  Settings,
  LogOut,
  CheckCircle,
  Gift,
  Bot,
  GraduationCap
} from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import CurrencyDisplay from '@/components/currency/CurrencyDisplay';
import { toast } from 'sonner';

interface DailyMission {
  id: string;
  title: string;
  description: string;
  progress: number;
  targetValue: number;
  rewardXp: number;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
}

interface TodayStats {
  quizzesCompleted: number;
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
}

interface OnlineFriend {
  id: string;
  name: string;
  avatar: string;
  level: number;
  online: boolean;
}

const UpperDesktopDashboard: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Array<{subject:string;topic:string;accuracy:number}>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let alive = true;
    db.from("topic_progress").select("subject,topic,accuracy_percentage,questions_attempted").eq("user_id", user.id)
      .then(({data}) => {
        if (!alive) return;
        setTopics((data || []).filter((r:any) => r.topic && Number(r.questions_attempted)>0)
          .map((r:any) => ({subject:String(r.subject || "General"),topic:String(r.topic),accuracy:Number(r.accuracy_percentage)||0}))
          .sort((x,y)=>x.accuracy-y.accuracy).slice(0,6));
        setLoading(false);
      }, ()=>{ if(alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id]);
  const xp = Number((user as any)?.xp) || 0;
  const streak = Number((user as any)?.streak ?? (user as any)?.dayStreak);
  const nav = [
    ["Home", "⌂", "/"], ["Drills", "ϟ", "/quiz"], ["Question bank", "▤", "/academic/entrance-papers"],
    ["Mock tests", "▣", "/academic/exam"], ["Study plan", "▦", "/academic/planner"], ["Vocabulary", "✣", "/academic/flashcards"],
    ["Courses", "▰", "/library"], ["Classroom", "♙", "/study-mode"], ["Leaderboard", "▥", "/leaderboard"],
    ["AI tutor", "♧", "/ai-tutor"], ["Discord", "☻", "/friends"]
  ] as const;
  const schedule = [
    {kind:"Drill", title:"Text Structure and Purpose", color:"pink", path:"/quiz"},
    {kind:"Vocabulary", title:"Review your due flashcards", color:"orange", path:"/academic/flashcards"},
    {kind:"Quiz", title:"Practice your selected exam subjects", color:"blue", path:"/academic/exam"}
  ];
  return <div className="mm-exact-desktop">
    <aside className="mm-exact-sidebar">
      <div className="mm-exact-brand"><span className="mm-exact-logo">◉</span><strong>{user?.name?.split(/\\s+/)[0] || "Master Minds"}</strong><span className="mm-exact-collapse">«</span></div>
      <nav>{nav.map(([label,icon,path],i)=><button key={label} data-active={i===0} onClick={()=>navigate(path)}><span>{icon}</span>{label}</button>)}</nav>
      <button className="mm-exact-settings" onClick={()=>navigate("/settings")}>⬡ <span>Settings &amp; more</span></button>
    </aside>
    <section className="mm-exact-main">
      <header className="mm-exact-top"><span className="mm-exact-pill">🔷 {xp.toLocaleString()}</span><div><span className="mm-exact-pill">🔥 {Number.isFinite(streak) && streak>0 ? streak : "—"}</span><button aria-label="Notifications" onClick={()=>navigate("/notifications")}>♧</button></div></header>
      <div className="mm-exact-grid">
        <div className="mm-exact-primary">
          <div className="mm-exact-topcards">
            <section className="mm-exact-card mm-exact-score"><div className="mm-exact-card-title">Target score <button aria-label="Edit target score" onClick={()=>navigate("/academic/setup")}>↗</button></div><strong>—</strong><small>Set your target in Academic Preparation</small><div className="mm-exact-scorebar"><span /></div><div className="mm-exact-scorefoot">Your recorded results appear here when available.</div><button className="mm-exact-link" onClick={()=>navigate("/academic/insights")}>View academic insights</button></section>
            <section className="mm-exact-card mm-exact-radar"><div className="mm-exact-card-title">Progress radar <span>R&amp;W&nbsp;&nbsp; Math</span></div><div className="mm-exact-radar-body"><svg viewBox="0 0 200 160" role="img" aria-label="Progress radar based on recorded topic performance"><g fill="none" stroke="#eadcf9" strokeWidth="1">{[25,45,65].map(r=><polygon key={r} points={`100,${80-r} ${100+r*.95},${80-r*.3} ${100+r*.6},${80+r*.8} ${100-r*.6},${80+r*.8} ${100-r*.95},${80-r*.3}`} />)}<path d="M100 15V145 M35 60L165 100 M35 100L165 60" /></g><polygon points={topics.length ? topics.slice(0,5).map((t,i)=>{const ang=(-90+i*72)*Math.PI/180; const r=20+Math.min(1,t.accuracy/100)*45; return `${100+Math.cos(ang)*r},${80+Math.sin(ang)*r}`}).join(" ") : "100,40 138,65 123,112 77,112 62,65"} fill="#a855f7" fillOpacity=".18" stroke="#a855f7" strokeWidth="2"/></svg><div className="mm-exact-radar-labels"><span>Recorded topics</span><span>{loading?"Loading…":topics.length ? `${topics.length} tracked` : "No data yet"}</span></div></div></section>
          </div>
          <section className="mm-exact-card mm-exact-schedule"><div className="mm-exact-card-title">Today's schedule <button aria-label="Open study planner" onClick={()=>navigate("/academic/planner")}>↗</button></div>{schedule.map(s=><button className={`mm-exact-task ${s.color}`} key={s.kind} onClick={()=>navigate(s.path)}><small>{s.kind}</small><strong>{s.title}</strong></button>)}</section>
          <section className="mm-exact-card mm-exact-performance"><div className="mm-exact-card-title">Topic performance <button onClick={()=>navigate("/academic/topics")}>View all ↗</button></div>{loading?<p>Loading saved topic performance…</p>:topics.length?<div className="mm-exact-topicgrid">{topics.map(t=><button key={t.subject+t.topic} onClick={()=>navigate("/academic/topics")}><strong>{t.topic}</strong><span>{t.subject}</span><b>{t.accuracy}%</b><i><em style={{width:`${Math.max(0,Math.min(100,t.accuracy))}%`}} /></i></button>)}</div>:<p>No topic results recorded yet. Complete practice to build your performance view.</p>}</section>
        </div>
        <aside className="mm-exact-right">
          <section className="mm-exact-card mm-exact-streak"><div className="mm-exact-big">🔥 {Number.isFinite(streak)&&streak>0?streak:"—"}</div><small>Day streak</small><div className="mm-exact-week">{["MO","TU","WE","TH","FR","SA","SU"].map(d=><span key={d}>{d}</span>)}</div><button className="mm-exact-link" onClick={()=>navigate("/study-mode")}>Start today's study session</button></section>
          <section className="mm-exact-card mm-exact-xp"><div className="mm-exact-big blue">🔷 {xp.toLocaleString()}</div><small>XP (Experience Points)</small><div className="mm-exact-rank"><span>Your ranking</span><strong>—</strong><span>Ranking appears when leaderboard data is available.</span></div><button className="mm-exact-outline" onClick={()=>navigate("/leaderboard")}>See full leaderboard</button></section>
          <section className="mm-exact-card mm-exact-countdown"><div className="mm-exact-calendar">🗓️</div><strong>Exam countdown</strong><p>No exam date set</p><button className="mm-exact-outline" onClick={()=>navigate("/academic/setup")}>Set exam details</button></section>
        </aside>
      </div>
    </section>
  </div>;
};

const StudentDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const { coins, gems } = useCurrency();
  const { unlockedBadges } = useAchievements();
  const { friends } = useFriends();
  const navigate = useNavigate();

  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    quizzesCompleted: 0,
    correctAnswers: 0,
    totalQuestions: 0,
    xpEarned: 0
  });
  const [streak, setStreak] = useState(0);
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignedLearning, setAssignedLearning] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTodayStats(),
        fetchDailyMissions(),
        fetchStreak(),
        fetchOnlineFriends(),
        fetchAssignedLearning()
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedLearning = async () => {
    if (!user?.id) return;
    const { data: memberships, error: membershipError } = await db
      .from("class_students").select("class_id").eq("student_id", user.id);
    if (membershipError) { console.error("Could not load class memberships:", membershipError); return; }
    const classIds = Array.from(new Set((memberships ?? []).map((row: any) => row.class_id).filter(Boolean)));
    let query = db.from("quiz_assignments")
      .select("id,quiz_id,class_id,student_id,due_date,created_at,quizzes(title,subject),classes(name,grade)")
      .order("created_at", { ascending: false }).limit(8);
    query = classIds.length
      ? query.or(`student_id.eq.${user.id},class_id.in.(${classIds.join(",")})`)
      : query.eq("student_id", user.id);
    const { data, error } = await query;
    if (error) { console.error("Could not load teacher assignments:", error); return; }
    setAssignedLearning((data ?? []) as any[]);
  };

  const fetchTodayStats = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await db
      .from('quiz_results')
      .select('score, correct_answers, total_questions, xp_earned')
      .eq('student_id', user.id)
      .gte('completed_at', today.toISOString());

    if (!error && data) {
      const stats = data.reduce((acc, result) => ({
        quizzesCompleted: acc.quizzesCompleted + 1,
        correctAnswers: acc.correctAnswers + result.correct_answers,
        totalQuestions: acc.totalQuestions + result.total_questions,
        xpEarned: acc.xpEarned + (result.xp_earned || 0)
      }), { quizzesCompleted: 0, correctAnswers: 0, totalQuestions: 0, xpEarned: 0 });

      setTodayStats(stats);
    }
  };

  const fetchDailyMissions = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    const { data: userMissions, error } = await db
      .from('user_missions')
      .select(`
        id,
        progress,
        completed,
        claimed,
        daily_missions!inner(
          id,
          title,
          description,
          target_value,
          reward_xp,
          reward_coins,
          mission_type
        )
      `)
      .eq('user_id', user.id)
      .eq('mission_date', today);

    if (!error && userMissions) {
      const missions: DailyMission[] = userMissions.map((um: any) => ({
        id: um.id,
        title: um.daily_missions.title,
        description: um.daily_missions.description,
        progress: um.progress,
        targetValue: um.daily_missions.target_value,
        rewardXp: um.daily_missions.reward_xp || 0,
        rewardCoins: um.daily_missions.reward_coins || 0,
        completed: um.completed || false,
        claimed: um.claimed || false,
      }));
      setDailyMissions(missions);
      return;
    }

    // Assignment is server-controlled. Do not insert missions from the browser.
    const { error: assignError } = await supabase.functions.invoke('daily-missions', {
      body: { action: 'assign', userId: user.id },
    });

    if (assignError) {
      console.error('Daily mission assignment failed:', assignError);
      return;
    }

    await fetchDailyMissions();
  };

  const fetchStreak = async () => {
    if (!user) return;

    const { data, error } = await db
      .from('user_streaks')
      .select('current_streak, longest_streak')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setStreak(data.current_streak || 0);
    }
  };

  const fetchOnlineFriends = async () => {
    if (!user) return;

    // Get accepted friends
    const { data: friendsList, error } = await db
      .from('friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    if (!error && friendsList) {
      const friendIds = friendsList.map(f => f.friend_id);
      
      if (friendIds.length > 0) {
        // Get profiles with online status
        const { data: profiles } = await db
          .from('profiles')
          .select(`
            id,
            name,
            avatar,
            level,
            user_presence!inner(status, last_seen)
          `)
          .in('id', friendIds);

        if (profiles) {
          const onlineList = profiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar || 'avatar-1',
            level: p.level || 1,
            online: p.user_presence?.status === 'online' && 
              new Date(p.user_presence?.last_seen).getTime() > Date.now() - 5 * 60 * 1000
          })).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
          
          setOnlineFriends(onlineList.slice(0, 5));
        }
      }
    }
  };

  const claimMissionReward = async (mission: DailyMission) => {
    if (!mission.completed || mission.claimed) return;

    const { data, error } = await supabase.functions.invoke('daily-missions', {
      body: { action: 'claim', missionId: mission.id, userId: user.id },
    });

    if (!error && data?.success) {
      toast.success(`Claimed ${data.xp_awarded ?? mission.rewardXp} XP + ${data.coins_awarded ?? mission.rewardCoins} coins!`);
      await fetchDailyMissions();
    } else if (error) {
      toast.error('Unable to claim this mission reward yet.');
    }
  };

  const getRankInfo = (level: number) => {
    if (level < 5) return { title: "Rookie", icon: "🌱", color: "from-slate-500 to-slate-600" };
    if (level < 10) return { title: "Thinker", icon: "💭", color: "from-blue-500 to-blue-600" };
    if (level < 20) return { title: "Master", icon: "🎓", color: "from-primary to-accent" };
    if (level < 35) return { title: "Grand Master", icon: "👑", color: "from-amber-500 to-orange-600" };
    return { title: "Legend", icon: "⚡", color: "from-pink-500 to-rose-600" };
  };

  const rank = getRankInfo(user?.level || 1);
  const xpForNextLevel = (user?.level || 1) * 100;
  const currentXP = user?.xp || 0;
  const xpProgress = Math.min((currentXP / xpForNextLevel) * 100, 100);
  const accuracy = todayStats.totalQuestions > 0 
    ? Math.round((todayStats.correctAnswers / todayStats.totalQuestions) * 100) 
    : 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const isUpperTier = Number(String(user?.grade ?? "").match(/\d+/)?.[0] || 0) >= 9;

  return (
    <>
      {isUpperTier && <UpperDesktopDashboard />}
      <div className={isUpperTier ? "upper-current-dashboard" : ""}>
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />

      <div className="relative z-10">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo & User */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-xl font-display font-bold text-white">MM</span>
                </div>
                <div>
                  <h1 className="text-lg font-display font-bold text-foreground">
                    Welcome, {user?.name || "Student"}!
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{rank.icon}</span>
                    <span className="text-sm text-muted-foreground">{rank.title}</span>
                  </div>
                </div>
              </div>

              {/* Currency & Actions */}
              <div className="flex items-center gap-3">
                <CurrencyDisplay showBoth />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/settings')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <motion.main
          className="container mx-auto px-4 py-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Card className="border-blue-200/70 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-card">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><GraduationCap className="h-5 w-5 text-blue-600" /> Assignments from your teachers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {assignedLearning.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Your teacher assignments will appear here when a quiz is assigned to one of your classes.</p>
                ) : assignedLearning.map((item: any) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{item.quizzes?.title || "Assigned quiz"}</p>
                      <p className="text-xs text-muted-foreground">{item.quizzes?.subject || "Learning activity"}{item.classes?.name ? ` · ${item.classes.name}` : ""}{item.due_date ? ` · Due ${new Date(item.due_date).toLocaleDateString()}` : ""}</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(item.quizzes?.subject ? `/quiz?subject=${encodeURIComponent(item.quizzes.subject)}` : "/quiz")}>Open Quiz Center</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* XP Progress Section */}
          <motion.div variants={itemVariants}>
            <Card className="glass border-primary/20 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${rank.color} flex items-center justify-center shadow-lg`}>
                      <span className="text-3xl">{rank.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-display font-bold text-foreground">
                          Level {user?.level || 1}
                        </span>
                        <Badge className={`bg-gradient-to-r ${rank.color} text-white border-0`}>
                          {rank.title}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {currentXP} / {xpForNextLevel} XP to next level
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-xl">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="font-display font-bold text-orange-500">{streak} Day Streak</span>
                  </div>
                </div>
                <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 xp-bar rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Star, label: "Level", value: user?.level || 1, color: "from-primary to-accent" },
              { icon: Zap, label: "Today's XP", value: `+${todayStats.xpEarned}`, color: "from-secondary to-glow-cyan" },
              { icon: Target, label: "Accuracy", value: `${accuracy}%`, color: "from-glow-green to-emerald-500" },
              { icon: Award, label: "Badges", value: unlockedBadges.length, color: "from-accent to-glow-pink" }
            ].map((stat, i) => (
              <Card key={i} className="glass border-border/30 card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <Card className="glass border-border/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {[
                    { icon: BookOpen, label: "Start Quiz", path: "/quiz", gradient: "from-primary to-accent" },
                    { icon: Users, label: "Multiplayer", path: "/lobby", gradient: "from-secondary to-glow-cyan" },
                    { icon: Bot, label: "AI Tutor", path: "/ai-tutor", gradient: "from-primary to-accent" },
                    { icon: Brain, label: "My Learning", path: "/learning-dna", gradient: "from-pink-500 to-rose-500" },
                    { icon: Trophy, label: "Leaderboard", path: "/leaderboard", gradient: "from-glow-yellow to-orange-500" },
                    { icon: Gift, label: "Store", path: "/store", gradient: "from-primary to-accent" }
                  ].map((action, i) => (
                    <motion.div key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        onClick={() => navigate(action.path)}
                        className={`w-full h-20 flex-col gap-2 bg-gradient-to-br ${action.gradient} border-0 rounded-xl shadow-lg hover:shadow-xl transition-shadow`}
                      >
                        <action.icon className="h-6 w-6" />
                        <span className="text-sm font-display">{action.label}</span>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Daily Missions */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Daily Missions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dailyMissions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6">
                        No daily missions yet. Complete quizzes to unlock missions!
                      </p>
                    ) : (
                      dailyMissions.map((mission) => (
                        <div key={mission.id} className={`p-4 rounded-xl ${mission.completed ? 'bg-glow-green/10 border border-glow-green/30' : 'bg-muted/30'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">{mission.title}</span>
                            {mission.completed && !mission.claimed ? (
                              <Button 
                                size="sm" 
                                onClick={() => claimMissionReward(mission)}
                                className="bg-glow-green hover:bg-glow-green/80 text-background gap-1"
                              >
                                <Gift className="h-3 w-3" />
                                Claim
                              </Button>
                            ) : mission.claimed ? (
                              <Badge className="bg-glow-green/20 text-glow-green border-0">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Claimed
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                +{mission.rewardXp} XP, +{mission.rewardCoins} 🪙
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={(mission.progress / mission.targetValue) * 100} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">
                              {mission.progress}/{mission.targetValue}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Today's Performance */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Brain className="h-5 w-5 text-accent" />
                      Today's Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Quizzes", value: todayStats.quizzesCompleted, icon: "📚" },
                        { label: "Correct", value: `${todayStats.correctAnswers}/${todayStats.totalQuestions}`, icon: "✅" },
                        { label: "XP Earned", value: `+${todayStats.xpEarned}`, icon: "⚡" }
                      ].map((stat, i) => (
                        <div key={i} className="text-center p-4 bg-muted/30 rounded-xl">
                          <span className="text-2xl mb-2 block">{stat.icon}</span>
                          <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Avatar Card */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30 overflow-hidden">
                  <div className="bg-gradient-to-br from-primary/20 to-accent/20 p-6 text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent p-1">
                      <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-4xl">
                        {user?.avatar || "🧑‍🎓"}
                      </div>
                    </div>
                    <h3 className="mt-3 font-display font-bold text-lg text-foreground">
                      {user?.name || "Student"}
                    </h3>
                    <p className="text-sm text-muted-foreground">Grade {user?.grade || 5}</p>
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full border-primary/30 hover:bg-primary/10"
                        onClick={() => navigate('/store')}
                      >
                        Customize Avatar
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => navigate('/library')}
                      >
                        Open Library
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Grade 9–12 Academic Prep hub */}
              {Number(String(user?.grade ?? "").match(/\d+/)?.[0] || 0) >= 9 && (
                <motion.div variants={itemVariants}>
                  <Card className="glass border-border/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-lg flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        Academic Prep
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Your Grade 9–12 study tools, connected in one place.</p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2">
                      <Button className="min-h-11 justify-start" onClick={() => navigate('/academic')}>
                        <Target className="mr-2 h-4 w-4" /> Study hub
                      </Button>
                      <Button variant="outline" className="min-h-11 justify-start" onClick={() => navigate('/library')}>
                        <BookOpen className="mr-2 h-4 w-4" /> Library
                      </Button>
                      <Button variant="outline" className="min-h-11 justify-start" onClick={() => navigate('/learning-dna')}>
                        <Brain className="mr-2 h-4 w-4" /> Learning DNA
                      </Button>
                      <Button variant="outline" className="min-h-11 justify-start" onClick={() => navigate('/multiplayer')}>
                        <Gamepad2 className="mr-2 h-4 w-4" /> Multiplayer
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Recent Achievements */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-glow-yellow" />
                      Recent Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {unlockedBadges.length > 0 ? (
                      <div className="space-y-2">
                        {unlockedBadges.slice(0, 3).map((badge, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                            <span className="text-2xl">{badge.icon}</span>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground">{badge.name}</p>
                              <p className="text-xs text-muted-foreground">{badge.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-6">
                        Complete quizzes to earn badges! 🏆
                      </p>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full mt-3 text-primary"
                      onClick={() => navigate(user?.id ? `/profile/${user.id}` : '/settings')}
                    >
                      View All Achievements
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Friends Online */}
              <motion.div variants={itemVariants}>
                <Card className="glass border-border/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-secondary" />
                      Friends Online
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {onlineFriends.length > 0 ? (
                      <div className="space-y-2">
                        {onlineFriends.map((friend) => (
                          <div key={friend.id} className="flex items-center gap-3 p-2">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                                <span className="text-lg">{friend.avatar || '👤'}</span>
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${friend.online ? 'bg-glow-green' : 'bg-muted'}`} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground">{friend.name}</p>
                              <p className="text-xs text-muted-foreground">Level {friend.level}</p>
                            </div>
                            <Button size="sm" variant="ghost" className="text-primary">
                              <Gamepad2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-6">
                        Add friends to see them here!
                      </p>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full mt-3 text-primary"
                      onClick={() => navigate('/friends')}
                    >
                      View All Friends
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </motion.main>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground">
          Created by Biniam Bogale • Master Minds
        </footer>
      </div>
    </div>
      </div>
    </>
  );
};

export default StudentDashboard;
