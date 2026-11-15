import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Flame,
  Gamepad2,
  GraduationCap,
  Home,
  Layers3,
  Library,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Settings,
  ShoppingBag,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import { getXpProgressInLevel } from "@/lib/rankSystem";

const primaryNav = [
  { label: "Home", path: "/", icon: Home, match: ["/"] },
  { label: "Learn", path: "/quiz", icon: BookOpen, match: ["/quiz", "/academic", "/library", "/ai-tutor", "/revision", "/learning-dna"] },
  { label: "Focus", path: "/study-mode", icon: Timer, match: ["/study-mode"] },
  { label: "Play", path: "/multiplayer", icon: Gamepad2, match: ["/multiplayer", "/lobby", "/tournaments", "/leaderboard", "/store"] },
  { label: "Connect", path: "/social", icon: MessageCircle, match: ["/social", "/friends", "/chat", "/notifications"] },
];

const learnLinks = [
  { label: "Quiz Center", path: "/quiz", icon: BookOpen },
  { label: "Academic hub", path: "/academic", icon: GraduationCap },
  { label: "Study Mode", path: "/study-mode", icon: Timer },
  { label: "Revision", path: "/revision", icon: BrainCircuit },
  { label: "Library", path: "/library", icon: Library },
  { label: "AI Tutor", path: "/ai-tutor", icon: Bot },
];

const playLinks = [
  { label: "Multiplayer", path: "/multiplayer", icon: Swords },
  { label: "Tournaments", path: "/tournaments", icon: Trophy },
  { label: "Leaderboard", path: "/leaderboard", icon: Award },
  { label: "Store", path: "/store", icon: ShoppingBag },
];

const connectLinks = [
  { label: "Friends", path: "/friends", icon: Users },
  { label: "Community", path: "/social/community", icon: MessageCircle },
  { label: "Chat", path: "/chat", icon: MessageCircle },
];

const moreLinks = [
  { label: "Friends", path: "/friends", icon: Users },
  { label: "Community", path: "/social/community", icon: MessageCircle },
  { label: "Chat", path: "/chat", icon: MessageCircle },
  { label: "Flashcards", path: "/academic/flashcards", icon: Layers3 },
  { label: "Topic coverage", path: "/academic/topics", icon: Target },
  { label: "Study planner", path: "/academic/planner", icon: CalendarDays },
  { label: "Academic insights", path: "/academic/insights", icon: Sparkles },
  { label: "Learning DNA", path: "/learning-dna", icon: BrainCircuit },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Settings", path: "/settings", icon: Settings },
];

const isActivePath = (pathname: string, match: string[]) =>
  match.some((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)));

const MiddleTierShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Learner";
  const xpProgress = getXpProgressInLevel(user?.xp ?? 0);
  const pageTitle = location.pathname === "/" ? "Today" : primaryNav.find((item) => isActivePath(location.pathname, item.match))?.label ?? "Master Minds";

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="tier-middle min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/70 bg-card/95 px-3 py-5 backdrop-blur-xl md:flex">
        <Link to="/" className="mb-7 flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-muted" aria-label="Master Minds home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg font-extrabold tracking-tight">Master Minds</span>
            <span className="block text-xs font-semibold text-muted-foreground">Grades 5–8 · Learn boldly</span>
          </span>
        </Link>

        <nav aria-label="Grades 5–8 navigation" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-1">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Your workspace</p>
            <div className="space-y-1">
              {primaryNav.slice(0, 3).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(location.pathname, item.match);
                return <Link key={item.label} to={item.path} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors ${active ? "bg-primary text-primary-foreground shadow-md shadow-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-5 w-5" />{item.label}<ChevronRight className={`ml-auto h-4 w-4 transition-opacity ${active ? "opacity-70" : "opacity-0"}`} /></Link>;
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Explore</p>
            <div className="space-y-1">
              {[...learnLinks.slice(3), ...playLinks, ...connectLinks, ...moreLinks].map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return <Link key={item.path} to={item.path} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{item.label}</Link>;
              })}
            </div>
          </div>
        </nav>

        <div className="mt-4 border-t border-border/70 pt-4">
          <Link to={user?.id ? `/profile/${user.id}` : "/settings"} className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted">
            <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-2 ring-primary/20" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{firstName}</span><span className="block text-xs text-muted-foreground">Level {user?.level ?? 1} · {xpProgress.current}/{xpProgress.max} XP</span></span>
            <CircleUserRound className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="grid grid-cols-2 gap-1">
            <Link to="/settings" className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><Settings className="h-4 w-4" />Settings</Link>
            <button type="button" onClick={handleLogout} className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Grades 5–8</p><h1 className="truncate font-display text-xl font-extrabold tracking-tight">{pageTitle}</h1></div>
            <div className="hidden items-center gap-2 sm:flex"><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold tabular-nums"><Flame className="h-4 w-4 text-warning" />{dailyStreak} day streak</span><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold tabular-nums"><ShoppingBag className="h-4 w-4 text-accent" />{coins.toLocaleString()}</span></div>
            <ThemeToggle className="h-10 w-10 rounded-xl" />
            <Link to="/notifications" aria-label="Notifications" className="hidden h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted sm:flex"><Bell className="h-5 w-5" /></Link>
            <Link to={user?.id ? `/profile/${user.id}` : "/settings"} aria-label="Open profile" className="flex h-10 w-10 items-center justify-center rounded-full"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-2 ring-primary/20" /></Link>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-4.5rem)] max-w-7xl pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8">{children}</main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_hsl(var(--foreground)/.06)] backdrop-blur-xl md:hidden">
        {moreOpen && <div className="mx-auto max-w-lg px-3 pb-2"><div className="grid max-h-[min(55vh,460px)] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-2xl" aria-label="More destinations">{moreLinks.map((item) => { const Icon = item.icon; const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`); return <button key={item.path} type="button" onClick={() => { setMoreOpen(false); navigate(item.path); }} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold ${active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}><Icon className="h-4 w-4 shrink-0" />{item.label}</button>; })}</div></div>}
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-lg items-center justify-around gap-1 px-1 sm:h-[4.25rem] sm:px-3">
          {primaryNav.slice(0, 4).map((item) => { const Icon = item.icon; const active = isActivePath(location.pathname, item.match); return <button key={item.label} type="button" onClick={() => { setMoreOpen(false); navigate(item.path); }} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}><Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} /><span className="text-[11px] font-bold">{item.label}</span></button>; })}
          <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-label="More destinations" className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 ${moreOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}<span className="text-[11px] font-bold">More</span></button>
        </nav>
      </div>
    </div>
  );
};

export default MiddleTierShell;
