import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CalendarDays, ChevronRight,
  GraduationCap, Library, LogOut, MessageCircle, Settings, ShoppingBag, Swords,
  Timer, Trophy, UserRoundPlus, Zap, Target, Flame, Bot
} from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { LearningDNASummary } from "@/components/learning/LearningDNASummary";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";

const mainTools = [
  { title: "Study Mode", description: "Focus sessions and study-room access", path: "/study-mode", icon: Timer, accent: "text-violet-600 bg-violet-500/10" },
  { title: "Academic Preparation", description: "Topics, exams, flashcards and planning", path: "/academic", icon: GraduationCap, accent: "text-primary bg-primary/10" },
  { title: "Multiplayer", description: "Join a match or challenge other students", path: "/multiplayer", icon: Swords, accent: "text-emerald-600 bg-emerald-500/10" },
  { title: "Tournaments", description: "Explore competitions and tournament rounds", path: "/tournaments", icon: Trophy, accent: "text-amber-600 bg-amber-500/10" },
  { title: "Play with a friend", description: "Invite a friend to a multiplayer match", path: "/multiplayer", icon: UserRoundPlus, accent: "text-sky-600 bg-sky-500/10" },
  { title: "Learning DNA", description: "Review your strengths and what to study next", path: "/learning-dna", icon: BrainCircuit, accent: "text-fuchsia-600 bg-fuchsia-500/10" },
];
const secondaryTools = [
  { title: "Friends", path: "/friends", icon: UserRoundPlus },
  { title: "Leaderboard", path: "/leaderboard", icon: Trophy },
  { title: "Social & chat", path: "/social", icon: MessageCircle },
  { title: "Library", path: "/library", icon: Library },
  { title: "AI Tutor", path: "/ai-tutor", icon: Bot },
  { title: "Revision", path: "/revision", icon: Flame },
  { title: "Quiz setup", path: "/quiz/filter", icon: Target },
  { title: "Rewards store", path: "/store", icon: ShoppingBag },
  { title: "Notifications", path: "/notifications", icon: MessageCircle },
];
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; };

const FeatureCard = ({ title, description, path, icon: Icon, accent }: { title: string; description: string; path: string; icon: React.ElementType; accent: string }) => (
  <Link to={path} className="group flex min-h-[148px] min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[160px] sm:p-5">
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
    <span className="mt-3 flex items-start gap-2"><span className="min-w-0 flex-1 break-words font-semibold leading-snug text-foreground">{title}</span><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
    <span className="mt-1 text-sm leading-5 text-muted-foreground">{description}</span>
  </Link>
);
const MoreLink = ({ title, path, icon: Icon }: { title: string; path: string; icon: React.ElementType }) => (
  <Link to={path} className="group flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-secondary group-hover:text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1 break-words text-sm font-medium">{title}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Link>
);

