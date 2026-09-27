import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  Settings,
  Timer,
} from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useUser } from "@/context/UserContext";

const preparationTools = [
  {
    title: "Academic preparation",
    description: "Exam mode, flashcards, topic coverage, and your study planner.",
    path: "/academic",
    icon: GraduationCap,
  },
  {
    title: "Study mode",
    description: "Set aside focused time and work through one task at a time.",
    path: "/study-mode",
    icon: Timer,
  },
  {
    title: "Ask AI Tutor",
    description: "Get a clear explanation or work through a difficult question.",
    path: "/ai-tutor",
    icon: Bot,
  },
  {
    title: "Library",
    description: "Read, review, and keep useful learning resources close by.",
    path: "/library",
    icon: BookOpen,
  },
];

const todayPlan = [
  { title: "Review your topic coverage", detail: "Identify the next topic to strengthen.", path: "/academic/topics", icon: ClipboardCheck },
  { title: "Practice with exam mode", detail: "Use timed questions to check your readiness.", path: "/academic/exam", icon: CalendarCheck },
  { title: "Plan your next session", detail: "Make time for the subjects that need attention.", path: "/academic/planner", icon: CalendarCheck },
];

const UpperTierHome: React.FC = () => {
  const { user } = useUser();
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="tier-upper min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/25 text-primary-foreground" aria-hidden="true">
              <Brain className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-base font-bold tracking-tight">Master Minds</span>
              <span className="block text-xs text-muted-foreground">Exam preparation</span>
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle className="h-10 w-10 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" />
            <Link to="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Settings className="h-5 w-5" />
            </Link>
            <Link to={profilePath} aria-label="Open your profile" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-1 ring-border" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Grade 9–12 preparation</p>
          <h1 className="mt-4 text-4xl tracking-tight text-foreground sm:text-5xl">
            {firstName ? `${firstName}, ` : ""}make today&apos;s study time count.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Build steady exam readiness with focused practice, clear coverage, and help when you need it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/study-mode" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Start a study session <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-muted-foreground">Level {user?.level ?? 1} <span aria-hidden="true">·</span> {user?.xp ?? 0} XP</span>
          </div>
        </section>

        <section className="mt-16 border-y border-border py-8" aria-labelledby="today-plan-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">TODAY&apos;S STUDY PLAN</p>
              <h2 id="today-plan-heading" className="mt-1 text-2xl tracking-tight">Choose your next useful step.</h2>
            </div>
            <Link to="/academic/planner" className="text-sm font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary">Open planner</Link>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {todayPlan.map(({ title, detail, path, icon: Icon }) => (
              <Link key={path} to={path} className="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground"><Icon className="h-4 w-4" /></span>
                <span>
                  <span className="flex items-center gap-2 font-display font-bold"><span>{title}</span><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">{detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="text-2xl tracking-tight">Preparation tools</h2>
          <p className="mt-2 text-muted-foreground">Everything you need for independent, purposeful revision.</p>
          <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {preparationTools.map(({ title, description, path, icon: Icon }) => (
              <Link key={path} to={path} className="group flex min-h-40 items-start gap-4 bg-card p-6 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-foreground" />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-3 font-display text-lg font-bold"><span>{title}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default UpperTierHome;
