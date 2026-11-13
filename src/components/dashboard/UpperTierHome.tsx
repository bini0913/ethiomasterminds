import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CalendarDays, Flame, GraduationCap,
  LibraryBig, LogOut, Play, Settings, Swords, Target, Timer, Trophy, Users, Bot, Zap,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";

const drill = [
  { title: "Entrance exam drill", sub: "Timed past-paper questions", to: "/academic/exam", icon: Target },
  { title: "Deep focus session", sub: "25 min study timer", to: "/study-mode", icon: Timer },
  { title: "Flashcard review", sub: "Formulas & past mistakes", to: "/academic/flashcards", icon: BrainCircuit },
  { title: "Past papers", sub: "Real national exams", to: "/academic/entrance-papers", icon: GraduationCap },
];
const tools = [
  { title: "Topics", to: "/academic/topics", icon: BookOpen },
  { title: "Planner", to: "/academic/planner", icon: CalendarDays },
  { title: "Insights", to: "/academic/insights", icon: BarChart3 },
  { title: "AI Tutor", to: "/ai-tutor", icon: Bot },
  { title: "Library", to: "/library", icon: LibraryBig },
  { title: "Battle", to: "/multiplayer", icon: Swords },
  { title: "Tournaments", to: "/tournaments", icon: Trophy },
  { title: "Friends", to: "/friends", icon: Users },
];
const days = ["M", "T", "W", "T", "F", "S", "S"];

function Ring({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return <svg viewBox="0 0 80 80" className="h-28 w-28 -rotate-90" aria-hidden="true">
    <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-primary-foreground/20" />
    <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-primary-foreground transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} />
  </svg>;
}

