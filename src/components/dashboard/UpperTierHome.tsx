import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BarChart3, BookOpen, BrainCircuit, CalendarDays,
  ChevronRight, Clock3, GraduationCap, Library, LogOut, MessageCircle, Settings,
  Sparkles, Swords, Timer, Trophy, UserRoundPlus, Zap, Target, Flame, Bot,
  AlertCircle, Loader2
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";

type Action = { title: string; description: string; path: string; icon: React.ElementType; tone: string };
const primaryActions: Action[] = [
  { title: "Study Mode", description: "Focus sessions, study rooms and friend calls", path: "/study-mode", icon: Timer, tone: "violet" },
  { title: "Academic Preparation", description: "Exam practice, topic coverage and study plans", path: "/academic", icon: BookOpen, tone: "blue" },
  { title: "Multiplayer Arena", description: "Challenge friends and play real matches", path: "/multiplayer", icon: Swords, tone: "green" },
  { title: "Tournament Center", description: "Explore the tournament features available to you", path: "/tournaments", icon: Trophy, tone: "gold" },
  { title: "Learning DNA", description: "Your recorded strengths, topics and study signals", path: "/learning-dna", icon: BrainCircuit, tone: "pink" },
  { title: "Topic Coverage", description: "Continue learning from available curriculum topics", path: "/academic/topics", icon: GraduationCap, tone: "cyan" },
];
const moreActions: Action[] = [
  { title: "Friends", description: "Connect and study with friends", path: "/friends", icon: UserRoundPlus, tone: "cyan" },
  { title: "Leaderboard", description: "View available student rankings", path: "/leaderboard", icon: Trophy, tone: "gold" },
  { title: "Social & chat", description: "Messages and social spaces", path: "/social", icon: MessageCircle, tone: "pink" },
  { title: "Library", description: "Your learning resources", path: "/library", icon: Library, tone: "blue" },
  { title: "AI Tutor", description: "Open the existing AI Tutor", path: "/ai-tutor", icon: Bot, tone: "violet" },
  { title: "Revision", description: "Revisit material you have studied", path: "/revision", icon: Flame, tone: "coral" },
  { title: "Exam Mode", description: "Configure an exam or practice session", path: "/academic/exam", icon: Target, tone: "green" },
  { title: "Study Planner", description: "Plan sessions around your learning", path: "/academic/planner", icon: CalendarDays, tone: "cyan" },
  { title: "Academic Insights", description: "Review your recorded academic progress", path: "/academic/insights", icon: BarChart3, tone: "gold" },
  { title: "Notifications", description: "View and manage app notifications", path: "/notifications", icon: MessageCircle, tone: "blue" },
];
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; };

