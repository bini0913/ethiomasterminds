import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { safeStorage } from "@/lib/safeStorage";
import EnhancedWelcomeScreen from "@/components/welcome/EnhancedWelcomeScreen";
import UnifiedAuthForm from "@/components/auth/UnifiedAuthForm";
import ProfileSetup from "@/components/profile/ProfileSetup";
import MainMenu from "@/components/dashboard/MainMenu";
import EarlyTierHome from "@/components/dashboard/EarlyTierHome";
import MiddleTierHome from "@/components/dashboard/MiddleTierHome";
import UpperTierHome from "@/components/dashboard/UpperTierHome";
import EarlyEncouragement from "@/components/early/EarlyEncouragement";
import StudentBottomNav from "@/components/layout/StudentBottomNav";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";

// App stages
enum AppStage {
  Welcome,
  Auth,
  ProfileSetup,
  MainMenu
}

const Index: React.FC = () => {
  const { user, isAuthenticated, isLoading, refreshProfile } = useUser();
  const tier = useTier();
  const [appStage, setAppStage] = useState<AppStage>(AppStage.Welcome);
  const [userType, setUserType] = useState<"student" | "teacher" | "admin" | "manager">("student");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();
  
  // Redirect based on role when authenticated
  useEffect(() => {
    if (isLoading) return;
    
    if (isAuthenticated && user) {
      const loginMode = safeStorage.getItem("masterminds_login_mode");
      if (loginMode === "parent") {
        navigate('/parent-dashboard');
        return;
      }

      // Dedicated Finance accounts land directly in the Finance workspace.
      if (user.role === 'finance') {
        navigate('/finance');
        return;
      }

      // Redirect privileged roles to their portals
      if (user.role === 'extreme_admin') {
        navigate('/root-control-portal-9xA7');
        return;
      }
      if (user.role === 'super_admin') {
        navigate('/super-admin');
        return;
      }
      if (user.role === 'teacher') {
        navigate('/teacher');
        return;
      }
      if (user.role === 'admin') {
        navigate('/admin');
        return;
      }
      if (user.role === 'manager') {
        navigate('/manager-dashboard');
        return;
      }
      
      // For students, check if profile is complete
      if (!user.grade || !user.educationLevel) {
        setAppStage(AppStage.ProfileSetup);
      } else {
        setAppStage(AppStage.MainMenu);
      }
    } else if (!isAuthenticated && appStage !== AppStage.Welcome) {
      setAppStage(AppStage.Auth);
    }
  }, [isAuthenticated, user, isLoading, navigate, appStage]);
  
  // Handle welcome screen continue button
  const handleWelcomeContinue = (type: "student" | "teacher" | "admin" | "manager" = "student", mode: "signin" | "signup" = "signin") => {
    setUserType(type);
    setAuthMode(mode);
    setAppStage(AppStage.Auth);
  };
  
  // Handle successful authentication
  const handleAuthSuccess = async () => {
    // Refresh profile to get latest role
    await refreshProfile();
    // The useEffect will handle redirection based on role
  };

  // Handle back to welcome
  const handleBackToWelcome = () => {
    setAppStage(AppStage.Welcome);
  };
  
  // Render content based on the current app stage
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }
    
    switch (appStage) {
      case AppStage.Welcome:
        return <EnhancedWelcomeScreen onContinue={handleWelcomeContinue} />;
      case AppStage.Auth:
        return (
          <UnifiedAuthForm 
            onSuccess={handleAuthSuccess} 
            onBack={handleBackToWelcome}
            initialTab={userType}
            initialMode={authMode}
          />
        );
      case AppStage.ProfileSetup:
        return <ProfileSetup onComplete={() => setAppStage(AppStage.MainMenu)} />;
      case AppStage.MainMenu:
        return (
          tier === "early" ? (
            <><EarlyTierHome /><EarlyEncouragement /><StudentBottomNav /></>
          ) : tier === "middle" ? (
            <MiddleTierHome />
          ) : tier === "upper" ? (
            <UpperTierHome />
          ) : (
            <>
              <MainMenu />
              <StudentBottomNav />
            </>
          )
        );
      default:
        return <div>Something went wrong</div>;
    }
  };
  
  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {renderContent()}
    </div>
  );
};

export default Index;
