import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Gift,
  GraduationCap,
  Home,
  LibraryBig,
  LogOut,
  MessageCircle,
  Target,
  Trophy,
  UserRound,
  Users,
  Bot,
  X,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";

type Props = { onNavigate?: () => void; onSignOut: () => void };
const items = [
  { label: "Dashboard", to: "/student-dashboard", icon: Home },
  { label: "Learn", to: "/academic", icon: BookOpen },
  { label: "Practice", to: "/quiz", icon: Target },
  { label: "Study Plan", to: "/academic/planner", icon: CalendarDays },
  { label: "Library", to: "/library", icon: LibraryBig },
  { label: "AI Tutor", to: "/ai-tutor", icon: Bot },
  { label: "Community", to: "/social", icon: Users },
  { label: "Competitions", to: "/tournaments", icon: Trophy },
  { label: "Rewards", to: "/store", icon: Gift },
  { label: "Profile", to: "/profile", icon: UserRound },
];

function isActive(path: string, to: string) {
  if (to === "/student-dashboard") return path === "/student-dashboard" || path === "/";
  return path === to || path.startsWith(`${to}/`);
}

export default function UpperTierSidebar({ onNavigate, onSignOut }: Props) {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const grade = user?.grade
    ? (/grade/i.test(user.grade) ? user.grade : `Grade ${user.grade}`)
    : "Grades 9–12";
  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <>
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-border bg-card px-5 text-card-foreground">
        <img src="/brand/master-minds-icon.svg" alt="" className="h-9 w-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-extrabold text-foreground">Ethiomasterminds</p>
          <p className="text-xs font-medium text-muted-foreground">{grade} workspace</p>
        </div>
        <button type="button" data-drawer-close onClick={onNavigate} aria-label="Close navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground/75 hover:bg-muted hover:text-foreground md:hidden">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/60 p-3 text-foreground">
        <AvatarRenderer
          avatar={user?.avatar}
          avatarConfig={user?.avatarConfig}
          size="md"
          className="h-10 w-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{user?.name || user?.username || "Student"}</p>
          <p className="text-xs font-medium text-muted-foreground">{grade}</p>
        </div>
      </div>
      <nav
        aria-label="Grades 9 to 12 navigation"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5"
      >
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">
          Student space
        </p>
        {items.map(({ label, to, icon: Icon }) => {
          const selected = isActive(location.pathname, to);
          return (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              aria-current={selected ? "page" : undefined}
              className={`glass-nav-item flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/75 hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-border/60 p-3">
        <Link
          to="/friends"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground/75 hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          Friends & messages
        </Link>
        <Link
          to="/academic/entrance-papers"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        >
          <GraduationCap className="h-[18px] w-[18px]" />
          Entrance papers
        </Link>
        <Link
          to="/settings"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        >
          <UserRound className="h-[18px] w-[18px]" />
          Settings
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-foreground/75 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </>
  );
}
