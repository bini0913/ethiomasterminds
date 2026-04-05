import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';
import { toast } from 'sonner';

export interface Room {
  id: string;
  name: string;
  host: string;
  hostName?: string;
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
    id: string;
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
  loading: boolean;
  createRoom: (name: string, settings: Room['gameSettings'], maxPlayers: number, password?: string) => Promise<Room | null>;
  joinRoom: (roomId: string, playerName: string, password?: string) => Promise<boolean>;
  leaveRoom: (roomId: string, playerName: string) => Promise<void>;
  startGame: (roomId: string) => Promise<void>;
  submitAnswer: (questionId: string, answer: string, timeUsed: number) => void;
  getRoomById: (roomId: string) => Room | undefined;
  getPublicRooms: () => Room[];
  refreshRooms: () => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);

  const cleanupExpiredRooms = useCallback(async () => {
    await supabase.rpc('cleanup_expired_multiplayer_rooms' as any);
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      await cleanupExpiredRooms();

      const { data, error } = await supabase
        .from('multiplayer_rooms')
        .select('*')
        .in('status', ['waiting', 'countdown'])
        .is('password', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const roomIds = (data || []).map(r => r.id);
      
      if (roomIds.length > 0) {
        // Get player counts
        const { data: playerData } = await supabase
          .from('room_players')
          .select('room_id, user_id')
          .in('room_id', roomIds);

        const playerMap = new Map<string, string[]>();
        playerData?.forEach(p => {
          const existing = playerMap.get(p.room_id) || [];
          playerMap.set(p.room_id, [...existing, p.user_id]);
        });

        // Get host names
        const hostIds = [...new Set((data || []).map(r => r.host_id))];
        const { data: hostProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', hostIds);

        const hostNameMap = new Map(hostProfiles?.map(h => [h.id, h.name]) || []);

        const mappedRooms: Room[] = (data || []).map(r => ({
          id: r.id,
          name: r.name,
          host: r.host_id,
          hostName: hostNameMap.get(r.host_id) || 'Unknown',
          players: playerMap.get(r.id) || [],
          maxPlayers: r.max_players,
          password: r.password || undefined,
          gameSettings: {
            subject: r.subject || 'Mixed',
            difficulty: (r.difficulty || 'Medium') as 'Easy' | 'Medium' | 'Hard',
            questionCount: r.question_count || 10,
            timePerQuestion: 30
          },
          status: r.status as Room['status'],
          createdAt: new Date(r.created_at)
        }));

        setRooms(mappedRooms);
      } else {
        setRooms([]);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [cleanupExpiredRooms]);

  useEffect(() => {
    fetchRooms();
    const cleanupInterval = setInterval(() => {
      void cleanupExpiredRooms();
    }, 60000);

    // Set up realtime subscription
    const channel = supabase
      .channel('rooms-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'multiplayer_rooms'
      }, () => {
        fetchRooms();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_players'
      }, () => {
        fetchRooms();
      })
      .subscribe();

    return () => {
      clearInterval(cleanupInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchRooms, cleanupExpiredRooms]);

  const createRoom = async (
    name: string, 
    settings: Room['gameSettings'], 
    maxPlayers: number, 
    password?: string
  ): Promise<Room | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('multiplayer_rooms')
        .insert({
          name,
          host_id: user.id,
          max_players: maxPlayers,
          subject: settings.subject,
          difficulty: settings.difficulty,
          question_count: settings.questionCount,
          password: password || null,
          status: 'waiting'
        })
        .select()
        .single();

      if (error) throw error;

      // Join the room as host
      await supabase
        .from('room_players')
        .insert({
          room_id: data.id,
          user_id: user.id,
          is_ready: true
        });

      const room: Room = {
        id: data.id,
        name: data.name,
        host: data.host_id,
        hostName: user.name,
        players: [user.id],
        maxPlayers: data.max_players,
        password: data.password || undefined,
        gameSettings: settings,
        status: data.status as Room['status'],
        createdAt: new Date(data.created_at)
      };

      setCurrentRoom(room);
      toast.success('Room created!');
      await fetchRooms();
      
      return room;
    } catch (err) {
      console.error('Error creating room:', err);
      toast.error('Failed to create room');
      return null;
    }
  };

  const joinRoom = async (roomId: string, playerName: string, password?: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Check if room exists and has space
      const { data: roomData, error: roomError } = await supabase
        .from('multiplayer_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      // Check password if required
      if (roomData.password && roomData.password !== password) {
        toast.error('Incorrect password');
        return false;
      }

      // Check player count
      const { count } = await supabase
        .from('room_players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);

      if ((count || 0) >= roomData.max_players) {
        toast.error('Room is full');
        return false;
      }

      // Join the room
      const { error: joinError } = await supabase
        .from('room_players')
        .insert({
          room_id: roomId,
          user_id: user.id
        });

      if (joinError) throw joinError;

      const room: Room = {
        id: roomData.id,
        name: roomData.name,
        host: roomData.host_id,
        players: [],
        maxPlayers: roomData.max_players,
        password: roomData.password || undefined,
        gameSettings: {
          subject: roomData.subject || 'Mixed',
          difficulty: (roomData.difficulty || 'Medium') as 'Easy' | 'Medium' | 'Hard',
          questionCount: roomData.question_count || 10,
          timePerQuestion: 30
        },
        status: roomData.status as Room['status'],
        createdAt: new Date(roomData.created_at)
      };

      setCurrentRoom(room);
      toast.success(`Joined ${roomData.name}!`);
      await fetchRooms();
      
      return true;
    } catch (err: any) {
      if (err.code === '23505') {
        toast.error('Already in this room');
      } else {
        console.error('Error joining room:', err);
        toast.error('Failed to join room');
      }
      return false;
    }
  };

  const leaveRoom = async (roomId: string, playerName: string) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('room_players')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      // If host leaves, delete the room
      if (currentRoom?.host === user.id) {
        await supabase
          .from('multiplayer_rooms')
          .delete()
          .eq('id', roomId);
      }

      setCurrentRoom(null);
      setGameSession(null);
      toast.info('Left the room');
      await fetchRooms();
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  };

  const startGame = async (roomId: string) => {
    if (!user?.id || !currentRoom || currentRoom.host !== user.id) return;

    try {
      await supabase
        .from('multiplayer_rooms')
        .update({ status: 'starting', started_at: new Date().toISOString() })
        .eq('id', roomId);

      setCurrentRoom({ ...currentRoom, status: 'starting' });

      // Initialize game session
      setGameSession({
        roomId,
        players: currentRoom.players.map(id => ({
          id,
          name: id,
          score: 0,
          answers: []
        })),
        currentQuestion: 0,
        questions: [],
        startedAt: new Date()
      });

      // Start the game after 3 seconds
      setTimeout(async () => {
        await supabase
          .from('multiplayer_rooms')
          .update({ status: 'playing' })
          .eq('id', roomId);
        
        setCurrentRoom(prev => prev ? { ...prev, status: 'playing' } : null);
      }, 3000);
    } catch (err) {
      console.error('Error starting game:', err);
      toast.error('Failed to start game');
    }
  };

  const submitAnswer = (questionId: string, answer: string, timeUsed: number) => {
    if (!gameSession || !user?.id) return;

    const isCorrect = Math.random() > 0.5; // Placeholder logic
    const points = isCorrect ? Math.max(10 - timeUsed, 1) : 0;

    // Update local score
    setGameSession(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        players: prev.players.map(player => 
          player.id === user.id
            ? {
                ...player,
                score: player.score + points,
                answers: [...player.answers, { questionId, answer, correct: isCorrect, timeUsed }]
              }
            : player
        )
      };
    });

    // Update score in database
    supabase
      .from('room_players')
      .update({ score: gameSession.players.find(p => p.id === user.id)?.score || 0 + points })
      .eq('room_id', currentRoom?.id)
      .eq('user_id', user.id);
  };

  const getRoomById = (roomId: string) => {
    return rooms.find(r => r.id === roomId);
  };

  const getPublicRooms = () => {
    return rooms.filter(r => !r.password && r.status === 'waiting');
  };

  const refreshRooms = async () => {
    await fetchRooms();
  };

  return (
    <RoomContext.Provider value={{
      rooms,
      currentRoom,
      gameSession,
      loading,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      submitAnswer,
      getRoomById,
      getPublicRooms,
      refreshRooms
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
