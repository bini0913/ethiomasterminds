import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAchievements } from "@/context/AchievementsContext";
import UserLevel from "../profile/UserLevel";
import { motion } from "framer-motion";
import { useAIHelper } from "@/context/AIHelperContext";
import {
  Bot, BookOpen, Trophy, Users, Settings, GraduationCap,
  Gamepad, Store, Award, Zap, Target, LogOut, Sparkles, Compass, Timer, ArrowRight, Flame
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import LevelUpModal from "../profile/LevelUpModal";
import CurrencyDisplay from "@/components/currency/CurrencyDisplay";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/layout/ThemeToggle";

const HOME_ONBOARDING_STORAGE_KEY = "home_onboarding_completed_v1";

type GuideStep = {
  selector: string;
  title: string;
  description: string;
};

const MainMenu: React.FC = () => {
  const { user, logout, showLevelUp, setShowLevelUp, previousLevel } = useUser();
  const tier = useTier();
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
    ...(tier === "early" ? [] : [
      { title: t("social-feed"), icon: <Compass className="h-6 w-6" />, path: "/social", category: "social", color: "from-sky-500 to-blue-600", description: t("posts-updates"), guideId: "feature-social-feed" },
      { title: t("friends"), icon: <Users className="h-6 w-6" />, path: "/friends", category: "social", color: "from-teal-500 to-cyan-600", description: t("connect-chat") },
    ]),
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-20">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-xl shadow-lg shadow-primary/20" whileHover={{ rotate: 12 }}>
              🧠
            </motion.div>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">Master Minds</h1>
              <p className="text-xs text-muted-foreground">{t("learn-play-win")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <CurrencyDisplay />
            <ThemeToggle className="h-9 w-9" />
            <Button variant="ghost" size="icon" onClick={openHelper} className="h-9 w-9" aria-label="Open AI helper"><Bot className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="Log out"><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {user && (
            <motion.section variants={itemVariants} data-guide="profile-header" className="col-span-2 overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm md:col-span-2 md:p-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <AvatarRenderer avatar={user.avatar} avatarConfig={user.avatarConfig} size="lg" className="rounded-2xl" />
                  <span className="absolute -bottom-2 -right-2 rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">Lv. {user.level}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Welcome back</p>
                  <h2 className="truncate text-2xl font-display font-bold">{user.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground capitalize">{t(user.role)} · {t("grade")} {user.grade || "N/A"}</p>
                  <div className="mt-4"><UserLevel level={user.level} xp={user.xp} showBadge={false} /></div>
                </div>
              </div>
              {recentBadges.length > 0 && <div className="mt-5 flex items-center gap-2 border-t border-border pt-4"><Award className="h-4 w-4 text-warning" /><span className="text-sm text-muted-foreground">Recent wins</span><div className="ml-auto flex gap-1">{recentBadges.slice(0, 3).map((badge, i) => <span key={i} className="text-lg">{badge.icon}</span>)}</div></div>}
            </motion.section>
          )}

          <motion.section variants={itemVariants} data-guide="quick-actions" className="col-span-2 row-span-2 overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/20 md:col-span-2 md:p-8">
            <div className="flex h-full flex-col items-start">
              <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-widest">Quick start</span>
              <div className="mt-6">
                <Zap className="h-8 w-8" />
                <h2 className="mt-3 text-3xl font-display font-bold sm:text-4xl">{t("quick-play")}</h2>
                <p className="mt-2 max-w-sm text-sm text-primary-foreground/80 sm:text-base">{t("jump-into-quiz")}</p>
              </div>
              <Link to="/quiz" className="mt-auto pt-8">
                <Button size="lg" className="gap-2 rounded-xl bg-primary-foreground px-5 font-bold text-primary hover:bg-primary-foreground/90">{t("start-quiz")} <ArrowRight className="h-5 w-5" /></Button>
              </Link>
            </div>
          </motion.section>

          <motion.div variants={itemVariants} className="col-span-1">
            <Link to="/multiplayer" className="block h-full">
              <Card className="group h-full rounded-3xl border-border bg-card transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"><CardContent className="flex h-full min-h-40 flex-col justify-between p-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Target className="h-5 w-5" /></span><div><h3 className="text-base font-display font-bold">{t("1v1-battle")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("challenge-player")}</p></div></CardContent></Card>
            </Link>
          </motion.div>
          <motion.div variants={itemVariants} className="col-span-1">
            <Link to="/lobby" className="block h-full">
              <Card className="group h-full rounded-3xl border-border bg-card transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"><CardContent className="flex h-full min-h-40 flex-col justify-between p-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success text-success-foreground"><Users className="h-5 w-5" /></span><div><h3 className="text-base font-display font-bold">{t("join-lobby")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("find-matches")}</p></div></CardContent></Card>
            </Link>
          </motion.div>

          {(tier === "middle" || tier === "upper") && user && (
            <motion.div variants={itemVariants} data-guide="academic-mode" className="col-span-2 md:col-span-2">
              <Link to="/academic" className="block h-full"><Card className="h-full rounded-3xl border-0 bg-gradient-to-br from-slate-800 to-slate-950 text-white transition hover:-translate-y-1 hover:shadow-xl"><CardContent className="flex min-h-40 items-center gap-4 p-5"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">📘</span><div><h3 className="font-display text-lg font-bold">{t("academic-mode")}</h3><p className="mt-1 text-sm text-white/65">{t("flashcards")} · {t("topic-coverage")} · {t("exam-mode")}</p></div><GraduationCap className="ml-auto h-6 w-6 shrink-0 text-white/60" /></CardContent></Card></Link>
            </motion.div>
          )}

          {user && <motion.section variants={itemVariants} className="col-span-2 rounded-3xl border border-border bg-muted/50 p-5 md:col-span-2"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Your level</p><p className="mt-1 text-5xl font-display font-bold text-foreground">{user.level}</p></div><div className="text-right"><div className="flex items-center justify-end gap-1 text-warning"><Flame className="h-5 w-5 fill-current" /><span className="text-2xl font-display font-bold">{user.xp}</span></div><p className="text-xs text-muted-foreground">XP earned</p></div></div></motion.section>}
        </motion.div>

        <section className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-medium text-primary">Explore</p><h2 className="mt-1 text-2xl font-display font-bold">Make your next move</h2></div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map(category => <Button key={category.id} variant={activeCategory === category.id ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(category.id)} className="shrink-0 gap-1.5 rounded-full">{category.icon}{category.name}</Button>)}
            </div>
          </div>
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map((item) => <motion.div key={item.path + item.title} variants={itemVariants} data-guide={item.guideId}><Link to={item.path} className="block h-full"><Card className="group h-full rounded-2xl border-border bg-card transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"><CardContent className="p-4"><div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-sm transition group-hover:scale-110`}>{item.icon}</div><h3 className="font-display text-sm font-bold">{item.title}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p></CardContent></Card></Link></motion.div>)}
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-4 py-5 pb-24 text-center"><p className="text-xs text-muted-foreground">{t("app-version")} · {t("created-by")} Biniam Bogale, Ethiopia</p><p className="mt-1 text-xs text-muted-foreground">{t("contact")}: +251978744724</p></footer>

      {showLevelUp && user && (<LevelUpModal previousLevel={previousLevel} newLevel={user.level} onClose={() => setShowLevelUp(false)} />)}

      {isGuideVisible && !isGuidePaused && guideTargetRect && (
        <div className="fixed inset-0 z-[110]"><div className="absolute inset-0 bg-black/70" /><div className="home-guide-highlight" style={{ top: guideTargetRect.top - 8, left: guideTargetRect.left - 8, width: guideTargetRect.width + 16, height: guideTargetRect.height + 16 }} /><div className="absolute w-[min(92vw,360px)] rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl" style={{ top: Math.min(Math.max(guideTargetRect.bottom + 14, 16), window.innerHeight - 190), left: Math.min(Math.max(guideTargetRect.left, 12), window.innerWidth - 372) }}><p className="text-sm font-semibold text-primary">{guideSteps[guideStepIndex]?.title}</p><p className="mt-2 text-sm text-muted-foreground">{guideSteps[guideStepIndex]?.description}</p><div className="mt-4 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{guideStepIndex + 1}/{guideSteps.length}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={endGuide}>Skip</Button><Button size="sm" onClick={() => runStep(guideStepIndex + 1)}>Next</Button></div></div></div></div>
      )}
      {isGuidePaused && isGuideVisible && (<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm"><Card className="border-primary/40 bg-card/95 p-4"><CardContent className="flex flex-col items-center gap-3 p-0"><p className="text-sm text-muted-foreground">Tutorial paused while app is in background.</p><Button size="sm" onClick={() => setIsGuidePaused(false)}>Resume</Button></CardContent></Card></div>)}
    </div>
  );
};

export default MainMenu;
