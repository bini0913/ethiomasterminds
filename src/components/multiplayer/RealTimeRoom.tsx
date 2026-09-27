import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Crown,
  Clock,
  MessageCircle,
  Send,
  LogOut,
  Loader2,
  CheckCircle,
  XCircle,
  Wifi,
  Volume2,
  VolumeX,
  UserPlus,
  Link,
  Signal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AvatarRenderer from '@/components/avatar/AvatarRenderer';
import { useFriends } from '@/context/FriendsContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
  level: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  points: number;
}

interface RoomState {
  status: 'waiting' | 'ready' | 'countdown' | 'starting' | 'playing' | 'finished';
  question_index: number;
  current_question_id: string | null;
  question_started_at: string | null;
  question_ends_at: string | null;
}

export interface MatchSummary {
  playerRank: number;
  xpGained: number;
  rankChange: number;
  accuracy: number;
  avgResponseTime: number;
  streak: number;
  strongTopics: string[];
  weakTopics: string[];
}

interface RealTimeRoomProps {
  roomId: string;
  roomName: string;
  maxPlayers: number;
  currentUserId: string;
  currentUserName: string;
  onLeave: () => void;
  onGameEnd: (results: MatchSummary) => void;
}

const SAFE_CHAT = ['Good luck!', 'Nice move!', 'Ready to battle!', 'Well played!', 'Rematch?'];
const QUICK_EMOTES = ['🔥', '😎', '💡'];

