import React from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Bot,
  Brain,
  GraduationCap,
  MessageCircle,
  Settings,
  Swords,
  Timer,
  UserRoundPlus,
} from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useUser } from "@/context/UserContext";

const features = [
  {
    title: "Academic Prep",
    path: "/academic",
    icon: GraduationCap,
  },
  {
    title: "Study mode",
    path: "/study-mode",
    icon: Timer,
  },
  {
    title: "Ask AI Tutor",
    path: "/ai-tutor",
    icon: Bot,
  },
  {
    title: "Library",
    path: "/library",
    icon: BookOpen,
  },
  { title: "Social", path: "/social", icon: MessageCircle },
  { title: "Friends", path: "/friends", icon: UserRoundPlus },
  { title: "1v1 Battle", path: "/lobby", icon: Swords },
];

const UpperTierHome: React.FC = () => {
  const { user } = useUser();
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="tier-upper min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
              <Brain className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-base font-bold tracking-tight">Master Minds</span>
              <span className="block text-xs text-muted-foreground">Exam preparation</span>
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle className="h-11 w-11 rounded-md text-muted-foreground active:bg-secondary focus-visible:bg-secondary focus-visible:text-foreground" />
            <Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-secondary active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Settings className="h-5 w-5" />
            </Link>
            <Link to={profilePath} aria-label="Open your profile" className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-1 ring-border" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-10">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Grade 9–12</p>
          <h1 className="mt-2 text-3xl tracking-tight text-foreground sm:text-4xl">
            {firstName ? `Hi, ${firstName}` : "Ready to learn?"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Level {user?.level ?? 1} <span aria-hidden="true">·</span> {user?.xp ?? 0} XP</p>
        </section>

        <section className="mt-7" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-lg tracking-tight">Choose an activity</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {features.map(({ title, path, icon: Icon }) => (
              <Link key={path} to={path} className="flex min-h-32 flex-col items-start justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-colors active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="h-8 w-8" aria-hidden="true" /></span>
                <span className="font-display text-base font-bold leading-tight text-foreground">{title}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default UpperTierHome;
