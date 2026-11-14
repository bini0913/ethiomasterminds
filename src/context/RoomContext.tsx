import { db } from "@/integrations/untypedClient";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';
import { toast } from 'sonner';

let cleanupUnavailable = false;

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
    gameMode: 'speed' | 'accuracy';
  };
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  createdAt: Date;
}

interface RoomContextType {
  rooms: Room[];
  currentRoom: Room | null;
  loading: boolean;
  createRoom: (name: string, settings: Room['gameSettings'], maxPlayers: number, password?: string) => Promise<Room | null>;
  joinRoom: (roomId: string, playerName: string, password?: string) => Promise<boolean>;
  leaveRoom: (roomId: string, playerName: string) => Promise<void>;
  getRoomById: (roomId: string) => Room | undefined;
  getPublicRooms: () => Room[];
  refreshRooms: () => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  const cleanupExpiredRooms = useCallback(async () => {
    if (cleanupUnavailable) return;
    try {
      const { error } = await db.rpc('cleanup_expired_multiplayer_rooms' as any);
      // The cleanup function is optional maintenance; stop calling it once the backend reports it missing.
      if (error) cleanupUnavailable = true;
    } catch (error) {
      // Expiry cleanup is maintenance-only and must never interrupt room discovery.
      console.warn('Room cleanup request failed:', error);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      await cleanupExpiredRooms();
      const { data, error } = await supabase
        .from('multiplayer_rooms')
        .select('id, name, host_id, max_players, subject, difficulty, question_count, game_mode, status, created_at, current_question, started_at, finished_at')
        .in('status', ['waiting', 'countdown'])
        .order('created_at', { ascending: false });
      if (error) throw error;

      const roomIds = (data || []).map((r) => r.id);
      if (!roomIds.length) {
        setRooms([]);
        return;
      }

      const [{ data: playerData }, { data: hostProfiles }] = await Promise.all([
        db.from('room_players').select('room_id, user_id').in('room_id', roomIds),
        db.from('profiles').select('id, name').in('id', [...new Set((data || []).map((r) => r.host_id))]),
      ]);

      const playerMap = new Map<string, string[]>();
      (playerData || []).forEach((p) => {
        const players = playerMap.get(p.room_id) || [];
        playerMap.set(p.room_id, [...players, p.user_id]);
      });
      const hostNameMap = new Map((hostProfiles || []).map((h) => [h.id, h.name]));

      setRooms((data || []).map((r) => ({
        id: r.id,
        name: r.name,
        host: r.host_id,
        hostName: hostNameMap.get(r.host_id) || 'Unknown',
        players: playerMap.get(r.id) || [],
        maxPlayers: r.max_players,
        password: undefined,
        gameSettings: {
          subject: r.subject || 'Mixed',
          difficulty: (r.difficulty || 'Medium') as Room['gameSettings']['difficulty'],
          questionCount: r.question_count || 10,
          timePerQuestion: 30,
          gameMode: r.game_mode === 'speed' ? 'speed' : 'accuracy',
        },
        status: r.status as Room['status'],
        createdAt: new Date(r.created_at),
      })));
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [cleanupExpiredRooms]);

  useEffect(() => {
    void fetchRooms();
    const cleanupInterval = window.setInterval(() => void cleanupExpiredRooms(), 60000);
    const channel = supabase
      .channel('rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_rooms' }, () => void fetchRooms())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, () => void fetchRooms())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('Rooms realtime:', status);
      });
    return () => {
      window.clearInterval(cleanupInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchRooms, cleanupExpiredRooms]);

  const createRoom = async (name: string, settings: Room['gameSettings'], maxPlayers: number, password?: string): Promise<Room | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await db.rpc('multiplayer_create_room', {
        p_name: name,
        p_subject: settings.subject,
        p_difficulty: settings.difficulty,
        p_question_count: settings.questionCount,
        p_max_players: maxPlayers,
        p_password: password || null,
      });
      if (error) throw error;

      const { error: settingsError } = await db.rpc('multiplayer_update_room', {
        p_room_id: data.id,
        p_subject: settings.subject,
        p_difficulty: settings.difficulty,
        p_game_mode: settings.gameMode,
        p_question_count: settings.questionCount,
        p_max_players: maxPlayers,
      });
      if (settingsError) throw settingsError;

      const room: Room = {
        id: data.id,
        name: data.name,
        host: data.host_id,
        hostName: user.name,
        players: [user.id],
        maxPlayers: data.max_players,
        password: password || undefined,
        gameSettings: settings,
        status: data.status as Room['status'],
        createdAt: new Date(data.created_at),
      };
      setCurrentRoom(room);
      toast.success('Room created!');
      await fetchRooms();
      return room;
    } catch (err: any) {
      console.error('Error creating room:', err);
      toast.error(err?.message || 'Failed to create room');
      return null;
    }
  };

  const joinRoom = async (roomId: string, playerName: string, password?: string): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const { data: existingRow } = await supabase
        .from('room_players')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle();
      const existingMembership = Boolean(existingRow);

      // Join through the password- and capacity-validated RPC before reading
      // private room metadata. Membership RLS then authorizes the following read.
      const { error: joinError } = await db.rpc('multiplayer_join_room', {
        p_room_id: roomId,
        p_password: password || null,
      });
      if (joinError) throw joinError;

      const { data: roomData, error: roomError } = await supabase
        .from('multiplayer_rooms')
        .select('id, name, host_id, max_players, subject, difficulty, question_count, game_mode, status, created_at, current_question, started_at, finished_at')
        .eq('id', roomId)
        .in('status', ['waiting', 'countdown', 'playing'])
        .single();
      if (roomError || !roomData) {
        throw roomError || new Error('Room is no longer available');
      }

      const room: Room = {
        id: roomData.id,
        name: roomData.name,
        host: roomData.host_id,
        hostName: undefined,
        players: [],
        maxPlayers: roomData.max_players,
        password: undefined,
        gameSettings: {
          subject: roomData.subject || 'Mixed',
          difficulty: (roomData.difficulty || 'Medium') as Room['gameSettings']['difficulty'],
          questionCount: roomData.question_count || 10,
          timePerQuestion: 30,
          gameMode: roomData.game_mode === 'speed' ? 'speed' : 'accuracy',
        },
        status: roomData.status as Room['status'],
        createdAt: new Date(roomData.created_at),
      };
      setCurrentRoom(room);
      toast.success(existingMembership ? `Rejoined ${roomData.name}!` : `Joined ${roomData.name}!`);
      await fetchRooms();
      return true;
    } catch (err: any) {
      console.error('Error joining room:', err);
      toast.error(err?.message || 'Failed to join room');
      return false;
    }
  };

  const leaveRoom = async (roomId: string, playerName: string) => {
    if (!user?.id) return;
    try {
      const { error } = await db.rpc('multiplayer_leave_room', { p_room_id: roomId });
      if (error) throw error;
      setCurrentRoom(null);
      toast.info('Left the room');
      await fetchRooms();
    } catch (err) {
      console.error('Error leaving room:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to leave room');
    }
  };

  return (
    <RoomContext.Provider value={{
      rooms,
      currentRoom,
      loading,
      createRoom,
      joinRoom,
      leaveRoom,
      getRoomById: (roomId) => rooms.find((room) => room.id === roomId),
      getPublicRooms: () => rooms.filter((room) => !room.password && room.status === 'waiting'),
      refreshRooms: fetchRooms,
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
};
