import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, BookOpen, Target, CalendarDays, LibraryBig, Bot, BrainCircuit,
  Timer, Swords, Trophy, Users, MessageCircle, Gift, Settings, Bell,
  LogOut, UserRound, GraduationCap, BarChart3, Layers3, ChevronRight,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";

type Props = { onNavigate?: () => void; onSignOut: () => void };
type Item = { label: string; to: string; icon: typeof Home };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  { label: "Learn", items: [
    { label: "Overview", to: "/", icon: Home },
    { label: "Academic preparation", to: "/academic", icon: GraduationCap },
    { label: "Textbooks & library", to: "/library", icon: LibraryBig },
    { label: "Study Mode", to: "/study-mode", icon: Timer },
    { label: "AI Tutor", to: "/ai-tutor", icon: Bot },
    { label: "Learning DNA", to: "/learning-dna", icon: BrainCircuit },
  ]},
  { label: "Practice", items: [
    { label: "Quizzes & practice", to: "/quiz", icon: Target },
    { label: "Topic coverage", to: "/academic/topics", icon: BookOpen },
    { label: "Flashcards", to: "/academic/flashcards", icon: Layers3 },
    { label: "Exam preparation", to: "/academic/exam", icon: GraduationCap },
    { label: "Entrance papers", to: "/academic/entrance-papers", icon: BookOpen },
    { label: "Study planner", to: "/academic/planner", icon: CalendarDays },
    { label: "Academic insights", to: "/academic/insights", icon: BarChart3 },
  ]},
  { label: "Compete", items: [
    { label: "Multiplayer arena", to: "/multiplayer", icon: Swords },
    { label: "Tournaments", to: "/tournaments", icon: Trophy },
    { label: "Leaderboards", to: "/leaderboard", icon: BarChart3 },
  ]},
  { label: "Community", items: [
    { label: "Friends", to: "/friends", icon: Users },
    { label: "Social", to: "/social", icon: MessageCircle },
    { label: "Messages", to: "/chat", icon: MessageCircle },
  ]},
];

const extra: Item[] = [
  { label: "Challenge lobby", to: "/lobby", icon: Swords },
  { label: "Rewards store", to: "/store", icon: Gift },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Settings", to: "/settings", icon: Settings },
];

function active(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(to + "/");
}

export default function UpperTierSidebar({ onNavigate, onSignOut }: Props) {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const grade = user?.grade ? (/grade/i.test(user.grade) ? user.grade : `Grade ${user.grade}`) : "Grades 9–12";
  const go = (to: string) => { navigate(to); onNavigate?.(); };

  return (
    <>
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-border/60 px-5">
        <img src="/brand/master-minds-icon.svg" alt="Master Minds" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0"><p className="truncate font-display text-base font-extrabold">Master Minds</p><p className="text-xs text-muted-foreground">{grade} workspace</p></div>
      </div>
      <div className="mx-3 mt-4 flex items-center gap-3 rounded-2xl border border-border/50 bg-background/45 p-3">
        <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-10 w-10 shrink-0" />
        <div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name || user?.username || "Student"}</p><p className="text-xs text-muted-foreground">{grade}</p></div>
      </div>
      <nav aria-label="Grades 9 to 12 navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map(group => <section key={group.label}>
          <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{group.label}</h2>
          <div className="space-y-1">{group.items.map(item => { const Icon=item.icon; const selected=active(location.pathname,item.to); return (
            <button key={item.to} type="button" onClick={() => go(item.to)} aria-current={selected ? "page" : undefined} className={`glass-nav-item flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "glass-pill-active" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true"/><span className="min-w-0 flex-1 truncate">{item.label}</span>{selected && <ChevronRight className="h-4 w-4" aria-hidden="true"/>}
            </button>
          );})}</div>
        </section>)}
        <section><h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">More</h2><div className="space-y-1">{extra.map(item => {const Icon=item.icon; const selected=active(location.pathname,item.to); return <button key={item.to} type="button" onClick={()=>go(item.to)} aria-current={selected?"page":undefined} className={`glass-nav-item flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all duration-200 ${selected?"glass-pill-active":"text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}><Icon className="h-[18px] w-[18px] shrink-0"/><span className="truncate">{item.label}</span></button>;})}</div></section>
      </nav>
      <div className="space-y-1 border-t border-border/60 p-3">
        <Link to="/profile" onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground"><UserRound className="h-[18px] w-[18px]"/>My profile</Link>
        <button type="button" onClick={onSignOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut className="h-[18px] w-[18px]"/>Sign out</button>
      </div>
    </>
  );
}
