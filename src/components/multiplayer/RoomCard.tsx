
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

export interface Room {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  status: "waiting" | "in-progress" | "finished";
  subject: string;
  createdBy?: string;
  difficulty?: string;
  gameMode?: string;
}

interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin }) => {
  // Get color based on subject
  const getSubjectColor = (subject: string): string => {
    switch (subject.toLowerCase()) {
      case "math":
      case "mathematics":
        return "bg-blue-100 text-blue-800";
      case "science":
        return "bg-green-100 text-green-800";
      case "english":
        return "bg-purple-100 text-purple-800";
      case "mixed":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
      <Card className="border h-full flex flex-col">
        <div className="p-4 flex-grow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-lg">{room.name}</h3>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <Users className="h-3 w-3 mr-1" />
                <span>{room.players}/{room.maxPlayers} players</span>
              </div>
            </div>
            <Badge className={getSubjectColor(room.subject)}>
              {room.subject}
            </Badge>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {room.difficulty && (
              <Badge variant="outline" className="text-xs">
                {room.difficulty}
              </Badge>
            )}
            {room.gameMode && (
              <Badge variant="outline" className="text-xs">
                {room.gameMode}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t bg-gray-50">
          <Button
            onClick={() => onJoin(room)}
            className="w-full"
            variant={room.status === "waiting" ? "default" : "secondary"}
            disabled={room.status === "in-progress" || room.players >= room.maxPlayers}
          >
            {room.status === "waiting" && room.players < room.maxPlayers
              ? "Join Room"
              : room.status === "in-progress"
              ? "Game in Progress"
              : "Room Full"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

export default RoomCard;