function ActionCard({ item, onOpen }: { item: Action; onOpen: (path: string) => void }) {
  const Icon = item.icon;
  return <button type="button" onClick={() => onOpen(item.path)} className="mm-upper-action group flex min-w-0 items-start gap-3 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <span className={`mm-upper-icon mm-tone-${item.tone} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`}><Icon className="h-5 w-5" aria-hidden="true"/></span>
    <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{item.title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"/></span></span>
  </button>;
}

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

  return <div className="tier-upper mm-upper-shell min-h-screen bg-background pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-foreground">
    <style>{`
      .mm-upper-shell { --mm-navy:#101a35; --mm-navy-2:#17264a; --mm-gold:#f3c96b; --mm-ink:#f8fafc; }
      .mm-upper-shell .mm-upper-hero { background:radial-gradient(circle at 86% 15%,rgba(243,201,107,.16),transparent 28%),linear-gradient(120deg,var(--mm-navy),var(--mm-navy-2)); color:var(--mm-ink); }
      .mm-upper-shell .mm-upper-hero-muted { color:rgba(237,242,255,.76); }
      .mm-upper-shell .mm-upper-action { background:var(--card); border-color:var(--border); box-shadow:0 2px 7px rgba(15,23,42,.035); }
      .mm-upper-shell .mm-upper-action:hover { border-color:hsl(var(--primary)/.48); box-shadow:0 10px 24px rgba(15,23,42,.08); }
      .mm-upper-shell .mm-upper-icon { background:rgba(99,102,241,.1); color:#6366f1; }
      .mm-upper-shell .mm-tone-violet {background:rgba(139,92,246,.13);color:#8b5cf6}.mm-upper-shell .mm-tone-blue {background:rgba(59,130,246,.12);color:#3b82f6}.mm-upper-shell .mm-tone-green {background:rgba(16,185,129,.12);color:#10b981}.mm-upper-shell .mm-tone-gold {background:rgba(217,161,44,.16);color:#c58b17}.mm-upper-shell .mm-tone-pink {background:rgba(217,70,239,.12);color:#c026d3}.mm-upper-shell .mm-tone-cyan {background:rgba(6,182,212,.12);color:#0891b2}.mm-upper-shell .mm-tone-coral {background:rgba(249,115,22,.12);color:#ea580c}
      .mm-upper-shell .mm-upper-stat { background:var(--card); border:1px solid var(--border); border-radius:1rem; padding:1rem; min-width:0; }
      .mm-upper-shell .mm-upper-label { color:rgba(237,242,255,.72); font-size:.75rem; }
      @media(max-width:640px){.mm-upper-shell .mm-upper-hero{border-radius:1.25rem}.mm-upper-shell .mm-upper-action{padding:.85rem;gap:.7rem}.mm-upper-shell .mm-upper-icon{height:2.6rem;width:2.6rem}.mm-upper-shell .mm-upper-action .text-sm{font-size:.78rem;line-height:1.15rem}}
    `}</style>
    <header className="border-b border-border/80 bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
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

    <main className="mx-auto max-w-[1440px] space-y-7 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      <section className="mm-upper-hero relative overflow-hidden rounded-3xl p-5 shadow-lg sm:p-7 xl:p-8">
        <div className="pointer-events-none absolute -right-8 -top-10 h-48 w-48 rounded-full border-[28px] border-white/5 sm:h-64 sm:w-64"/>
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5" style={{color:"var(--mm-gold)"}}/> Your learning, in focus</span><span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium">Grades 9–12</span></div>
            <h1 className="mt-4 max-w-3xl break-words font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl xl:text-4xl">{firstName ? `${greeting()}, ${firstName}` : "Build understanding that lasts."}</h1>
            <p className="mm-upper-hero-muted mt-3 max-w-2xl text-sm leading-6 sm:text-base">Pick up where you left off, practise what matters, and keep your progress visible—from focused study sessions to exam readiness.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate("/study-mode")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:brightness-105" style={{background:"var(--mm-gold)"}}><Timer className="h-4 w-4"/> Start Study Mode</button>
              <button type="button" onClick={() => navigate("/academic")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"><BookOpen className="h-4 w-4"/> Academic Prep <ArrowRight className="h-4 w-4"/></button>
              <button type="button" onClick={() => navigate("/learning-dna")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"><BrainCircuit className="h-4 w-4"/> Learning DNA</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><Clock3 className="h-5 w-5" style={{color:"var(--mm-gold)"}}/><p className="mt-3 text-2xl font-extrabold">{isLoading ? "…" : attemptCount.toLocaleString()}</p><p className="mm-upper-label">Question attempts</p><p className="mt-2 text-xs text-emerald-300">Recorded activity</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><BookOpen className="h-5 w-5" style={{color:"var(--mm-gold)"}}/><p className="mt-3 text-2xl font-extrabold">{isLoading ? "…" : topicCount.toLocaleString()}</p><p className="mm-upper-label">Topics tracked</p><p className="mt-2 text-xs text-slate-300">Your Learning DNA</p></div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><BrainCircuit className="h-5 w-5" style={{color:"var(--mm-gold)"}}/></span><div className="min-w-0"><p className="font-semibold">Your Learning DNA</p><p className="mm-upper-hero-muted text-sm leading-5">{isLoading ? "Loading your learning record…" : error ? "Your learning record could not be loaded." : topicCount ? `${topicCount} topics tracked · ${attemptCount} recorded question attempts` : "Your record will appear as learning activity is saved."}</p></div></div><button type="button" onClick={() => navigate("/learning-dna")} aria-label="Open Learning DNA" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-white/10"><ChevronRight className="h-5 w-5"/></button></div>
              {error && <button type="button" onClick={() => void reload()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-rose-200"><AlertCircle className="h-4 w-4"/> Retry loading learning record</button>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Your live learning metrics">
        <div className="mm-upper-stat"><p className="text-xs font-medium text-muted-foreground">Question attempts</p><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : attemptCount.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Recorded in your account</p></div>
        <div className="mm-upper-stat"><p className="text-xs font-medium text-muted-foreground">Topics tracked</p><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : topicCount.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">From Learning DNA</p></div>
        <div className="mm-upper-stat"><p className="text-xs font-medium text-muted-foreground">Average topic mastery</p><p className="mt-2 text-2xl font-bold tabular-nums">{isLoading ? "…" : averageMastery === null ? "—" : `${averageMastery}%`}</p><p className="mt-1 text-xs text-muted-foreground">{averageMastery === null ? "Available when mastery is recorded" : "Calculated from recorded topic mastery"}</p></div>
        <div className="mm-upper-stat"><p className="text-xs font-medium text-muted-foreground">Account level</p><p className="mt-2 text-2xl font-bold tabular-nums">{user?.level ?? 1}</p><p className="mt-1 text-xs text-muted-foreground">{(user?.xp ?? 0).toLocaleString()} XP recorded on your profile</p></div>
      </section>

      <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold tracking-tight sm:text-xl">Your main learning spaces</h2><p className="mt-1 text-sm text-muted-foreground">Open your study, exam preparation and competition tools.</p></div><span className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground sm:flex"><Sparkles className="h-4 w-4"/> Built for Grades 9–12</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{primaryActions.map(item => <ActionCard key={item.path} item={item} onOpen={navigate}/>)}</div></section>

      <section className="space-y-3"><div><h2 className="text-lg font-bold tracking-tight sm:text-xl">More from Master Minds</h2><p className="mt-1 text-sm text-muted-foreground">Your connected resources and student tools.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{moreActions.map(item => <ActionCard key={item.path} item={item} onOpen={navigate}/>)}</div></section>
      <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground"><Loader2 className="mt-0.5 h-4 w-4 shrink-0"/> Metrics shown here are read from your signed-in profile and existing Learning DNA records. Feature shortcuts open the existing production routes and preserve their backend integrations.</p>
    </main>
  </div>;
};
export default UpperStudentDashboard;
