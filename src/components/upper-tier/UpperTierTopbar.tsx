import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, Flame, Coins, Sparkles, GraduationCap } from "lucide-react";
import { useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";

type Props = { onOpenMenu: () => void };
const destinations: Array<[string, string]> = [
  ["/student-dashboard", "Dashboard"],
  ["/academic", "Learn · Academic hub"],
  ["/academic/setup", "Academic setup"],
  ["/academic/topics", "Topic coverage"],
  ["/academic/flashcards", "Flashcards"],
  ["/academic/exam", "Timed exam mode"],
  ["/academic/entrance-papers", "Entrance papers"],
  ["/academic/planner", "Study plan · Planner"],
  ["/academic/insights", "Progress insights"],
  ["/study-mode", "Study mode · Focus session"],
  ["/quiz", "Practice · Quiz"],
  ["/quiz/filter", "Quiz filters"],
  ["/revision", "Revision schedule"],
  ["/library", "Library · Learning resources"],
  ["/ai-tutor", "AI Tutor"],
  ["/learning-dna", "Learning profile · DNA"],
  ["/multiplayer", "Multiplayer challenge"],
  ["/lobby", "Challenge lobby"],
  ["/leaderboard", "Leaderboard · Rankings"],
  ["/tournaments", "Competitions · Tournaments"],
  ["/social", "Community · Social feed"],
  ["/social/community", "Study communities"],
  ["/friends", "Friends"],
  ["/chat", "Messages · Chat"],
  ["/store", "Rewards · Store"],
  ["/profile", "Profile"],
  ["/avatar-creator", "Avatar creator"],
  ["/settings", "Settings · Account"],
  ["/enhanced-settings", "Study preferences"],
  ["/notifications", "Notifications"],
  ["/parent-dashboard", "Parent progress view"],
];

export default function UpperTierTopbar({ onOpenMenu }: Props) {
  const { user } = useUser();
  const { coins, dailyStreak } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const grade = user?.grade
    ? (/grade/i.test(user.grade) ? user.grade : `Grade ${user.grade}`)
    : "Grades 9–12";
  const title = destinations.find(
    ([path]) => path === location.pathname || (path !== "/student-dashboard" && location.pathname.startsWith(`${path}/`)),
  )?.[1] || "Student workspace";
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? destinations.filter(([, label]) => label.toLowerCase().includes(q)).slice(0, 6) : [];
  }, [query]);
  const go = (path: string) => {
    navigate(path);
    setQuery("");
  };

  return (
    <header className="glass-nav-top sticky top-0 z-40">
      <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/70 md:hidden"
        >
          <span className="text-xl" aria-hidden="true">☰</span>
        </button>
        <div className="hidden min-w-0 md:block md:w-40 lg:w-48">
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">Student workspace</p>
        </div>
        <div className="relative min-w-0 flex-1 lg:max-w-[390px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
              if (event.key === "Enter" && results[0]) go(results[0][0]);
            }}
            placeholder="Search lessons, tools, resources…"
            aria-label="Search learning tools"
            aria-expanded={results.length > 0}
            className="h-10 w-full rounded-full border border-border/70 bg-background/70 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-border bg-card p-1 shadow-xl" role="listbox" aria-label="Search results">
              {results.map(([path, label]) => (
                <button
                  key={path}
                  type="button"
                  role="option"
                  onClick={() => go(path)}
                  className="block min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/65 px-3 py-2 sm:flex">
          <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold">{grade}</span>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/65 px-3 py-2 sm:flex" aria-label={`${dailyStreak} day study streak`}>
          <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <span className="text-xs font-bold tabular-nums">{dailyStreak}</span>
          <span className="hidden text-xs text-muted-foreground lg:inline">day streak</span>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/65 px-3 py-2 xl:flex" aria-label={`${coins} coins and ${Number(user?.xp || 0)} XP`}>
          <Coins className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <span className="text-xs font-bold tabular-nums">{coins.toLocaleString()}</span>
          <Sparkles className="ml-1 h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-bold tabular-nums">{Number(user?.xp || 0).toLocaleString()} XP</span>
        </div>
        <ThemeToggle className="h-10 w-10 shrink-0 rounded-xl" />
        <Link to="/notifications" aria-label="Notifications" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/70">
          <Bell className="h-5 w-5" />
        </Link>
        <Link to="/profile" aria-label="Open profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-primary/20">
          <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="sm" className="h-9 w-9" />
        </Link>
      </div>
    </header>
  );
}
