import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useRoom } from "@/context/RoomContext";
import { useFriends } from "@/context/FriendsContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  MessageSquare, 
  Trophy, 
  Clock, 
  Plus,
  Send,
  Home,
  Gamepad,
  Zap,
  Crown,
  Star,
  Swords,
  RefreshCw,
  Activity,
  Target,
  Flame,
  Bell,
  X,
  CheckCircle2,
  Timer,
} from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import RoomCard, { Room } from "@/components/multiplayer/RoomCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import BackButton from "@/components/ui/BackButton";
import AnimatedBackground from "@/components/ui/AnimatedBackground";

interface OnlinePlayer {
  id: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  status: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  timestamp: Date;
}

interface ActivityItem {
  id: string;
  message: string;
  timestamp: Date;
}

interface Tournament {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  players: number;
  maxPlayers: number;
  prize: string;
  status: "upcoming" | "active" | "completed";
  format: "knockout" | "speed_knockout" | "multiplayer_draw";
  scoreMode: "accuracy" | "speed";
  createdBy: string;
  isFull: boolean;
}

interface MultiplayerInvite {
  id: string;
  sender_id: string;
  receiver_id: string;
  room_id: string | null;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
}

interface NewTournamentForm {
  name: string;
  description: string;
  format: Tournament["format"];
  scoreMode: Tournament["scoreMode"];
  subject: string;
  maxPlayers: string;
  prizeCoins: string;
  prizeGems: string;
  durationHours: string;
}

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { rooms, createRoom: contextCreateRoom, joinRoom: contextJoinRoom, refreshRooms } = useRoom();
  const { friends, onlineFriends } = useFriends();
  
  const [chatMessage, setChatMessage] = useState("");
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newRoomData, setNewRoomData] = useState({
    name: "",
    maxPlayers: "2",
    subject: "Mathematics",
    difficulty: "Medium",
    gameMode: "1v1",
    questionCount: "10",
    roomType: "public",
    roomCode: "",
    inviteFriendIds: [] as string[]
  });
  const [joinByCode, setJoinByCode] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([
    {
      id: "seed-room",
      message: "Player123 just won a ranked duel",
      timestamp: new Date(),
    },
    {
      id: "seed-tournament",
      message: "Tournament qualifier opens in 15 minutes",
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
    },
    {
      id: "seed-champion",
      message: "New champion crowned in Grade 8 bracket",
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
    },
  ]);
  const [newTournamentData, setNewTournamentData] = useState<NewTournamentForm>({
    name: "",
    description: "",
    format: "knockout",
    scoreMode: "accuracy",
    subject: "Mixed",
    maxPlayers: "16",
    prizeCoins: "1000",
    prizeGems: "20",
    durationHours: "2"
  });
  const [incomingInvite, setIncomingInvite] = useState<MultiplayerInvite | null>(null);
  const [incomingInviteSender, setIncomingInviteSender] = useState<{ name: string; avatar: string } | null>(null);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(0);
  const [sendingInviteForUserId, setSendingInviteForUserId] = useState<string | null>(null);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (!requestedMode) return;
    setNewRoomData((prev) => {
      const mode = requestedMode === "2v2" || requestedMode === "Battle Royale" ? requestedMode : "1v1";
      const maxPlayers = mode === "2v2" ? "4" : mode === "Battle Royale" ? "8" : prev.maxPlayers;
      return { ...prev, gameMode: mode, maxPlayers };
    });
    setCreateRoomOpen(true);
  }, [searchParams]);

  const pushActivity = useCallback((message: string) => {
    const item: ActivityItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      timestamp: new Date(),
    };
    setActivityFeed((prev) => [item, ...prev].slice(0, 10));
  }, []);

  const fetchOnlinePlayers = useCallback(async () => {
    if (user) {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          last_seen: new Date().toISOString()
        }, { onConflict: 'user_id' });
    }

    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, status, last_seen')
      .eq('status', 'online')
      .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('last_seen', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading online players:', error);
      setOnlinePlayers([]);
      return;
    }

    const userIds = (data || []).map((p: any) => p.user_id);
    if (userIds.length === 0) {
      setOnlinePlayers([]);
      return;
    }

    const { data: profiles, error: profileError } = await supabase.rpc(
      'get_public_student_profiles',
      { p_user_ids: userIds },
    );

    if (profileError) {
      console.error('Error loading public player profiles:', profileError);
      setOnlinePlayers([]);
      return;
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const players = userIds
      .map((id: string) => profileMap.get(id))
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
        name: p.name || p.username || 'Student',
        avatar: p.avatar || 'avatar-1',
        level: p.level || 1,
        xp: p.xp || 0,
        status: 'online',
      }));

    setOnlinePlayers(players);
  }, [user]);

  const fetchChatMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('lobby_messages')
      .select('id, content, created_at, user_id')
      .order('created_at', { ascending: true })
      .limit(50);

    if (!error && data) {
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      const messages = data.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        userName: profileMap[m.user_id]?.name || 'Unknown',
        userAvatar: profileMap[m.user_id]?.avatar || 'avatar-1',
        message: m.content,
        timestamp: new Date(m.created_at)
      }));
      setChatMessages(messages);
    }
  }, []);

  const fetchTournaments = useCallback(async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['upcoming', 'active'])
      .order('start_time', { ascending: true })
      .limit(10);

    if (!error && data) {
      const tournamentIds = data.map((t: any) => t.id);
      const participantCounts: Record<string, number> = {};
      
      if (tournamentIds.length > 0) {
        const { data: participants } = await supabase
          .from('tournament_participants')
          .select('tournament_id')
          .in('tournament_id', tournamentIds);

        if (participants) {
          participants.forEach((p: any) => {
            participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] || 0) + 1;
          });
        }
      }

      const tourns = data.map((t: any) => {
        const playersCount = participantCounts[t.id] || 0;
        const maxPlayers = t.max_participants || 128;
        const lowerDifficulty = (t.difficulty || "").toLowerCase();
        const format = lowerDifficulty.includes("draw")
          ? "multiplayer_draw"
          : lowerDifficulty.includes("speed")
            ? "speed_knockout"
            : "knockout";
        return {
          id: t.id,
          name: t.name,
          description: t.description || "Tournament challenge",
          format: format as Tournament["format"],
          scoreMode: (lowerDifficulty.includes("speed") ? "speed" : "accuracy") as Tournament["scoreMode"],
          startTime: new Date(t.start_time),
          endTime: new Date(t.end_time),
          players: playersCount,
          maxPlayers,
          prize: t.prize_description || `${t.prize_coins || 0} coins + ${t.prize_gems || 0} gems`,
          status: t.status as Tournament["status"],
          createdBy: t.created_by,
          isFull: playersCount >= maxPlayers
        };
      });
      setTournaments(tourns);
    }
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    const [roomsRes, chatsRes, tournRes] = await Promise.all([
      supabase
        .from("multiplayer_rooms")
        .select("id, name, created_at, host_id")
        .in("status", ["waiting", "countdown", "playing"])
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("lobby_messages")
        .select("id, content, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("tournament_participants")
        .select("id, registered_at, user_id, tournament_id")
        .order("registered_at", { ascending: false })
        .limit(4),
    ]);

    const hostIds = (roomsRes.data || []).map((room) => room.host_id);
    const chatUserIds = (chatsRes.data || []).map((msg) => msg.user_id);
    const participantUserIds = (tournRes.data || []).map((entry) => entry.user_id);
    const userIds = [...new Set([...hostIds, ...chatUserIds, ...participantUserIds])];

    const tournamentIds = [...new Set((tournRes.data || []).map((entry) => entry.tournament_id))];

    const [profilesRes, tournamentMetaRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id, name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
      tournamentIds.length > 0
        ? supabase.from("tournaments").select("id, name").in("id", tournamentIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((profile) => [profile.id, profile.name || "Student"]));
    const tournamentMap = new Map((tournamentMetaRes.data || []).map((tournament) => [tournament.id, tournament.name]));

    const combined = [
      ...(roomsRes.data || []).map((room) => ({
        id: `room-${room.id}`,
        createdAt: room.created_at,
        message: `${profileMap.get(room.host_id) || "Student"} created room "${room.name}"`,
      })),
      ...(chatsRes.data || []).map((msg) => ({
        id: `chat-${msg.id}`,
        createdAt: msg.created_at,
        message: `${profileMap.get(msg.user_id) || "Student"}: ${msg.content}`,
      })),
      ...(tournRes.data || []).map((entry) => ({
        id: `tournament-${entry.id}`,
        createdAt: entry.registered_at,
        message: `${profileMap.get(entry.user_id) || "Student"} joined ${tournamentMap.get(entry.tournament_id) || "a tournament"}`,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        message: item.message,
        timestamp: new Date(item.createdAt),
      }));

    setActivityFeed(combined);
  }, []);

  const loadLobbyData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshRooms(),
        fetchOnlinePlayers(),
        fetchChatMessages(),
        fetchTournaments(),
        fetchRecentActivity(),
      ]);
    } catch (error) {
      console.error('Error loading lobby data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchChatMessages, fetchOnlinePlayers, fetchRecentActivity, fetchTournaments, refreshRooms]);

  const setupRealtimeSubscriptions = useCallback(() => {
    const chatChannel = supabase
      .channel('lobby-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lobby_messages'
      }, async (payload) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar')
          .eq('id', payload.new.user_id)
          .single();
        
        if (profile) {
          const newMsg: ChatMessage = {
            id: payload.new.id,
            userId: payload.new.user_id,
            userName: profile.name,
            userAvatar: profile.avatar || 'avatar-1',
            message: payload.new.content,
            timestamp: new Date(payload.new.created_at)
          };
          setChatMessages(prev => [...prev, newMsg]);
          pushActivity(`${profile.name}: ${payload.new.content}`);
        }
      })
      .subscribe();

    const roomChannel = supabase
      .channel('lobby-rooms')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'multiplayer_rooms'
      }, () => {
        refreshRooms();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'multiplayer_rooms'
      }, async (payload) => {
        const newRoom = payload.new as { name: string; host_id: string };
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", newRoom.host_id).single();
        pushActivity(`${profile?.name || "Student"} created room "${newRoom.name}"`);
      })
      .subscribe();

    const presenceChannel = supabase
      .channel('lobby-presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, () => {
        fetchOnlinePlayers();
      })
      .subscribe();

    const tournamentChannel = supabase
      .channel('lobby-tournaments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments'
      }, () => {
        fetchTournaments();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants'
      }, () => {
        fetchTournaments();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tournament_participants'
      }, async (payload) => {
        const entry = payload.new as { user_id: string; tournament_id: string };
        const [{ data: profile }, { data: tournament }] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", entry.user_id).single(),
          supabase.from("tournaments").select("name").eq("id", entry.tournament_id).single(),
        ]);
        pushActivity(`${profile?.name || "Student"} joined ${tournament?.name || "a tournament"}`);
      })
      .subscribe();

    const invitesChannel = supabase
      .channel("multiplayer-invites")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multiplayer_invites",
        },
        async (payload: any) => {
          const newInvite = payload.new as MultiplayerInvite | null;
          if (!newInvite || !user?.id) return;

          if (newInvite.receiver_id === user.id && newInvite.status === "pending") {
            setIncomingInvite(newInvite);
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("name, avatar")
              .eq("id", newInvite.sender_id)
              .single();

            setIncomingInviteSender({
              name: senderProfile?.name || "Player",
              avatar: senderProfile?.avatar || "avatar-1",
            });
            const seconds = Math.max(
              0,
              Math.floor((new Date(newInvite.expires_at).getTime() - Date.now()) / 1000),
            );
            setInviteSecondsLeft(seconds);
            toast.info(`🎮 ${senderProfile?.name || "Player"} invited you to a match`);
            if ("vibrate" in navigator) {
              navigator.vibrate(180);
            }
          }

          if (newInvite.sender_id === user.id && newInvite.status !== "pending") {
            const statusLabel = newInvite.status === "accepted" ? "accepted" : newInvite.status;
            toast.message(`Invite ${statusLabel}`);

            if (newInvite.status === "accepted" && newInvite.room_id) {
              const success = await contextJoinRoom(newInvite.room_id, user.name || "Player");
              if (success) {
                pushActivity("Your invite was accepted. Entering shared room...");
                navigate(`/multiplayer?room=${newInvite.room_id}`);
              }
            }
          }
        },
      )
      .subscribe();

    return [chatChannel, roomChannel, presenceChannel, tournamentChannel, invitesChannel];
  }, [contextJoinRoom, fetchOnlinePlayers, fetchTournaments, navigate, pushActivity, refreshRooms, user?.id, user?.name]);

  useEffect(() => {
    if (!user?.id || incomingInvite) return;

    const loadPendingInvite = async () => {
      const { data, error } = await (supabase as any)
        .from("multiplayer_invites")
        .select("id, sender_id, receiver_id, room_id, status, created_at, expires_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("name, avatar")
        .eq("id", data.sender_id)
        .single();

      setIncomingInvite(data as MultiplayerInvite);
      setIncomingInviteSender({
        name: senderProfile?.name || "A player",
        avatar: senderProfile?.avatar || "avatar-1",
      });
    };

    void loadPendingInvite();
  }, [user?.id, incomingInvite]);

  useEffect(() => {
    if (!incomingInvite) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(incomingInvite.expires_at).getTime() - Date.now()) / 1000),
      );
      setInviteSecondsLeft(remaining);
      if (remaining <= 0) {
        void supabase
          .from("multiplayer_invites" as any)
          .update({ status: "expired", responded_at: new Date().toISOString() })
          .eq("id", incomingInvite.id)
          .eq("receiver_id", user?.id || "");
        setIncomingInvite(null);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [incomingInvite, user?.id]);

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access the lobby");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    loadLobbyData();
    const channels = setupRealtimeSubscriptions();

    return () => {
      channels?.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user, navigate, loadLobbyData, setupRealtimeSubscriptions]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user) return;
    
    const { error } = await supabase
      .from('lobby_messages')
      .insert({
        user_id: user.id,
        content: chatMessage.trim()
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setChatMessage("");
    }
  };

  const createRoom = async () => {
    if (!newRoomData.name.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    const gameSettings = {
      subject: newRoomData.subject,
      difficulty: newRoomData.difficulty as 'Easy' | 'Medium' | 'Hard',
      questionCount: parseInt(newRoomData.questionCount),
      timePerQuestion: 30
    };

    const roomPassword = newRoomData.roomType === "private" ? newRoomData.roomCode.trim() : undefined;
    if (newRoomData.roomType === "private" && !roomPassword) {
      toast.error("Private rooms require a passcode");
      return;
    }

    if (newRoomData.roomType === "private" && roomPassword && roomPassword.length < 4) {
      toast.error("Private room passcode must be at least 4 characters");
      return;
    }

    const scoreMode = newRoomData.gameMode === "2v2" ? "accuracy" : "speed";
    const playerLimit = newRoomData.gameMode === "2v2" ? 4 : newRoomData.gameMode === "Battle Royale" ? 8 : 2;

    const room = await contextCreateRoom(
      newRoomData.name,
      { ...gameSettings, gameMode: scoreMode },
      playerLimit,
      roomPassword || undefined
    );

    if (room) {
      const inviteCode = room.id.slice(0, 8).toUpperCase();
      await navigator.clipboard.writeText(inviteCode).catch(() => undefined);

      if (newRoomData.inviteFriendIds.length > 0 && user?.id) {
        await Promise.all(
          newRoomData.inviteFriendIds.map((friendId) =>
            supabase.from("messages").insert({
              sender_id: user.id,
              receiver_id: friendId,
              content: `🎮 Join my ${newRoomData.subject} room "${newRoomData.name}" with code: ${inviteCode}`
            })
          )
        );
      }

      toast.success(`Room created! Invite code copied: ${inviteCode}`);
      setCreateRoomOpen(false);
      setNewRoomData({ name: "", maxPlayers: "2", subject: "Mathematics", difficulty: "Medium", gameMode: "1v1", questionCount: "10", roomType: "public", roomCode: "", inviteFriendIds: [] });
      navigate(`/multiplayer?room=${room.id}`);
    }
  };

  const handleJoinRoom = async (room: Room) => {
    const success = await contextJoinRoom(room.id, user?.name || 'Player');
    if (success) {
      navigate(`/multiplayer?room=${room.id}`);
    }
  };

  const joinWithCode = async () => {
    if (!joinByCode.trim() || !user) {
      toast.error("Enter a room code");
      return;
    }

    const normalizedCode = joinByCode.trim().toUpperCase();
    const { data: roomPool, error } = await supabase
      .from("multiplayer_rooms")
      .select("id, name, password, status")
      .in("status", ["waiting", "countdown", "playing"]);

    if (error || !roomPool) {
      toast.error("Unable to look up room code");
      return;
    }

    const matchedRoom = roomPool.find((room) => room.id.slice(0, 8).toUpperCase() === normalizedCode);
    if (!matchedRoom) {
      toast.error("Room not found for this code");
      return;
    }

    if (matchedRoom.password && !joinPasscode.trim()) {
      toast.error("This room is private. Enter passcode.");
      return;
    }

    const success = await contextJoinRoom(matchedRoom.id, user.name || "Player", joinPasscode.trim() || undefined);
    if (success) {
      setJoinByCode("");
      setJoinPasscode("");
      navigate(`/multiplayer?room=${matchedRoom.id}`);
    }
  };

  const handleRandomMatch = async () => {
    if (!user) return;

    await refreshRooms();

    const { data: waitingRooms, error: waitingRoomsError } = await supabase
      .from("multiplayer_rooms")
      .select("id, name, max_players")
      .eq("status", "waiting")
      .is("password", null)
      .order("created_at", { ascending: false })
      .limit(30);

    if (waitingRoomsError) {
      toast.error("Could not search for available matches.");
      return;
    }

    const roomIds = (waitingRooms || []).map((room) => room.id);
    const { data: playerRows, error: playerRowsError } = roomIds.length
      ? await supabase.from("room_players").select("room_id").in("room_id", roomIds)
      : { data: [], error: null };

    if (playerRowsError) {
      toast.error("Could not check room capacity.");
      return;
    }

    const playerCounts = new Map<string, number>();
    (playerRows || []).forEach((row: { room_id: string }) => {
      playerCounts.set(row.room_id, (playerCounts.get(row.room_id) || 0) + 1);
    });

    const availableRooms = (waitingRooms || []).filter((room) => {
      const count = playerCounts.get(room.id) || 0;
      return count < room.max_players;
    });

    if (availableRooms.length === 0) {
      const quickMatchRoomName = `${user.name || "Player"}'s Quick Match`;
      const quickRoom = await contextCreateRoom(
        quickMatchRoomName,
        {
          subject: "Mixed",
          difficulty: "Medium",
          questionCount: 10,
          timePerQuestion: 30,
          gameMode: "speed",
        },
        2,
      );

      if (!quickRoom) {
        toast.error("Could not create a quick match room. Try again.");
        return;
      }

      toast.success("Quick match room created. Waiting for an opponent…");
      navigate(`/multiplayer?room=${quickRoom.id}`);
      return;
    }

    const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    const success = await contextJoinRoom(randomRoom.id, user.name || "Player");
    if (success) {
      toast.success(`Matched in room: ${randomRoom.name}`);
      navigate(`/multiplayer?room=${randomRoom.id}`);
    }
  };

  const joinTournament = async (tournamentId: string) => {
    if (!user) return;

    const target = tournaments.find((tournament) => tournament.id === tournamentId);
    if (target?.status === "active" || target?.status === "completed") {
      toast.error("This tournament is no longer accepting registrations.");
      return;
    }
    if (target?.isFull) {
      toast.error("This tournament is full.");
      return;
    }

    const { error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Already registered for this tournament');
      } else {
        toast.error('Failed to register');
      }
    } else {
      toast.success('Registered for tournament!');
      fetchTournaments();
    }
  };

  const createTournament = async () => {
    if (!user || !newTournamentData.name.trim()) {
      toast.error("Tournament name is required");
      return;
    }

    const startTime = new Date();
    const endTime = new Date(Date.now() + Number(newTournamentData.durationHours || 2) * 60 * 60 * 1000);
    const difficultyTag =
      newTournamentData.format === "multiplayer_draw"
        ? "draw"
        : newTournamentData.scoreMode === "speed"
          ? "speed"
          : "accuracy";

    const { error } = await supabase
      .from("tournaments")
      .insert({
        name: newTournamentData.name.trim(),
        description: newTournamentData.description.trim() || `Mode: ${newTournamentData.format.replace("_", " ")}`,
        created_by: user.id,
        status: "upcoming",
        subject: newTournamentData.subject,
        difficulty: difficultyTag,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        max_participants: Math.max(2, Number(newTournamentData.maxPlayers || 16)),
        prize_coins: Number(newTournamentData.prizeCoins || 0),
        prize_gems: Number(newTournamentData.prizeGems || 0),
        prize_description: `${newTournamentData.prizeCoins} coins + ${newTournamentData.prizeGems} gems`
      });

    if (error) {
      toast.error("Failed to create tournament");
      return;
    }

    toast.success("Tournament created. Students can now register.");
    setCreateTournamentOpen(false);
    setNewTournamentData({
      name: "",
      description: "",
      format: "knockout",
      scoreMode: "accuracy",
      subject: "Mixed",
      maxPlayers: "16",
      prizeCoins: "1000",
      prizeGems: "20",
      durationHours: "2"
    });
    fetchTournaments();
  };

  const startTournament = async (tournament: Tournament) => {
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      toast.error("Only admins or managers can start tournaments");
      return;
    }

    if (!tournament.isFull) {
      toast.error("Tournament must be full before starting");
      return;
    }

    const { error } = await supabase
      .from("tournaments")
      .update({ status: "active" })
      .eq("id", tournament.id);

    if (error) {
      toast.error("Failed to start tournament");
      return;
    }

    const startMessage = tournament.format === "multiplayer_draw"
      ? "Draw generated. Players can now battle in multiplayer rounds."
      : tournament.scoreMode === "speed"
        ? "Speed knockout started. Fastest correct answers win."
        : "Accuracy knockout started. Highest precision wins each round.";

    toast.success(`Tournament started: ${tournament.name}`, { description: startMessage });
    fetchTournaments();
  };

  const challengePlayer = async (playerId: string, playerName: string) => {
    if (!user) return;
    setSendingInviteForUserId(playerId);
    try {
      const { data: room, error: roomError } = await supabase.rpc("multiplayer_create_room", {
        p_name: `${user.name || "Player"}'s Challenge`,
        p_subject: "Mixed",
        p_difficulty: "Medium",
        p_question_count: 10,
        p_max_players: 2,
        p_password: null,
      });
      if (roomError) throw roomError;

      const { error: settingsError } = await supabase.rpc("multiplayer_update_room", {
        p_room_id: room.id,
        p_subject: "Mixed",
        p_difficulty: "Medium",
        p_game_mode: "accuracy",
        p_question_count: 10,
        p_max_players: 2,
      });
      if (settingsError) throw settingsError;

      const { error: inviteError } = await supabase.rpc("create_multiplayer_invite", {
        _receiver_id: playerId,
        _room_id: room.id,
      });
      if (inviteError) throw inviteError;

      // The challenger is already the room host, so enter the newly-created room immediately.
      // The invited player will join the same room after accepting.
      toast.success(`Invite sent to ${playerName}`);
      pushActivity(`${playerName} was invited to a multiplayer challenge`);
      navigate(`/multiplayer?room=${room.id}`);
    } catch (error: any) {
      console.error("Error sending multiplayer challenge:", error);
      toast.error(error?.message || "Could not send invite");
    } finally {
      setSendingInviteForUserId(null);
    }
  };

  const respondToInvite = async (response: "accepted" | "rejected") => {
    if (!incomingInvite || !user) return;

    try {
      const { data, error } = await (supabase as any).rpc("respond_multiplayer_invite", {
        _invite_id: incomingInvite.id,
        _accept: response === "accepted",
      });

      if (error) throw error;

      const roomId = data?.room_id || incomingInvite.room_id;
      setIncomingInvite(null);

      if (response === "accepted" && roomId) {
        const success = await contextJoinRoom(roomId, user.name || "Player");
        if (!success) throw new Error("Could not join the invited game room");

        // An accepted direct challenge is a ready-to-play action. Mark the invitee ready
        // so the host can automatically start the match as soon as both players are present.
        const { error: readyError } = await supabase.rpc("multiplayer_toggle_ready", { p_room_id: roomId });
        if (readyError) throw readyError;

        navigate(`/multiplayer?room=${roomId}`);
      } else {
        toast.success("Invite declined");
      }
    } catch (error: any) {
      console.error("Error responding to multiplayer invite:", error);
      toast.error(error?.message || "Invite response failed");
    }
  };

  const formatTimeRemaining = (startTime: Date) => {
    const diff = startTime.getTime() - Date.now();
    if (diff < 0) return "Starting now";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'in-game': return 'bg-blue-500';
      default: return 'bg-yellow-500';
    }
  };

  const canManageTournaments = user?.role === "admin" || user?.role === "manager";
  const liveMatchCount = Math.max(0, rooms.filter((r) => r.status === "playing").length);
  const balancedPlayers = onlinePlayers.filter((p) => Math.abs((p.level || 1) - (user?.level || 1)) <= 2).length;
  const matchQualityScore = Math.min(
    99,
    Math.max(72, Math.round((balancedPlayers / Math.max(1, onlinePlayers.length)) * 100)),
  );
  const formatLabel: Record<Tournament["format"], string> = {
    knockout: "Knockout",
    speed_knockout: "Speed Knockout",
    multiplayer_draw: "Multiplayer Draw"
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/60">
          <CardHeader>
            <CardTitle>Lobby Access Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Please sign in to use multiplayer rooms, chat, and tournaments. Redirecting to home...
            </p>
            <Button className="w-full" onClick={() => navigate("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeRooms: Room[] = rooms
    .filter((room) => room.status !== "finished")
    .map(r => ({
    id: r.id,
    name: r.name,
    players: r.players?.length || 0,
    maxPlayers: r.maxPlayers,
    status: ((r.status as string) === 'countdown' ? 'waiting' : r.status) as 'waiting' | 'in-progress' | 'finished',
    subject: r.gameSettings?.subject || 'Mixed',
    difficulty: r.gameSettings?.difficulty || 'Medium',
    gameMode: '1v1',
    createdBy: r.host
  }));

  const recentMatches = activeRooms.slice(0, 4);
  const recentActivities = activityFeed.slice(0, 6);
  const friendsOnline = onlineFriends;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <AnimatedBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.24),transparent_52%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.16),transparent_44%)]" />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <BackButton to="/" />
            <div className="bg-cyan-500/15 rounded-xl p-2 border border-cyan-300/30">
              <Gamepad className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Nexus Lobby</h1>
              <p className="text-xs text-slate-300">{onlinePlayers.length.toLocaleString()} players online • {liveMatchCount} matches live</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 min-w-[260px]">
              <AvatarRenderer avatar={user.avatar || "avatar-1"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-white">{user.name || "Player"}</p>
                <div className="h-1.5 rounded-full bg-slate-700 mt-1 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-violet-400 animate-pulse" style={{ width: `${Math.min(100, ((user.xp || 0) % 1000) / 10)}%` }} />
                </div>
              </div>
              <Badge className="bg-violet-500/20 text-violet-200 border-violet-300/40">Lv.{user.level || 1}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={loadLobbyData}>
              <RefreshCw className={`h-4 w-4 text-white ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate("/")} className="gap-2 bg-white/10 text-white hover:bg-white/20 border border-white/20">
              <Home className="h-4 w-4" /> Menu
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 px-4 py-3 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2">
          <Button onClick={() => setCreateRoomOpen(true)} className="gap-2 whitespace-nowrap bg-cyan-600 hover:bg-cyan-500">
            <Plus className="h-4 w-4" /> Create Room
          </Button>
          <Button variant="outline" className="gap-2 whitespace-nowrap border-cyan-400/40 text-cyan-100 bg-cyan-500/10 hover:bg-cyan-500/20" onClick={handleRandomMatch}>
            <Zap className="h-4 w-4" /> Find Match
          </Button>
          <Button variant="outline" className="gap-2 whitespace-nowrap border-violet-400/40 text-violet-100 bg-violet-500/10 hover:bg-violet-500/20">
            <Swords className="h-4 w-4" /> Ranked
          </Button>
          <Button variant="outline" className="gap-2 whitespace-nowrap border-amber-300/40 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20">
            <Crown className="h-4 w-4" /> Tournament
          </Button>
          <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-auto">
            <Input value={joinByCode} onChange={(e) => setJoinByCode(e.target.value)} className="h-9 flex-1 min-w-[150px]" placeholder="Join by room code" />
            <Input value={joinPasscode} onChange={(e) => setJoinPasscode(e.target.value)} className="h-9 flex-1 min-w-[170px]" placeholder="Passcode" />
            <Button onClick={joinWithCode} className="whitespace-nowrap" variant="secondary">Join</Button>
          </div>
          {canManageTournaments && (
            <Button variant="outline" className="gap-2 whitespace-nowrap" onClick={() => setCreateTournamentOpen(true)}>
              <Trophy className="h-4 w-4" /> Create Tournament
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          {[
            { title: "⚔️ Quick Match", desc: "Fast balanced duel queue", onClick: handleRandomMatch, style: "from-cyan-500/40 to-blue-500/30 border-cyan-300/30" },
            { title: "👥 Team Up", desc: "Invite friends and squad", onClick: () => setCreateRoomOpen(true), style: "from-violet-500/40 to-fuchsia-500/30 border-violet-300/30" },
            { title: "🏆 Tournaments", desc: "Join live competitive cups", onClick: () => {}, style: "from-amber-500/40 to-orange-500/30 border-amber-300/30" },
            { title: "🔐 Private Room", desc: "Code + pass protected lobby", onClick: () => setCreateRoomOpen(true), style: "from-emerald-500/40 to-teal-500/30 border-emerald-300/30" },
          ].map((card) => (
            <button
              key={card.title}
              onClick={card.onClick}
              className={`text-left rounded-2xl border p-4 bg-gradient-to-br ${card.style} hover:scale-[1.015] transition-transform shadow-[0_0_25px_rgba(56,189,248,0.12)]`}
            >
              <p className="font-semibold text-white">{card.title}</p>
              <p className="text-xs text-slate-200 mt-1">{card.desc}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="border-cyan-300/30 bg-cyan-500/10">
            <CardContent className="p-3 text-sm">
              <div className="flex items-center gap-2 text-cyan-100"><Users className="h-4 w-4" /> Players online now</div>
              <p className="text-2xl font-bold mt-1 text-white">{onlinePlayers.length.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-indigo-300/30 bg-indigo-500/10">
            <CardContent className="p-3 text-sm">
              <div className="flex items-center gap-2 text-indigo-100"><Activity className="h-4 w-4" /> Matches in progress</div>
              <p className="text-2xl font-bold mt-1 text-white">{liveMatchCount}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-300/30 bg-emerald-500/10">
            <CardContent className="p-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-100"><Target className="h-4 w-4" /> Match Quality</div>
              <p className="text-2xl font-bold mt-1 text-white">{matchQualityScore}% Balanced</p>
            </CardContent>
          </Card>
          <Card className="border-orange-300/30 bg-orange-500/10">
            <CardContent className="p-3 text-sm">
              <div className="flex items-center gap-2 text-orange-100"><Flame className="h-4 w-4" /> Win Streak Aura</div>
              <p className="text-2xl font-bold mt-1 text-white">🔥 {Math.max(1, Math.floor((user?.xp || 0) / 1200))}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-4 px-4 relative z-10">
        {loading && (
          <div className="mb-4 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Syncing lobby data...
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-white/10 text-white">
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" /> Online Players ({onlinePlayers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-3 space-y-2">
                  {onlinePlayers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No players online</p>
                  ) : (
                    onlinePlayers.map((player) => (
                      <div key={player.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="relative">
                          <AvatarRenderer avatar={player.avatar} size="md" />
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${getStatusColor(player.status)} border-2 border-card`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate text-white">{player.name}</div>
                          <div className="text-xs text-slate-300 flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" /> Lv.{player.level} • {player.xp} XP
                          </div>
                        </div>
                        {player.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            disabled={sendingInviteForUserId === player.id}
                            onClick={() => challengePlayer(player.id, player.name)}
                          >
                            <Swords className="h-3 w-3 mr-1" /> {sendingInviteForUserId === player.id ? "Sending..." : "Invite"}
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/80 border-white/10 text-white">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Play & Compete</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <Tabs defaultValue="rooms">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="rooms" className="gap-1"><Gamepad className="h-3 w-3" /> Rooms ({activeRooms.length})</TabsTrigger>
                  <TabsTrigger value="tournaments" className="gap-1"><Trophy className="h-3 w-3" /> Tournaments ({tournaments.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="rooms" className="mt-3">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-2">
                      {activeRooms.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No active rooms. Create one!</p>
                      ) : (
                        activeRooms.map((room) => (
                          <RoomCard key={room.id} room={room} onJoin={handleJoinRoom} />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="tournaments" className="mt-3">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {tournaments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No upcoming tournaments</p>
                      ) : (
                        tournaments.map((tournament) => (
                          <div key={tournament.id} className="border border-border/50 rounded-xl p-4 bg-muted/30">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold text-sm">{tournament.name}</h3>
                                <div className="text-[11px] text-muted-foreground mt-0.5">{formatLabel[tournament.format]} • {tournament.scoreMode}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {tournament.status === 'active' ? 'In Progress' : `Starts in: ${formatTimeRemaining(tournament.startTime)}`}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">{tournament.players}/{tournament.maxPlayers}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              <span className="text-yellow-500 font-medium">🏆 Prize:</span> {tournament.prize}
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(tournament.players / tournament.maxPlayers) * 100}%` }} />
                            </div>
                            <div className="space-y-2">
                              <Button size="sm" className="w-full" onClick={() => joinTournament(tournament.id)} disabled={tournament.status === 'active' || tournament.isFull}>
                                {tournament.status === 'active' ? 'In Progress' : tournament.isFull ? 'Full' : 'Register'}
                              </Button>
                              {canManageTournaments && tournament.status === "upcoming" && (
                                <Button size="sm" variant="outline" className="w-full" onClick={() => startTournament(tournament)} disabled={!tournament.isFull}>
                                  {tournament.isFull ? 'Start Tournament' : 'Waiting for Full Capacity'}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/80 border-white/10 text-white">
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5" /> Lobby Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[500px]">
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No messages yet. Say hi!</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2">
                        <AvatarRenderer avatar={msg.userAvatar} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-sm">{msg.userName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground break-words">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border/50">
                <div className="flex gap-2">
                  <Input value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Type a message..." className="flex-1" />
                  <Button type="submit" size="icon" className="flex-shrink-0"><Send className="h-4 w-4" /></Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 backdrop-blur-sm border-white/10 text-white">
            <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-xl py-3">
              <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-5 w-5" /> Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {recentActivities.map((item, index) => (
                <motion.div
                  key={`${item.id}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2 text-sm"
                >
                  <p>{item.message}</p>
                  <p className="text-[11px] text-emerald-200/80 mt-1">{item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-white/10 text-white">
            <CardHeader className="py-3 border-b border-white/10">
              <CardTitle className="text-base">Friends + Recent Matches</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div>
                <p className="text-xs text-slate-300 mb-2">Online friends ({friendsOnline.length})</p>
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {friendsOnline.length === 0 ? (
                    <p className="text-xs text-slate-400">No friends online right now.</p>
                  ) : (
                    friendsOnline.slice(0, 6).map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-2">
                        <span className="text-sm">{friend.name}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => challengePlayer(friend.id, friend.name)}>
                          Invite
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-300 mb-2">Recent active rooms</p>
                <div className="space-y-2">
                  {recentMatches.length === 0 ? (
                    <p className="text-xs text-slate-400">No recent room history yet.</p>
                  ) : (
                    recentMatches.map((match) => (
                      <div key={match.id} className="rounded-lg bg-white/5 border border-white/10 p-2 text-xs">
                        <p className="font-medium text-slate-100">{match.name}</p>
                        <p className="text-slate-300">{match.subject} • {match.players}/{match.maxPlayers} players</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gamepad className="h-5 w-5" /> Create Game Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Name</Label>
              <Input value={newRoomData.name} onChange={(e) => setNewRoomData({...newRoomData, name: e.target.value})} placeholder="e.g., Math Champions" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Game Mode</Label>
                <Select value={newRoomData.gameMode} onValueChange={(v) => setNewRoomData({...newRoomData, gameMode: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1v1">1v1 Duel</SelectItem>
                    <SelectItem value="2v2">2v2 Team</SelectItem>
                    <SelectItem value="Battle Royale">Battle Royale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Players</Label>
                <Select value={newRoomData.maxPlayers} onValueChange={(v) => setNewRoomData({...newRoomData, maxPlayers: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Players</SelectItem>
                    <SelectItem value="4">4 Players</SelectItem>
                    <SelectItem value="8">8 Players</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject</Label>
                <Select value={newRoomData.subject} onValueChange={(v) => setNewRoomData({...newRoomData, subject: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={newRoomData.difficulty} onValueChange={(v) => setNewRoomData({...newRoomData, difficulty: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Questions</Label>
                <Select value={newRoomData.questionCount} onValueChange={(v) => setNewRoomData({...newRoomData, questionCount: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions</SelectItem>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="15">15 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room Privacy</Label>
                <Select value={newRoomData.roomType} onValueChange={(v) => setNewRoomData({...newRoomData, roomType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newRoomData.roomType === "private" && (
              <div>
                <Label>Private Room Code</Label>
                <Input value={newRoomData.roomCode} onChange={(e) => setNewRoomData({...newRoomData, roomCode: e.target.value})} placeholder="Enter passcode" />
              </div>
            )}
            <div>
              <Label>Invite Friends</Label>
              {friends.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No friends available yet. Add friends to invite directly.</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-32 overflow-auto border border-border rounded-md p-2">
                  {friends.map((friend) => {
                    const selected = newRoomData.inviteFriendIds.includes(friend.id);
                    return (
                      <Button
                        type="button"
                        key={friend.id}
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => {
                          setNewRoomData((prev) => ({
                            ...prev,
                            inviteFriendIds: selected
                              ? prev.inviteFriendIds.filter((id) => id !== friend.id)
                              : [...prev.inviteFriendIds, friend.id]
                          }));
                        }}
                      >
                        {friend.name}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRoomOpen(false)}>Cancel</Button>
            <Button onClick={createRoom} className="gap-2"><Plus className="h-4 w-4" /> Create Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createTournamentOpen} onOpenChange={setCreateTournamentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Create Tournament (Admin)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tournament Name</Label>
              <Input value={newTournamentData.name} onChange={(e) => setNewTournamentData({ ...newTournamentData, name: e.target.value })} placeholder="e.g., Grade 8 Speed Cup" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newTournamentData.description} onChange={(e) => setNewTournamentData({ ...newTournamentData, description: e.target.value })} placeholder="What students will compete on" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format</Label>
                <Select value={newTournamentData.format} onValueChange={(value: Tournament["format"]) => setNewTournamentData({ ...newTournamentData, format: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knockout">Knockout (Football style)</SelectItem>
                    <SelectItem value="speed_knockout">Speed Knockout</SelectItem>
                    <SelectItem value="multiplayer_draw">Competition Draw (Multiplayer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scoring</Label>
                <Select value={newTournamentData.scoreMode} onValueChange={(value: Tournament["scoreMode"]) => setNewTournamentData({ ...newTournamentData, scoreMode: value })} disabled={newTournamentData.format === "multiplayer_draw"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accuracy">Accuracy</SelectItem>
                    <SelectItem value="speed">Speed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Players</Label>
                <Input type="number" min={2} value={newTournamentData.maxPlayers} onChange={(e) => setNewTournamentData({ ...newTournamentData, maxPlayers: e.target.value })} />
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <Input type="number" min={1} value={newTournamentData.durationHours} onChange={(e) => setNewTournamentData({ ...newTournamentData, durationHours: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prize Coins</Label>
                <Input type="number" min={0} value={newTournamentData.prizeCoins} onChange={(e) => setNewTournamentData({ ...newTournamentData, prizeCoins: e.target.value })} />
              </div>
              <div>
                <Label>Prize Gems</Label>
                <Input type="number" min={0} value={newTournamentData.prizeGems} onChange={(e) => setNewTournamentData({ ...newTournamentData, prizeGems: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTournamentOpen(false)}>Cancel</Button>
            <Button onClick={createTournament}>Create Tournament</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {incomingInvite && incomingInvite.status === "pending" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[92vw] max-w-md">
          <Card className="border-emerald-400/40 bg-slate-950/95 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <AvatarRenderer avatar={incomingInviteSender?.avatar || "avatar-1"} size="md" />
                <div className="flex-1">
                  <p className="font-semibold">🎮 {incomingInviteSender?.name || "A player"} invited you to a match</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Timer className="h-3 w-3" /> Expires in {inviteSecondsLeft}s
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => respondToInvite("accepted")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Accept
                </Button>
                <Button variant="outline" onClick={() => respondToInvite("rejected")}>
                  <X className="h-4 w-4 mr-2" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Lobby;
