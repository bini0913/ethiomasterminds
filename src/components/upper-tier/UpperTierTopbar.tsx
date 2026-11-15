import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, Flame, Coins, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";

type Props = { onOpenMenu: () => void };
const labels: Array<[string,string]> = [
  ["/academic/entrance-papers","Entrance papers"],["/academic/flashcards","Flashcards"],["/academic/topics","Topic coverage"],
  ["/academic/exam","Exam preparation"],["/academic/planner","Study planner"],["/academic/insights","Academic insights"],
  ["/academic","Academic preparation"],["/study-mode","Study Mode"],["/multiplayer","Multiplayer arena"],
  ["/leaderboard","Leaderboards"],["/ai-tutor","AI Tutor"],["/library","Textbooks & library"],["/quiz","Quizzes & practice"],["/","Overview"]
];
export default function UpperTierTopbar({ onOpenMenu }: Props) {
  const { user } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const [query,setQuery] = useState("");
  const title = labels.find(([path]) => path === location.pathname || (path !== "/" && location.pathname.startsWith(path + "/")))?.[1] || "Student workspace";
  const results = useMemo(() => { const q=query.trim().toLowerCase(); return q ? labels.filter(([,label])=>label.toLowerCase().includes(q)).slice(0,5) : []; },[query]);
  return <header className="glass-nav-top sticky top-0 z-40">
    <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-8">
      <button type="button" onClick={onOpenMenu} aria-label="Open navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/70 md:hidden"><span className="text-xl">☰</span></button>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold sm:text-base">{title}</p><p className="hidden text-xs text-muted-foreground sm:block">{user?.grade ? `Grade ${user.grade} · ` : ""}Student workspace</p></div>
      <div className="relative hidden w-full max-w-[260px] lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setQuery("");if(e.key==="Enter"&&results[0]){navigate(results[0][0]);setQuery("");}}} placeholder="Search learning tools…" aria-label="Search learning tools" className="h-10 w-full rounded-full border border-border/60 bg-background/55 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/>
        {results.length>0&&<div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-border bg-card p-1 shadow-xl">{results.map(([path,label])=><button key={path} type="button" onClick={()=>{navigate(path);setQuery("");}} className="block min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-muted">{label}</button>)}</div>}
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/55 px-3 py-2 sm:flex"><Flame className="h-4 w-4 text-amber-500"/><span className="text-xs font-bold tabular-nums">{dailyStreak}</span></div>
      <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/55 px-3 py-2 sm:flex"><Coins className="h-4 w-4 text-amber-500"/><span className="text-xs font-bold tabular-nums">{coins.toLocaleString()}</span><Sparkles className="h-4 w-4 text-primary"/><span className="text-xs font-bold tabular-nums">{Number(user?.xp||0).toLocaleString()} XP</span></div>
      <ThemeToggle className="h-10 w-10 rounded-xl"/>
      <Link to="/notifications" aria-label="Notifications" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/70"><Bell className="h-5 w-5"/></Link>
      <Link to="/profile" aria-label="Open profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-primary/20"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9"/></Link>
    </div>
  </header>;
}
