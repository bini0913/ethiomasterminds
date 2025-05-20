
import React, { useState } from "react";
import WelcomeScreen from "@/components/WelcomeScreen";
import AuthForm from "@/components/auth/AuthForm";
import ProfileSetup from "@/components/profile/ProfileSetup";
import MainMenu from "@/components/dashboard/MainMenu";
import { useUser } from "@/context/UserContext";

// App stages
enum AppStage {
  Welcome,
  Auth,
  ProfileSetup,
  MainMenu
}

const Index: React.FC = () => {
  const { user, isAuthenticated } = useUser();
  const [appStage, setAppStage] = useState<AppStage>(AppStage.Welcome);
  const [userType, setUserType] = useState<"student" | "teacher" | "admin" | "manager">("student");
  
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
  
  // Handle welcome screen continue button
  const handleWelcomeContinue = (type: "student" | "teacher" | "admin" | "manager" = "student") => {
    setUserType(type);
    setAppStage(AppStage.Auth);
  };
  
  // Render content based on the current app stage
  const renderContent = () => {
    switch (appStage) {
      case AppStage.Welcome:
        return <WelcomeScreen onContinue={handleWelcomeContinue} />;
      case AppStage.Auth:
        return <AuthForm onSuccess={() => setAppStage(AppStage.ProfileSetup)} initialTab={userType} />;
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

export default Index;
