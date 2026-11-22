import { lazy, Suspense } from "react";
import RouteErrorBoundary from "@/components/layout/RouteErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation, useNavigate } from "react-router-dom";
const Index = lazy(() => import("./pages/Index"));
const Quiz = lazy(() => import("./pages/Quiz"));
const QuizFilter = lazy(() => import("./pages/QuizFilter"));
const Multiplayer = lazy(() => import("./pages/Multiplayer"));
const Lobby = lazy(() => import("./pages/Lobby"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Friends = lazy(() => import("./pages/Friends"));
const Settings = lazy(() => import("./pages/Settings"));
const EnhancedSettings = lazy(() => import("./pages/EnhancedSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const TeacherPortal = lazy(() => import("./pages/TeacherPortal"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StudentDashboardRoute = lazy(() => import("./components/dashboard/StudentDashboardRoute"));
const SchoolManagerPortal = lazy(() => import("./pages/SchoolManagerPortal"));
const SchoolLeadershipPortal = lazy(() => import("./pages/SchoolLeadershipPortal"));
const SchoolLeadershipGate = lazy(() => import("./components/school/SchoolLeadershipGate"));
const SchoolTeacherPortal = lazy(() => import("./pages/SchoolTeacherPortal"));
const SchoolParentPortal = lazy(() => import("./pages/SchoolParentPortal"));
const SchoolFinancePortal = lazy(() => import("./pages/SchoolFinancePortal"));
const SchoolStudentPortal = lazy(() => import("./pages/SchoolStudentPortal"));
const SchoolGlobalAdminPortal = lazy(() => import("./pages/SchoolGlobalAdminPortal"));
const NetworkSuperAdminPortal = lazy(() => import("./pages/NetworkSuperAdminPortal"));
const Chat = lazy(() => import("./pages/Chat"));
const AITutor = lazy(() => import("./pages/AITutor"));
const LearningDNA = lazy(() => import("./pages/LearningDNA"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const FinancePortal = lazy(() => import("./pages/FinancePortal"));
const TimeTravelRevision = lazy(() => import("./pages/TimeTravelRevision"));
const EnhancedSocial = lazy(() => import("./pages/EnhancedSocial"));
const SocialHub = lazy(() => import("./pages/SocialHub"));
const AvatarCreator = lazy(() => import("./pages/AvatarCreator"));
const AcademicMode = lazy(() => import("./pages/AcademicMode"));
const AcademicSetup = lazy(() => import("./pages/AcademicSetup"));
const FlashcardsPage = lazy(() => import("./pages/FlashcardsPage"));
const TopicCoveragePage = lazy(() => import("./pages/TopicCoveragePage"));
const ExamModePage = lazy(() => import("./pages/ExamModePage"));
const EntranceExamPapersPage = lazy(() => import("./pages/EntranceExamPapersPage"));
const StudyPlannerPage = lazy(() => import("./pages/StudyPlannerPage"));
const AcademicInsightsPage = lazy(() => import("./pages/AcademicInsightsPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const StudyModePage = lazy(() => import("./pages/StudyModePage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const EarlyGamesPage = lazy(() => import("./pages/EarlyGamesPage"));
const EarlyQuizPage = lazy(() => import("./pages/EarlyQuizPage"));
const EarlyVideosPage = lazy(() => import("./pages/EarlyVideosPage"));
const EarlyDiscoverPage = lazy(() => import("./pages/EarlyDiscoverPage"));
const EarlyExplorePage = lazy(() => import("./pages/EarlyExplorePage"));
const EarlyProgressPage = lazy(() => import("./pages/EarlyProgressPage"));
const EarlyCollectionPage = lazy(() => import("./pages/EarlyCollectionPage"));
const EarlyProfilePage = lazy(() => import("./pages/EarlyProfilePage"));
const EarlyLeaderboardPage = lazy(() => import("./pages/EarlyLeaderboardPage"));
import EarlyTierOnlyRoute from "./components/auth/EarlyTierOnlyRoute";
const EarlyContentAdminPage = lazy(() => import("./pages/EarlyContentAdminPage"));
const ExtremeAdminPortal = lazy(() => import("./pages/ExtremeAdminPortal"));
const SupabaseMigration = lazy(() => import("./pages/SupabaseMigration"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import EarlyTierRestrictedRoute from "./components/auth/EarlyTierRestrictedRoute";
import { UserProvider } from "./context/UserContext";
import { SchoolPortalProvider } from "./context/SchoolPortalContext";
import SchoolPortalGate from "./components/school/SchoolPortalGate";
import { TierProvider } from "./context/TierContext";
import { QuizProvider } from "./context/QuizContext";
import { AIHelperProvider } from "./context/AIHelperContext";
import { FriendsProvider } from "./context/FriendsContext";
import { LanguageProvider } from "./context/LanguageContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AchievementsProvider } from "./context/AchievementsContext";
import { RoomProvider } from "./context/RoomContext";
import { ChatProvider } from "./context/ChatContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ArrowLeft, Home, LogOut, BookOpen, BrainCircuit, Timer, Swords, Trophy, Users, Library, Bot, Bell, CalendarDays, Target, BarChart3, Layers3, ChevronRight, Settings as SettingsIcon, UserRound, GraduationCap, Sparkles } from "lucide-react";
import { useUser } from "./context/UserContext";
import AIHelper from "./components/ai/AIHelper";
import NativeBackHandler from "./components/mobile/NativeBackHandler";
import NotificationBootstrap from "./components/notifications/NotificationBootstrap";
import NotificationRouteHandler from "./components/notifications/NotificationRouteHandler";
import SocialRealtimeNotifications from "./components/notifications/SocialRealtimeNotifications";
import StudentBottomNav from "./components/layout/StudentBottomNav";
import MiddleTierShell from "./components/layout/MiddleTierShell";
import UpperTierStudioShell from "./components/layout/UpperTierStudioShell";
import { getUserTier } from "./lib/getUserTier";

const queryClient = new QueryClient();

const appRouteTitles: Array<{ prefix: string; title: string }> = [
  { prefix: "/quiz/filter", title: "Quiz Setup" },
  { prefix: "/early-games", title: "Play" },
  { prefix: "/early-quiz", title: "Quick Quiz" },
  { prefix: "/early-discover", title: "Discover" },
  { prefix: "/early-videos", title: "Videos & Stories" },
  { prefix: "/early-explore", title: "Explore" },
  { prefix: "/early-progress", title: "My Progress" },
  { prefix: "/early-collection", title: "My Collection" },
  { prefix: "/early-profile", title: "My Profile" },
  { prefix: "/early-ranks", title: "Early Ranks" },
  { prefix: "/quiz", title: "Quiz" },
  { prefix: "/study-mode", title: "Study Mode" },
  { prefix: "/library", title: "Library" },
  { prefix: "/ai-tutor", title: "AI Tutor" },
  { prefix: "/academic/flashcards", title: "Flashcards" },
  { prefix: "/academic/topics", title: "Topics" },
  { prefix: "/academic/exam", title: "Exam Mode" },
  { prefix: "/academic/planner", title: "Study Planner" },
  { prefix: "/academic/insights", title: "Academic Insights" },
  { prefix: "/academic", title: "Academic Mode" },
  { prefix: "/learning-dna", title: "Learning DNA" },
  { prefix: "/lobby", title: "Game Lobby" },
  { prefix: "/multiplayer", title: "Multiplayer" },
  { prefix: "/tournaments", title: "Tournaments" },
  { prefix: "/leaderboard", title: "Ranks" },
  { prefix: "/friends", title: "Friends" },
  { prefix: "/chat", title: "Chat" },
  { prefix: "/social", title: "Social" },
  { prefix: "/store", title: "Rewards Store" },
  { prefix: "/avatar-creator", title: "Avatar" },
  { prefix: "/profile/", title: "Profile" },
  { prefix: "/notifications", title: "Notifications" },
  { prefix: "/enhanced-settings", title: "Settings" },
  { prefix: "/settings", title: "Settings" },
  { prefix: "/revision", title: "Revision" },
  { prefix: "/parent-dashboard", title: "Parent Dashboard" },
  { prefix: "/teacher", title: "Teacher Portal" },
  { prefix: "/admin/early-content", title: "Early Content" },
  { prefix: "/admin", title: "Admin Portal" },
  { prefix: "/school/manager", title: "School Manager Portal" },
  { prefix: "/school/admin", title: "School Leadership Portal" },
  { prefix: "/school/teacher", title: "School Teacher Portal" },
  { prefix: "/school/parent", title: "School Parent Portal" },
  { prefix: "/school/finance", title: "School Finance Portal" },
  { prefix: "/school/student", title: "School Student Portal" },
  { prefix: "/school/super-admin", title: "School Network Administration" },
  { prefix: "/manager", title: "School Manager Portal" },
  { prefix: "/manager-dashboard", title: "School Manager Portal" },
  { prefix: "/finance", title: "Finance Portal" },
  { prefix: "/super-admin", title: "Super Admin Control Center" },
  { prefix: "/root-control-portal-9xA7", title: "Control Portal" },
];

const getAppRouteTitle = (pathname: string) => {
  if (pathname === "/") return "Home";
  return appRouteTitles.find((route) => pathname.startsWith(route.prefix))?.title ?? "Master Minds";
};

const AppChrome = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useUser();

  // Standalone role workspaces provide their own navigation and layout.
  if (location.pathname === "/finance" || location.pathname.startsWith("/finance/") || location.pathname === "/super-admin" || location.pathname.startsWith("/school/")) return <>{children}</>;

  if (!isAuthenticated || !user) return <>{children}</>;
  if (user.role === "student" && getUserTier(user.grade) === "upper") return <UpperTierStudioShell>{children}</UpperTierStudioShell>;

  const isHome = location.pathname === "/";
  const isUpperStudent = getUserTier(user?.grade) === "upper";
  const isStudent = user.role === "student";
  const isMiddleStudent = isStudent && getUserTier(user?.grade) === "middle";
  // Grades 9–12 home renders its own screenshot-matched responsive shell.
  // Wrapping it here creates a second sidebar, header and desktop navigation.
  if (isHome && !isUpperStudent) {
    if (isMiddleStudent) return <MiddleTierShell>{children}</MiddleTierShell>;
    return <>{children}</>;
  }
  const showBottomNav = isStudent && !isUpperStudent ? true : isUpperStudent;

  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  if (isMiddleStudent) return <MiddleTierShell>{children}</MiddleTierShell>;

  return (
    <div className={isUpperStudent ? "min-h-screen bg-background mm-studio-upper" : "min-h-screen bg-background"}>
      {isUpperStudent && <aside className="mm-studio-upper-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r px-4 py-5 lg:flex">
        <button type="button" onClick={() => navigate("/")} className="mb-7 flex items-center gap-3 rounded-xl px-2 text-left"><span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border"><img src="/brand/master-minds-icon.svg" alt="" className="h-full w-full"/></span><span><span className="block font-display text-base font-bold">Master Minds</span><span className="block text-xs text-muted-foreground">Grades 9–12</span><span className="mt-1 block text-[10px] text-muted-foreground">Academic Year 2017 E.C. · 2024/25 G.C.</span></span></button>
        <nav aria-label="High school navigation" className="flex-1 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Workspace</p>
          <button type="button" onClick={() => navigate("/")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${location.pathname === "/" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Home className="h-4 w-4"/> Home</button>
          <button type="button" onClick={() => navigate("/study-mode")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${location.pathname === "/study-mode" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Timer className="h-4 w-4"/> Study Mode</button>
          <button type="button" onClick={() => navigate("/academic")} aria-current={location.pathname === "/academic" || location.pathname.startsWith("/academic/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BookOpen className="h-4 w-4"/> Academic Mode <ChevronRight className="ml-auto h-4 w-4"/></button>
          <div className="ml-4 space-y-1 border-l border-border pl-3">
            <button type="button" onClick={() => navigate("/academic/topics")} aria-current={location.pathname === "/academic/topics" || location.pathname.startsWith("/academic/topics/") ? "page" : undefined} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Layers3 className="h-4 w-4"/> Topic Coverage</button>
            <button type="button" onClick={() => navigate("/academic/flashcards")} aria-current={location.pathname === "/academic/flashcards" || location.pathname.startsWith("/academic/flashcards/") ? "page" : undefined} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BrainCircuit className="h-4 w-4"/> Flashcards & Revision</button>
            <button type="button" onClick={() => navigate("/academic/exam")} aria-current={location.pathname === "/academic/exam" || location.pathname.startsWith("/academic/exam/") ? "page" : undefined} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Target className="h-4 w-4"/> Exam Mode</button>
          <button type="button" onClick={() => navigate("/academic/entrance-papers")} aria-current={location.pathname === "/academic/entrance-papers" || location.pathname.startsWith("/academic/entrance-papers/") ? "page" : undefined} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><GraduationCap className="h-4 w-4"/> Entrance Papers</button>
            <button type="button" onClick={() => navigate("/academic/planner")} aria-current={location.pathname === "/academic/planner" || location.pathname.startsWith("/academic/planner/") ? "page" : undefined} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><CalendarDays className="h-4 w-4"/> Study Planner</button>
            <button type="button" onClick={() => navigate("/academic/insights")} aria-current={location.pathname === "/academic/insights" || location.pathname.startsWith("/academic/insights/") ? "page" : undefined} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BarChart3 className="h-4 w-4"/> Academic Insights</button>
          </div>
          <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Connect</p>
          <button type="button" onClick={() => navigate("/multiplayer")} aria-current={location.pathname === "/multiplayer" || location.pathname.startsWith("/multiplayer/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Swords className="h-4 w-4"/> Multiplayer</button>
          <button type="button" onClick={() => navigate("/tournaments")} aria-current={location.pathname === "/tournaments" || location.pathname.startsWith("/tournaments/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Trophy className="h-4 w-4"/> Tournaments</button>
          <button type="button" onClick={() => navigate("/learning-dna")} aria-current={location.pathname === "/learning-dna" || location.pathname.startsWith("/learning-dna/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BrainCircuit className="h-4 w-4"/> Learning DNA</button>
          <button type="button" onClick={() => navigate("/friends")} aria-current={location.pathname === "/friends" || location.pathname.startsWith("/friends/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Users className="h-4 w-4"/> Friends</button>
          <button type="button" onClick={() => navigate("/library")} aria-current={location.pathname === "/library" || location.pathname.startsWith("/library/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Library className="h-4 w-4"/> Library</button>
          <button type="button" onClick={() => navigate("/ai-tutor")} aria-current={location.pathname === "/ai-tutor" || location.pathname.startsWith("/ai-tutor/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Bot className="h-4 w-4"/> AI Tutor</button>
          <button type="button" onClick={() => navigate("/notifications")} aria-current={location.pathname === "/notifications" || location.pathname.startsWith("/notifications/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="h-4 w-4"/> Notifications</button>
        </nav>
        <div className="mt-4 border-t border-border pt-3"><button type="button" onClick={() => navigate("/settings")} aria-current={location.pathname === "/settings" || location.pathname.startsWith("/settings/") ? "page" : undefined} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><SettingsIcon className="h-4 w-4"/> Settings</button><button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut className="h-4 w-4"/> Log out</button></div>
      </aside>}
      {isUpperStudent && <aside aria-label="Quick navigation" className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center gap-2 border-r border-border bg-card py-5 md:flex lg:hidden">
        <button type="button" title="Studio" aria-label="Studio" onClick={() => navigate("/")} className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${location.pathname === "/" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Home className="h-5 w-5"/></button>
        <button type="button" title="Exam Prep" aria-label="Exam Prep" onClick={() => navigate("/academic/exam")} className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${location.pathname.startsWith("/academic/exam") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Target className="h-5 w-5"/></button>
        <button type="button" title="Focus" aria-label="Focus" onClick={() => navigate("/study-mode")} className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${location.pathname === "/study-mode" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Timer className="h-5 w-5"/></button>
        <button type="button" title="Review" aria-label="Review" onClick={() => navigate("/academic/flashcards")} className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${location.pathname.startsWith("/academic/flashcards") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><BrainCircuit className="h-5 w-5"/></button>
        <button type="button" title="Library" aria-label="Library" onClick={() => navigate("/library")} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Library className="h-5 w-5"/></button>
        <div className="mt-auto flex flex-col items-center gap-1 px-1 text-center text-[9px] leading-tight text-muted-foreground"><span>2017 E.C.</span><span>2024/25</span></div>
      </aside>}
      <div className={isUpperStudent ? "mm-studio-upper-content md:pl-[72px] lg:pl-64" : ""}>
      {!isHome && <header className={isUpperStudent ? "sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80" : "sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"}>
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleBack}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Go back"
                title="Go back"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{getAppRouteTitle(location.pathname)}</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {user.name || user.username || "Master Minds"}
              </p>
            </div>
          </div>
          {isUpperStudent && <>
            <span className="hidden items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold tabular-nums sm:inline-flex" aria-label={`Experience points: ${user.xp || 0}`}><Sparkles className="h-3.5 w-3.5 text-primary"/>{(user.xp || 0).toLocaleString()} XP</span>
            <button type="button" onClick={() => navigate("/notifications")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Notifications" title="Notifications"><Bell className="h-4 w-4" /></button>
            <button type="button" onClick={() => navigate(user.id ? `/profile/${user.id}` : "/settings")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Profile" title="Profile"><UserRound className="h-4 w-4" /></button>
          </>}
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>}
      <div className={`${showBottomNav && !isHome ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" + (isUpperStudent ? " lg:pb-0" : "") : ""}`}>{children}</div>
      {showBottomNav && <div className={isUpperStudent ? "lg:hidden" : ""}><StudentBottomNav /></div>}
      </div>
    </div>
  );
};


const LegacyTeacherPortalRoute = () => {
  const { memberships, loading } = useSchoolPortal();
  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading teacher workspace…</div>;
  }
  if (memberships.some((membership) => membership.school_role === "teacher" && membership.status === "active")) {
    return <Navigate to="/school/teacher" replace />;
  }
  return <TeacherPortal />;
};

const SelfProfileRedirect = () => {
  const { user, session } = useUser();
  const targetUserId = user?.id || session?.user?.id;

  if (!targetUserId) return <Navigate to="/settings" replace />;
  return <Navigate to={`/profile/${targetUserId}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <UserProvider>
        <SchoolPortalProvider>
        <TierProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <AchievementsProvider>
                <QuizProvider>
                  <RoomProvider>
                    <AIHelperProvider>
                      <FriendsProvider>
                        <ChatProvider>
                          <TooltipProvider>
                          <Toaster />
                          <Sonner />
                          <BrowserRouter>
                            <AppChrome>
                            <Suspense fallback={
                              <div className="min-h-screen flex items-center justify-center bg-background">
                                <div className="text-center">
                                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                  <p className="text-sm text-muted-foreground">Loading Master Minds…</p>
                                </div>
                              </div>
                            }>
                            <RouteErrorBoundary>
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/quiz" element={<EarlyTierRestrictedRoute><ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Quiz /></ProtectedRoute></EarlyTierRestrictedRoute>} />
                              <Route path="/early-games" element={<EarlyTierOnlyRoute><EarlyGamesPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-quiz" element={<EarlyTierOnlyRoute><EarlyQuizPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-videos" element={<EarlyTierOnlyRoute><EarlyVideosPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-discover" element={<EarlyTierOnlyRoute><EarlyDiscoverPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-explore" element={<EarlyTierOnlyRoute><EarlyExplorePage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-progress" element={<EarlyTierOnlyRoute><EarlyProgressPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-collection" element={<EarlyTierOnlyRoute><EarlyCollectionPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-profile" element={<EarlyTierOnlyRoute><EarlyProfilePage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-ranks" element={<EarlyTierOnlyRoute><EarlyLeaderboardPage /></EarlyTierOnlyRoute>} />
                              <Route path="/quiz/filter" element={<EarlyTierRestrictedRoute><ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><QuizFilter /></ProtectedRoute></EarlyTierRestrictedRoute>} />
                              <Route path="/multiplayer" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Multiplayer /></ProtectedRoute>} />
                              <Route path="/lobby" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Lobby /></ProtectedRoute>} />
                              <Route path="/leaderboard" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Leaderboard /></ProtectedRoute>} />
                              <Route path="/profile" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><SelfProfileRedirect /></ProtectedRoute>} />
                              <Route path="/profile/:userId" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><UserProfilePage /></ProtectedRoute>} />
                              <Route path="/friends" element={<EarlyTierRestrictedRoute><Friends /></EarlyTierRestrictedRoute>} />
                              <Route path="/settings" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Settings /></ProtectedRoute>} />
                              <Route path="/notifications" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><NotificationSettingsPage /></ProtectedRoute>} />
                              <Route path="/chat" element={<EarlyTierRestrictedRoute><Chat /></EarlyTierRestrictedRoute>} />
                              <Route path="/teacher" element={<ProtectedRoute allowedRoles={["teacher"]}><LegacyTeacherPortalRoute /></ProtectedRoute>} />
                              <Route
                                path="/admin/early-content"
                                element={
                                  <ProtectedRoute allowedRoles={["admin", "extreme_admin"]}>
                                    <EarlyContentAdminPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin", "extreme_admin"]}><AdminPortal /></ProtectedRoute>} />
                              <Route path="/student-dashboard" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboardRoute /></ProtectedRoute>} />
                              <Route path="/school/manager" element={<ProtectedRoute allowedRoles={["manager"]}><SchoolPortalGate role="manager"><SchoolManagerPortal /></SchoolPortalGate></ProtectedRoute>} />
                              <Route path="/school/admin" element={<ProtectedRoute allowedRoles={["teacher", "finance"]}><SchoolLeadershipGate><SchoolLeadershipPortal /></SchoolLeadershipGate></ProtectedRoute>} />
                              <Route path="/school/teacher" element={<ProtectedRoute allowedRoles={["teacher"]}><SchoolPortalGate role="teacher"><SchoolTeacherPortal /></SchoolPortalGate></ProtectedRoute>} />
                              <Route path="/school/parent" element={<ProtectedRoute allowedRoles={["parent"]}><SchoolPortalGate role="parent"><SchoolParentPortal /></SchoolPortalGate></ProtectedRoute>} />
                              <Route path="/school/finance" element={<ProtectedRoute allowedRoles={["finance"]}><SchoolPortalGate role="finance"><SchoolFinancePortal /></SchoolPortalGate></ProtectedRoute>} />
                              <Route path="/school/student" element={<ProtectedRoute allowedRoles={["student"]}><SchoolPortalGate role="student"><SchoolStudentPortal /></SchoolPortalGate></ProtectedRoute>} />
                              <Route path="/school/super-admin" element={<ProtectedRoute allowedRoles={["extreme_admin"]}><SchoolGlobalAdminPortal /></ProtectedRoute>} />
                              {/* Compatibility aliases: the school-scoped portal is the sole Manager experience. */}
                              <Route path="/manager" element={<ProtectedRoute allowedRoles={["manager"]}><Navigate to="/school/manager" replace /></ProtectedRoute>} />
                              <Route path="/manager-dashboard" element={<ProtectedRoute allowedRoles={["manager"]}><Navigate to="/school/manager" replace /></ProtectedRoute>} />
                              <Route path="/store" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><StorePage /></ProtectedRoute>} />
                              <Route path="/tournaments" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Tournaments /></ProtectedRoute>} />
                              <Route path="/enhanced-settings" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><EnhancedSettings /></ProtectedRoute>} />
                              <Route path="/social" element={<EarlyTierRestrictedRoute><SocialHub /></EarlyTierRestrictedRoute>} />
                              <Route path="/social/community" element={<EarlyTierRestrictedRoute><EnhancedSocial /></EarlyTierRestrictedRoute>} />
                              <Route path="/ai-tutor" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><AITutor /></ProtectedRoute>} />
                              <Route path="/learning-dna" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><LearningDNA /></ProtectedRoute>} />
                              <Route
                                path="/parent-dashboard"
                                element={
                                  <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'manager', 'parent', 'extreme_admin']}>
                                    <ParentDashboard />
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/revision" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><TimeTravelRevision /></ProtectedRoute>} />
                              <Route path="/avatar-creator" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><AvatarCreator /></ProtectedRoute>} />
                              <Route path="/academic" element={<EarlyTierRestrictedRoute><AcademicMode /></EarlyTierRestrictedRoute>} />
                              <Route path="/study-mode" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><StudyModePage /></ProtectedRoute>} />
                              <Route path="/academic/setup" element={<EarlyTierRestrictedRoute><AcademicSetup /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/flashcards" element={<EarlyTierRestrictedRoute><FlashcardsPage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/topics" element={<EarlyTierRestrictedRoute><TopicCoveragePage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/exam" element={<EarlyTierRestrictedRoute><ExamModePage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/entrance-papers" element={<EarlyTierRestrictedRoute><EntranceExamPapersPage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/planner" element={<EarlyTierRestrictedRoute><StudyPlannerPage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/insights" element={<EarlyTierRestrictedRoute><AcademicInsightsPage /></EarlyTierRestrictedRoute>} />
                              <Route
                                path="/library"
                                element={
                                  <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'manager', 'extreme_admin']}>
                                    <LibraryPage />
                                  </ProtectedRoute>
                                }
                              />

                              {/*
                                Owner-only portal (intentional, not a bug).
                                The `extreme_admin` role is seeded once for the single owner account
                                (see migration 20260417133000_seed_extreme_admin_account.sql). It is
                                deliberately NOT grantable from the normal admin UI; the only way to
                                grant it is the `extreme_admin_update_user_role` RPC, which itself
                                requires an existing extreme_admin caller.
                              */}
                              <Route
                                path="/finance"
                                element={
                                  <ProtectedRoute allowedRoles={["finance", "extreme_admin"]}>
                                    <FinancePortal />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/super-admin"
                                element={
                                  <ProtectedRoute allowedRoles={['super_admin']}>
                                    <NetworkSuperAdminPortal />
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/root-control-portal-9xA7" 
                                element={
                                  <ProtectedRoute allowedRoles={['extreme_admin']}>
                                    <ExtremeAdminPortal />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route path="/migrate-supabase" element={<ProtectedRoute allowedRoles={["extreme_admin"]}><SupabaseMigration /></ProtectedRoute>} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                            </RouteErrorBoundary>
                            </Suspense>
                            </AppChrome>
                            <NativeBackHandler />
                            <NotificationBootstrap />
                            <NotificationRouteHandler />
                            <SocialRealtimeNotifications />
                            <AIHelper />
                          </BrowserRouter>
                          </TooltipProvider>
                        </ChatProvider>
                      </FriendsProvider>
                    </AIHelperProvider>
                  </RoomProvider>
                </QuizProvider>
              </AchievementsProvider>
            </CurrencyProvider>
          </LanguageProvider>
        </TierProvider>
        </SchoolPortalProvider>
      </UserProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
