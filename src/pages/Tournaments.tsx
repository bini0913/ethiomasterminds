import React from "react";

import TournamentHub from "@/components/tournaments/TournamentHub";
import BackButton from "@/components/ui/BackButton";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";

const Tournaments: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  return (
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]" : "min-h-screen bg-background"}>
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
        <BackButton />
        <TournamentHub />
      </div>
    </div>
  );
};

export default Tournaments;
