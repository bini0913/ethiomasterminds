import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, BrainCircuit, ChevronRight, Clock3, LogOut, Settings,
  Sparkles, Swords, Timer, AlertCircle, Loader2, Home, Trophy, Users, Library,
  Bot, Bell, CalendarDays, Target, BarChart3, Layers3
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import StudentBottomNav from "@/components/layout/StudentBottomNav";

const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; };

const UpperStudentDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const { learningData, isLoading, error, reload } = useLearningDNA(user?.id);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const topicCount = Object.keys(learningData?.topicMastery ?? {}).length;
  const attemptCount = learningData?.totalAttempts ?? 0;
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";

  return <div className="tier-upper mm-upper-shell min-h-screen bg-background text-foreground">
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
      .mm-upper-shell .mm-upper-sidebar { width:16rem; }
      .mm-upper-shell .mm-upper-nav-link { display:flex; align-items:center; gap:.75rem; min-height:2.65rem; padding:.65rem .8rem; border-radius:.8rem; color:var(--muted-foreground); font-size:.875rem; font-weight:550; text-align:left; transition:background .15s,color .15s; }
      .mm-upper-shell .mm-upper-nav-link:hover { background:var(--muted); color:var(--foreground); }
      .mm-upper-shell .mm-upper-nav-link[data-active="true"] { background:rgba(99,102,241,.12); color:hsl(var(--primary)); font-weight:700; }
      @media(max-width:640px){.mm-upper-shell .mm-upper-hero{border-radius:1.25rem}.mm-upper-shell .mm-upper-action{padding:.85rem;gap:.7rem}.mm-upper-shell .mm-upper-icon{height:2.6rem;width:2.6rem}.mm-upper-shell .mm-upper-action .text-sm{font-size:.78rem;line-height:1.15rem}}
    `}</style>
    <aside className="mm-upper-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-card/95 px-4 py-5 lg:flex lg:flex-col">
      <button type="button" onClick={() => navigate("/")} className="mb-7 flex items-center gap-3 rounded-xl px-2 text-left">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border"><img src="/brand/master-minds-icon.svg" alt="" className="h-full w-full"/></span>
        <span><span className="block font-display text-base font-bold">Master Minds</span><span className="block text-xs text-muted-foreground">Grades 9–12</span></span>
      </button>
      <nav aria-label="High school navigation" className="flex-1 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Workspace</p>
        <button type="button" data-active="true" onClick={() => navigate("/")} className="mm-upper-nav-link w-full"><Home className="h-4 w-4"/> Home</button>
        <button type="button" onClick={() => navigate("/study-mode")} className="mm-upper-nav-link w-full"><Timer className="h-4 w-4"/> Study Mode</button>
        <button type="button" onClick={() => navigate("/academic")} className="mm-upper-nav-link w-full"><BookOpen className="h-4 w-4"/> Academic Mode <ChevronRight className="ml-auto h-4 w-4"/></button>
        <div className="ml-4 space-y-1 border-l border-border pl-3">
          <button type="button" onClick={() => navigate("/academic/topics")} className="mm-upper-nav-link w-full"><Layers3 className="h-4 w-4"/> Topic Coverage</button>
          <button type="button" onClick={() => navigate("/academic/flashcards")} className="mm-upper-nav-link w-full"><BrainCircuit className="h-4 w-4"/> Flashcards & Revision</button>
          <button type="button" onClick={() => navigate("/academic/exam")} className="mm-upper-nav-link w-full"><Target className="h-4 w-4"/> Exam Mode</button>
          <button type="button" onClick={() => navigate("/academic/planner")} className="mm-upper-nav-link w-full"><CalendarDays className="h-4 w-4"/> Study Planner</button>
          <button type="button" onClick={() => navigate("/academic/insights")} className="mm-upper-nav-link w-full"><BarChart3 className="h-4 w-4"/> Academic Insights</button>
        </div>
        <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Connect</p>
        <button type="button" onClick={() => navigate("/multiplayer")} className="mm-upper-nav-link w-full"><Swords className="h-4 w-4"/> Multiplayer</button>
        <button type="button" onClick={() => navigate("/tournaments")} className="mm-upper-nav-link w-full"><Trophy className="h-4 w-4"/> Tournaments</button>
        <button type="button" onClick={() => navigate("/learning-dna")} className="mm-upper-nav-link w-full"><BrainCircuit className="h-4 w-4"/> Learning DNA</button>
        <button type="button" onClick={() => navigate("/friends")} className="mm-upper-nav-link w-full"><Users className="h-4 w-4"/> Friends</button>
        <button type="button" onClick={() => navigate("/library")} className="mm-upper-nav-link w-full"><Library className="h-4 w-4"/> Library</button>
        <button type="button" onClick={() => navigate("/ai-tutor")} className="mm-upper-nav-link w-full"><Bot className="h-4 w-4"/> AI Tutor</button>
        <button type="button" onClick={() => navigate("/notifications")} className="mm-upper-nav-link w-full"><Bell className="h-4 w-4"/> Notifications</button>
      </nav>
      <div className="mt-4 border-t border-border pt-3">
        <button type="button" onClick={() => navigate("/settings")} className="mm-upper-nav-link w-full"><Settings className="h-4 w-4"/> Settings</button>
        <button type="button" onClick={async () => { await logout(); navigate("/", { replace: true }); }} className="mm-upper-nav-link w-full hover:!bg-destructive/10 hover:!text-destructive"><LogOut className="h-4 w-4"/> Log out</button>
      </div>
    </aside>
    <div className="min-w-0 lg:pl-64">
    <header className="border-b border-border/80 bg-background pt-[env(safe-area-inset-top)] lg:hidden">
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


      <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground"><Loader2 className="mt-0.5 h-4 w-4 shrink-0"/> Your progress comes from your signed-in account. Use More in the bottom navigation for friends, tournaments, the library, revision, notifications and other tools.</p>
    </main>
    </div>
    <div className="lg:hidden"><StudentBottomNav /></div>
  </div>;
};
export default UpperStudentDashboard;