const RealTimeRoom: React.FC<RealTimeRoomProps> = ({
  roomId,
  roomName,
  maxPlayers,
  currentUserId,
  currentUserName,
  onLeave,
  onGameEnd,
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [roomState, setRoomState] = useState<RoomState>({
    status: 'waiting',
    question_index: 0,
    current_question_id: null,
    question_started_at: null,
    question_ends_at: null,
  });
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showChat, setShowChat] = useState(true);
  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [isHost, setIsHost] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [countdownEndsAt, setCountdownEndsAt] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [offlineSeconds, setOfflineSeconds] = useState(30);
  const [isOffline, setIsOffline] = useState(false);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [floatingXp, setFloatingXp] = useState<number | null>(null);
  const [answerShake, setAnswerShake] = useState(false);
  const [latencyMs, setLatencyMs] = useState(42);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [sendingInviteTo, setSendingInviteTo] = useState<string | null>(null);
  const [roomConfig, setRoomConfig] = useState({
    subject: 'Math',
    difficulty: 'Medium',
    gameMode: 'speed',
    questionCount: 10,
  });

  const advancingQuestionRef = useRef(false);
  const prevPlayersRef = useRef<Player[]>([]);
  const autoStartTriggeredRef = useRef(false);
  const { onlineFriends } = useFriends();

  useEffect(() => {
    void loadRoomData();
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [roomId, currentUserId, onLeave]);

  useEffect(() => {
    if (roomState.status === 'playing' && roomState.question_ends_at) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const endTime = new Date(roomState.question_ends_at!).getTime();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [roomState.status, roomState.question_ends_at]);

  useEffect(() => {
    if (!isHost || roomState.status !== 'playing' || timeRemaining > 0) return;
    void nextQuestion();
  }, [isHost, roomState.status, timeRemaining]);

  useEffect(() => {
    if (roomState.status !== 'countdown' && roomState.status !== 'starting') return;
    const remaining = countdownEndsAt
      ? Math.max(0, Math.ceil((new Date(countdownEndsAt).getTime() - Date.now()) / 1000))
      : countdownValue;
    setCountdownValue(remaining);

    if (remaining <= 0) {
      if (isHost) void startGame();
      return;
    }

    const tick = setTimeout(() => {
      if (isHost) playTone(420, 0.06);
      setCountdownValue((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(tick);
  }, [roomState.status, countdownEndsAt, countdownValue, isHost]);

  const readyCount = players.filter((p) => p.isReady).length;
  const autoStartReady = players.length >= 2 && readyCount === players.length;
  useEffect(() => {
    if (roomState.status !== 'waiting') {
      autoStartTriggeredRef.current = false;
      return;
    }

    if (!autoStartReady) {
      autoStartTriggeredRef.current = false;
      return;
    }

    if (!isHost || autoStartTriggeredRef.current) return;
    autoStartTriggeredRef.current = true;
    void triggerCountdown();
  }, [autoStartReady, isHost, roomState.status]);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setOfflineSeconds(30);
      toast.error('Connection lost… reconnecting');
    };
    const handleOnline = () => {
      setIsOffline(false);
      setOfflineSeconds(30);
      toast.success('Reconnected to room');
      void loadRoomData();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!isOffline) return;
    if (offlineSeconds <= 0) {
      toast.error('Reconnect window expired. Match forfeited.');
      onLeave();
      return;
    }

    const timer = setTimeout(() => setOfflineSeconds((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [isOffline, offlineSeconds, onLeave]);

  useEffect(() => {
    let isMounted = true;
    const checkLatency = async () => {
      const start = performance.now();
      await supabase.from('multiplayer_rooms').select('id').eq('id', roomId).maybeSingle();
      const ping = Math.round(performance.now() - start);
      if (isMounted) {
        setLatencyMs(ping);
      }
    };
    void checkLatency();
    const interval = setInterval(() => {
      void checkLatency();
    }, 9000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId]);

  const playTone = (frequency: number, duration: number) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.04, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  const loadRoomData = async () => {
    try {
      const { data: room } = await supabase
        .from('multiplayer_rooms')
        .select('host_id, question_count, subject, difficulty, max_players, game_mode')
        .eq('id', roomId)
        .single();

      if (!room) {
        toast.error('Room not found');
        onLeave();
        return;
      }

      setIsHost(room.host_id === currentUserId);
      setTotalQuestions(room.question_count || 10);
      setRoomConfig({
        subject: room.subject || 'Math',
        difficulty: room.difficulty || 'Medium',
        gameMode: room.game_mode || 'speed',
        questionCount: room.question_count || 10,
      });

      await supabase.from('room_players').upsert(
        {
          room_id: roomId,
          user_id: currentUserId,
          is_ready: false,
        },
        { onConflict: 'room_id,user_id' },
      );

      await fetchPlayers();

      const { data: state } = await supabase.from('room_state').select('*').eq('room_id', roomId).single();

      if (state) {
        setRoomState(state as RoomState);
        if (state.status === 'countdown' || state.status === 'starting') {
          setCountdownEndsAt(state.question_ends_at);
        }
        if (state.current_question_id) {
          await fetchCurrentQuestion(state.current_question_id);
        }
      }

      await fetchChatMessages();
    } catch (err) {
      console.error('Error loading room data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async (): Promise<Player[]> => {
    const { data: roomData } = await supabase.from('multiplayer_rooms').select('host_id').eq('id', roomId).single();

    const { data: playersData } = await supabase.from('room_players').select('user_id, score, is_ready').eq('room_id', roomId);

    if (playersData) {
      const userIds = playersData.map((p) => p.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar, level').in('id', userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const mappedPlayers: Player[] = playersData.map((p) => {
        const profile = profileMap.get(p.user_id);
        return {
          id: p.user_id,
          name: profile?.name || 'Unknown',
          avatar: profile?.avatar || 'avatar-1',
          score: p.score || 0,
          isReady: p.is_ready || false,
          isHost: p.user_id === roomData?.host_id,
          level: profile?.level || 1,
        };
      });

      const previousIds = new Set(prevPlayersRef.current.map((p) => p.id));
      const nextIds = new Set(mappedPlayers.map((p) => p.id));

      mappedPlayers.forEach((p) => {
        if (!previousIds.has(p.id)) {
          toast.success(`✨ ${p.name} joined the lobby`);
        }
      });
      prevPlayersRef.current.forEach((p) => {
        if (!nextIds.has(p.id)) {
          toast.info(`👋 ${p.name} left the lobby`);
        }
      });

      prevPlayersRef.current = mappedPlayers;
      setPlayers(mappedPlayers);
      return mappedPlayers;
    }

    return [];
  };

  const fetchCurrentQuestion = async (questionId: string) => {
    const { data } = await supabase
      .from('questions')
      .select('id, question_text, options, points')
      .eq('id', questionId)
      .single();

    if (data) {
      setCurrentQuestion({
        ...data,
        options: Array.isArray(data.options) ? (data.options as string[]) : [],
      });
    }
  };

  const fetchChatMessages = async () => {
    const { data } = await supabase
      .from('room_chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      const userIds = [...new Set(data.map((m) => m.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));

      const mappedMessages: ChatMessage[] = data.map((m) => ({
        id: m.id,
        sender: profileMap.get(m.user_id) || 'Unknown',
        senderId: m.user_id,
        content: m.content,
        timestamp: new Date(m.created_at),
      }));

      setMessages(mappedMessages);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const nextRoom = payload.new as any;
          if (!nextRoom) return;
          setIsHost(nextRoom.host_id === currentUserId);
          setRoomConfig((prev) => ({
            ...prev,
            subject: nextRoom.subject || prev.subject,
            difficulty: nextRoom.difficulty || prev.difficulty,
            gameMode: nextRoom.game_mode || prev.gameMode,
            questionCount: nextRoom.question_count || prev.questionCount,
          }));
          setTotalQuestions(nextRoom.question_count || 10);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void fetchPlayers();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_state',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newState = payload.new as RoomState | null;
          if (!newState) return;
          setRoomState(newState);
          if (newState.status === 'countdown' || newState.status === 'starting') {
            setCountdownEndsAt(newState.question_ends_at);
          } else {
            setCountdownEndsAt(null);
          }

          if (newState.current_question_id) {
            await fetchCurrentQuestion(newState.current_question_id);
            setSelectedAnswer(null);
            setAnswerResult(null);
          }

          if (newState.status === 'finished') {
            const finalPlayers = await fetchPlayers();
            const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score);
            const me = sortedPlayers.find((p) => p.id === currentUserId);
            const meRank = sortedPlayers.findIndex((p) => p.id === currentUserId) + 1;

            const summary: MatchSummary = {
              playerRank: meRank || sortedPlayers.length,
              xpGained: Math.max(20, (me?.score || 0) * 2),
              rankChange: meRank === 1 ? 18 : meRank <= 3 ? 6 : -4,
              accuracy: Math.min(99, Math.max(55, Math.round(((me?.score || 0) / (totalQuestions * 100)) * 100))),
              avgResponseTime: Number((Math.max(1.3, 5 - (me?.score || 0) / 500)).toFixed(2)),
              streak: Math.max(bestStreak, consecutiveCorrect),
              strongTopics: ['Logic', 'Mental Math'],
              weakTopics: ['Vocabulary', 'History'],
            };

            playTone(760, 0.2);
            onGameEnd(summary);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const { data: profile } = await supabase.from('profiles').select('name').eq('id', newMsg.user_id).single();

          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              sender: profile?.name || 'Unknown',
              senderId: newMsg.user_id,
              content: newMsg.content,
              timestamp: new Date(newMsg.created_at),
            },
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleReady = async () => {
    const currentPlayer = players.find((p) => p.id === currentUserId);
    if (!currentPlayer) return;

    const { error } = await supabase.rpc('multiplayer_toggle_ready', { p_room_id: roomId });
    if (error) throw error;

    playTone(520, 0.08);
  };

  const startGame = async () => {
    if (!isHost) return;
    if (players.length < 2) {
      toast.error('At least 2 players are required to start');
      return;
    }

    try {
      const { error } = await supabase.rpc('multiplayer_start_game', {
        p_room_id: roomId,
      });

      if (error) throw error;
      await supabase.rpc('multiplayer_next_question', { p_room_id: roomId });
      playTone(660, 0.12);
    } catch (err) {
      console.error('Error starting game:', err);
      toast.error('Failed to start game');
    }
  };

  const handleAnswer = async (answerIndex: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    const lagCompensation = Math.min(2, Math.max(0, latencyMs / 1000 / 2));
    const timeUsed = Math.max(0, 30 - timeRemaining - lagCompensation);

    try {
      const { data, error } = await supabase.rpc('multiplayer_submit_answer', {
        p_room_id: roomId,
        p_question_id: currentQuestion.id,
        p_answer: currentQuestion.options[answerIndex],
        p_time_used: timeUsed,
      });

      if (error) throw error;

      const result = data as { is_correct: boolean; points: number; correct_answer: string };
      setAnswerResult({ correct: result.is_correct, points: result.points });

      if (result.is_correct) {
        setConsecutiveCorrect((prev) => {
          const next = prev + 1;
          setBestStreak((current) => Math.max(current, next));
          return next;
        });
        setFloatingXp(result.points);
        setTimeout(() => setFloatingXp(null), 900);
        playTone(820, 0.12);
        toast.success(`Correct! +${result.points} points`);
      } else {
        setConsecutiveCorrect(0);
        setAnswerShake(true);
        setTimeout(() => setAnswerShake(false), 300);
        playTone(220, 0.15);
        toast.error(`Wrong! Correct answer: ${result.correct_answer}`);
      }

      await fetchPlayers();
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const nextQuestion = async () => {
    if (!isHost || advancingQuestionRef.current) return;

    try {
      advancingQuestionRef.current = true;
      const { data, error } = await supabase.rpc('multiplayer_next_question', {
        p_room_id: roomId,
      });

      if (error) throw error;
      const result = data as { status: string };
      if (result.status === 'finished') {
        // handled by realtime state update
      }
    } catch (err) {
      console.error('Error advancing question:', err);
    } finally {
      advancingQuestionRef.current = false;
    }
  };

  const sendChatMessage = async (message?: string) => {
    const content = (message || chatInput.trim()).slice(0, 80);
    if (!content) return;

    const { error } = await supabase.rpc('multiplayer_send_room_message', {
      p_room_id: roomId,
      p_content: content,
    });
    if (error) throw error;

    if (!message) setChatInput('');
  };

  const updateRoomConfig = async (nextConfig: Partial<typeof roomConfig>) => {
    if (!isHost) return;
    const merged = { ...roomConfig, ...nextConfig };
    setRoomConfig(merged);
    const { error } = await supabase.rpc('multiplayer_update_room', {
      p_room_id: roomId,
      p_subject: merged.subject,
      p_difficulty: merged.difficulty,
      p_game_mode: merged.gameMode,
      p_question_count: merged.questionCount,
    });
    if (error) throw error;
    toast.success('Room settings updated');
  };

  const triggerCountdown = async () => {
    if (!isHost || players.length < 2) return;
    const endTime = new Date(Date.now() + 5000).toISOString();

    await supabase
      .from('room_state')
      .upsert(
        {
          room_id: roomId,
          status: 'starting',
          question_started_at: new Date().toISOString(),
          question_ends_at: endTime,
        },
        { onConflict: 'room_id' },
      );

    setCountdownEndsAt(endTime);
  };

  const kickPlayer = async (playerId: string, playerName: string) => {
    if (!isHost || playerId === currentUserId) return;
    await supabase.from('room_players').delete().eq('room_id', roomId).eq('user_id', playerId);
    toast.info(`${playerName} was removed from the room`);
  };

  const inviteableFriends = onlineFriends.filter((friend) => !players.some((player) => player.id === friend.id));

  const inviteFriendToRoom = async (friendId: string, friendName: string) => {
    if (!isHost) {
      toast.error('Only the host can invite players to this room');
      return;
    }

    setSendingInviteTo(friendId);
    try {
      const { error } = await (supabase as any).rpc('create_multiplayer_invite', {
        p_receiver_id: friendId,
        p_room_id: roomId,
        p_max_players: maxPlayers,
        p_subject: roomConfig.subject,
        p_difficulty: roomConfig.difficulty,
      });

      if (error) {
        throw error;
      }

      toast.success(`Invite sent to ${friendName}`);
      setInviteDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || `Could not invite ${friendName}`);
    } finally {
      setSendingInviteTo(null);
    }
  };

  const currentPlayer = players.find((p) => p.id === currentUserId);
  const connectionQuality = latencyMs <= 120 ? 'Excellent' : latencyMs <= 220 ? 'Stable' : latencyMs <= 350 ? 'Degraded' : 'Poor';
  const connectionColor = latencyMs <= 120 ? 'text-emerald-300' : latencyMs <= 220 ? 'text-cyan-300' : latencyMs <= 350 ? 'text-amber-300' : 'text-red-300';
  const strongestOpponent = players
    .filter((p) => p.id !== currentUserId)
    .sort((a, b) => b.level - a.level)[0];

  const readyPlayers = players.filter((p) => p.isReady).length;
  const canAutoStart = players.length >= 2 && readyPlayers === players.length;
  const roomPhaseLabel =
    roomState.status === 'countdown' || roomState.status === 'starting'
      ? 'starting'
      : roomState.status === 'playing'
      ? 'playing'
      : roomState.status === 'finished'
      ? 'finished'
      : canAutoStart
      ? 'ready'
      : 'waiting';

  const highlightKeywords = (text: string) => {
    const words = text.split(' ');
    return words.map((word, index) => {
      const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
      const isKeyword = ['most', 'least', 'not', 'always', 'first', 'best', 'main'].includes(cleaned);
      return (
        <span key={`${word}-${index}`} className={isKeyword ? 'text-cyan-300 font-semibold' : ''}>
          {word}{' '}
        </span>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-purple-950 p-4 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.28),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.24),transparent_35%)]" />

      <div className="max-w-6xl mx-auto relative z-10">
        {isOffline && (
          <Card className="mb-4 p-3 border-amber-300/30 bg-amber-500/10 text-amber-100">
            Connection lost… reconnecting ({offlineSeconds}s return window)
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold">{roomName}</h1>
            <p className="text-sm text-blue-100/75">Room ID: {roomId.slice(0, 8)}... · Subject: {roomConfig.subject} · Mode: {roomConfig.gameMode}</p>
          </div>
          <div className={`text-xs rounded-md border border-white/20 bg-black/25 px-2 py-1 flex items-center gap-2 ${connectionColor}`}>
            <Signal className="h-3 w-3" /> {connectionQuality} · {latencyMs}ms
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setSoundEnabled((prev) => !prev)}>
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)} disabled={!isHost}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Friend
            </Button>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(roomId); toast.success('Room code copied'); }}>
              <Link className="h-4 w-4 mr-2" /> Join via Code
            </Button>
            <Button variant="destructive" size="sm" onClick={onLeave}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {roomState.status === 'waiting' && (
              <Card className="p-6 bg-white/5 border-white/10 shadow-[0_0_40px_rgba(99,102,241,0.22)]">
                <div className="text-center space-y-4">
                  <h2 className="text-xl font-bold">Lobby Ready Check</h2>
                  <p className="text-blue-100/80">{players.length}/{maxPlayers} players connected</p>
                  <Progress value={(players.length / maxPlayers) * 100} className="h-2" />

                  <div className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-sm">
                    Room State: <span className="font-semibold uppercase">{roomPhaseLabel}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="rounded-lg border border-white/15 p-2">Questions: {roomConfig.questionCount}</div>
                    <div className="rounded-lg border border-white/15 p-2">Topic: {roomConfig.subject}</div>
                    <div className="rounded-lg border border-white/15 p-2">Ready: {readyPlayers}/{players.length || 1}</div>
                    <div className="rounded-lg border border-white/15 p-2">Mode: {roomConfig.gameMode}</div>
                  </div>

                  {isHost && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Select value={roomConfig.subject} onValueChange={(value) => void updateRoomConfig({ subject: value })}>
                        <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Math">Math</SelectItem>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="GK">GK</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={String(roomConfig.questionCount)} onValueChange={(value) => void updateRoomConfig({ questionCount: Number(value) })}>
                        <SelectTrigger><SelectValue placeholder="Questions" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Questions</SelectItem>
                          <SelectItem value="10">10 Questions</SelectItem>
                          <SelectItem value="20">20 Questions</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={roomConfig.gameMode} onValueChange={(value) => void updateRoomConfig({ gameMode: value })}>
                        <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="speed">⚡ Speed</SelectItem>
                          <SelectItem value="accuracy">🎯 Accuracy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-center gap-2 flex-wrap">
                    <Button size="lg" className="min-h-11 px-6" variant={currentPlayer?.isReady ? 'default' : 'outline'} onClick={toggleReady}>
                      {currentPlayer?.isReady ? 'READY ✅' : 'READY'}
                    </Button>
                  </div>

                  <div className="flex justify-center gap-2">
                    {QUICK_EMOTES.map((emote) => (
                      <button
                        key={emote}
                        className="text-xl rounded-full w-10 h-10 bg-white/10 hover:bg-white/20"
                        onClick={() => sendChatMessage(emote)}
                      >
                        {emote}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {(roomState.status === 'countdown' || roomState.status === 'starting') && (
              <Card className="p-12 bg-white/5 border-white/10 text-center">
                <motion.div key={countdownValue} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-display font-bold text-cyan-300">
                  {countdownValue}
                </motion.div>
                <p className="text-xl mt-4">Match Starting… Syncing both players now</p>
              </Card>
            )}

            {roomState.status === 'playing' && currentQuestion && (
              <Card className={cn('p-6 bg-white/5 border-white/10 transition-all', answerShake && 'animate-pulse')}>
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <Badge variant="secondary">Question {Math.max(1, roomState.question_index)}/{totalQuestions}</Badge>
                    <div className="flex items-center gap-2">
                      <Clock className={cn('h-4 w-4', timeRemaining <= 5 && 'text-amber-300 animate-pulse')} />
                      <span className={cn('font-mono font-bold', timeRemaining <= 5 ? 'text-amber-300 animate-pulse' : 'text-white')}>
                        {timeRemaining}s
                      </span>
                    </div>
                  </div>

                  {floatingXp !== null && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: -6 }} className="text-center text-emerald-300 font-bold">
                      +{floatingXp} XP
                    </motion.div>
                  )}

                  <Progress value={(timeRemaining / 30) * 100} className="h-2" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {players.map((p) => (
                      <div key={p.id} className="rounded-lg border border-white/15 px-3 py-2 flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="font-semibold text-cyan-300">{p.score} pts</span>
                      </div>
                    ))}
                  </div>

                  {strongestOpponent && strongestOpponent.level >= (currentPlayer?.level || 1) + 3 && (
                    <div className="rounded-lg border border-amber-300/35 bg-amber-500/10 p-2 text-sm text-amber-100">
                      ⚡ Strong Opponent Detected: {strongestOpponent.name}
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-center py-4 leading-relaxed">
                    {highlightKeywords(currentQuestion.question_text)}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQuestion.options.map((option, index) => {
                      let buttonClass = 'border-white/15 hover:border-cyan-300/70 bg-white/5';

                      if (selectedAnswer !== null) {
                        if (answerResult?.correct && selectedAnswer === index) {
                          buttonClass = 'border-green-500 bg-green-500/20 shadow-[0_0_18px_rgba(16,185,129,0.45)]';
                        } else if (!answerResult?.correct && selectedAnswer === index) {
                          buttonClass = 'border-red-400 bg-red-500/20';
                        } else {
                          buttonClass = 'border-white/10 bg-white/5 opacity-55';
                        }
                      }

                      return (
                        <motion.button
                          key={index}
                          whileHover={{ scale: selectedAnswer === null ? 1.02 : 1 }}
                          whileTap={{ scale: selectedAnswer === null ? 0.98 : 1 }}
                          onClick={() => handleAnswer(index)}
                          disabled={selectedAnswer !== null || timeRemaining <= 0}
                          className={cn('p-4 min-h-14 rounded-xl border-2 text-left transition-all relative overflow-hidden', buttonClass)}
                        >
                          <span className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                          <span className="font-medium relative z-10">
                            {String.fromCharCode(65 + index)}. {option}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {selectedAnswer !== null && answerResult && (
                    <div className={cn('p-4 rounded-lg text-center', answerResult.correct ? 'bg-green-500/20' : 'bg-red-500/20')}>
                      <div className="flex items-center justify-center gap-2">
                        {answerResult.correct ? <CheckCircle className="h-5 w-5 text-green-400" /> : <XCircle className="h-5 w-5 text-red-300" />}
                        <span className="font-bold">{answerResult.correct ? `+${answerResult.points} points!` : 'Wrong answer!'}</span>
                      </div>
                    </div>
                  )}

                  {consecutiveCorrect >= 3 && (
                    <div className="rounded-lg bg-violet-500/20 p-2 text-center text-sm">
                      {consecutiveCorrect >= 10 ? 'OVERDRIVE MODE 🔥' : consecutiveCorrect >= 5 ? 'Flame Streak Active 🔥' : 'Streak Glow Activated ✨'}
                    </div>
                  )}

                  {isHost && timeRemaining <= 0 && (
                    <div className="text-center">
                      <Button onClick={nextQuestion} className="bg-cyan-500 hover:bg-cyan-600 min-h-11 px-6">
                        Next Question
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <Card className="p-4 bg-white/5 border-white/10">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Players ({players.length}/{maxPlayers})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {players.map((player) => (
                  <motion.div key={player.id} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn('p-3 rounded-xl border text-center', player.isReady ? 'border-green-400/50 bg-green-500/10' : 'border-white/15 bg-white/5')}>
                    <AvatarRenderer avatar={player.avatar} size="md" className="mx-auto mb-1" />
                    <div className="text-[11px] uppercase tracking-wide text-blue-100/70">Player {players.findIndex((p) => p.id === player.id) + 1}</div>
                    <div className="text-sm font-medium truncate">{player.name}</div>
                    <div className="flex items-center justify-center gap-1 mt-1 text-xs text-blue-100/75">
                      {player.isHost && <Crown className="h-3 w-3 text-yellow-400" />} Lv.{player.level}
                    </div>
                    <div className={cn('flex justify-center items-center gap-1 mt-1 text-xs', connectionColor)}><Signal className="h-3 w-3" /> {connectionQuality}</div>
                    <div className="mt-1 text-xs">{player.isReady ? 'Ready ✅' : 'Waiting ⏳'}</div>
                    {roomState.status !== 'waiting' && <div className="text-sm font-bold text-cyan-300 mt-1">{player.score} pts</div>}
                    {isHost && player.id !== currentUserId && roomState.status === 'waiting' && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => void kickPlayer(player.id, player.name)}>
                        Kick
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          <AnimatePresence>
            {showChat && (
              <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
                <Card className="h-[560px] flex flex-col bg-white/5 border-white/10">
                  <div className="p-3 border-b border-white/10">
                    <h3 className="font-bold flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Social Lobby Chat
                    </h3>
                  </div>

                  <div className="p-2 border-b border-white/10 flex flex-wrap gap-1">
                    {SAFE_CHAT.map((message) => (
                      <button key={message} className="text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/20" onClick={() => sendChatMessage(message)}>
                        {message}
                      </button>
                    ))}
                  </div>

                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div key={msg.id} className={cn('p-2 rounded-lg text-sm', msg.senderId === currentUserId ? 'bg-cyan-500/15' : 'bg-white/10')}>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-medium text-xs">{msg.sender}</span>
                          </div>
                          <p>{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t border-white/10">
                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={`Type as ${currentUserName}...`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendChatMessage();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button size="icon" onClick={() => void sendChatMessage()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-blue-100/70 mt-2 flex items-center gap-1"><Wifi className="h-3 w-3" /> Instant lobby updates enabled</div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a friend to this match</DialogTitle>
            <DialogDescription>
              Invited players can join this exact room and continue the live quiz battle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {inviteableFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No online friends available to invite right now.
              </p>
            ) : (
              inviteableFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 p-3"
                >
                  <div className="flex items-center gap-2">
                    <AvatarRenderer avatar={friend.avatar || 'avatar-1'} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{friend.name}</p>
                      <p className="text-xs text-muted-foreground">Level {friend.level || 1}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => inviteFriendToRoom(friend.id, friend.name || 'Player')}
                    disabled={sendingInviteTo !== null}
                  >
                    {sendingInviteTo === friend.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RealTimeRoom;
