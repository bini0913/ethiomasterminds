import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Crown, Play, Clock, MessageCircle, Send, 
  Bot, LogOut, Trophy, Zap, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AvatarRenderer from '@/components/avatar/AvatarRenderer';

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
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  question_index: number;
  current_question_id: string | null;
  question_started_at: string | null;
  question_ends_at: string | null;
}

interface RealTimeRoomProps {
  roomId: string;
  roomName: string;
  maxPlayers: number;
  currentUserId: string;
  currentUserName: string;
  onLeave: () => void;
  onGameEnd: (results: Player[]) => void;
}

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
    question_ends_at: null
  });
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showChat, setShowChat] = useState(true);
  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [isHost, setIsHost] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  // Fetch initial data and set up subscriptions
  useEffect(() => {
    loadRoomData();
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [roomId]);

  // Timer effect
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

  const loadRoomData = async () => {
    try {
      // Check if current user is host
      const { data: room } = await supabase
        .from('multiplayer_rooms')
        .select('host_id, question_count')
        .eq('id', roomId)
        .single();

      setIsHost(room?.host_id === currentUserId);
      setTotalQuestions(room?.question_count || 10);

      // Fetch players
      await fetchPlayers();

      // Fetch room state
      const { data: state } = await supabase
        .from('room_state')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (state) {
        setRoomState(state as RoomState);
        if (state.current_question_id) {
          await fetchCurrentQuestion(state.current_question_id);
        }
      }

      // Fetch chat messages
      await fetchChatMessages();

    } catch (err) {
      console.error('Error loading room data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async (): Promise<Player[]> => {
    const { data: roomData } = await supabase
      .from('multiplayer_rooms')
      .select('host_id')
      .eq('id', roomId)
      .single();

    const { data: playersData } = await supabase
      .from('room_players')
      .select('user_id, score, is_ready')
      .eq('room_id', roomId);

    if (playersData) {
      const userIds = playersData.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar, level')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const mappedPlayers: Player[] = playersData.map(p => {
        const profile = profileMap.get(p.user_id);
        return {
          id: p.user_id,
          name: profile?.name || 'Unknown',
          avatar: profile?.avatar || 'avatar-1',
          score: p.score || 0,
          isReady: p.is_ready || false,
          isHost: p.user_id === roomData?.host_id,
          level: profile?.level || 1
        };
      });

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
        options: Array.isArray(data.options) ? data.options as string[] : []
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
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));

      const mappedMessages: ChatMessage[] = data.map(m => ({
        id: m.id,
        sender: profileMap.get(m.user_id) || 'Unknown',
        senderId: m.user_id,
        content: m.content,
        timestamp: new Date(m.created_at)
      }));

      setMessages(mappedMessages);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchPlayers();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_state',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        const newState = payload.new as RoomState | null;
        if (!newState) return;
        setRoomState(newState);
        
        if (newState.current_question_id) {
          await fetchCurrentQuestion(newState.current_question_id);
          setSelectedAnswer(null);
          setAnswerResult(null);
        }

        if (newState.status === 'finished') {
          // Fetch final scores and end game
          const finalPlayers = await fetchPlayers();
          const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score);
          onGameEnd(sortedPlayers);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_chat_messages',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        const newMsg = payload.new as any;
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', newMsg.user_id)
          .single();

        setMessages(prev => [...prev, {
          id: newMsg.id,
          sender: profile?.name || 'Unknown',
          senderId: newMsg.user_id,
          content: newMsg.content,
          timestamp: new Date(newMsg.created_at)
        }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleReady = async () => {
    const currentPlayer = players.find(p => p.id === currentUserId);
    if (!currentPlayer) return;

    await supabase
      .from('room_players')
      .update({ is_ready: !currentPlayer.isReady })
      .eq('room_id', roomId)
      .eq('user_id', currentUserId);
  };

  const startGame = async () => {
    if (!isHost) return;

    try {
      // Call the database function to start the game
      const { error } = await supabase.rpc('multiplayer_start_game', {
        p_room_id: roomId
      });

      if (error) throw error;

      // Start countdown
      setRoomState(prev => ({ ...prev, status: 'countdown' }));
      setCountdownValue(3);

      let count = 3;
      const countdownInterval = setInterval(async () => {
        count--;
        setCountdownValue(count);
        if (count <= 0) {
          clearInterval(countdownInterval);
          // Advance to first question
          await supabase.rpc('multiplayer_next_question', { p_room_id: roomId });
        }
      }, 1000);

    } catch (err) {
      console.error('Error starting game:', err);
      toast.error('Failed to start game');
    }
  };

  const handleAnswer = async (answerIndex: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    const timeUsed = 30 - timeRemaining;

    try {
      const { data, error } = await supabase.rpc('multiplayer_submit_answer', {
        p_room_id: roomId,
        p_question_id: currentQuestion.id,
        p_answer: currentQuestion.options[answerIndex],
        p_time_used: timeUsed
      });

      if (error) throw error;

      const result = data as { is_correct: boolean; points: number; correct_answer: string };
      setAnswerResult({ correct: result.is_correct, points: result.points });

      if (result.is_correct) {
        toast.success(`Correct! +${result.points} points`);
      } else {
        toast.error(`Wrong! Correct answer: ${result.correct_answer}`);
      }

      // Refresh player scores
      fetchPlayers();

    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const nextQuestion = async () => {
    if (!isHost) return;

    try {
      const { data, error } = await supabase.rpc('multiplayer_next_question', {
        p_room_id: roomId
      });

      if (error) throw error;

      const result = data as { status: string };
      if (result.status === 'finished') {
        // Game will end via realtime subscription
      }
    } catch (err) {
      console.error('Error advancing question:', err);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    await supabase
      .from('room_chat_messages')
      .insert({
        room_id: roomId,
        user_id: currentUserId,
        content: chatInput.trim()
      });

    setChatInput('');
  };

  const allReady = players.every(p => p.isReady);
  const currentPlayer = players.find(p => p.id === currentUserId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{roomName}</h1>
            <p className="text-sm text-muted-foreground">Room ID: {roomId.slice(0, 8)}...</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button variant="destructive" size="sm" onClick={onLeave}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-4">
            {roomState.status === 'waiting' && (
              <Card className="p-6 glass neon-border">
                <div className="text-center space-y-4">
                  <h2 className="text-xl font-bold text-foreground">Waiting for Players</h2>
                  <p className="text-muted-foreground">
                    {players.length}/{maxPlayers} players
                  </p>
                  <Progress value={(players.length / maxPlayers) * 100} className="h-2" />
                  
                  <div className="flex justify-center gap-2 flex-wrap">
                    <Button
                      variant={currentPlayer?.isReady ? 'default' : 'outline'}
                      onClick={toggleReady}
                    >
                      {currentPlayer?.isReady ? '✓ Ready!' : 'Click to Ready'}
                    </Button>
                    {isHost && allReady && players.length >= 2 && (
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600">
                        <Play className="h-4 w-4 mr-2" />
                        Start Game
                      </Button>
                    )}
                  </div>

                  {isHost && !allReady && (
                    <p className="text-sm text-muted-foreground">
                      Waiting for all players to ready up...
                    </p>
                  )}
                </div>
              </Card>
            )}

            {roomState.status === 'countdown' && (
              <Card className="p-12 glass neon-border text-center">
                <motion.div
                  key={countdownValue}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-8xl font-display font-bold text-primary"
                >
                  {countdownValue}
                </motion.div>
                <p className="text-xl mt-4 text-foreground">Get Ready!</p>
              </Card>
            )}

            {roomState.status === 'playing' && currentQuestion && (
              <Card className="p-6 glass neon-border">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">
                      Question {Math.max(1, roomState.question_index)}/{totalQuestions}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span
                        className={cn(
                          'font-mono font-bold',
                          timeRemaining <= 5 ? 'text-destructive' : 'text-foreground'
                        )}
                      >
                        {timeRemaining}s
                      </span>
                    </div>
                  </div>

                  <Progress
                    value={(timeRemaining / 30) * 100}
                    className="h-2"
                  />

                  <h3 className="text-xl font-bold text-center py-4 text-foreground">
                    {currentQuestion.question_text}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {currentQuestion.options.map((option, index) => {
                      let buttonClass = 'border-border hover:border-primary bg-card';
                      
                      if (selectedAnswer !== null) {
                        if (answerResult?.correct && selectedAnswer === index) {
                          buttonClass = 'border-green-500 bg-green-500/20';
                        } else if (!answerResult?.correct && selectedAnswer === index) {
                          buttonClass = 'border-destructive bg-destructive/20';
                        } else {
                          buttonClass = 'border-border bg-card opacity-50';
                        }
                      }

                      return (
                        <motion.button
                          key={index}
                          whileHover={{ scale: selectedAnswer === null ? 1.02 : 1 }}
                          whileTap={{ scale: selectedAnswer === null ? 0.98 : 1 }}
                          onClick={() => handleAnswer(index)}
                          disabled={selectedAnswer !== null}
                          className={cn(
                            'p-4 rounded-xl border-2 text-left transition-all',
                            buttonClass
                          )}
                        >
                          <span className="font-medium">
                            {String.fromCharCode(65 + index)}. {option}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {selectedAnswer !== null && answerResult && (
                    <div className={cn(
                      'p-4 rounded-lg text-center',
                      answerResult.correct ? 'bg-green-500/20' : 'bg-destructive/20'
                    )}>
                      <div className="flex items-center justify-center gap-2">
                        {answerResult.correct ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <span className="font-bold">
                          {answerResult.correct ? `+${answerResult.points} points!` : 'Wrong answer!'}
                        </span>
                      </div>
                    </div>
                  )}

                  {isHost && timeRemaining <= 0 && (
                    <div className="text-center">
                      <Button onClick={nextQuestion} className="bg-primary">
                        Next Question
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {roomState.status === 'finished' && (
              <Card className="p-6 glass neon-border text-center">
                <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-4 text-foreground">Game Over!</h2>
                <div className="space-y-2">
                  {[...players].sort((a, b) => b.score - a.score).map((player, index) => (
                    <div
                      key={player.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg',
                        index === 0 ? 'bg-yellow-500/20' : 'bg-card'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">#{index + 1}</span>
                        <AvatarRenderer avatar={player.avatar} size="sm" />
                        <span className="text-foreground">{player.name}</span>
                        {player.isHost && <Crown className="h-4 w-4 text-yellow-500" />}
                      </div>
                      <span className="font-bold text-primary">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Players List */}
            <Card className="p-4 glass">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4" />
                Players ({players.length}/{maxPlayers})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {players.map((player) => (
                  <motion.div
                    key={player.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'p-3 rounded-xl border text-center',
                      player.isReady
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-border bg-card'
                    )}
                  >
                    <AvatarRenderer avatar={player.avatar} size="md" className="mx-auto mb-1" />
                    <div className="text-sm font-medium truncate text-foreground">{player.name}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {player.isHost && <Crown className="h-3 w-3 text-yellow-500" />}
                      <span className="text-xs text-muted-foreground">Lv.{player.level}</span>
                    </div>
                    {roomState.status !== 'waiting' && (
                      <div className="text-sm font-bold text-primary mt-1">{player.score} pts</div>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          {/* Chat Sidebar */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
              >
                <Card className="h-[500px] flex flex-col glass">
                  <div className="p-3 border-b border-border">
                    <h3 className="font-bold flex items-center gap-2 text-foreground">
                      <MessageCircle className="h-4 w-4" />
                      Room Chat
                    </h3>
                  </div>

                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'p-2 rounded-lg text-sm',
                            msg.senderId === currentUserId ? 'bg-primary/10' : 'bg-muted'
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-medium text-xs">{msg.sender}</span>
                          </div>
                          <p className="text-foreground">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t border-border">
                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button size="icon" onClick={sendChatMessage}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default RealTimeRoom;
