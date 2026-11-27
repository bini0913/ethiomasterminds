import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, Lightbulb, LogOut, PlayCircle, Settings, Sparkles, Store, Trophy, UserRound } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useEarlyProgress } from "@/hooks/useEarlyProgress";
import { useEarlyRecommendations } from "@/hooks/useEarlyRecommendations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const EarlyTierHome: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const { xp, coins, dailyStreak } = useCurrency();
  const { summary: progress } = useEarlyProgress();
  const recommendations = useEarlyRecommendations();
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const gradeLabel = !user?.grade || /^k|kindergarten|pre/i.test(user.grade) ? "Early learner" : `Grade ${user.grade}`;

  const quick = [
    { to:"/early-games", label:"Games", description:"Play & practise", icon:<Gamepad2 className="h-7 w-7"/>, tone:"bg-primary/10 text-primary" },
    { to:"/early-quiz", label:"Quiz", description:"Show what you know", icon:<Sparkles className="h-7 w-7"/>, tone:"bg-warning/15 text-warning" },
    { to:"/early-videos", label:"Videos", description:"Watch & discover", icon:<PlayCircle className="h-7 w-7"/>, tone:"bg-accent/15 text-accent" },
    { to:"/early-discover", label:"Discover", description:"Amazing facts", icon:<Sparkles className="h-7 w-7"/>, tone:"bg-warning/15 text-warning" },
    { to:"/early-explore", label:"Explore", description:"Stories, science & create", icon:<Lightbulb className="h-7 w-7"/>, tone:"bg-success/15 text-success" },
    { to:"/early-ranks", label:"Ranks", description:"See your progress", icon:<Trophy className="h-7 w-7"/>, tone:"bg-success/15 text-success" },
    { to:"/store", label:"Store", description:"Use your rewards", icon:<Store className="h-7 w-7"/>, tone:"bg-primary/10 text-primary" },
    { to:"/early-profile", label:"My Profile", description:"Your learning journey", icon:<UserRound className="h-7 w-7"/>, tone:"bg-accent/15 text-accent" },
    { to:"/early-collection", label:"Collection", description:"Collect treasures", icon:<Trophy className="h-7 w-7"/>, tone:"bg-warning/15 text-warning" },
  ];

  return <div className="min-h-screen bg-background pb-24">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5"><img src="/brand/master-minds-icon.svg" alt="" className="h-full w-full" /></div><div><p className="font-display text-lg font-bold">Master Minds</p><p className="text-xs font-semibold text-primary">{gradeLabel} • Learn through play</p></div></Link>
        <div className="flex items-center gap-1"><ThemeToggle className="h-11 w-11 rounded-xl"/><Link to={profilePath} aria-label="Open profile"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-11 w-11 ring-2 ring-primary/20"/></Link><Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><Settings className="h-5 w-5"/></Link><button type="button" onClick={async () => { await logout(); navigate("/", { replace: true }); }} aria-label="Log out" title="Log out" className="flex h-11 items-center justify-center gap-2 rounded-xl px-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"><LogOut className="h-5 w-5" aria-hidden="true"/><span className="hidden sm:inline text-sm font-medium">Log out</span></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
      <section className="overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-lg sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold opacity-90">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋</p><h1 className="mt-1 text-3xl font-display font-bold sm:text-4xl">What do you want to explore?</h1><p className="mt-2 max-w-xl opacity-90">Play, practise, watch, and collect rewards.</p></div><div className="text-6xl" aria-hidden="true">🌟</div></div><div className="mt-5 flex flex-wrap gap-2"><BadgeStat label="XP" value={xp.toLocaleString()}/><BadgeStat label="Coins" value={coins.toLocaleString()}/><BadgeStat label="Streak" value={`${dailyStreak} days`}/></div></section>
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-display font-bold">Your learning playground</h2><span className="text-xs font-semibold text-muted-foreground">Pick anything</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{quick.map(item=><Link key={item.to} to={item.to} className="min-h-36 rounded-[1.5rem] border border-border bg-card p-4 shadow-sm transition hover:-translate-y-1 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>{item.icon}</div><h3 className="mt-4 font-display text-lg font-bold">{item.label}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></Link>)}</div></section>
      <section className="space-y-3">
        <div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Just for you</p><h2 className="font-display text-2xl font-bold">Keep learning</h2></div><Link to="/early-progress" className="text-sm font-semibold text-primary">See progress</Link></div>
        <div className="grid gap-3 sm:grid-cols-3">{recommendations.map(item=><Card key={item.activityId} className="rounded-[1.5rem]"><CardContent className="p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-2xl">{item.icon}</div><h3 className="mt-3 font-display font-bold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p><Link to={item.route} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">Try it</Link></CardContent></Card>)}</div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-[1.5rem]"><CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your learning</p>
          <p className="mt-1 text-lg font-display font-bold">{progress.skills.length ? `${progress.skills.length} skills in progress` : "Start your first skill"}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${progress.accuracy}%`}} /></div>
          <p className="mt-2 text-sm text-muted-foreground">{progress.attempts ? `${progress.accuracy}% correct across ${progress.attempts} tries` : "Play a game or quiz to start tracking your learning."}</p>
          <Link to="/early-progress" className="mt-3 inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">See my learning →</Link>
        </CardContent></Card>
        <Card className="rounded-[1.5rem]"><CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
          <p className="mt-1 text-lg font-display font-bold">Keep your streak going 🔥</p>
          <p className="mt-1 text-sm text-muted-foreground">{progress.completions ? `${progress.completions} activities completed so far.` : "A little practice every day helps you grow."}</p>
        </CardContent></Card>
      </section>
    </main>
  </div>;
};

const BadgeStat=({label,value}:{label:string;value:string})=><div className="rounded-2xl bg-primary-foreground/15 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p><p className="font-display font-bold">{value}</p></div>;
export default EarlyTierHome;
