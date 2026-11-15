import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Gamepad2, GraduationCap, LibraryBig, Play, Sparkles, Store, Timer, Trophy, Users, Zap } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { getXpProgressInLevel } from "@/lib/rankSystem";
import { useAchievements } from "@/context/AchievementsContext";

const learningPath = [
  { title: "Warm-up quiz", sub: "5 quick questions", detail: "Build momentum", to: "/quiz", icon: Zap, tone: "bg-primary text-primary-foreground" },
  { title: "Focus session", sub: "25 minute study timer", detail: "Deepen your focus", to: "/study-mode", icon: Timer, tone: "bg-accent text-accent-foreground" },
  { title: "Subject practice", sub: "Choose a topic", detail: "Strengthen a skill", to: "/academic", icon: GraduationCap, tone: "bg-warning text-warning-foreground" },
  { title: "Read & discover", sub: "Explore the library", detail: "Learn beyond class", to: "/library", icon: LibraryBig, tone: "bg-success text-success-foreground" },
];

const quickLinks = [
  { title: "Challenge a friend", sub: "Put your skills to the test", to: "/multiplayer", icon: Gamepad2, className: "bg-primary/10 text-primary" },
  { title: "Climb the ranks", sub: "See how you are progressing", to: "/leaderboard", icon: Trophy, className: "bg-warning/15 text-warning" },
  { title: "Meet your community", sub: "Learn together", to: "/social", icon: Users, className: "bg-accent/15 text-accent" },
];

const days = ["M", "T", "W", "T", "F", "S", "S"];

const MiddleTierHome: React.FC = () => {
  const { user } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const { unlockedBadges } = useAchievements();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Learner";
  const xp = user?.xp ?? 0;
  const level = user?.level ?? 1;
  const levelProgress = getXpProgressInLevel(xp);
  const progress = levelProgress.percentage;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const streakDays = Math.min(dailyStreak, todayIdx + 1);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
        <div className="min-w-0 space-y-7">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground shadow-xl shadow-primary/15 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[28px] border-primary-foreground/10" />
            <div className="pointer-events-none absolute -bottom-20 right-1/3 h-44 w-44 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="relative max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-bold opacity-85"><Sparkles className="h-4 w-4" />{greet}, {firstName}</div>
              <h2 className="mt-3 max-w-xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Your next win is one activity away.</h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/85 sm:text-base">Keep your learning streak moving with a short challenge designed for your level. You are {levelProgress.max - levelProgress.current} XP away from level {level + 1}.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/quiz" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-background px-5 font-extrabold text-primary shadow-[0_4px_0_hsl(var(--foreground)/.2)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"><Play className="h-5 w-5 fill-current" /> Start a quick quiz</Link>
                <Link to="/academic" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary-foreground/15 px-4 font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/25">Choose a subject <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="absolute bottom-8 right-8 hidden h-28 w-28 items-center justify-center rounded-full border-8 border-primary-foreground/20 sm:flex" aria-label={`${progress}% level progress`}>
              <div className="absolute inset-0 rounded-full border-8 border-primary-foreground border-b-transparent border-l-transparent" style={{ transform: `rotate(${45 + progress * 3.6}deg)` }} />
              <span className="text-center"><span className="block text-2xl font-extrabold tabular-nums">{progress}%</span><span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">level</span></span>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"><div className="flex items-center gap-2 text-warning"><Flame className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Streak</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{dailyStreak}</p><p className="text-xs text-muted-foreground">days in a row</p></div>
            <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"><div className="flex items-center gap-2 text-primary"><Zap className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">XP</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{xp.toLocaleString()}</p><p className="text-xs text-muted-foreground">total earned</p></div>
            <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4"><div className="flex items-center gap-2 text-accent"><Store className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Coins</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{coins.toLocaleString()}</p><p className="text-xs text-muted-foreground">ready to spend</p></div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Your learning path</p><h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Pick your next move</h2></div><Link to="/academic" className="hidden items-center gap-1 text-sm font-bold text-primary sm:inline-flex">View all <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {learningPath.map((step, index) => { const Icon = step.icon; return <Link key={step.to} to={step.to} className={`group relative flex min-h-32 flex-col justify-between overflow-hidden rounded-2xl border-2 p-4 transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg sm:p-5 ${index === 0 ? "border-primary/45 bg-primary/5" : "border-border/80 bg-card"}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${step.tone}`}><Icon className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index === 0 ? "Recommended" : `Step ${index + 1}`}</span></div><div><p className="mt-4 font-bold">{step.title}</p><p className="text-sm text-muted-foreground">{step.sub} <span className="hidden sm:inline">· {step.detail}</span></p></div><ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></Link>; })}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Make it social</p><h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Learn with your people</h2></div><Link to="/social" className="hidden items-center gap-1 text-sm font-bold text-primary sm:inline-flex">Open community <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="grid gap-3 md:grid-cols-3">{quickLinks.map((item) => { const Icon = item.icon; return <Link key={item.to} to={item.to} className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.className}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{item.title}</span><span className="block truncate text-sm text-muted-foreground">{item.sub}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></Link>; })}</div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning"><Flame className="h-6 w-6" /></span><div><p className="font-display text-2xl font-extrabold tabular-nums">{dailyStreak} day{dailyStreak === 1 ? "" : "s"}</p><p className="text-sm text-muted-foreground">Study streak</p></div></div><div className="mt-5 grid grid-cols-7 gap-1.5">{days.map((day, index) => { const lit = index <= todayIdx && index > todayIdx - streakDays; return <div key={`${day}-${index}`} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${lit ? "bg-warning text-warning-foreground" : index === todayIdx ? "border-2 border-warning text-warning" : "bg-muted text-muted-foreground"}`}>{lit ? <Flame className="h-4 w-4" /> : day}</div></div>; })}</div><Link to="/study-mode" className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-warning/10 text-sm font-bold text-warning hover:bg-warning/15">Keep the streak going <ArrowRight className="h-4 w-4" /></Link></section>
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Level {level}</p><p className="mt-1 font-bold">Progress to next level</p></div><span className="font-display text-lg font-extrabold text-primary">{progress}%</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{levelProgress.max - levelProgress.current} XP to go</p></section>
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Recent badges</h2><Link to={user?.id ? `/profile/${user.id}` : "/settings"} className="text-xs font-bold text-primary">View profile</Link></div>{unlockedBadges.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{unlockedBadges.slice(0, 6).map((badge, index) => <span key={badge.name ?? index} title={badge.name} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-xl">{badge.icon}</span>)}</div> : <div className="mt-4 rounded-2xl bg-muted/60 p-4"><p className="text-sm font-semibold">Your first badge is waiting.</p><p className="mt-1 text-xs text-muted-foreground">Complete a quiz to start your collection.</p><Link to="/quiz" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Take a quiz <ArrowRight className="h-3 w-3" /></Link></div>}</section>
        </aside>
      </div>
    </div>
  );
};

export default MiddleTierHome;
