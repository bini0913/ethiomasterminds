import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Bot, Brain, GraduationCap, MessageCircle, Settings, ShoppingBag, Swords, Timer, Trophy, UserRoundPlus } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { LearningDNASummary } from "@/components/learning/LearningDNASummary";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";

const academicFeatures = [
  { title: "Academic Prep", description: "Plan focused exam preparation.", path: "/academic", icon: GraduationCap },
  { title: "Study Mode", description: "Work through a focused session.", path: "/study-mode", icon: Timer },
  { title: "AI Tutor", description: "Get help with a difficult concept.", path: "/ai-tutor", icon: Bot },
  { title: "Library", description: "Review learning resources.", path: "/library", icon: BookOpen },
];

const secondaryFeatures = [
  { title: "Friends", path: "/friends", icon: UserRoundPlus },
  { title: "Social", path: "/social", icon: MessageCircle },
  { title: "1v1 Battle", path: "/lobby", icon: Swords },
  { title: "Tournaments", path: "/tournaments", icon: Trophy },
  { title: "Store", path: "/store", icon: ShoppingBag },
];

const FeatureLink = ({ title, description, path, icon: Icon, secondary = false }: { title: string; description?: string; path: string; icon: React.ElementType; secondary?: boolean }) => (
  <Link to={path} className={`group flex min-h-28 items-start gap-3 rounded-xl border p-4 shadow-sm transition-colors active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${secondary ? "bg-background" : "bg-card"}`}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
    <span><span className="block font-semibold text-foreground">{title}</span>{description && <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>}</span>
  </Link>
);

const UpperTierHome: React.FC = () => {
  const { user } = useUser();
  const { learningData, isLoading, error, reload } = useLearningDNA(user?.id);
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="tier-upper min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true"><Brain className="h-5 w-5" /></span>
            <span><span className="block font-display text-base font-bold tracking-tight">Master Minds</span><span className="block text-xs text-muted-foreground">Grade 9–12+ · Exam preparation</span></span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle className="h-11 w-11 rounded-md text-muted-foreground active:bg-secondary focus-visible:bg-secondary focus-visible:text-foreground" />
            <Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-secondary active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings className="h-5 w-5" /></Link>
            <Link to={profilePath} aria-label="Open your profile" className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-1 ring-border" /></Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 pb-28 sm:px-8 sm:py-10 md:pb-32">
        <section aria-labelledby="welcome-heading"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Academic dashboard</p><h1 id="welcome-heading" className="mt-2 text-3xl tracking-tight sm:text-4xl">{firstName ? `Hi, ${firstName}` : "Ready to learn?"}</h1><p className="mt-2 text-sm text-muted-foreground">Level {user?.level ?? 1} <span aria-hidden="true">·</span> {user?.xp ?? 0} XP</p></section>

        <section className="mt-7" aria-label="Learning DNA"><LearningDNASummary data={learningData} isLoading={isLoading} error={error} onRetry={() => void reload()} /></section>

        <section className="mt-8 rounded-xl border border-border bg-muted/40 p-5" aria-labelledby="study-loop-heading"><h2 id="study-loop-heading" className="text-base font-semibold">Your study loop</h2><p className="mt-1 text-sm text-muted-foreground">Review your Learning DNA, focus your study, practise with a quiz, then update your analysis.</p><ol className="mt-4 grid gap-2 text-sm font-medium sm:grid-cols-5"><li>1. Learning DNA</li><li>2. Focus next</li><li>3. Study & revision</li><li>4. Quiz</li><li>5. Review progress</li></ol></section>

        <section className="mt-8" aria-labelledby="academic-heading"><div className="flex items-baseline justify-between"><div><h2 id="academic-heading" className="text-lg font-semibold tracking-tight">Academic tools</h2><p className="mt-1 text-sm text-muted-foreground">Choose a focused way to make progress.</p></div><Link to="/quiz" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Start a quiz</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{academicFeatures.map((feature) => <FeatureLink key={feature.path} {...feature} />)}</div></section>

        <section className="mt-9" aria-labelledby="community-heading"><h2 id="community-heading" className="text-lg font-semibold tracking-tight">Community & competition</h2><p className="mt-1 text-sm text-muted-foreground">Keep connected when you want a break from focused study.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{secondaryFeatures.map((feature) => <FeatureLink key={feature.path} {...feature} secondary />)}</div></section>
      </main>
    </div>
  );
};

export default UpperTierHome;
