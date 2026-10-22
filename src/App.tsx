import { lazy, Suspense } from "react";
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
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const ManagerControlCenter = lazy(() => import("./pages/ManagerControlCenter"));
const SuperAdminPortal = lazy(() => import("./pages/SuperAdminPortal"));
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
import { ArrowLeft, Home, LogOut, BookOpen, BrainCircuit, Timer, Swords, Trophy, Users, Library, Bot, Bell, CalendarDays, Target, BarChart3, Layers3, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { useUser } from "./context/UserContext";
import AIHelper from "./components/ai/AIHelper";
import NativeBackHandler from "./components/mobile/NativeBackHandler";
import NotificationBootstrap from "./components/notifications/NotificationBootstrap";
import NotificationRouteHandler from "./components/notifications/NotificationRouteHandler";
import SocialRealtimeNotifications from "./components/notifications/SocialRealtimeNotifications";
import StudentBottomNav from "./components/layout/StudentBottomNav";
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
  { prefix: "/manager", title: "Manager Control Center" },
  { prefix: "/manager-dashboard", title: "Manager Dashboard" },
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

  // Finance is a standalone staff workspace with its own header and navigation.
  if (location.pathname === "/finance" || location.pathname.startsWith("/finance/")) return <>{children}</>;

  if (!isAuthenticated || !user) return <>{children}</>;

  const isHome = location.pathname === "/";
  const isUpperStudent = getUserTier(user?.grade) === "upper";
  if (isHome) {
    return <>{children}</>;
  }

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

  return (
    <div className={isUpperStudent ? "upper-studio-workspace min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" : "min-h-screen bg-background"}>
      {isUpperStudent && <style>{`.upper-studio-workspace aside button{color:#94a3b8}.upper-studio-workspace aside button:hover{background:#1e293b;color:#fff}.upper-studio-workspace aside button.bg-indigo-500{background:#6366f1;color:#fff}.upper-studio-workspace aside button svg{flex-shrink:0}.upper-studio-workspace .upper-studio-content{min-height:calc(100vh - 3.5rem);background:#f6f8fc}.dark .upper-studio-workspace .upper-studio-content{background:#090f1e}.upper-studio-workspace .upper-studio-content main{max-width:1440px;margin-inline:auto}.upper-studio-workspace .upper-studio-content [class*="rounded-xl"][class*="border"],.upper-studio-workspace .upper-studio-content [class*="rounded-2xl"][class*="border"]{border-radius:1rem;box-shadow:0 2px 12px -8px rgba(15,23,42,.22)}.upper-studio-workspace .upper-studio-content h1{letter-spacing:-.035em}.upper-studio-workspace .upper-studio-content button{transition:background-color .16s ease,border-color .16s ease,transform .16s ease}.upper-studio-workspace .upper-studio-content button:focus-visible{outline:2px solid hsl(var(--primary));outline-offset:2px}@media(max-width:1023px){.upper-studio-workspace .upper-studio-content{background:var(--background)}}`}</style>}
      {isUpperStudent && <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 text-slate-100 lg:flex">
        <button type="button" onClick={() => navigate("/")} className="mb-7 flex items-center gap-3 rounded-xl px-2 text-left"><span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700"><img src="/brand/master-minds-icon.svg" alt="" className="h-full w-full"/></span><span><span className="block font-display text-base font-bold text-white">Master Minds</span><span className="block text-xs text-slate-400">Grades 9–12</span></span></button>
        <nav aria-label="High school navigation" className="flex-1 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Workspace</p>
          <button type="button" onClick={() => navigate("/")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${location.pathname === "/" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-950/30" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}><Home className="h-4 w-4"/> Home</button>
          <button type="button" onClick={() => navigate("/study-mode")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${location.pathname === "/study-mode" ? "bg-indigo-500 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}><Timer className="h-4 w-4"/> Study Mode</button>
          <button type="button" onClick={() => navigate("/academic")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BookOpen className="h-4 w-4"/> Academic Mode <ChevronRight className="ml-auto h-4 w-4"/></button>
          <div className="ml-4 space-y-1 border-l border-slate-800 pl-3">
            <button type="button" onClick={() => navigate("/academic/topics")} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Layers3 className="h-4 w-4"/> Topic Coverage</button>
            <button type="button" onClick={() => navigate("/academic/flashcards")} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BrainCircuit className="h-4 w-4"/> Flashcards & Revision</button>
            <button type="button" onClick={() => navigate("/academic/exam")} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Target className="h-4 w-4"/> Exam Mode</button>
            <button type="button" onClick={() => navigate("/academic/planner")} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><CalendarDays className="h-4 w-4"/> Study Planner</button>
            <button type="button" onClick={() => navigate("/academic/insights")} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BarChart3 className="h-4 w-4"/> Academic Insights</button>
          </div>
          <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Connect</p>
          <button type="button" onClick={() => navigate("/multiplayer")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Swords className="h-4 w-4"/> Multiplayer</button>
          <button type="button" onClick={() => navigate("/tournaments")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Trophy className="h-4 w-4"/> Tournaments</button>
          <button type="button" onClick={() => navigate("/learning-dna")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><BrainCircuit className="h-4 w-4"/> Learning DNA</button>
          <button type="button" onClick={() => navigate("/friends")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Users className="h-4 w-4"/> Friends</button>
          <button type="button" onClick={() => navigate("/library")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Library className="h-4 w-4"/> Library</button>
          <button type="button" onClick={() => navigate("/ai-tutor")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Bot className="h-4 w-4"/> AI Tutor</button>
          <button type="button" onClick={() => navigate("/notifications")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="h-4 w-4"/> Notifications</button>
        </nav>
        <div className="mt-4 border-t border-slate-800 pt-3"><button type="button" onClick={() => navigate("/settings")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><SettingsIcon className="h-4 w-4"/> Settings</button><button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut className="h-4 w-4"/> Log out</button></div>
      </aside>}
      <div className={isUpperStudent ? "lg:pl-64" : ""}>
      <header className={isUpperStudent ? "sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 lg:hidden" : "sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"}>
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
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Go home"
                title="Go home"
              >
                <Home className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{getAppRouteTitle(location.pathname)}</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {user.name || user.username || "Master Minds"}
              </p>
            </div>
          </div>
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
      </header>
      <div className={`${isUpperStudent ? "upper-studio-content pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0" : ""}`}>{children}</div>
      {isUpperStudent && <div className="lg:hidden"><StudentBottomNav /></div>}
      </div>
    </div>
  );
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
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/quiz" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Quiz /></ProtectedRoute>} />
                              <Route path="/early-games" element={<EarlyTierOnlyRoute><EarlyGamesPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-quiz" element={<EarlyTierOnlyRoute><EarlyQuizPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-videos" element={<EarlyTierOnlyRoute><EarlyVideosPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-discover" element={<EarlyTierOnlyRoute><EarlyDiscoverPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-explore" element={<EarlyTierOnlyRoute><EarlyExplorePage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-progress" element={<EarlyTierOnlyRoute><EarlyProgressPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-collection" element={<EarlyTierOnlyRoute><EarlyCollectionPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-profile" element={<EarlyTierOnlyRoute><EarlyProfilePage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-ranks" element={<EarlyTierOnlyRoute><EarlyLeaderboardPage /></EarlyTierOnlyRoute>} />
                              <Route path="/quiz/filter" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><QuizFilter /></ProtectedRoute>} />
                              <Route path="/multiplayer" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Multiplayer /></ProtectedRoute>} />
                              <Route path="/lobby" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Lobby /></ProtectedRoute>} />
                              <Route path="/leaderboard" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Leaderboard /></ProtectedRoute>} />
                              <Route path="/profile" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><SelfProfileRedirect /></ProtectedRoute>} />
                              <Route path="/profile/:userId" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><UserProfilePage /></ProtectedRoute>} />
                              <Route path="/friends" element={<EarlyTierRestrictedRoute><Friends /></EarlyTierRestrictedRoute>} />
                              <Route path="/settings" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><Settings /></ProtectedRoute>} />
                              <Route path="/notifications" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><NotificationSettingsPage /></ProtectedRoute>} />
                              <Route path="/chat" element={<EarlyTierRestrictedRoute><Chat /></EarlyTierRestrictedRoute>} />
                              <Route 
                                path="/teacher" 
                                element={
                                  <ProtectedRoute allowedRoles={['teacher', 'admin', 'manager', 'extreme_admin']}>
                                    <TeacherPortal />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route
                                path="/admin/early-content"
                                element={
                                  <ProtectedRoute allowedRoles={['admin', 'manager', 'extreme_admin']}>
                                    <EarlyContentAdminPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/admin" 
                                element={
                                  <ProtectedRoute allowedRoles={['admin', 'manager', 'extreme_admin']}>
                                    <AdminPortal />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route path="/student-dashboard" element={<ProtectedRoute allowedRoles={["student"]}><StudentDashboard /></ProtectedRoute>} />
                              <Route
                                path="/manager"
                                element={
                                  <ProtectedRoute allowedRoles={['manager', 'admin', 'extreme_admin']}>
                                    <ManagerControlCenter />
                                  </ProtectedRoute>
                                }
                              />
                              <Route 
                                path="/manager-dashboard" 
                                element={
                                  <ProtectedRoute allowedRoles={['manager', 'admin', 'extreme_admin']}>
                                    <ManagerDashboard />
                                  </ProtectedRoute>
                                } 
                              />
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
                                  <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'manager', 'extreme_admin']}>
                                    <ParentDashboard />
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/revision" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><TimeTravelRevision /></ProtectedRoute>} />
                              <Route path="/avatar-creator" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><AvatarCreator /></ProtectedRoute>} />
                              <Route path="/academic" element={<EarlyTierRestrictedRoute><AcademicMode /></EarlyTierRestrictedRoute>} />
                              <Route path="/study-mode" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><StudyModePage /></ProtectedRoute>} />
                              <Route path="/academic/setup" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin", "manager", "extreme_admin"]}><AcademicSetup /></ProtectedRoute>} />
                              <Route path="/academic/flashcards" element={<EarlyTierRestrictedRoute><FlashcardsPage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/topics" element={<EarlyTierRestrictedRoute><TopicCoveragePage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/exam" element={<EarlyTierRestrictedRoute><ExamModePage /></EarlyTierRestrictedRoute>} />
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
                                  <ProtectedRoute allowedRoles={['finance', 'admin', 'manager', 'extreme_admin']}>
                                    <FinancePortal />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/super-admin"
                                element={
                                  <ProtectedRoute allowedRoles={['extreme_admin']}>
                                    <SuperAdminPortal />
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
                              <Route path="/migrate-supabase" element={<ProtectedRoute allowedRoles={["admin", "manager", "extreme_admin"]}><SupabaseMigration /></ProtectedRoute>} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
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
      </UserProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
