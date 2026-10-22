import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CalendarDays, ChevronRight,
  GraduationCap, Library, LogOut, MessageCircle, Settings, Swords, Timer, Trophy,
  UserRoundPlus, Zap, Target, Flame, Bot, Loader2, AlertCircle
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";

type Action = { title: string; description: string; path: string; icon: React.ElementType; accent: string };
const mainTools: Action[] = [
  { title: "Study Mode", description: "Focus sessions, study rooms and friend calls", path: "/study-mode", icon: Timer, accent: "text-violet-600 bg-violet-500/10" },
  { title: "Academic Preparation", description: "Verified exam practice, topics and study plans", path: "/academic", icon: GraduationCap, accent: "text-primary bg-primary/10" },
  { title: "Multiplayer Arena", description: "Start or join a real multiplayer match", path: "/multiplayer", icon: Swords, accent: "text-emerald-600 bg-emerald-500/10" },
  { title: "Tournament Center", description: "Open live tournament and registration features", path: "/tournaments", icon: Trophy, accent: "text-amber-600 bg-amber-500/10" },
  { title: "Learning DNA", description: "Your recorded strengths, weaknesses and study signals", path: "/learning-dna", icon: BrainCircuit, accent: "text-fuchsia-600 bg-fuchsia-500/10" },
  { title: "Topic Coverage", description: "Continue with your available curriculum topics", path: "/academic/topics", icon: BookOpen, accent: "text-sky-600 bg-sky-500/10" },
];
const secondaryTools: Action[] = [
  { title: "Friends", description: "Your connected friends", path: "/friends", icon: UserRoundPlus, accent: "text-sky-600 bg-sky-500/10" },
  { title: "Leaderboard", description: "Real rankings", path: "/leaderboard", icon: Trophy, accent: "text-amber-600 bg-amber-500/10" },
  { title: "Social & chat", description: "Your social and messaging spaces", path: "/social", icon: MessageCircle, accent: "text-pink-600 bg-pink-500/10" },
  { title: "Library", description: "Your learning resources", path: "/library", icon: Library, accent: "text-blue-600 bg-blue-500/10" },
  { title: "AI Tutor", description: "Open the existing AI Tutor", path: "/ai-tutor", icon: Bot, accent: "text-violet-600 bg-violet-500/10" },
  { title: "Revision", description: "Review and reinforce earlier learning", path: "/revision", icon: Flame, accent: "text-orange-600 bg-orange-500/10" },
  { title: "Exam Mode", description: "Configure a practice or exam session", path: "/academic/exam", icon: Target, accent: "text-emerald-600 bg-emerald-500/10" },
  { title: "Study Planner", description: "Plan sessions around your books", path: "/academic/planner", icon: CalendarDays, accent: "text-sky-600 bg-sky-500/10" },
  { title: "Academic Insights", description: "Review your academic progress", path: "/academic/insights", icon: BarChart3, accent: "text-amber-600 bg-amber-500/10" },
  { title: "Notifications", description: "Manage your app notifications", path: "/notifications", icon: MessageCircle, accent: "text-primary bg-primary/10" },
];

