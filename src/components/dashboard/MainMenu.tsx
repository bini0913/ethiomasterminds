import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAchievements } from "@/context/AchievementsContext";
import UserLevel from "../profile/UserLevel";
import { motion } from "framer-motion";
import { useAIHelper } from "@/context/AIHelperContext";
import {
  Bot, BookOpen, Trophy, Users, Settings, GraduationCap,
  Gamepad, Store, Award, Zap, Target, LogOut, Sparkles, Compass, Timer
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import LevelUpModal from "../profile/LevelUpModal";
import CurrencyDisplay from "@/components/currency/CurrencyDisplay";
import { supabase } from "@/integrations/supabase/client";

const HOME_ONBOARDING_STORAGE_KEY = "home_onboarding_completed_v1";

type GuideStep = {
  selector: string;
  title: string;
  description: string;
};

const MainMenu: React.FC = () => {
  const { user, logout, showLevelUp, setShowLevelUp, previousLevel } = useUser();
  useCurrency();
  const { getRecentBadges } = useAchievements();
  const { openHelper } = useAIHelper();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState("all");

  const [guideStepIndex, setGuideStepIndex] = useState<number>(-1);
  const [guideTargetRect, setGuideTargetRect] = useState<DOMRect | null>(null);
  const [isGuidePaused, setIsGuidePaused] = useState(false);
  const isGuideVisible = guideStepIndex >= 0;
  const highlightRef = useRef<HTMLElement | null>(null);

  const recentBadges = getRecentBadges();

  const categories = [
    { id: "all", name: t("all"), icon: <Sparkles className="h-3 w-3" /> },
    { id: "play", name: t("play"), icon: <Gamepad className="h-3 w-3" /> },
    { id: "learn", name: t("learn"), icon: <BookOpen className="h-3 w-3" /> },
    { id: "compete", name: t("compete"), icon: <Trophy className="h-3 w-3" /> },
    { id: "social", name: t("social"), icon: <Users className="h-3 w-3" /> }
  ];

  const quickActions = [
    { title: t("quick-play"), icon: <Zap className="h-5 w-5" />, path: "/quiz", color: "from-yellow-500 to-orange-500", description: t("jump-into-quiz") },
    { title: t("1v1-battle"), icon: <Target className="h-5 w-5" />, path: "/multiplayer", color: "from-red-500 to-pink-500", description: t("challenge-player") },
    { title: t("join-lobby"), icon: <Users className="h-5 w-5" />, path: "/lobby", color: "from-green-500 to-emerald-500", description: t("find-matches") },
  ];

  const menuItems = [
    { title: t("quiz"), icon: <GraduationCap className="h-6 w-6" />, path: "/quiz", category: "learn", color: "from-indigo-500 to-purple-600", description: t("test-knowledge"), guideId: "feature-quiz" },
    { title: t("multiplayer"), icon: <Users className="h-6 w-6" />, path: "/multiplayer", category: "play", color: "from-blue-500 to-cyan-600", description: t("compete-friends"), guideId: "feature-multiplayer" },
    { title: t("game-lobby"), icon: <Gamepad className="h-6 w-6" />, path: "/lobby", category: "play", color: "from-green-400 to-emerald-500", description: t("join-matches-chat") },
    { title: t("leaderboard"), icon: <Trophy className="h-6 w-6" />, path: "/leaderboard", category: "compete", color: "from-yellow-500 to-amber-600", description: t("see-whos-top"), guideId: "feature-leaderboard" },
    { title: t("ai-tutor"), icon: <Bot className="h-6 w-6" />, path: "/ai-tutor", category: "learn", color: "from-violet-500 to-purple-600", description: t("24-7-ai-helper") },
    { title: "Study Mode", icon: <Timer className="h-6 w-6" />, path: "/study-mode", category: "learn", color: "from-indigo-500 to-blue-600", description: "Focus timer, streaks, and study competitions", guideId: "feature-study-mode" },
    { title: "Library", icon: <BookOpen className="h-6 w-6" />, path: "/library", category: "social", color: "from-emerald-500 to-teal-600", description: "Read books with AI tools" },
    { title: t("social-feed"), icon: <Compass className="h-6 w-6" />, path: "/social", category: "social", color: "from-sky-500 to-blue-600", description: t("posts-updates"), guideId: "feature-social-feed" },
    { title: t("friends"), icon: <Users className="h-6 w-6" />, path: "/friends", category: "social", color: "from-teal-500 to-cyan-600", description: t("connect-chat") },
    { title: t("tournaments"), icon: <Award className="h-6 w-6" />, path: "/tournaments", category: "compete", color: "from-orange-500 to-red-600", description: t("global-competitions"), guideId: "feature-tournaments" },
    { title: t("avatar-store"), icon: <Store className="h-6 w-6" />, path: "/store", category: "social", color: "from-purple-500 to-pink-600", description: t("customize-look") },
    { title: t("settings"), icon: <Settings className="h-6 w-6" />, path: "/settings", category: "all", color: "from-gray-500 to-slate-600", description: t("preferences") },
  ];

  const filteredItems = menuItems.filter(item => activeCategory === "all" || item.category === activeCategory);

  const guideSteps: GuideStep[] = useMemo(() => ([
    { selector: '[data-guide="profile-header"]', title: "Your Profile", description: "This shows your level, XP, and progress. Level up by playing and studying." },
    { selector: '[data-guide="quick-actions"]', title: "Quick Actions", description: "Start instantly, challenge a friend, or join a live lobby." },
    { selector: '[data-guide="academic-mode"]', title: "Academic Mode", description: "Access flashcards, study tools, and exam preparation." },
    { selector: '[data-guide="feature-quiz"]', title: "Quiz", description: "Test your knowledge and earn XP." },
    { selector: '[data-guide="feature-multiplayer"]', title: "Multiplayer", description: "Play against real students in real time." },
    { selector: '[data-guide="feature-leaderboard"]', title: "Leaderboard", description: "Compete and climb to the top each season." },
    { selector: '[data-guide="feature-study-mode"]', title: "Study Mode", description: "Track your focus time and improve consistency." },
    { selector: '[data-guide="feature-social-feed"]', title: "Community", description: "See posts, updates, and interact with other students." },
    { selector: '[data-guide="feature-tournaments"]', title: "Tournaments", description: "Join competitions and win rewards." },
    { selector: '[data-guide="bottom-nav"]', title: "Navigation", description: "Use this to move between sections anytime." },
  ]), []);

  const markGuideCompleted = useCallback(async () => {
    localStorage.setItem(HOME_ONBOARDING_STORAGE_KEY, "true");
    if (!user?.id) return;
    await supabase.from("user_onboarding_states" as any).upsert({
      user_id: user.id,
      home_completed: true,
      updated_at: new Date().toISOString(),
    });
  }, [user?.id]);

  const runStep = useCallback((stepIndex: number) => {
    if (stepIndex >= guideSteps.length) {
      setGuideStepIndex(-1);
      setGuideTargetRect(null);
      setIsGuidePaused(false);
      markGuideCompleted();
      return;
    }

    const target = document.querySelector(guideSteps[stepIndex].selector) as HTMLElement | null;
    if (!target) {
      runStep(stepIndex + 1);
      return;
    }

    highlightRef.current = target;
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setTimeout(() => {
      setGuideTargetRect(target.getBoundingClientRect());
      setGuideStepIndex(stepIndex);
    }, 220);
  }, [guideSteps, markGuideCompleted]);

  const endGuide = useCallback(() => {
    setGuideStepIndex(-1);
    setGuideTargetRect(null);
    setIsGuidePaused(false);
    markGuideCompleted();
  }, [markGuideCompleted]);

  useEffect(() => {
    if (!user || localStorage.getItem(HOME_ONBOARDING_STORAGE_KEY) === "true") return;

    let alive = true;
    const startGuide = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!alive) return;
      runStep(0);
    };

    startGuide();
    return () => {
      alive = false;
    };
  }, [runStep, user]);

  useEffect(() => {
    if (!isGuideVisible || isGuidePaused) return;

    const syncRect = () => {
      const target = highlightRef.current;
      if (!target) return;
      setGuideTargetRect(target.getBoundingClientRect());
    };

    syncRect();
    const observer = new MutationObserver(syncRect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [isGuidePaused, isGuideVisible]);

  useEffect(() => {
    const onVisibility = () => {
      if (!isGuideVisible) return;
      if (document.visibilityState === "hidden") {
        setIsGuidePaused(true);
        return;
      }
      setIsGuidePaused(false);
      runStep(guideStepIndex);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [guideStepIndex, isGuideVisible, runStep]);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary via-primary to-indigo-600 px-4 py-3 shadow-xl">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <motion.div className="bg-white/20 backdrop-blur-sm rounded-xl p-2" whileHover={{ rotate: 360 }} transition={{ duration: 0.8 }}>
              <span className="text-2xl">🧠</span>
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-white">Master Minds</h1>
              <p className="text-xs text-white/70">{t("learn-play-win")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyDisplay />
            <Button variant="ghost" size="icon" onClick={openHelper} className="text-white hover:bg-white/20"><Bot className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" onClick={logout} className="text-white hover:bg-white/20"><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      {user && (
        <div className="px-4 py-4 max-w-7xl mx-auto w-full" data-guide="profile-header">
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-border/50">
            <div className="flex items-center gap-4">
              <div className="relative">
                <AvatarRenderer avatar={user.avatar} avatarConfig={user.avatarConfig} size="lg" className="rounded-2xl" />
                <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">Lv.{user.level}</div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{user.name}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="capitalize">{t(user.role)}</span>
                  <span>•</span>
                  <span>{t("grade")} {user.grade || 'N/A'}</span>
                </div>
                <div className="mt-1"><UserLevel level={user.level} xp={user.xp} showBadge={false} /></div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1">
                {recentBadges.slice(0, 3).map((badge, i) => (<span key={i} className="text-xl">{badge.icon}</span>))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="px-4 max-w-7xl mx-auto w-full" data-guide="quick-actions">
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action, index) => (
            <motion.div key={action.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Link to={action.path}>
                <Card className={`bg-gradient-to-br ${action.color} border-0 overflow-hidden group cursor-pointer`}>
                  <CardContent className="p-3 text-center text-white">
                    <div className="mx-auto mb-1 group-hover:scale-110 transition-transform">{action.icon}</div>
                    <div className="text-xs font-semibold">{action.title}</div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {user && parseInt(user.grade || "0") >= 5 && parseInt(user.grade || "0") <= 12 && (
        <div className="px-4 py-4 max-w-7xl mx-auto w-full" data-guide="academic-mode">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/academic">
              <Card className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 border-0 overflow-hidden group cursor-pointer hover:shadow-2xl transition-all">
                <CardContent className="p-4 flex items-center gap-4 text-white">
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📘</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base">{t("academic-mode")}</h3>
                    <p className="text-xs text-white/60">{t("flashcards")} • {t("topic-coverage")} • {t("exam-mode")} • {t("study-planner")}</p>
                  </div>
                  <div className="bg-white/10 rounded-full p-2"><GraduationCap className="h-5 w-5" /></div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      )}

      <div className="px-4 pb-2 max-w-7xl mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
          {categories.map(category => (
            <Button key={category.id} variant={activeCategory === category.id ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(category.id)}
              className={`whitespace-nowrap gap-1.5 ${activeCategory === category.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-card/50 hover:bg-card"}`}>
              {category.icon}{category.name}
            </Button>
          ))}
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex-1 px-4 pb-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <motion.div key={item.path + item.title} variants={itemVariants} data-guide={item.guideId}>
              <Link to={item.path}>
                <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform shadow-lg`}>{item.icon}</div>
                    <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <footer className="px-4 py-4 text-center border-t border-border/50 bg-card/30">
        <p className="text-xs text-muted-foreground">{t("app-version")} • {t("created-by")} Biniam Bogale, Ethiopia</p>
        <p className="text-xs text-muted-foreground mt-1">{t("contact")}: +251978744724</p>
      </footer>

      {showLevelUp && user && (<LevelUpModal previousLevel={previousLevel} newLevel={user.level} onClose={() => setShowLevelUp(false)} />)}

      {isGuideVisible && !isGuidePaused && guideTargetRect && (
        <div className="fixed inset-0 z-[110]">
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="home-guide-highlight"
            style={{
              top: guideTargetRect.top - 8,
              left: guideTargetRect.left - 8,
              width: guideTargetRect.width + 16,
              height: guideTargetRect.height + 16,
            }}
          />
          <div
            className="absolute w-[min(92vw,360px)] rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl"
            style={{
              top: Math.min(Math.max(guideTargetRect.bottom + 14, 16), window.innerHeight - 190),
              left: Math.min(Math.max(guideTargetRect.left, 12), window.innerWidth - 372),
            }}
          >
            <p className="text-sm font-semibold text-primary">{guideSteps[guideStepIndex]?.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{guideSteps[guideStepIndex]?.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{guideStepIndex + 1}/{guideSteps.length}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={endGuide}>Skip</Button>
                <Button size="sm" onClick={() => runStep(guideStepIndex + 1)}>Next</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGuidePaused && isGuideVisible && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <Card className="p-4 border-primary/40 bg-card/95">
            <CardContent className="p-0 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Tutorial paused while app is in background.</p>
              <Button size="sm" onClick={() => setIsGuidePaused(false)}>Resume</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
