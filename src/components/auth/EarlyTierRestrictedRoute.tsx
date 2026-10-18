import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTier } from "@/context/TierContext";
import { useUser } from "@/context/UserContext";

interface EarlyTierRestrictedRouteProps {
  children: React.ReactNode;
}

/** Keeps early-tier and unassigned student profiles out of general social/chat and academic routes. */
const EarlyTierRestrictedRoute: React.FC<EarlyTierRestrictedRouteProps> = ({ children }) => {
  const tier = useTier();
  const { user, isAuthenticated, isLoading } = useUser();

  // Do not render protected content before authentication and profile data are resolved.
  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-background px-4" role="status" aria-live="polite" aria-label="Checking student access">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Checking your learning level…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/" replace />;

  // An unknown grade must not let a student bypass the early-tier restriction.
  // Returning home lets the existing profile-completion flow handle setup.
  if (user.role === "student" && (tier === "early" || tier === null)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default EarlyTierRestrictedRoute;
