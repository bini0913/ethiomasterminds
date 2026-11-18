import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Flame, Gamepad2, GraduationCap, LibraryBig, Play, Sparkles, Store, Timer, Trophy, Users, Zap } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { getXpProgressInLevel } from "@/lib/rankSystem";
import { useAchievements } from "@/context/AchievementsContext";
import { cn } from "@/lib/utils";

const missions = [
  { id: "warm-up", eyebrow: "Start small", title: "Warm-up quiz", sub: "5 quick questions", detail: "Build momentum in a few minutes.", to: "/quiz", icon: Zap, tone: "bg-primary text-primary-foreground" },
  { id: "focus", eyebrow: "Go deeper", title: "Focus session", sub: "25 minute study timer", detail: "Make one idea stick.", to: "/study-mode", icon: Timer, tone: "bg-accent text-accent-foreground" },
  { id: "subject", eyebrow: "Choose your lane", title: "Subject practice", sub: "Pick a topic to strengthen", detail: "Turn a tricky topic into a win.", to: "/academic", icon: GraduationCap, tone: "bg-warning text-warning-foreground" },
  { id: "discover", eyebrow: "Stay curious", title: "Read & discover", sub: "Explore the library", detail: "Find something worth sharing.", to: "/library", icon: LibraryBig, tone: "bg-success text-success-foreground" },
];

const quickLinks = [
  { title: "Challenge a friend", sub: "Put your skills to the test", to: "/multiplayer", icon: Gamepad2, className: "bg-primary/10 text-primary" },
  { title: "Climb the ranks", sub: "See how you are progressing", to: "/leaderboard", icon: Trophy, className: "bg-warning/15 text-warning" },
  { title: "Meet your community", sub: "Learn together", to: "/social", icon: Users, className: "bg-accent/15 text-accent" },
];

