import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Room {
  id: string;
  name: string;
  host: string;
  players: string[];
  maxPlayers: number;
  password?: string;
  gameSettings: {
    subject: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    questionCount: number;
    timePerQuestion: number;
  };
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  createdAt: Date;
}

export interface GameSession {
  roomId: string;
  players: {
    name: string;
    score: number;
    answers: { questionId: string; answer: string; correct: boolean; timeUsed: number }[];
  }[];
  currentQuestion: number;
  questions: any[];
  startedAt?: Date;
  finishedAt?: Date;
}

interface RoomContextType {
  rooms: Room[];
  currentRoom: Room | null;
  gameSession: GameSession | null;
  createRoom: (name: string, settings: Room['gameSettings'], maxPlayers: number, password?: string) => Room;
  joinRoom: (roomId: string, playerName: string, password?: string) => boolean;
  leaveRoom: (roomId: string, playerName: string) => void;
  startGame: (roomId: string) => void;
  submitAnswer: (questionId: string, answer: string, timeUsed: number) => void;
  getRoomById: (roomId: string) => Room | undefined;
  getPublicRooms: () => Room[];
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);

  const createRoom = (
    name: string, 
    settings: Room['gameSettings'], 
    maxPlayers: number, 
    password?: string
  ): Room => {
    const room: Room = {
      id: `room-${Math.random().toString(36).substr(2, 9)}`,
      name,
      host: 'current-user', // This would be the actual user
      players: ['current-user'],
      maxPlayers,
      password,
      gameSettings: settings,
      status: 'waiting',
      createdAt: new Date()
    };

    setRooms(prev => [...prev, room]);
    setCurrentRoom(room);
    return room;
  };

  const joinRoom = (roomId: string, playerName: string, password?: string): boolean => {
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return false;
    if (room.password && room.password !== password) return false;
    if (room.players.length >= room.maxPlayers) return false;
    if (room.players.includes(playerName)) return false;

    setRooms(prev => prev.map(r => 
      r.id === roomId 
        ? { ...r, players: [...r.players, playerName] }
        : r
    ));

    setCurrentRoom({ ...room, players: [...room.players, playerName] });
    return true;
  };

  const leaveRoom = (roomId: string, playerName: string) => {
    setRooms(prev => prev.map(r => 
      r.id === roomId 
        ? { ...r, players: r.players.filter(p => p !== playerName) }
        : r
    ).filter(r => r.players.length > 0)); // Remove empty rooms

    if (currentRoom?.id === roomId) {
      setCurrentRoom(null);
      setGameSession(null);
    }
  };

  const startGame = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    setRooms(prev => prev.map(r => 
      r.id === roomId 
        ? { ...r, status: 'starting' as const }
        : r
    ));

    // Initialize game session
    setGameSession({
      roomId,
      players: room.players.map(name => ({
        name,
        score: 0,
        answers: []
      })),
      currentQuestion: 0,
      questions: [], // Would be populated with actual questions
      startedAt: new Date()
    });

    // Start the game after 3 seconds
    setTimeout(() => {
      setRooms(prev => prev.map(r => 
        r.id === roomId 
          ? { ...r, status: 'playing' as const }
          : r
      ));
    }, 3000);
  };

  const submitAnswer = (questionId: string, answer: string, timeUsed: number) => {
    if (!gameSession) return;

    // This would check if answer is correct and update score
    const isCorrect = Math.random() > 0.5; // Placeholder logic
    const points = isCorrect ? Math.max(10 - timeUsed, 1) : 0;

    setGameSession(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        players: prev.players.map(player => 
          player.name === 'current-user' // Would be actual current user
            ? {
                ...player,
                score: player.score + points,
                answers: [...player.answers, { questionId, answer, correct: isCorrect, timeUsed }]
              }
            : player
        )
      };
    });
  };

  const getRoomById = (roomId: string) => {
    return rooms.find(r => r.id === roomId);
  };

  const getPublicRooms = () => {
    return rooms.filter(r => !r.password && r.status === 'waiting');
  };

  return (
    <RoomContext.Provider value={{
      rooms,
      currentRoom,
      gameSession,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      submitAnswer,
      getRoomById,
      getPublicRooms
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};