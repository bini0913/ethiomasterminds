import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, CircleUserRound, Flame, GraduationCap, LogOut, Menu, Settings, Trophy, X } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import { getXpProgressInLevel } from "@/lib/rankSystem";
import { cn } from "@/lib/utils";
import {
  getMiddlePageTitle,
  getMiddlePrimaryItem,
  isMiddlePathActive,
  middleDrawerGroups,
  middleGroupLabels,
  middlePrimaryNav,
  middleSecondaryNav,
  type MiddleNavGroup,
  type MiddleNavItem,
} from "./middleTierNavigation";

const navItemClass = (active: boolean, compact = false) => cn(
  "group flex min-h-11 items-center rounded-2xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  compact ? "justify-center px-2" : "gap-3 px-3",
  active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground",
);

const MiddleTierShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(true);
  const drawerTriggerRef = React.useRef<HTMLButtonElement>(null);
  const profileTriggerRef = React.useRef<HTMLButtonElement>(null);
  const drawerRef = React.useRef<HTMLElement>(null);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Learner";
  const xpProgress = getXpProgressInLevel(user?.xp ?? 0);
  const activePrimary = getMiddlePrimaryItem(location.pathname);
  const pageTitle = getMiddlePageTitle(location.pathname);
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";

  const closeDrawer = React.useCallback(() => {
    setMobileMenuOpen(false);
    window.setTimeout(() => drawerTriggerRef.current?.focus(), 0);
  }, []);

  const closeProfile = React.useCallback(() => {
    setProfileOpen(false);
    window.setTimeout(() => profileTriggerRef.current?.focus(), 0);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  React.useEffect(() => {
    if (!mobileMenuOpen && !profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mobileMenuOpen) closeDrawer();
        else closeProfile();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    if (mobileMenuOpen) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDrawer, closeProfile, mobileMenuOpen, profileOpen]);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>("a,button");
    firstFocusable?.focus();
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    if (!profileOpen) return;
    profileMenuRef.current?.querySelector<HTMLElement>("a,button")?.focus();
  }, [profileOpen]);

  const renderNavItem = (item: MiddleNavItem, compact = false, onNavigate?: () => void) => {
    const Icon = item.icon;
    const active = isMiddlePathActive(location.pathname, item.match);
    return (
      <Link
        key={item.id}
        to={item.path}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={compact ? item.label : undefined}
        title={compact ? item.label : undefined}
        className={navItemClass(active, compact)}
      >
        <Icon className={cn("shrink-0", compact ? "h-5 w-5" : "h-[1.1rem] w-[1.1rem]")} aria-hidden="true" />
        {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {!compact && active && <span className="h-1.5 w-1.5 rounded-full bg-current/70" aria-hidden="true" />}
      </Link>
    );
  };

  const renderGroup = (group: MiddleNavGroup, compact = false) => {
    const items = middleSecondaryNav.filter((item) => item.group === group);
    if (!items.length) return null;
    return (
      <div key={group} className="space-y-1">
        {!compact && <p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">{middleGroupLabels[group]}</p>}
        {items.map((item) => renderNavItem(item, compact, closeDrawer))}
      </div>
    );
  };

  return (
    <div className="tier-middle min-h-screen bg-background text-foreground">
      <aside className="glass-panel fixed inset-y-0 left-0 z-40 hidden w-[4.5rem] flex-col border-r border-border/70 px-2 py-5 md:flex lg:w-64 lg:px-3">
        <Link to="/" aria-label="Master Minds home" className="mb-7 flex items-center justify-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:justify-start lg:px-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><GraduationCap className="h-5 w-5" aria-hidden="true" /></span>
          <span className="hidden min-w-0 lg:block"><span className="block font-display text-lg font-extrabold tracking-tight">Master Minds</span><span className="block text-xs font-semibold text-muted-foreground">Grades 5–8 · Learn boldly</span></span>
        </Link>

        <nav aria-label="Grades 5–8 navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto">
          <div className="space-y-1">{middlePrimaryNav.map((item) => renderNavItem(item, true))}</div>
          <div className="hidden border-t border-border/70 pt-4 lg:block">
            <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} className="flex min-h-10 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">+</span><span className="flex-1">More tools</span><ChevronRight className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-90")} aria-hidden="true" />
            </button>
            {moreOpen && <div className="mt-2 space-y-4 border-l border-border pl-3">{middleDrawerGroups.map((group) => renderGroup(group))}</div>}
          </div>
        </nav>

        <div className="mt-4 border-t border-border/70 pt-4">
          <Link to={profilePath} className="flex items-center justify-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:justify-start lg:px-3">
            <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 shrink-0 ring-2 ring-primary/20" />
            <span className="hidden min-w-0 flex-1 lg:block"><span className="block truncate text-sm font-bold">{firstName}</span><span className="block text-xs text-muted-foreground">Level {user?.level ?? 1} · {xpProgress.current}/{xpProgress.max} XP</span></span>
            <CircleUserRound className="hidden h-4 w-4 text-muted-foreground lg:block" aria-hidden="true" />
          </Link>
          <div className="mt-2 hidden grid-cols-2 gap-1 lg:grid"><Link to="/settings" className="flex min-h-10 items-center justify-center rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Settings</Link><button type="button" onClick={handleLogout} className="flex min-h-10 items-center justify-center rounded-xl text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive">Log out</button></div>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[4.5rem] lg:pl-64">
        <header className="glass-nav-top sticky top-0 z-30">
          <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <button ref={drawerTriggerRef} type="button" onClick={() => { setMobileMenuOpen(true); setProfileOpen(false); }} aria-label="Open Grades 5–8 navigation" aria-expanded={mobileMenuOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"><Menu className="h-5 w-5" aria-hidden="true" /></button>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Grades 5–8</p><h1 className="truncate font-display text-xl font-extrabold tracking-tight">{pageTitle}</h1></div>
            <div className="hidden items-center gap-2 sm:flex"><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold tabular-nums"><Flame className="h-4 w-4 text-warning" aria-hidden="true" />{dailyStreak} day streak</span><span className="rounded-full border border-border bg-card px-3 py-2 text-xs font-bold tabular-nums">{coins.toLocaleString()} coins</span></div>
            <ThemeToggle className="h-11 w-11 rounded-2xl" />
            <Link to="/notifications" aria-label="Notifications" className="hidden h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"><Bell className="h-5 w-5" aria-hidden="true" /></Link>
            <button ref={profileTriggerRef} type="button" onClick={() => { setProfileOpen((open) => !open); setMobileMenuOpen(false); }} aria-label="Open profile menu" aria-expanded={profileOpen} className={cn("flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", profileOpen && "ring-2 ring-primary ring-offset-2 ring-offset-background")}><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-2 ring-primary/20" /></button>
          </div>
          {profileOpen && <div ref={profileMenuRef} role="menu" aria-label="Profile menu" className="absolute right-3 top-[4.75rem] z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-3xl border border-border bg-card p-3 shadow-2xl"><div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-12 w-12 ring-2 ring-primary/20" /><div className="min-w-0"><p className="truncate font-bold">{user?.name || firstName}</p><p className="text-xs text-muted-foreground">Level {user?.level ?? 1} · {xpProgress.current}/{xpProgress.max} XP</p></div></div><div className="mt-2 space-y-1"><Link role="menuitem" to={profilePath} onClick={closeProfile} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-muted"><CircleUserRound className="h-4 w-4 text-primary" aria-hidden="true" /> My profile</Link><Link role="menuitem" to="/notifications" onClick={closeProfile} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-muted"><Bell className="h-4 w-4 text-primary" aria-hidden="true" /> Notifications</Link><Link role="menuitem" to="/settings" onClick={closeProfile} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-muted"><Settings className="h-4 w-4 text-primary" aria-hidden="true" /> Settings</Link><button role="menuitem" type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-destructive hover:bg-destructive/10"><LogOut className="h-4 w-4" aria-hidden="true" /> Log out</button></div></div>}
        </header>

        <main className="mx-auto min-h-[calc(100vh-4.5rem)] max-w-7xl pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8">{children}</main>
      </div>

      {mobileMenuOpen && <div className="fixed inset-0 z-[60] bg-foreground/40 md:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}><aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="Grades 5–8 navigation" className="glass-panel flex h-full w-[min(21rem,90vw)] flex-col border-r border-border px-4 pb-6 pt-5 shadow-2xl"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" aria-hidden="true" /></span><div><p className="font-display font-extrabold">Master Minds</p><p className="text-xs text-muted-foreground">Grades 5–8 workspace</p></div></div><button type="button" onClick={closeDrawer} aria-label="Close navigation" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button></div><div className="mt-6 flex-1 space-y-6 overflow-y-auto pb-4"><div className="space-y-1">{middlePrimaryNav.map((item) => renderNavItem(item, false, closeDrawer))}</div>{middleDrawerGroups.map((group) => <div key={group} className="space-y-2 border-t border-border pt-4">{renderGroup(group)}</div>)}</div><div className="border-t border-border pt-4"><Link to={profilePath} onClick={closeDrawer} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted"><AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9 ring-2 ring-primary/20" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{firstName}</span><CircleUserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></Link></div></aside></div>}

      <div className="glass-nav-dock fixed inset-x-0 bottom-0 z-50 border-t border-border/70 pb-[env(safe-area-inset-bottom)] md:hidden"><nav aria-label="Primary Grades 5–8 navigation" className="mx-auto flex h-16 max-w-lg items-center justify-around gap-1 px-1 sm:h-[4.25rem] sm:px-3">{middlePrimaryNav.slice(0, 4).map((item) => { const Icon = item.icon; const active = activePrimary?.id === item.id; return <Link key={item.id} to={item.path} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}><Icon className="h-5 w-5" aria-hidden="true" /><span>{item.label}</span></Link>; })}<Link to="/leaderboard" aria-current={location.pathname.startsWith("/leaderboard") ? "page" : undefined} className={cn("flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", location.pathname.startsWith("/leaderboard") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}><Trophy className="h-5 w-5" aria-hidden="true" /><span>Rank</span></Link></nav></div>
    </div>
  );
};

export default MiddleTierShell;
