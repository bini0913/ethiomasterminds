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
  Bot, UserPlus, LogOut, Trophy, Zap 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isNPC: boolean;
  isReady: boolean;
  isHost: boolean;
  level: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isNPC: boolean;
}

interface GameState {
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  question?: {
    text: string;
    options: string[];
    timeLimit: number;
  };
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

// NPC names for auto-fill
const NPC_NAMES = [
  'QuizBot Alpha', 'BrainMaster', 'SmartBot', 'LearnBot', 'QuizWhiz',
  'ThinkFast', 'BrainStorm', 'QuizMaster', 'KnowledgeBot', 'WisdomAI'
];

const NPC_CHAT_RESPONSES = [
  "Good luck everyone! 🎯",
  "Let's have a fair game! 🤝",
  "I'm ready to learn!",
  "May the best mind win! 🧠",
  "This is exciting!",
  "Great question!",
  "That was tricky!",
  "Well played!",
];

const RealTimeRoom: React.FC<RealTimeRoomProps> = ({
  roomId,
  roomName,
  maxPlayers,
  currentUserId,
  currentUserName,
  onLeave,
  onGameEnd,
}) => {
  const [players, setPlayers] = useState<Player[]>([
    {
      id: currentUserId,
      name: currentUserName,
      avatar: '👦',
      score: 0,
      isNPC: false,
      isReady: false,
      isHost: true,
      level: 5,
    },
  ]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    currentQuestion: 0,
    totalQuestions: 10,
    timeRemaining: 0,
  });
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(true);

  // Add NPC players to fill the room
  const addNPCPlayer = useCallback(() => {
    if (players.length >= maxPlayers) return;

    const availableNames = NPC_NAMES.filter(
      (name) => !players.some((p) => p.name === name)
    );
    if (availableNames.length === 0) return;

    const npcName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const newNPC: Player = {
      id: `npc-${Date.now()}-${Math.random()}`,
      name: npcName,
      avatar: '🤖',
      score: 0,
      isNPC: true,
      isReady: true,
      isHost: false,
      level: Math.floor(Math.random() * 10) + 1,
    };

    setPlayers((prev) => [...prev, newNPC]);
    
    // NPC sends a greeting
    setTimeout(() => {
      const greeting = NPC_CHAT_RESPONSES[Math.floor(Math.random() * 3)];
      addChatMessage(npcName, greeting, true);
    }, 1000);
  }, [players, maxPlayers]);

  const addChatMessage = (sender: string, content: string, isNPC: boolean = false) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender,
      content,
      timestamp: new Date(),
      isNPC,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    addChatMessage(currentUserName, chatInput, false);
    setChatInput('');

