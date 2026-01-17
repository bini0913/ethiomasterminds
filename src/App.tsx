import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Social from "./pages/Social";
import AdminPortal from "./pages/AdminPortal";
import StudentDashboard from "./pages/StudentDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import Chat from "./pages/Chat";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { UserProvider } from "./context/UserContext";
import { QuizProvider } from "./context/QuizContext";
import { AIHelperProvider } from "./context/AIHelperContext";
import { FriendsProvider } from "./context/FriendsContext";
import { LanguageProvider } from "./context/LanguageContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AchievementsProvider } from "./context/AchievementsContext";
import { RoomProvider } from "./context/RoomContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider } from "./context/ChatContext";
import AIHelper from "./components/ai/AIHelper";
import PlusButton from "./components/ai/PlusButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <UserProvider>
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
                              <Route path="/quiz/filter" element={<QuizFilter />} />
                              <Route path="/multiplayer" element={<Multiplayer />} />
                              <Route path="/lobby" element={<Lobby />} />
                              <Route path="/leaderboard" element={<Leaderboard />} />
                              <Route path="/friends" element={<Friends />} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="/chat" element={<Chat />} />
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
                              <Route path="/tournaments" element={<div>Tournaments Coming Soon</div>} />
                              <Route path="/enhanced-settings" element={<EnhancedSettings />} />
                              <Route path="/social" element={<Social />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                            <AIHelper />
                            <PlusButton />
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
      </UserProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
