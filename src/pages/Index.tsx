
import React, { useState } from "react";
import WelcomeScreen from "@/components/WelcomeScreen";
import AuthForm from "@/components/auth/AuthForm";
import ProfileSetup from "@/components/profile/ProfileSetup";
import MainMenu from "@/components/dashboard/MainMenu";
import { UserProvider, useUser } from "@/context/UserContext";
import { QuizProvider } from "@/context/QuizContext";

// App stages
enum AppStage {
  Welcome,
  Auth,
  ProfileSetup,
  MainMenu
}

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useUser();
  const [appStage, setAppStage] = useState<AppStage>(AppStage.Welcome);
  
  // Determine the current stage based on authentication and profile completion
  React.useEffect(() => {
    if (appStage === AppStage.Welcome) {
      return; // Stay on welcome screen until user continues
    }
    
    if (!isAuthenticated) {
      setAppStage(AppStage.Auth);
    } else if (!user?.gender || !user?.grade || !user?.educationLevel) {
      setAppStage(AppStage.ProfileSetup);
    } else {
      setAppStage(AppStage.MainMenu);
    }
  }, [isAuthenticated, user, appStage]);
  
  // Render content based on the current app stage
  const renderContent = () => {
    switch (appStage) {
      case AppStage.Welcome:
        return <WelcomeScreen onContinue={() => setAppStage(AppStage.Auth)} />;
      case AppStage.Auth:
        return <AuthForm onSuccess={() => setAppStage(AppStage.ProfileSetup)} />;
      case AppStage.ProfileSetup:
        return <ProfileSetup onComplete={() => setAppStage(AppStage.MainMenu)} />;
      case AppStage.MainMenu:
        return <MainMenu />;
      default:
        return <div>Something went wrong</div>;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {renderContent()}
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <UserProvider>
      <QuizProvider>
        <AppContent />
      </QuizProvider>
    </UserProvider>
  );
};

export default Index;
