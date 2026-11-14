import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, BookOpen, Target, CalendarDays, LibraryBig, Bot, BrainCircuit,
  Timer, Swords, Trophy, Users, MessageCircle, Gift, Settings, Bell,
  LogOut, Search, Menu, X, UserRound, GraduationCap, BarChart3, Layers3,
  ChevronRight, Sparkles,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";

type NavItem = { label: string; to: string; icon: React.ElementType };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Workspace", items: [
    { label: "Overview", to: "/", icon: Home },
    { label: "Academic preparation", to: "/academic", icon: GraduationCap },
    { label: "Quizzes & practice", to: "/quiz", icon: Target },
  ]},
  { label: "Study", items: [
    { label: "Study Mode", to: "/study-mode", icon: Timer },
    { label: "Textbooks & library", to: "/library", icon: LibraryBig },
    { label: "Exam preparation", to: "/academic/exam", icon: Target },
    { label: "Entrance papers", to: "/academic/entrance-papers", icon: GraduationCap },
    { label: "Flashcards", to: "/academic/flashcards", icon: Layers3 },
    { label: "Study planner", to: "/academic/planner", icon: CalendarDays },
    { label: "Topic coverage", to: "/academic/topics", icon: BookOpen },
    { label: "Academic insights", to: "/academic/insights", icon: BarChart3 },
    { label: "AI Tutor", to: "/ai-tutor", icon: Bot },
    { label: "Learning DNA", to: "/learning-dna", icon: BrainCircuit },
  ]},
  { label: "Compete", items: [
    { label: "Multiplayer arena", to: "/multiplayer", icon: Swords },
    { label: "Tournaments", to: "/tournaments", icon: Trophy },
    { label: "Leaderboards", to: "/leaderboard", icon: BarChart3 },
  ]},
  { label: "Community", items: [
    { label: "Social", to: "/social", icon: MessageCircle },
    { label: "Friends", to: "/friends", icon: Users },
  ]},
];

const extraItems: NavItem[] = [
  { label: "Revision", to: "/revision", icon: BrainCircuit },
  { label: "Challenge lobby", to: "/lobby", icon: Swords },
  { label: "Rewards store", to: "/store", icon: Gift },
  { label: "Avatar creator", to: "/avatar-creator", icon: UserRound },
  { label: "Notifications", to: "/notifications", icon: Bell },
];

const navigationGroups: NavGroup[] = groups.concat([{ label: "More", items: extraItems }]);
const allItems = navigationGroups.flatMap((group) => group.items);
const titleFor = (pathname: string) =>
  allItems.slice().sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/")))?.label
  || (pathname === "/" ? "Overview" : "Student workspace");

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (to === "/academic") return pathname === "/academic" || pathname === "/academic/setup";
  return pathname === to || pathname.startsWith(to + "/");
}

export default function UpperTierStudioShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState("");

  const grade = user?.grade ? (/grade/i.test(user.grade) ? user.grade : "Grade " + user.grade) : "Grades 9–12";
  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return allItems.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 6);
  }, [search]);

  const go = (to: string) => {
    navigate(to);
    setDrawerOpen(false);
    setMoreOpen(false);
    setSearch("");
  };

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-center gap-3 border-b border-border px-0 lg:justify-start lg:px-5">
        <img src="/brand/master-minds-icon.svg" alt="Master Minds" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 md:hidden lg:block">
          <p className="truncate text-base font-extrabold tracking-tight">Master Minds</p>
          <p className="text-xs text-muted-foreground">Grades 9–12 workspace</p>
        </div>
      </div>
      <div className="border-b border-border px-4 py-4 lg:px-5">
        <div className="flex items-center gap-3">
          <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-10 w-10 shrink-0" />
          <div className="min-w-0 md:hidden lg:block">
            <p className="truncate text-sm font-bold">{user?.name || user?.username || "Student"}</p>
            <p className="text-xs text-muted-foreground">{grade}</p>
          </div>
        </div>
      </div>
      <nav aria-label="Grades 9 to 12 navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {navigationGroups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground md:hidden lg:block">{group.label}</h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(location.pathname, item.to);
                return (
                  <button key={item.to} type="button" title={item.label} aria-current={active ? "page" : undefined}
                    onClick={() => go(item.to)}
                    className={"flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate md:hidden lg:block">{item.label}</span>
                    {active && <ChevronRight className="ml-auto h-4 w-4 md:hidden lg:block" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <div className="space-y-1 border-t border-border p-3">
        <Link to="/profile" onClick={() => setDrawerOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <UserRound className="h-[18px] w-[18px]" /><span className="md:hidden lg:block">My profile</span>
        </Link>
        <Link to="/settings" onClick={() => setDrawerOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <Settings className="h-[18px] w-[18px]" /><span className="md:hidden lg:block">Settings</span>
        </Link>
        <button type="button" onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="h-[18px] w-[18px]" /><span className="md:hidden lg:block">Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="mm-studio-upper tier-upper min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-border bg-card md:flex lg:w-64">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-slate-950/45" />
          <aside className="relative flex h-full w-[min(19rem,88vw)] flex-col border-r border-border bg-card shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="min-h-screen md:pl-[76px] lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center gap-3 px-3 sm:px-5 lg:px-8">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{titleFor(location.pathname)}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">{grade} · Student workspace</p>
            </div>
            <div className="relative hidden w-full max-w-[360px] md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); if (event.key === "Enter" && suggestions[0]) go(suggestions[0].to); }}
                placeholder="Search learning tools…" aria-label="Search learning tools"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                  {suggestions.map((item) => {
                    const Icon = item.icon;
                    return <button type="button" key={item.to} onClick={() => go(item.to)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted"><Icon className="h-4 w-4 text-primary" />{item.label}</button>;
                  })}
                </div>
              )}
            </div>
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:flex">
              <Sparkles className="h-4 w-4 text-primary" /><span className="text-sm font-bold tabular-nums">{(user?.xp || 0).toLocaleString()} XP</span>
            </div>
            <ThemeToggle className="h-10 w-10 rounded-xl" />
            <Link to="/notifications" aria-label="Notifications" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="h-5 w-5" /></Link>
            <Link to="/profile" aria-label="Open profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-primary/15">
              <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9" />
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:pb-10">
          {children}
        </div>
      </div>

      <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {moreOpen && (
          <div className="mx-auto grid max-h-[45vh] max-w-lg grid-cols-2 gap-2 overflow-y-auto border-b border-border py-3">
            {allItems.filter((item) => !["/", "/academic", "/study-mode", "/multiplayer"].includes(item.to)).map((item) => {
              const Icon = item.icon;
              return <button type="button" key={item.to} onClick={() => go(item.to)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold hover:bg-muted"><Icon className="h-4 w-4 text-primary" />{item.label}</button>;
            })}
          </div>
        )}
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around gap-1">
          {[
            { label: "Home", to: "/", icon: Home },
            { label: "Learn", to: "/academic", icon: BookOpen },
            { label: "Study", to: "/study-mode", icon: Timer },
            { label: "Arena", to: "/multiplayer", icon: Swords },
          ].map((item) => {
            const Icon = item.icon;
            const active = isActive(location.pathname, item.to);
            return <button type="button" key={item.to} onClick={() => go(item.to)} aria-current={active ? "page" : undefined} className={"flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold " + (active ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <Icon className="h-5 w-5" /><span>{item.label}</span>
            </button>;
          })}
          <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-label="More destinations" className={"flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold " + (moreOpen ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
            {moreOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}<span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
