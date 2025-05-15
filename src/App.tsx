
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Quiz from "./pages/Quiz";
import Multiplayer from "./pages/Multiplayer";
import Leaderboard from "./pages/Leaderboard";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { UserProvider } from "./context/UserContext";
import { QuizProvider } from "./context/QuizContext";
import { AIHelperProvider } from "./context/AIHelperContext";
import { FriendsProvider } from "./context/FriendsContext";
import AIHelper from "./components/ai/AIHelper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <QuizProvider>
        <AIHelperProvider>
          <FriendsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/quiz" element={<Quiz />} />
                  <Route path="/multiplayer" element={<Multiplayer />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/settings" element={<Settings />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <AIHelper />
              </BrowserRouter>
            </TooltipProvider>
          </FriendsProvider>
        </AIHelperProvider>
      </QuizProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
