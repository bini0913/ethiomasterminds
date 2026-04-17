import React from "react";

import TournamentHub from "@/components/tournaments/TournamentHub";
import BackButton from "@/components/ui/BackButton";

const Tournaments: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
        <BackButton />
        <TournamentHub />
      </div>
    </div>
  );
};

export default Tournaments;
