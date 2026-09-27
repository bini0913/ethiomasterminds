import React from "react";
import { Navigate } from "react-router-dom";
import { useTier } from "@/context/TierContext";
import { useUser } from "@/context/UserContext";

const EarlyTierOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tier = useTier();
  const { isLoading, isAuthenticated } = useUser();
  if (isLoading) return null;
  if (!isAuthenticated || tier !== "early") return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default EarlyTierOnlyRoute;
