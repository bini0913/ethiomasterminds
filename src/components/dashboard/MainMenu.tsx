import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Gamepad2, Store, Award, Zap, Target, Timer, ArrowRight, Flame, LibraryBig, LogOut, MessageCircle
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import LevelUpModal from "../profile/LevelUpModal";
import CurrencyDisplay from "@/components/currency/CurrencyDisplay";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/layout/ThemeToggle";
import LearningDNASummary from "@/components/learning/LearningDNASummary";
import { useLearningDNA } from "@/hooks/useLearningDNA";

const HOME_ONBOARDING_STORAGE_KEY = "home_onboarding_completed_v1";

type GuideStep = {
  selector: string;
  title: string;
  description: string;
};

const MainMenu: React.FC = () => {
  const { user, logout, showLevelUp, setShowLevelUp, previousLevel } = useUser();
  const navigate = useNavigate();
  const tier = useTier();
  const { dailyStreak } = useCurrency();
  const { getRecentBadges } = useAchievements();
  const { openHelper } = useAIHelper();
  const { learningData, isLoading: learningDNALoading, error: learningDNAError, reload: reloadLearningDNA } = useLearningDNA(user?.id);
  const { t } = useLanguage();

  const [guideStepIndex, setGuideStepIndex] = useState<number>(-1);
  const [guideTargetRect, setGuideTargetRect] = useState<DOMRect | null>(null);
  const [isGuidePaused, setIsGuidePaused] = useState(false);
  const isGuideVisible = guideStepIndex >= 0;
  const highlightRef = useRef<HTMLElement | null>(null);

  const recentBadges = getRecentBadges();

  const studyItems = [
    {
      title: "Academic Mode",
      description: "Plan your study, practice topics, and prepare for exams",
      icon: <GraduationCap className="h-5 w-5" />,
      path: "/academic",
      guideId: "study-academic",
    },
    {
      title: t("quiz"),
      description: t("test-knowledge"),
      icon: <GraduationCap className="h-5 w-5" />,
      path: "/quiz",
      guideId: "study-quiz",
    },
    {
      title: "Study Mode",
      description: "Focus sessions, streaks, and study competitions",
      icon: <Timer className="h-5 w-5" />,
      path: "/study-mode",
      guideId: "study-mode",
    },
    {
      title: "Library",
      description: "Books and learning resources with AI tools",
      icon: <LibraryBig className="h-5 w-5" />,
      path: "/library",
      guideId: "study-library",
    },
    {
      title: t("ai-tutor"),
      description: t("24-7-ai-helper"),
      icon: <Bot className="h-5 w-5" />,
      path: "/ai-tutor",
      guideId: "study-ai",
    },
  ];

  const playItems = [
    {
      title: t("1v1-battle"),
      description: t("challenge-player"),
      icon: <Target className="h-5 w-5" />,
      path: "/multiplayer",
      guideId: "play-battle",
    },
    {
      title: t("game-lobby"),
      description: t("join-matches-chat"),
      icon: <Gamepad2 className="h-5 w-5" />,
      path: "/lobby",
      guideId: "play-lobby",
    },
    {
      title: t("tournaments"),
      description: t("global-competitions"),
      icon: <Trophy className="h-5 w-5" />,
      path: "/tournaments",
      guideId: "play-tournaments",
    },
  ];

  const guideSteps: GuideStep[] = useMemo(() => [
    {
      selector: '[data-guide="profile-header"]',
      title: "Your Progress",
      description: "See your level, XP, grade, and recent achievements at a glance.",
    },
    {
      selector: '[data-guide="continue-learning"]',
      title: "Continue Learning",
      description: "Start your next quiz quickly. This is the main path for daily learning.",
    },
    {
      selector: '[data-guide="daily-progress"]',
      title: "Daily Progress",
      description: "Keep an eye on XP and your daily study streak.",
    },
    {
      selector: '[data-guide="study-section"]',
      title: "Study",
      description: "Quiz, Study Mode, Library, and AI Tutor are grouped together here.",
    },
    {
      selector: '[data-guide="play-section"]',
      title: "Play",
      description: "Use Play for 1v1 battles, live lobbies, and tournaments.",
    },
    {
      selector: '[data-guide="rank-card"]',
      title: "Ranks",
      description: "Track your standing and open the full leaderboard when you want to compete.",
    },
    {
      selector: '[data-guide="bottom-nav"]',
      title: "Main Navigation",
      description: "Home, Study, Play, Ranks, and Profile are your five primary destinations.",
    },
  ], []);

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { y: 14, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to={user?.id ? `/profile/${user.id}` : "/settings"} className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl text-primary-foreground shadow-sm">
              🧠
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-display font-bold text-foreground">Master Minds</h1>
              <p className="text-xs text-muted-foreground">Learn · Practice · Grow</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <CurrencyDisplay />
            <ThemeToggle className="h-9 w-9" />
            <Button variant="ghost" size="icon" onClick={openHelper} className="h-9 w-9" aria-label="Open AI helper">
              <Bot className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              onClick={async () => { await logout(); navigate("/", { replace: true }); }}
              className="h-9 gap-2 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:px-3"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-7">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
          {user && (
            <motion.section
              variants={itemVariants}
              data-guide="profile-header"
              className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center gap-4">
                <AvatarRenderer avatar={user.avatar} avatarConfig={user.avatarConfig} size="lg" className="shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">Welcome back</p>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Lv. {user.level}</span>
                  </div>
                  <h2 className="mt-1 truncate text-2xl font-display font-bold sm:text-3xl">{user.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground capitalize">
                    {t(user.role)} · {t("grade")} {user.grade || "N/A"}
                  </p>
                </div>
                <Link to={user.id ? `/profile/${user.id}` : "/settings"} className="hidden shrink-0 sm:block">
                  <Button variant="outline" size="sm">Profile</Button>
                </Link>
              </div>

              <div className="mt-5">
                <UserLevel level={user.level} xp={user.xp} showBadge={false} />
              </div>

              {recentBadges.length > 0 && (
                <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                  <Award className="h-4 w-4 text-warning" />
                  <span className="text-sm text-muted-foreground">Recent wins</span>
                  <div className="ml-auto flex gap-1">
                    {recentBadges.slice(0, 3).map((badge, i) => (
                      <span key={i} className="text-lg" aria-label={badge.name}>{badge.icon}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}

          <motion.section
            variants={itemVariants}
            data-guide="continue-learning"
            className="overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/15 sm:p-8"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-widest">
                  <Zap className="h-3.5 w-3.5" />
                  Continue learning
                </span>
                <h2 className="mt-4 text-3xl font-display font-bold sm:text-4xl">Keep your learning streak moving.</h2>
                <p className="mt-2 max-w-lg text-sm text-primary-foreground/80 sm:text-base">
                  Jump into a quiz, earn XP, and build progress toward your next level.
                </p>
              </div>
              <Link to="/quiz" className="shrink-0">
                <Button size="lg" className="gap-2 rounded-xl bg-primary-foreground px-5 font-bold text-primary hover:bg-primary-foreground/90">
                  Start quiz
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.section>

          {user && (
            <motion.section
              variants={itemVariants}
              data-guide="daily-progress"
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <Card className="rounded-2xl border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Level</p>
                  <p className="mt-1 text-2xl font-display font-bold">{user.level}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">XP earned</p>
                  <p className="mt-1 text-2xl font-display font-bold">{user.xp}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Flame className="h-4 w-4 text-warning" />
                    <p className="text-xs font-medium">Study streak</p>
                  </div>
                  <p className="mt-1 text-2xl font-display font-bold">{dailyStreak}</p>
                </CardContent>
              </Card>
              <Link to="/leaderboard" className="block">
                <Card className="h-full rounded-2xl border-border bg-card transition hover:border-primary/40 hover:shadow-sm">
                  <CardContent className="flex h-full items-center justify-between p-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Your rank</p>
                      <p className="mt-1 text-base font-display font-bold">{user.rank || "View ranks"}</p>
                    </div>
                    <Trophy className="h-5 w-5 text-primary" />
                  </CardContent>
                </Card>
              </Link>
            </motion.section>
          )}

          <motion.section variants={itemVariants}>
            <LearningDNASummary data={learningData} isLoading={learningDNALoading} error={learningDNAError} onRetry={reloadLearningDNA} />
          </motion.section>

          <motion.section variants={itemVariants} data-guide="study-section">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Study</p>
                <h2 className="mt-1 text-xl font-display font-bold">Learn and practice</h2>
              </div>
              <Link to="/academic" className="text-sm font-semibold text-primary hover:underline">
                Academic tools
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {studyItems.map((item) => (
                <motion.div key={item.path} variants={itemVariants} data-guide={item.guideId}>
                  <Link to={item.path} className="block h-full">
                    <Card className="group h-full rounded-2xl border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <CardContent className="p-4 sm:p-5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                          {item.icon}
                        </span>
                        <h3 className="mt-4 text-sm font-display font-bold">{item.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section variants={itemVariants} data-guide="play-section">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Play</p>
                <h2 className="mt-1 text-xl font-display font-bold">Compete and connect</h2>
              </div>
              <Link to="/friends" className="text-sm font-semibold text-primary hover:underline">
                Friends
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {playItems.map((item) => (
                <motion.div key={item.path} variants={itemVariants} data-guide={item.guideId}>
                  <Link to={item.path} className="block h-full">
                    <Card className="group h-full rounded-2xl border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-display font-bold">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section variants={itemVariants} data-guide="rank-card">
            <Link to="/leaderboard" className="block">
              <Card className="rounded-2xl border-border bg-card transition hover:border-primary/40 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5 sm:p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Trophy className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Ranks</p>
                    <h2 className="mt-1 text-base font-display font-bold">Track your competition progress</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {user?.rank ? `Current rank: ${user.rank}` : "Open the leaderboard to see your current standing."}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </motion.section>
        </motion.div>
      </main>

      <footer className="border-t border-border/60 px-4 py-5 pb-24 text-center">
        <p className="text-xs text-muted-foreground">{t("app-version")} · {t("created-by")} Biniam Bogale, Ethiopia</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("contact")}: +251978744724</p>
      </footer>

      {showLevelUp && user && (
        <LevelUpModal previousLevel={previousLevel} newLevel={user.level} onClose={() => setShowLevelUp(false)} />
      )}

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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <Card className="border-primary/40 bg-card/95 p-4">
            <CardContent className="flex flex-col items-center gap-3 p-0">
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