    // NPCs might respond
    setTimeout(() => {
      const respondingNPC = players.find((p) => p.isNPC && Math.random() > 0.7);
      if (respondingNPC) {
        const response = NPC_CHAT_RESPONSES[Math.floor(Math.random() * NPC_CHAT_RESPONSES.length)];
        addChatMessage(respondingNPC.name, response, true);
      }
    }, 2000);
  };

  const toggleReady = () => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === currentUserId ? { ...p, isReady: !p.isReady } : p
      )
    );
  };

  const startGame = () => {
    if (players.filter((p) => p.isReady || p.isNPC).length < 2) {
      toast.error('Need at least 2 ready players to start');
      return;
    }

    setGameState({ ...gameState, status: 'countdown', timeRemaining: 3 });

    // Countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setGameState((prev) => ({ ...prev, timeRemaining: count }));
      if (count <= 0) {
        clearInterval(countdownInterval);
        startQuestion();
      }
    }, 1000);
  };

  const startQuestion = () => {
    setSelectedAnswer(null);
    setGameState((prev) => ({
      ...prev,
      status: 'playing',
      currentQuestion: prev.currentQuestion + 1,
      timeRemaining: 15,
      question: {
        text: `Sample Question ${prev.currentQuestion + 1}: What is 5 × ${prev.currentQuestion + 1}?`,
        options: [
          `${5 * (prev.currentQuestion + 1)}`,
          `${5 * (prev.currentQuestion + 1) + 1}`,
          `${5 * (prev.currentQuestion + 1) - 1}`,
          `${5 * (prev.currentQuestion + 1) + 2}`,
        ],
        timeLimit: 15,
      },
    }));

    // Timer
    const timerInterval = setInterval(() => {
      setGameState((prev) => {
        if (prev.timeRemaining <= 1) {
          clearInterval(timerInterval);
          // NPCs answer
          simulateNPCAnswers();
          // Next question or end
          if (prev.currentQuestion >= prev.totalQuestions) {
            endGame();
          } else {
            setTimeout(startQuestion, 2000);
          }
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);
  };

  const simulateNPCAnswers = () => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.isNPC) {
          // NPCs have varying accuracy based on their "level"
          const isCorrect = Math.random() < 0.5 + p.level * 0.05;
          const points = isCorrect ? Math.floor(Math.random() * 50) + 50 : 0;
          return { ...p, score: p.score + points };
        }
        return p;
      })
    );
  };

  const handleAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);

    // Check if correct (first option is always correct in this demo)
    const isCorrect = answerIndex === 0;
    const basePoints = 100;
    const timeBonus = gameState.timeRemaining * 5;
    const points = isCorrect ? basePoints + timeBonus : 0;

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === currentUserId ? { ...p, score: p.score + points } : p
      )
    );

    if (isCorrect) {
      toast.success(`Correct! +${points} points`);
    } else {
      toast.error('Wrong answer!');
    }
  };

  const endGame = () => {
    setGameState((prev) => ({ ...prev, status: 'finished' }));
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    onGameEnd(sortedPlayers);
  };

  // Auto-add NPCs after a delay
  useEffect(() => {
    if (gameState.status === 'waiting' && players.length < maxPlayers) {
      const timeout = setTimeout(() => {
        addNPCPlayer();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [players.length, maxPlayers, gameState.status, addNPCPlayer]);

  const isHost = players.find((p) => p.id === currentUserId)?.isHost;
  const allReady = players.every((p) => p.isReady || p.isNPC);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{roomName}</h1>
            <p className="text-sm text-muted-foreground">Room ID: {roomId}</p>
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
            {gameState.status === 'waiting' && (
              <Card className="p-6 glass neon-border">
                <div className="text-center space-y-4">
                  <h2 className="text-xl font-bold text-foreground">Waiting for Players</h2>
                  <p className="text-muted-foreground">
                    {players.length}/{maxPlayers} players
                  </p>
                  <Progress value={(players.length / maxPlayers) * 100} className="h-2" />
                  
                  <div className="flex justify-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={addNPCPlayer}>
                      <Bot className="h-4 w-4 mr-2" />
                      Add Bot
                    </Button>
                    <Button
                      variant={players.find((p) => p.id === currentUserId)?.isReady ? 'default' : 'outline'}
                      onClick={toggleReady}
                    >
                      {players.find((p) => p.id === currentUserId)?.isReady ? 'Ready!' : 'Click to Ready'}
                    </Button>
                    {isHost && allReady && players.length >= 2 && (
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600">
                        <Play className="h-4 w-4 mr-2" />
                        Start Game
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {gameState.status === 'countdown' && (
              <Card className="p-12 glass neon-border text-center">
                <motion.div
                  key={gameState.timeRemaining}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-8xl font-display font-bold text-primary"
                >
                  {gameState.timeRemaining}
                </motion.div>
                <p className="text-xl mt-4 text-foreground">Get Ready!</p>
              </Card>
            )}

            {gameState.status === 'playing' && gameState.question && (
              <Card className="p-6 glass neon-border">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">
                      Question {gameState.currentQuestion}/{gameState.totalQuestions}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span
                        className={cn(
                          'font-mono font-bold',
                          gameState.timeRemaining <= 5 ? 'text-destructive' : 'text-foreground'
                        )}
                      >
                        {gameState.timeRemaining}s
                      </span>
                    </div>
                  </div>

                  <Progress
                    value={(gameState.timeRemaining / 15) * 100}
                    className="h-2"
                  />

                  <h3 className="text-xl font-bold text-center py-4 text-foreground">
                    {gameState.question.text}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {gameState.question.options.map((option, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAnswer(index)}
                        disabled={selectedAnswer !== null}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          selectedAnswer === null
                            ? 'border-border hover:border-primary bg-card'
                            : selectedAnswer === index
                            ? index === 0
                              ? 'border-green-500 bg-green-500/20'
                              : 'border-destructive bg-destructive/20'
                            : 'border-border bg-card opacity-50'
                        )}
                      >
                        <span className="font-medium">
                          {String.fromCharCode(65 + index)}. {option}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {gameState.status === 'finished' && (
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
                        <span>{player.avatar}</span>
                        <span className="text-foreground">{player.name}</span>
                        {player.isNPC && <Badge variant="secondary">Bot</Badge>}
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
                      player.isReady || player.isNPC
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-border bg-card'
                    )}
                  >
                    <div className="text-2xl mb-1">{player.avatar}</div>
                    <div className="text-sm font-medium truncate text-foreground">{player.name}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {player.isHost && <Crown className="h-3 w-3 text-yellow-500" />}
                      {player.isNPC && <Bot className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">Lv.{player.level}</span>
                    </div>
                    {gameState.status !== 'waiting' && (
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
                            msg.isNPC ? 'bg-muted' : 'bg-primary/10'
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-medium text-foreground">{msg.sender}</span>
                            {msg.isNPC && <Bot className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <p className="text-muted-foreground">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t border-border">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendChatMessage();
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                      />
                      <Button type="submit" size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
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
