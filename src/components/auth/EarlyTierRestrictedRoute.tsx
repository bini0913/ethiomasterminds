import React from "react";
import { Navigate } from "react-router-dom";
import { useTier } from "@/context/TierContext";
import { useUser } from "@/context/UserContext";

interface EarlyTierRestrictedRouteProps {
  children: React.ReactNode;
}

/** Prevents Early tier students from opening social, chat, and academic screens. */
const EarlyTierRestrictedRoute: React.FC<EarlyTierRestrictedRouteProps> = ({ children }) => {
  const tier = useTier();
  const { isAuthenticated, isLoading } = useUser();

  // Do not render restricted content before the loaded profile determines the tier.
  if (isLoading) return null;

  if (isAuthenticated && tier === "early") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default EarlyTierRestrictedRoute;
