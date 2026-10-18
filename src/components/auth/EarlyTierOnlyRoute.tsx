import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTier } from "@/context/TierContext";
import { useUser } from "@/context/UserContext";

const RouteLoadingState = () => (
  <main className="flex min-h-[50vh] items-center justify-center bg-background px-4" role="status" aria-live="polite" aria-label="Checking student access">
    <div className="flex flex-col items-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Checking your learning level…</p>
    </div>
  </main>
);

const EarlyTierOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tier = useTier();
  const { isLoading, isAuthenticated } = useUser();

  // Never flash tier-specific content while the session/profile is being resolved.
  if (isLoading) return <RouteLoadingState />;
  if (!isAuthenticated || tier !== "early") return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default EarlyTierOnlyRoute;
