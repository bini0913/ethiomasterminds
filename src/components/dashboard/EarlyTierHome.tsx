import React from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Heart, Lightbulb, PlayCircle, Settings, Sparkles, Store, Trophy, UserRound, Compass } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const EarlyTierHome: React.FC = () => {
  const { user } = useUser();
  const { xp, coins, dailyStreak } = useCurrency();
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const gradeLabel = !user?.grade || /^k|kindergarten|pre/i.test(user.grade) ? "Early learner" : `Grade ${user.grade}`;

  const quick = [
    { to:"/early-games", label:"Play Games", description:"10 fun learning games", icon:<Gamepad2 className="h-7 w-7"/>, tone:"bg-primary/10 text-primary" },
    { to:"/early-quiz", label:"Quick Quiz", description:"Show what you know", icon:<Sparkles className="h-7 w-7"/>, tone:"bg-warning/15 text-warning" },
    { to:"/early-videos", label:"Videos & Stories", description:"Watch, listen & discover", icon:<PlayCircle className="h-7 w-7"/>, tone:"bg-accent/15 text-accent" },
    { to:"/early-explore", label:"Explore", description:"Science, art & coding", icon:<Compass className="h-7 w-7"/>, tone:"bg-success/15 text-success" },
    { to:"/leaderboard", label:"Ranks", description:"See your progress", icon:<Trophy className="h-7 w-7"/>, tone:"bg-success/15 text-success" },
    { to:"/store", label:"Rewards Store", description:"Spend your coins", icon:<Store className="h-7 w-7"/>, tone:"bg-primary/10 text-primary" },
    { to:profilePath, label:"My Avatar", description:"Make it yours", icon:<UserRound className="h-7 w-7"/>, tone:"bg-accent/15 text-accent" },
  ];

  return <div className="min-h-screen bg-background pb-24">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl shadow-sm">🧠</div><div><p className="font-display text-lg font-bold">Master Minds</p><p className="text-xs font-semibold text-primary">{gradeLabel} • Learn through play</p></div></Link>
        <div className="flex items-center gap-1"><ThemeToggle className="h-11 w-11 rounded-xl"/><Link to={profilePath} aria-label="Open profile"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-11 w-11 ring-2 ring-primary/20"/></Link><Link to="/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><Settings className="h-5 w-5"/></Link></div>
      </div>
    </header>
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
      <section className="overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-lg sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold opacity-90">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋</p><h1 className="mt-1 text-3xl font-display font-bold sm:text-4xl">Ready for a fun learning adventure?</h1><p className="mt-2 max-w-xl opacity-90">Choose a big button. Play, discover, and collect rewards.</p></div><div className="text-6xl" aria-hidden="true">🌟</div></div><div className="mt-5 flex flex-wrap gap-2"><BadgeStat label="XP" value={xp.toLocaleString()}/><BadgeStat label="Coins" value={coins.toLocaleString()}/><BadgeStat label="Streak" value={`${dailyStreak} days`}/></div></section>
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-display font-bold">Your learning playground</h2><span className="text-xs font-semibold text-muted-foreground">Pick anything</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{quick.map(item=><Link key={item.to} to={item.to} className="min-h-40 rounded-[1.5rem] border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-1 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${item.tone}`}>{item.icon}</div><h3 className="mt-4 font-display text-lg font-bold">{item.label}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><span className="mt-3 inline-flex min-h-10 items-center rounded-full bg-primary/10 px-3 text-xs font-bold text-primary">Open →</span></Link>)}</div></section>
      <section className="grid gap-3 sm:grid-cols-2"><Card className="rounded-[1.5rem]"><CardContent className="p-5"><div className="flex items-center gap-2"><Heart className="h-5 w-5 text-destructive"/><p className="font-display font-bold">Kindness & feelings</p></div><p className="mt-2 text-sm text-muted-foreground">Learning is also about being curious, kind, brave, and able to name your feelings.</p></CardContent></Card><Card className="rounded-[1.5rem]"><CardContent className="p-5"><div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-warning"/><p className="font-display font-bold">Try something hands-on</p></div><p className="mt-2 text-sm text-muted-foreground">Some activities connect the screen to drawing, building, movement, or a grown-up conversation.</p></CardContent></Card></section>
    </main>
  </div>;
};

const BadgeStat=({label,value}:{label:string;value:string})=><div className="rounded-2xl bg-primary-foreground/15 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p><p className="font-display font-bold">{value}</p></div>;
export default EarlyTierHome;
