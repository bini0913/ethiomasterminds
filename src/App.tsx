import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Quiz from "./pages/Quiz";
import QuizFilter from "./pages/QuizFilter";
import Multiplayer from "./pages/Multiplayer";
import Lobby from "./pages/Lobby";
import Leaderboard from "./pages/Leaderboard";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import EnhancedSettings from "./pages/EnhancedSettings";
import NotFound from "./pages/NotFound";
import StorePage from "./pages/StorePage";
import TeacherPortal from "./pages/TeacherPortal";
import AdminPortal from "./pages/AdminPortal";
import StudentDashboard from "./pages/StudentDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import Chat from "./pages/Chat";
import AITutor from "./pages/AITutor";
import LearningDNA from "./pages/LearningDNA";
import ParentDashboard from "./pages/ParentDashboard";
import TimeTravelRevision from "./pages/TimeTravelRevision";
import EnhancedSocial from "./pages/EnhancedSocial";
import AvatarCreator from "./pages/AvatarCreator";
import AcademicMode from "./pages/AcademicMode";
import FlashcardsPage from "./pages/FlashcardsPage";
import TopicCoveragePage from "./pages/TopicCoveragePage";
import ExamModePage from "./pages/ExamModePage";
import StudyPlannerPage from "./pages/StudyPlannerPage";
import AcademicInsightsPage from "./pages/AcademicInsightsPage";
import LibraryPage from "./pages/LibraryPage";
import StudyModePage from "./pages/StudyModePage";
import UserProfilePage from "./pages/UserProfilePage";
import Tournaments from "./pages/Tournaments";
import EarlyGamesPage from "./pages/EarlyGamesPage";
import EarlyQuizPage from "./pages/EarlyQuizPage";
import EarlyVideosPage from "./pages/EarlyVideosPage";
import EarlyDiscoverPage from "./pages/EarlyDiscoverPage";
import EarlyExplorePage from "./pages/EarlyExplorePage";
import EarlyProgressPage from "./pages/EarlyProgressPage";
import EarlyTierOnlyRoute from "./components/auth/EarlyTierOnlyRoute";
import ExtremeAdminPortal from "./pages/ExtremeAdminPortal";
import SupabaseMigration from "./pages/SupabaseMigration";
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
import { useUser } from "./context/UserContext";
import AIHelper from "./components/ai/AIHelper";
import NativeBackHandler from "./components/mobile/NativeBackHandler";

const queryClient = new QueryClient();

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
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/quiz" element={<Quiz />} />
                              <Route path="/early-games" element={<EarlyTierOnlyRoute><EarlyGamesPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-quiz" element={<EarlyTierOnlyRoute><EarlyQuizPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-videos" element={<EarlyTierOnlyRoute><EarlyVideosPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-discover" element={<EarlyTierOnlyRoute><EarlyDiscoverPage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-explore" element={<EarlyTierOnlyRoute><EarlyExplorePage /></EarlyTierOnlyRoute>} />
                              <Route path="/early-progress" element={<EarlyTierOnlyRoute><EarlyProgressPage /></EarlyTierOnlyRoute>} />
                              <Route path="/quiz/filter" element={<QuizFilter />} />
                              <Route path="/multiplayer" element={<Multiplayer />} />
                              <Route path="/lobby" element={<Lobby />} />
                              <Route path="/leaderboard" element={<Leaderboard />} />
                              <Route path="/profile" element={<SelfProfileRedirect />} />
                              <Route path="/profile/:userId" element={<UserProfilePage />} />
                              <Route path="/friends" element={<EarlyTierRestrictedRoute><Friends /></EarlyTierRestrictedRoute>} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="/chat" element={<EarlyTierRestrictedRoute><Chat /></EarlyTierRestrictedRoute>} />
                              <Route 
                                path="/teacher" 
                                element={
                                  <ProtectedRoute allowedRoles={['teacher', 'admin', 'manager']}>
                                    <TeacherPortal />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route 
                                path="/admin" 
                                element={
                                  <ProtectedRoute allowedRoles={['admin', 'manager']}>
                                    <AdminPortal />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route path="/student-dashboard" element={<StudentDashboard />} />
                              <Route 
                                path="/manager-dashboard" 
                                element={
                                  <ProtectedRoute allowedRoles={['manager']}>
                                    <ManagerDashboard />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route path="/store" element={<StorePage />} />
                              <Route path="/tournaments" element={<Tournaments />} />
                              <Route path="/enhanced-settings" element={<EnhancedSettings />} />
                              <Route path="/social" element={<EarlyTierRestrictedRoute><EnhancedSocial /></EarlyTierRestrictedRoute>} />
                              <Route path="/ai-tutor" element={<AITutor />} />
                              <Route path="/learning-dna" element={<LearningDNA />} />
                              <Route
                                path="/parent-dashboard"
                                element={
                                  <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'manager', 'extreme_admin']}>
                                    <ParentDashboard />
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/revision" element={<TimeTravelRevision />} />
                              <Route path="/avatar-creator" element={<AvatarCreator />} />
                              <Route path="/academic" element={<EarlyTierRestrictedRoute><AcademicMode /></EarlyTierRestrictedRoute>} />
                              <Route path="/study-mode" element={<StudyModePage />} />
                              <Route path="/academic/flashcards" element={<EarlyTierRestrictedRoute><FlashcardsPage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/topics" element={<EarlyTierRestrictedRoute><TopicCoveragePage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/exam" element={<EarlyTierRestrictedRoute><ExamModePage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/planner" element={<EarlyTierRestrictedRoute><StudyPlannerPage /></EarlyTierRestrictedRoute>} />
                              <Route path="/academic/insights" element={<EarlyTierRestrictedRoute><AcademicInsightsPage /></EarlyTierRestrictedRoute>} />
                              <Route
                                path="/library"
                                element={
                                  <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'manager']}>
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
                                path="/root-control-portal-9xA7" 
                                element={
                                  <ProtectedRoute allowedRoles={['extreme_admin']}>
                                    <ExtremeAdminPortal />
                                  </ProtectedRoute>
                                } 
                              />
                              <Route path="/migrate-supabase" element={<SupabaseMigration />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                            <NativeBackHandler />
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
