import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Smile, Mic, Image, Users, MessageCircle, 
  Bot, AlertTriangle, Flag, X, Heart, ThumbsUp, Laugh
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'emoji' | 'sticker' | 'voice';
  isNPC: boolean;
  reactions?: { emoji: string; count: number; users: string[] }[];
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'private' | 'group' | 'room';
  participants: { id: string; name: string; avatar: string; isOnline: boolean }[];
  unreadCount: number;
}

interface EnhancedChatSystemProps {
  currentUserId: string;
  currentUserName: string;
  onClose?: () => void;
}

const EMOJI_PICKER = ['😀', '😂', '😍', '🤔', '👍', '👎', '🎉', '💪', '🧠', '⭐', '🔥', '❤️'];
const STICKERS = ['🏆', '🎓', '📚', '💯', '🚀', '🌟', '👑', '💎', '🎯', '✨'];
const QUICK_REACTIONS = [
  { emoji: '❤️', icon: Heart },
  { emoji: '👍', icon: ThumbsUp },
  { emoji: '😂', icon: Laugh },
];

// Bad words filter (simplified)
const BAD_WORDS = ['bad', 'inappropriate']; // Add actual words in production

const filterContent = (text: string): { filtered: string; flagged: boolean } => {
  let filtered = text;
  let flagged = false;
  
  for (const word of BAD_WORDS) {
    if (text.toLowerCase().includes(word)) {
      filtered = filtered.replace(new RegExp(word, 'gi'), '***');
      flagged = true;
    }
  }
  
  return { filtered, flagged };
};