const FeatureLink = ({ item, onOpen }: { item: Action; onOpen: (path: string) => void }) => {
  const Icon = item.icon;
  return <button type="button" onClick={() => onOpen(item.path)} className="group flex min-h-32 min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.accent}`}><Icon className="h-5 w-5" aria-hidden="true"/></span>
    <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{item.title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"/></span></span>
  </button>;
};

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

const UpperStudentDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const { learningData, isLoading, error, reload } = useLearningDNA(user?.id);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const topicCount = Object.keys(learningData?.topicMastery ?? {}).length;
  const attemptCount = learningData?.totalAttempts ?? 0;
  const masteryEntries = Object.entries(learningData?.topicMastery ?? {});
  const averageMastery = masteryEntries.length
    ? Math.round(masteryEntries.reduce((sum, [, item]) => sum + Math.max(0, Math.min(100, Number(item.mastery) || 0)), 0) / masteryEntries.length)
    : null;
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";

  return <div className="tier-upper min-h-screen bg-background pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-foreground">
    <header className="border-b border-border/80 bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate("/")} className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-border"><img src="/brand/master-minds-icon.svg" alt="" className="h-full w-full"/></span>
          <span className="min-w-0"><span className="block font-display text-base font-bold tracking-tight">Master Minds</span><span className="block text-xs text-muted-foreground">Grades 9–12 · Student workspace</span></span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle className="h-10 w-10 rounded-lg text-muted-foreground hover:bg-muted"/>
          <button type="button" onClick={() => navigate("/settings")} aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Settings className="h-5 w-5"/></button>
          <button type="button" onClick={() => navigate(profilePath)} aria-label="Open profile" className="flex h-10 w-10 items-center justify-center rounded-full"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-1 ring-border"/></button>
          <button type="button" onClick={async () => { await logout(); navigate("/", { replace: true }); }} aria-label="Log out" title="Log out" className="flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:px-3"><LogOut className="h-5 w-5"/><span className="hidden text-sm font-medium sm:inline">Log out</span></button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-7 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[30px] border-primary/5 sm:h-72 sm:w-72"/>
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><GraduationCap className="h-4 w-4"/> Grade 9–12 learning hub</span>
            <h1 className="mt-4 max-w-3xl break-words font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">{firstName ? `${greeting()}, ${firstName}` : "Ready to learn?"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Your study tools, academic preparation, competitions and social spaces—connected to your existing account and progress.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate("/study-mode")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Timer className="h-4 w-4"/> Start Study Mode</button>
              <button type="button" onClick={() => navigate("/academic")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted"><BookOpen className="h-4 w-4"/> Academic Preparation</button>
              <button type="button" onClick={() => navigate("/learning-dna")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted"><BrainCircuit className="h-4 w-4"/> Learning DNA</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-2xl bg-muted/70 p-4"><div className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4"/><span className="text-xs font-medium">Total XP</span></div><p className="mt-3 break-words font-display text-2xl font-bold tabular-nums sm:text-3xl">{(user?.xp ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Level {user?.level ?? 1}</p></div>
            <div className="min-w-0 rounded-2xl bg-muted/70 p-4"><div className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4"/><span className="text-xs font-medium">Topics tracked</span></div><p className="mt-3 font-display text-2xl font-bold tabular-nums sm:text-3xl">{isLoading ? "…" : topicCount}</p><p className="mt-1 text-xs text-muted-foreground">From your Learning DNA record</p></div>
            <div className="col-span-2 min-w-0 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5"/></span><div className="min-w-0"><p className="font-semibold">Learning DNA</p><p className="text-sm leading-5 text-muted-foreground">{isLoading ? "Loading your learning record…" : error ? "Your learning record could not be loaded." : topicCount ? `${topicCount} topics tracked · ${attemptCount} recorded question attempts` : "Your record will appear here as learning activity is saved."}</p></div></div><button type="button" onClick={() => navigate("/learning-dna")} aria-label="Open Learning DNA" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-muted"><ChevronRight className="h-5 w-5"/></button></div>
              {error && <button type="button" onClick={() => void reload()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-destructive"><AlertCircle className="h-4 w-4"/> Retry loading learning record</button>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Your live learning metrics">
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Question attempts</p><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : attemptCount.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Recorded in your account</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Topics tracked</p><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : topicCount.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">From Learning DNA</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Average topic mastery</p><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : averageMastery === null ? "—" : `${averageMastery}%`}</p><p className="mt-1 text-xs text-muted-foreground">{averageMastery === null ? "Available when topic mastery is recorded" : "Calculated from recorded topic mastery"}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">Account level</p><p className="mt-2 text-2xl font-bold tabular-nums">{user?.level ?? 1}</p><p className="mt-1 text-xs text-muted-foreground">{(user?.xp ?? 0).toLocaleString()} XP recorded on your profile</p></div>
      </section>

      <section className="space-y-3"><div><h2 className="text-lg font-bold tracking-tight sm:text-xl">Your main learning spaces</h2><p className="mt-1 text-sm text-muted-foreground">Each shortcut opens the existing production feature; no sample accounts, fake rankings or placeholder metrics.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"><div className="contents">{mainTools.map(item => <FeatureLink key={item.path} item={item} onOpen={navigate}/>)}</div></div></section>
      <section className="space-y-3"><div><h2 className="text-lg font-bold tracking-tight sm:text-xl">More from Master Minds</h2><p className="mt-1 text-sm text-muted-foreground">Your existing resources and student tools.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{secondaryTools.map(item => <FeatureLink key={item.path} item={item} onOpen={navigate}/>)}</div></section>
      <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground"><Loader2 className="mt-0.5 h-4 w-4 shrink-0"/> Progress metrics on this page come from your signed-in profile and existing Learning DNA/question-attempt records. Features open their existing production routes and keep their current backend integrations.</p>
    </main>
  </div>;
};

export default UpperStudentDashboard;