const UpperTierHome: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const { learningData, isLoading, error, reload } = useLearningDNA(user?.id);
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const firstName = user?.name?.split(" ")[0];
  const xp = user?.xp ?? 0;
  const level = user?.level ?? 1;
  const levelStart = Math.max(0, (level - 1) * 100);
  const xpProgress = Math.min(100, Math.max(0, xp - levelStart));
  const topicCount = Object.keys(learningData?.topicMastery ?? {}).length;
  const attemptCount = learningData?.totalAttempts ?? 0;

  return <div className="tier-upper min-h-screen bg-background text-foreground">
    <header className="border-b border-border/80 bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5"><img src="/brand/master-minds-icon.svg" alt="" className="h-full w-full" /></span>
          <span className="min-w-0"><span className="block font-display text-base font-bold tracking-tight">Master Minds</span><span className="block text-xs text-muted-foreground">Grades 9–12 · Student workspace</span></span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle className="h-10 w-10 rounded-lg text-muted-foreground hover:bg-muted focus-visible:bg-muted" />
          <Link to="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings className="h-5 w-5" /></Link>
          <Link to={profilePath} aria-label="Open your profile" className="flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-1 ring-border" /></Link>
          <button type="button" onClick={async () => { await logout(); navigate("/", { replace: true }); }} aria-label="Log out" title="Log out" className="flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"><LogOut className="h-5 w-5" aria-hidden="true" /><span className="hidden sm:inline text-sm font-medium">Log out</span></button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-7 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-8 sm:px-6 sm:py-8 md:pb-32 lg:px-8">
      <section aria-labelledby="welcome-heading" className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[30px] border-primary/5 sm:h-72 sm:w-72" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] lg:items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><GraduationCap className="h-4 w-4" /> Grade 9–12 learning hub</div>
            <h1 id="welcome-heading" className="mt-4 max-w-3xl break-words font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">{firstName ? `${greeting()}, ${firstName}` : "Ready to learn?"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Study with focus, prepare for exams, challenge friends, and build learning habits that last. Your academic tools and social spaces are connected here.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/study-mode" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Timer className="h-4 w-4" /> Start Study Mode</Link>
              <Link to="/academic" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BookOpen className="h-4 w-4" /> Academic Preparation</Link>
              <Link to="/learning-dna" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrainCircuit className="h-4 w-4" /> Learning DNA</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-2xl bg-muted/70 p-4"><div className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" /><span className="text-xs font-medium">Total XP</span></div><p className="mt-3 break-words font-display text-2xl font-bold tabular-nums sm:text-3xl">{xp.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Level {level}</p></div>
            <div className="min-w-0 rounded-2xl bg-muted/70 p-4"><div className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" /><span className="text-xs font-medium">Topics tracked</span></div><p className="mt-3 font-display text-2xl font-bold tabular-nums sm:text-3xl">{isLoading ? "…" : topicCount}</p><p className="mt-1 text-xs text-muted-foreground">From your Learning DNA</p></div>
            <div className="col-span-2 min-w-0 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></span><div className="min-w-0"><p className="font-semibold">Learning DNA</p><p className="text-sm leading-5 text-muted-foreground">{isLoading ? "Loading your learning map…" : topicCount ? `${topicCount} tracked topics · ${attemptCount} question attempts` : "Build your personal map from your study activity"}</p></div></div><Link to="/learning-dna" aria-label="Open Learning DNA" className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open <ArrowRight className="h-4 w-4" /></Link></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="progress-heading" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" /><p className="text-sm">Experience</p></div><p className="mt-2 text-2xl font-bold tabular-nums">{xp.toLocaleString()} XP</p><div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Progress to level {level + 1}</span><span className="font-semibold text-primary">{xp - levelStart}/100</span></div><Progress value={xpProgress} className="mt-2 h-2" /></div>
        <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><BarChart3 className="h-4 w-4" /><p className="text-sm">Practice activity</p></div><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : attemptCount}</p><p className="mt-1 text-xs text-muted-foreground">Recorded question attempts</p></div>
        <Link to="/leaderboard" className="group rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-center gap-2 text-muted-foreground"><Trophy className="h-4 w-4" /><p className="text-sm">Competition</p></div><p className="mt-2 text-lg font-bold">Leaderboard</p><p className="mt-1 flex items-center gap-1 text-xs text-primary">See rankings <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></p></Link>
      </section>

      <section aria-labelledby="tools-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your workspace</p><h2 id="tools-heading" className="mt-1 text-xl font-bold sm:text-2xl">Everything you need, in one place</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Go directly to study, academic preparation, multiplayer and the tools that support your progress.</p></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">Grades 9–12</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{mainTools.map(tool => <FeatureCard key={tool.title} {...tool} />)}</div>
      </section>

      <section aria-labelledby="learning-dna-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Personal learning map</p><h2 id="learning-dna-heading" className="mt-1 text-xl font-bold sm:text-2xl">Learning DNA</h2><p className="mt-1 text-sm text-muted-foreground">See your strengths, focus areas and recommended next steps.</p></div><Link to="/learning-dna" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Full analysis <ArrowRight className="h-4 w-4" /></Link></div>
        <LearningDNASummary data={learningData} isLoading={isLoading} error={error} onRetry={() => void reload()} />
      </section>

      <section aria-labelledby="study-next-heading" className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 id="study-next-heading" className="text-lg font-bold">Continue your study journey</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Use your selected books, real topic coverage, revision and exam practice as one connected workflow.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><MoreLink title="Topic Coverage" path="/academic/topics" icon={BookOpen} /><MoreLink title="Exam Mode" path="/academic/exam" icon={Target} /><MoreLink title="Study Planner" path="/academic/planner" icon={CalendarDays} /><MoreLink title="Flashcards & Revision" path="/academic/flashcards" icon={BrainCircuit} /></div><Link to="/academic" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Academic Preparation <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Swords className="h-5 w-5" /></span><div className="min-w-0"><h2 className="font-bold">Study with friends</h2><p className="text-sm text-muted-foreground">Play, connect and compete.</p></div></div><div className="mt-4 space-y-1"><MoreLink title="Play with a friend" path="/multiplayer" icon={UserRoundPlus} /><MoreLink title="Tournaments" path="/tournaments" icon={Trophy} /><MoreLink title="Friends & messages" path="/friends" icon={MessageCircle} /></div></div>
      </section>

      <section aria-labelledby="more-heading" className="space-y-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">More</p><h2 id="more-heading" className="mt-1 text-xl font-bold sm:text-2xl">Your other tools</h2><p className="mt-1 text-sm text-muted-foreground">Extra destinations stay available without overcrowding your main navigation.</p></div>
        <div className="grid gap-1 rounded-2xl border border-border bg-card p-2 sm:grid-cols-2 lg:grid-cols-3">{secondaryTools.map(tool => <MoreLink key={tool.title} {...tool} />)}</div>
      </section>
    </main>
  </div>;
};

export default UpperTierHome;