const UpperTierHome: React.FC = () => {
  const { user, logout } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const navigate = useNavigate();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Scholar";
  const gradeNum = user?.grade?.replace(/^grade\s*/i, "") || "";
  const xp = user?.xp ?? 0;
  const level = user?.level ?? 1;
  const progress = Math.max(0, Math.min(100, xp - (level - 1) * 100));
  const todayIdx = (new Date().getDay() + 6) % 7;
  const streakDays = Math.min(dailyStreak, todayIdx + 1);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Streak", value: `${dailyStreak}`, icon: Flame, tone: "text-warning bg-warning/15" },
    { label: "Total XP", value: xp.toLocaleString(), icon: Zap, tone: "text-primary bg-primary/10" },
    { label: "Level", value: `${level}`, icon: GraduationCap, tone: "text-accent bg-accent/15" },
  ];

  return <div className="min-h-screen bg-background pb-28 text-foreground lg:pb-10">
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to={user?.id ? `/profile/${user.id}` : "/settings"} aria-label="Open your profile" className="shrink-0 rounded-full"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-10 w-10 ring-2 ring-primary/20" /></Link>
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{greet}{gradeNum ? ` · Grade ${gradeNum}` : ""}</p><h1 className="truncate text-base font-bold">{firstName}</h1></div>
        <div className="hidden items-center gap-2 sm:flex">
          {stats.map(s => <span key={s.label} title={s.label} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-bold tabular-nums"><s.icon className={`h-4 w-4 ${s.tone.split(" ")[0]}`} />{s.value}</span>)}
        </div>
        <ThemeToggle className="h-10 w-10 rounded-xl" />
        <Link to="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><Settings className="h-5 w-5" /></Link>
        <button type="button" onClick={async () => { await logout(); navigate("/", { replace: true }); }} aria-label="Log out" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut className="h-5 w-5" /></button>
      </div>
    </header>

    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:py-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <div className="min-w-0 space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-foreground via-foreground to-primary p-6 text-background shadow-lg md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-2xl" />
          <div className="relative flex items-center gap-6">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 rounded-full bg-background/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"><GraduationCap className="h-3.5 w-3.5" /> Grade 9–12 learning workspace</p>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight md:text-4xl">Every session moves you closer, {firstName}.</h2>
              <p className="mt-2 max-w-md text-sm opacity-80 md:text-base">Today's drill: timed questions, a focus block and a quick review. {100 - progress} XP to level {level + 1}.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/academic/exam" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground shadow-[0_4px_0_hsl(var(--primary)/0.45)] transition active:translate-y-1 active:shadow-none"><Play className="h-5 w-5 fill-current" /> Start today's drill</Link>
                <Link to="/academic/planner" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-background/25 px-5 font-semibold transition hover:bg-background/10"><CalendarDays className="h-5 w-5" /> Plan</Link>
              </div>
            </div>
            <div className="relative hidden shrink-0 text-primary-foreground sm:block">
              <Ring value={progress} />
              <span className="absolute inset-0 flex flex-col items-center justify-center text-background"><span className="text-2xl font-extrabold tabular-nums">{progress}%</span><span className="text-[10px] uppercase opacity-80">Level {level}</span></span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 sm:hidden">
          {stats.map(s => <div key={s.label} className="rounded-2xl border bg-card p-3 text-center"><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="h-4 w-4" /></span><p className="mt-1.5 text-lg font-extrabold tabular-nums">{s.value}</p><p className="text-[11px] text-muted-foreground">{s.label}</p></div>)}
        </section>

        <section>
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Exam preparation</p><h2 className="text-xl font-extrabold md:text-2xl">Recommended next steps</h2><p className="mt-1 text-sm text-muted-foreground">Choose a task to continue your preparation.</p></div>
          <ol className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {drill.map((step, i) => {
              const current = i === 0;
              return <li key={step.to}>
                <Link to={step.to} className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition active:scale-[.99] ${current ? "border-primary bg-primary/5 shadow-[0_4px_0_hsl(var(--primary)/0.35)]" : "border-border bg-card hover:border-primary/40"}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <step.icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1}</span><span className="block font-bold">{step.title}</span><span className="block text-sm text-muted-foreground">{step.sub}</span></span>
                  <span className={current ? "rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground" : "text-xs font-semibold text-muted-foreground"}>{current ? "Recommended" : "Open"}</span>
                </Link>
              </li>;
            })}
          </ol>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-extrabold md:text-2xl">Study toolkit</h2>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {tools.map(t => <Link key={t.to} to={t.to} className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center transition hover:-translate-y-0.5 hover:border-primary/40 sm:p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:h-12 sm:w-12"><t.icon className="h-5 w-5" /></span>
              <span className="text-xs font-bold sm:text-sm">{t.title}</span>
            </Link>)}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-3xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Entrance exam preparation</p>
          <p className="mt-2 text-lg font-extrabold">Practice with verified papers</p>
          <p className="mt-1 text-sm text-muted-foreground">Use available past papers and track coverage from your selected textbooks. Exam dates are shown only when officially configured.</p>
          <Link to="/academic/topics" className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground hover:bg-secondary/80">Check topic coverage <ArrowRight className="h-4 w-4" /></Link>
        </section>
        <section className="rounded-3xl border bg-card p-5">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning"><Flame className="h-6 w-6" /></span><div><p className="text-2xl font-extrabold tabular-nums">{dailyStreak} day{dailyStreak === 1 ? "" : "s"}</p><p className="text-sm text-muted-foreground">Study streak</p></div></div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {days.map((d, i) => { const lit = i <= todayIdx && i > todayIdx - streakDays; return <div key={i} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${lit ? "bg-warning text-warning-foreground" : i === todayIdx ? "border-2 border-warning text-warning" : "bg-muted text-muted-foreground"}`}>{lit ? <Flame className="h-4 w-4" /> : d}</div>; })}
          </div>
        </section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Link to="/leaderboard" className="flex items-center gap-3 rounded-3xl border bg-card p-4 hover:border-primary/40"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Trophy className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold">Leaderboard</span><span className="block truncate text-sm text-muted-foreground">See your rank</span></span></Link>
          <Link to="/store" className="flex items-center gap-3 rounded-3xl border bg-card p-4 hover:border-primary/40"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Zap className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold">Store</span><span className="block truncate text-sm text-muted-foreground">{coins.toLocaleString()} coins</span></span></Link>
        </div>
      </aside>
    </main>
  </div>;
};
export default UpperTierHome;
