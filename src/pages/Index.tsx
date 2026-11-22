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
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import { supabase } from "@/integrations/supabase/client";
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
  const { memberships, loading: schoolMembershipsLoading } = useSchoolPortal();
  const tier = useTier();
  const [appStage, setAppStage] = useState<AppStage>(AppStage.Welcome);
  const [userType, setUserType] = useState<"student" | "teacher" | "admin" | "manager">("student");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [roleRouteResolving, setRoleRouteResolving] = useState(false);
  const navigate = useNavigate();
  
  // Resolve one landing portal from the authoritative global role and active school membership.
  useEffect(() => {
    let cancelled = false;
    if (isLoading) return () => { cancelled = true; };

    if (isAuthenticated && user) {
      // Platform authorities always win over school membership and remembered login mode.
      if (user.role === "extreme_admin") {
        setRoleRouteResolving(false);
        navigate("/root-control-portal-9xA7", { replace: true });
        return () => { cancelled = true; };
      }
      if (user.role === "super_admin") {
        setRoleRouteResolving(false);
        navigate("/super-admin", { replace: true });
        return () => { cancelled = true; };
      }

      const hasSchoolRole = (role: string) =>
        memberships.some((membership) => membership.status === "active" && membership.school_role === role);

      const loginMode = safeStorage.getItem("masterminds_login_mode");

      if (["teacher", "finance", "parent", "student"].includes(user.role) && schoolMembershipsLoading) {
        return () => { cancelled = true; };
      }

      if (user.role === "manager") {
        setRoleRouteResolving(false);
        navigate("/school/manager", { replace: true });
        return () => { cancelled = true; };
      }
      if (user.role === "finance") {
        if (!hasSchoolRole("finance")) {
          setRoleRouteResolving(false);
          navigate("/finance", { replace: true });
          return () => { cancelled = true; };
        }

        const financeMembershipIds = memberships
          .filter((membership) => membership.status === "active" && membership.school_role === "finance")
          .map((membership) => membership.id);
        setRoleRouteResolving(true);
        void (async () => {
          const today = new Date().toLocaleDateString("en-CA");
          const { data, error } = await (supabase as any)
            .from("school_leadership_appointments")
            .select("id")
            .in("membership_id", financeMembershipIds)
            .eq("position", "hr_director")
            .eq("status", "active")
            .lte("start_date", today)
            .or(`end_date.is.null,end_date.gte.${today}`)
            .limit(1)
            .maybeSingle();
          if (cancelled) return;
          setRoleRouteResolving(false);
          navigate(!error && data ? "/school/admin" : "/school/finance", { replace: true });
        })();
        return () => { cancelled = true; };
      }
      if (user.role === "teacher") {
        setRoleRouteResolving(false);
        navigate(hasSchoolRole("teacher") ? "/school/teacher" : "/teacher", { replace: true });
        return () => { cancelled = true; };
      }
      if (user.role === "parent") {
        setRoleRouteResolving(false);
        navigate(hasSchoolRole("parent") ? "/school/parent" : "/parent-dashboard", { replace: true });
        return () => { cancelled = true; };
      }
      if (user.role === "admin") {
        setRoleRouteResolving(false);
        navigate("/admin", { replace: true });
        return () => { cancelled = true; };
      }

      if (user.role === "student") {
        setRoleRouteResolving(false);
        if (hasSchoolRole("student")) {
          navigate("/school/student", { replace: true });
          return () => { cancelled = true; };
        }
        if (loginMode === "parent") {
          navigate("/parent-dashboard", { replace: true });
          return () => { cancelled = true; };
        }
        if (!user.grade || !user.educationLevel) {
          setAppStage(AppStage.ProfileSetup);
        } else {
          setAppStage(AppStage.MainMenu);
        }
      }
    } else {
      setRoleRouteResolving(false);
      if (!isAuthenticated && appStage !== AppStage.Welcome) {
        setAppStage(AppStage.Auth);
      }
    }

    return () => { cancelled = true; };
  }, [isAuthenticated, user, isLoading, navigate, appStage, memberships, schoolMembershipsLoading]);

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
    if (isLoading || roleRouteResolving) {
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
