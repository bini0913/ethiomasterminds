
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

const Multiplayer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  
  const joinMatchmaking = (mode: string) => {
    toast.info(`Looking for ${mode} match...`, {
      description: "This feature is coming in a future update!",
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Multiplayer</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            Back to Menu
          </Button>
        </div>
      </header>
      
      <div className="container max-w-md mx-auto py-6 px-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Match Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 1v1 Match */}
            <div 
              className="border rounded-lg p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => joinMatchmaking("1v1")}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">1v1 Duel</h3>
                  <p className="text-sm opacity-80">Challenge another player head-to-head</p>
                </div>
                <div className="text-2xl">⚔️</div>
              </div>
            </div>
            
            {/* 2v2 Match */}
            <div 
              className="border rounded-lg p-4 bg-gradient-to-r from-green-500 to-teal-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => joinMatchmaking("2v2")}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">2v2 Team Battle</h3>
                  <p className="text-sm opacity-80">Join forces with another player</p>
                </div>
                <div className="text-2xl">👥</div>
              </div>
            </div>
            
            {/* Custom Match */}
            <div 
              className="border rounded-lg p-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => joinMatchmaking("custom")}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Custom Match</h3>
                  <p className="text-sm opacity-80">Create a private match with friends</p>
                </div>
                <div className="text-2xl">🎮</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Online Players */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Online Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Mock online players */}
              {["Alex", "Maria", "David", "Sophie"].map((name) => (
                <div key={name} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md">
                  <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center">
                    {name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-gray-500">Online • Grade 5</div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Multiplayer;