const MiddleTierHome: React.FC = () => {
  const { user } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const { unlockedBadges } = useAchievements();
  const [selectedMission, setSelectedMission] = React.useState(missions[0].id);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Learner";
  const xp = user?.xp ?? 0;
  const level = user?.level ?? 1;
  const levelProgress = getXpProgressInLevel(xp);
  const progress = levelProgress.percentage;
  const selected = missions.find((mission) => mission.id === selectedMission) ?? missions[0];
  const SelectedIcon = selected.icon;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
        <div className="min-w-0 space-y-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card p-6 shadow-[0_18px_50px_hsl(var(--primary)/.10)] sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 to-transparent" />
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[24px] border-primary/10" />
            <div className="relative max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" aria-hidden="true" />{greet}, {firstName}</div>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Pick your next win.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">A short, focused activity is enough to keep your learning moving. You are <strong className="text-foreground">{levelProgress.max - levelProgress.current} XP</strong> away from level {level + 1}.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to={selected.to} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-extrabold text-primary-foreground shadow-[0_4px_0_hsl(var(--primary-hover)/.7)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Play className="h-5 w-5 fill-current" aria-hidden="true" /> Start {selected.title.toLowerCase()}</Link>
                <Link to="/academic" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-background px-4 font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Choose a subject <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </div>
            <div className="relative mt-8 flex max-w-xl items-center gap-4 rounded-2xl border border-border/80 bg-background/75 p-4 backdrop-blur-sm sm:absolute sm:bottom-8 sm:right-8 sm:mt-0 sm:w-64 sm:flex-col sm:items-stretch">
              <div className="flex items-center gap-3"><div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[6px] border-primary/15" role="progressbar" aria-label={`Level ${level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="absolute inset-[-6px] rounded-full border-[6px] border-primary border-b-transparent border-l-transparent" style={{ transform: `rotate(${45 + progress * 3.6}deg)` }} /><span className="text-sm font-extrabold tabular-nums text-primary">{progress}%</span></div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">Level {level}</p><p className="mt-1 text-sm font-semibold">Your learning signal</p></div></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-3" aria-label="Your progress summary">
            <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4"><div className="flex items-center gap-2 text-warning"><Flame className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wider">Streak</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{dailyStreak}</p><p className="text-xs text-muted-foreground">days in a row</p></div>
            <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4"><div className="flex items-center gap-2 text-primary"><Zap className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wider">XP</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{xp.toLocaleString()}</p><p className="text-xs text-muted-foreground">total earned</p></div>
            <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4"><div className="flex items-center gap-2 text-accent"><Store className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wider">Coins</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{coins.toLocaleString()}</p><p className="text-xs text-muted-foreground">ready to spend</p></div>
          </section>

          <section aria-labelledby="learning-path-title">
            <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Your learning path</p><h2 id="learning-path-title" className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Choose your next move</h2></div><Link to="/academic" className="hidden items-center gap-1 text-sm font-bold text-primary sm:inline-flex">View all <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {missions.map((mission, index) => {
                const Icon = mission.icon;
                const isSelected = selectedMission === mission.id;
                return <article key={mission.id} className={cn("group relative overflow-hidden rounded-2xl border-2 bg-card p-4 transition-all sm:p-5", isSelected ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border/80 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md")}><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => setSelectedMission(mission.id)} aria-pressed={isSelected} className={cn("flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", mission.tone)}><Icon className="h-5 w-5" aria-hidden="true" /></button><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{isSelected ? "Selected" : `Step ${index + 1}`}</span></div><button type="button" onClick={() => setSelectedMission(mission.id)} className="mt-4 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{mission.eyebrow}</p><p className="mt-1 font-bold">{mission.title}</p><p className="text-sm text-muted-foreground">{mission.sub}</p></button><div className={cn("grid transition-[grid-template-rows,opacity] duration-200", isSelected ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}><div className="min-h-0 overflow-hidden"><p className="text-xs leading-5 text-muted-foreground">{mission.detail}</p><Link to={mission.to} className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open activity <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></div></div></article>;
              })}
            </div>
          </section>

          <section aria-labelledby="social-title"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Make it social</p><h2 id="social-title" className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Learn with your people</h2></div><Link to="/social" className="hidden items-center gap-1 text-sm font-bold text-primary sm:inline-flex">Open community <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div><div className="grid gap-3 md:grid-cols-3">{quickLinks.map((item) => { const Icon = item.icon; return <Link key={item.to} to={item.to} className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", item.className)}><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{item.title}</span><span className="block truncate text-sm text-muted-foreground">{item.sub}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>; })}</div></section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning"><Flame className="h-6 w-6" aria-hidden="true" /></span><div><p className="font-display text-2xl font-extrabold tabular-nums">{dailyStreak} day{dailyStreak === 1 ? "" : "s"}</p><p className="text-sm text-muted-foreground">Study streak</p></div></div><div className="mt-5 rounded-2xl bg-warning/10 p-4"><p className="text-sm font-bold text-warning">Keep the signal alive</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Complete one activity today to keep your current streak moving.</p></div><Link to="/study-mode" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-warning/10 text-sm font-bold text-warning hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning">Keep the streak going <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></section>
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Level {level}</p><p className="mt-1 font-bold">Progress to next level</p></div><span className="font-display text-lg font-extrabold text-primary">{progress}%</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{levelProgress.max - levelProgress.current} XP to go</p></section>
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Recent badges</h2><Link to={user?.id ? `/profile/${user.id}` : "/settings"} className="text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View profile</Link></div>{unlockedBadges.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{unlockedBadges.slice(0, 6).map((badge, index) => <span key={badge.name ?? index} title={badge.name} aria-label={badge.name} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-xl">{badge.icon}</span>)}</div> : <div className="mt-4 rounded-2xl bg-muted/60 p-4"><p className="text-sm font-semibold">Your first badge is waiting.</p><p className="mt-1 text-xs text-muted-foreground">Complete a quiz to start your collection.</p><Link to="/quiz" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Take a quiz <ArrowRight className="h-3 w-3" aria-hidden="true" /></Link></div>}</section>
        </aside>
      </div>
    </div>
  );
};

export default MiddleTierHome;