const EnhancedChatSystem: React.FC<EnhancedChatSystemProps> = ({
  currentUserId,
  currentUserName,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderId: 'system',
      senderName: 'Plus',
      senderAvatar: '🤖',
      content: 'Welcome to the chat! Be respectful and have fun learning together! 🌟',
      timestamp: new Date(),
      type: 'text',
      isNPC: true,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeChat, setActiveChat] = useState<string>('general');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatRooms: ChatRoom[] = [
    {
      id: 'general',
      name: 'General Chat',
      type: 'room',
      participants: [
        { id: '1', name: 'Alex', avatar: '👦', isOnline: true },
        { id: '2', name: 'Sarah', avatar: '👧', isOnline: true },
        { id: 'bot', name: 'Plus', avatar: '🤖', isOnline: true },
      ],
      unreadCount: 0,
    },
    {
      id: 'study-group',
      name: 'Math Study Group',
      type: 'group',
      participants: [
        { id: '1', name: 'Alex', avatar: '👦', isOnline: true },
        { id: '3', name: 'Mike', avatar: '🧑', isOnline: false },
      ],
      unreadCount: 2,
    },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (content: string, type: 'text' | 'emoji' | 'sticker' = 'text') => {
    if (!content.trim()) return;

    const { filtered, flagged } = filterContent(content);
    
    if (flagged) {
      toast.warning('Your message was modified to remove inappropriate content');
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName,
      senderAvatar: '👤',
      content: filtered,
      timestamp: new Date(),
      type,
      isNPC: false,
      reactions: [],
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    setShowEmojiPicker(false);
    setShowStickerPicker(false);

    // Simulate NPC response
    if (Math.random() > 0.7) {
      setTimeout(() => {
        const npcResponses = [
          'Great point! 👍',
          "That's interesting!",
          'Keep up the good work! 🌟',
          'I agree!',
          "Let's keep learning together! 📚",
        ];
        const npcMessage: Message = {
          id: `msg-${Date.now()}`,
          senderId: 'bot',
          senderName: 'Plus',
          senderAvatar: '🤖',
          content: npcResponses[Math.floor(Math.random() * npcResponses.length)],
          timestamp: new Date(),
          type: 'text',
          isNPC: true,
        };
        setMessages((prev) => [...prev, npcMessage]);
      }, 1500);
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find((r) => r.emoji === emoji);
        
        if (existingReaction) {
          if (existingReaction.users.includes(currentUserId)) {
            return {
              ...msg,
              reactions: reactions.filter((r) => r.emoji !== emoji || r.count > 1)
                .map((r) => r.emoji === emoji 
                  ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== currentUserId) }
                  : r
                ),
            };
          }
          return {
            ...msg,
            reactions: reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, users: [...r.users, currentUserId] }
                : r
            ),
          };
        }
        
        return {
          ...msg,
          reactions: [...reactions, { emoji, count: 1, users: [currentUserId] }],
        };
      })
    );
  };

  const reportMessage = (messageId: string) => {
    toast.success('Message reported. Our moderators will review it.');
  };

  const handleVoiceMessage = () => {
    setIsRecording(!isRecording);
    if (isRecording) {
      // Simulate voice message
      setTimeout(() => {
        sendMessage('🎤 Voice message (0:05)', 'text');
      }, 500);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] w-full max-w-md glass neon-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">Chat</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat Rooms Tabs */}
      <Tabs value={activeChat} onValueChange={setActiveChat} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 m-2">
          {chatRooms.map((room) => (
            <TabsTrigger key={room.id} value={room.id} className="relative">
              {room.type === 'group' ? <Users className="h-3 w-3 mr-1" /> : null}
              <span className="truncate text-xs">{room.name}</span>
              {room.unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {room.unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeChat} className="flex-1 flex flex-col m-0 p-0">
          {/* Online Users */}
          <div className="flex gap-2 p-2 border-b border-border overflow-x-auto">
            {chatRooms.find((r) => r.id === activeChat)?.participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-col items-center min-w-[50px]"
              >
                <div className="relative">
                  <span className="text-xl">{p.avatar}</span>
                  <div
                    className={cn(
                      'absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-card',
                      p.isOnline ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[50px]">
                  {p.name}
                </span>
              </div>
            ))}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3" ref={scrollRef}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex gap-2',
                    message.senderId === currentUserId ? 'flex-row-reverse' : ''
                  )}
                >
                  <span className="text-xl shrink-0">{message.senderAvatar}</span>
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl p-3',
                      message.senderId === currentUserId
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card border border-border rounded-tl-sm'
                    )}
                  >
                    {message.senderId !== currentUserId && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-medium">{message.senderName}</span>
                        {message.isNPC && <Bot className="h-3 w-3" />}
                      </div>
                    )}
                    <p className={cn(
                      'text-sm',
                      message.type === 'sticker' && 'text-3xl'
                    )}>
                      {message.content}
                    </p>
                    
                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {message.reactions.map((r) => (
                          <span
                            key={r.emoji}
                            className="text-xs bg-background/50 rounded-full px-1.5 py-0.5 cursor-pointer"
                            onClick={() => addReaction(message.id, r.emoji)}
                          >
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message Actions */}
                  {message.senderId !== currentUserId && (
                    <div className="flex flex-col gap-1 opacity-0 hover:opacity-100 transition-opacity">
                      {QUICK_REACTIONS.map(({ emoji, icon: Icon }) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(message.id, emoji)}
                          className="h-6 w-6 rounded-full bg-card flex items-center justify-center hover:bg-muted"
                        >
                          <Icon className="h-3 w-3" />
                        </button>
                      ))}
                      <button
                        onClick={() => reportMessage(message.id)}
                        className="h-6 w-6 rounded-full bg-card flex items-center justify-center hover:bg-destructive/20"
                      >
                        <Flag className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Emoji/Sticker Picker */}
          <AnimatePresence>
            {(showEmojiPicker || showStickerPicker) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border bg-card"
              >
                <div className="flex flex-wrap gap-2 p-3">
                  {(showEmojiPicker ? EMOJI_PICKER : STICKERS).map((item) => (
                    <button
                      key={item}
                      onClick={() => sendMessage(item, showEmojiPicker ? 'emoji' : 'sticker')}
                      className="text-xl hover:scale-125 transition-transform p-1"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="p-3 border-t border-border bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(inputText);
              }}
              className="flex items-center gap-2"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowStickerPicker(false);
                }}
              >
                <Smile className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowStickerPicker(!showStickerPicker);
                  setShowEmojiPicker(false);
                }}
              >
                <Image className="h-5 w-5" />
              </Button>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button
                type="button"
                variant={isRecording ? 'destructive' : 'ghost'}
                size="icon"
                onClick={handleVoiceMessage}
              >
                <Mic className={cn('h-5 w-5', isRecording && 'animate-pulse')} />
              </Button>
              <Button type="submit" size="icon" disabled={!inputText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default EnhancedChatSystem;
