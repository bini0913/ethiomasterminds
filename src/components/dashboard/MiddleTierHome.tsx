import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Brain, Flame, Gamepad2, GraduationCap, LibraryBig, LogOut, MessageCircle, Settings, Sparkles, Swords, Timer, Trophy, Users, Zap } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAchievements } from "@/context/AchievementsContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";

const study = [
  { title: "Quick Quiz", description: "Practise and earn XP", path: "/quiz", icon: Zap },
  { title: "Study Mode", description: "Focus, revise, and build a streak", path: "/study-mode", icon: Timer },
  { title: "Library", description: "Find books and learning resources", path: "/library", icon: LibraryBig },
  { title: "Academic Prep", description: "Work through subjects and topics", path: "/academic", icon: GraduationCap },
];
const play = [
  { title: "Games & Battles", description: "Challenge yourself or a friend", path: "/multiplayer", icon: Swords },
  { title: "Tournaments", description: "Compete and improve your rank", path: "/tournaments", icon: Trophy },
  { title: "Friends", description: "Chat, connect, and study together", path: "/friends", icon: Users },
  { title: "Social", description: "Share your learning journey", path: "/social", icon: MessageCircle },
];

function FeatureCard({ item }: { item: { title: string; description: string; path: string; icon: React.ElementType } }) {
  const Icon = item.icon;
  return <Link to={item.path} className="group flex min-h-36 min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-40 sm:p-5">
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-5 w-5" aria-hidden="true"/></span>
    <span className="mt-3 font-semibold">{item.title}</span>
    <span className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</span>
    <ArrowRight className="mt-auto ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true"/>
  </Link>;
}

const MiddleTierHome: React.FC = () => {
  const { user, logout } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const { unlockedBadges } = useAchievements();
  const navigate = useNavigate();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Learner";
  const xp = user?.xp ?? 0;
  const level = user?.level ?? 1;
  const levelProgress = Math.max(0, Math.min(100, xp - (level - 1) * 100));

  return <div className="min-h-screen bg-background pb-28 text-foreground">
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <Link to={user?.id ? `/profile/${user.id}` : "/settings"} aria-label="Open your profile" className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-11 w-11 ring-2 ring-primary/15"/></Link>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Grade 5–8 · Your space</p><h1 className="truncate text-lg font-bold">Master Minds</h1></div>
        <div className="flex shrink-0 items-center gap-1"><ThemeToggle className="h-11 w-11 rounded-xl"/><Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings className="h-5 w-5"/></Link><button type="button" onClick={async()=>{await logout();navigate("/",{replace:true});}} aria-label="Log out" title="Log out" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><LogOut className="h-5 w-5"/></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:space-y-7 sm:py-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card shadow-sm">
        <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center sm:p-7">
          <div><p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"><Sparkles className="h-4 w-4"/>Small steps. Big progress.</p><h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Hey {firstName}, what are we learning today?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Practise a skill, team up with friends, and turn your progress into something you can see.</p><Link to="/quiz" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Start a quiz <ArrowRight className="h-4 w-4"/></Link></div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
            <div className="rounded-xl border bg-background p-3 sm:flex sm:items-center sm:gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Zap className="h-4 w-4"/></span><p className="mt-2 text-xs text-muted-foreground sm:mt-0">Total XP</p><p className="text-lg font-bold tabular-nums sm:ml-auto">{xp.toLocaleString()}</p></div>
            <div className="rounded-xl border bg-background p-3 sm:flex sm:items-center sm:gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning"><Flame className="h-4 w-4"/></span><p className="mt-2 text-xs text-muted-foreground sm:mt-0">Study streak</p><p className="text-lg font-bold tabular-nums sm:ml-auto">{dailyStreak} days</p></div>
            <div className="rounded-xl border bg-background p-3 sm:flex sm:items-center sm:gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent"><Trophy className="h-4 w-4"/></span><p className="mt-2 text-xs text-muted-foreground sm:mt-0">Coins</p><p className="text-lg font-bold tabular-nums sm:ml-auto">{coins.toLocaleString()}</p></div>
          </div>
        </div>
        <div className="border-t bg-muted/30 px-5 py-3 sm:px-7"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">Level {level}</span><span className="text-muted-foreground">{levelProgress}/100 XP to next level</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgress}><div className="h-full rounded-full bg-primary transition-[width]" style={{width:`${levelProgress}%`}}/></div></div>
      </section>
      <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Study</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Learn something new</h2></div><Link to="/academic" className="text-sm font-semibold text-primary hover:underline">All study tools</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{study.map(item=><FeatureCard key={item.path} item={item}/>)}</div></section>
      <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Play & connect</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Make learning social</h2></div><Link to="/leaderboard" className="text-sm font-semibold text-primary hover:underline">View ranks</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{play.map(item=><FeatureCard key={item.path} item={item}/>)}</div></section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Link to="/leaderboard" className="flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Trophy className="h-6 w-6"/></span><span className="min-w-0 flex-1"><span className="block font-bold">Your rankings</span><span className="mt-1 block text-sm text-muted-foreground">See how your practice is adding up.</span></span><ArrowRight className="h-5 w-5 text-muted-foreground"/></Link>
        <Link to="/store" className="flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning"><Trophy className="h-6 w-6"/></span><span className="min-w-0 flex-1"><span className="block font-bold">Rewards store</span><span className="mt-1 block text-sm text-muted-foreground">Use your coins and celebrate milestones.</span></span><ArrowRight className="h-5 w-5 text-muted-foreground"/></Link>
      </section>
      {unlockedBadges.length > 0 && <section className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Trophy className="h-5 w-5"/></span><div><h2 className="font-bold">Recent achievements</h2><p className="text-sm text-muted-foreground">Keep up the great work.</p></div></div><div className="mt-3 flex flex-wrap gap-2">{unlockedBadges.slice(0,5).map((badge,index)=><span key={badge.id ?? badge.name ?? index} className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm"><span>{badge.icon}</span><span>{badge.name}</span></span>)}</div></section>}
    </main>
  </div>;
};
export default MiddleTierHome;
