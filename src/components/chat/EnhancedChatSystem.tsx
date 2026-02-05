import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Smile, Users, MessageCircle, 
  Bot, Flag, X, Heart, ThumbsUp, Laugh, Loader2, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'emoji' | 'sticker';
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

const BAD_WORDS = ['bad', 'inappropriate'];

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeChat, setActiveChat] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user's chat groups
  const fetchChatGroups = useCallback(async () => {
    if (!currentUserId || currentUserId === 'guest') return;

    try {
      // Get groups user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('user_id', currentUserId);

      if (memberError) throw memberError;

      if (!memberships || memberships.length === 0) {
        setChatRooms([]);
        setLoading(false);
        return;
      }

      const groupIds = memberships.map(m => m.group_id);

      // Get group details
      const { data: groups, error: groupError } = await supabase
        .from('chat_groups')
        .select('*')
        .in('id', groupIds);

      if (groupError) throw groupError;

      // Get members for each group
      const { data: allMembers, error: membersError } = await supabase
        .from('chat_group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds);

      if (membersError) throw membersError;

      // Get member profiles
      const memberIds = [...new Set((allMembers || []).map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', memberIds);

      // Get online status
      const { data: presence } = await supabase
        .from('user_presence')
        .select('user_id, status, last_seen')
        .in('user_id', memberIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const presenceMap: Record<string, boolean> = {};
      (presence || []).forEach(p => {
        const isOnline = p.status === 'online' && 
          new Date(p.last_seen).getTime() > Date.now() - 5 * 60 * 1000;
        presenceMap[p.user_id] = isOnline;
      });

      const rooms: ChatRoom[] = (groups || []).map(g => {
        const groupMembers = (allMembers || []).filter(m => m.group_id === g.id);
        const participants = groupMembers.map(m => {
          const profile = profileMap[m.user_id];
          return {
            id: m.user_id,
            name: profile?.name || 'User',
            avatar: profile?.avatar || '👤',
            isOnline: presenceMap[m.user_id] || false
          };
        });

        return {
          id: g.id,
          name: g.name,
          type: g.group_type as 'private' | 'group' | 'room',
          participants,
          unreadCount: 0
        };
      });

      setChatRooms(rooms);
      if (rooms.length > 0 && !activeChat) {
        setActiveChat(rooms[0].id);
      }
    } catch (err) {
      console.error('Error fetching chat groups:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, activeChat]);

  // Fetch messages for active chat
  const fetchMessages = useCallback(async () => {
    if (!activeChat) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', activeChat)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set((messagesData || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', senderIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const mapped: Message[] = (messagesData || []).map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: profileMap[m.sender_id]?.name || 'User',
        senderAvatar: profileMap[m.sender_id]?.avatar || '👤',
        content: m.content,
        timestamp: new Date(m.created_at),
        type: m.message_type as 'text' | 'emoji' | 'sticker',
        isNPC: false,
        reactions: []
      }));

      setMessages(mapped);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [activeChat]);

  useEffect(() => {
    fetchChatGroups();
  }, [fetchChatGroups]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!activeChat) return;

    const channel = supabase
      .channel(`messages-${activeChat}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${activeChat}`
      }, async (payload) => {
        const newMsg = payload.new as any;
        
        // Fetch sender profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar')
          .eq('id', newMsg.sender_id)
          .single();

        const message: Message = {
          id: newMsg.id,
          senderId: newMsg.sender_id,
          senderName: profile?.name || 'User',
          senderAvatar: profile?.avatar || '👤',
          content: newMsg.content,
          timestamp: new Date(newMsg.created_at),
          type: newMsg.message_type,
          isNPC: false,
          reactions: []
        };

        setMessages(prev => [...prev, message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string, type: 'text' | 'emoji' | 'sticker' = 'text') => {
    if (!content.trim() || !activeChat || currentUserId === 'guest') return;

    const { filtered, flagged } = filterContent(content);
    
    if (flagged) {
      toast.warning('Your message was modified to remove inappropriate content');
    }

    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: activeChat,
          sender_id: currentUserId,
          content: filtered,
          message_type: type
        });

      if (error) throw error;

      setInputText('');
      setShowEmojiPicker(false);
      setShowStickerPicker(false);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || currentUserId === 'guest') return;

    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('chat_groups')
        .insert({
          name: newGroupName.trim(),
          created_by: currentUserId,
          group_type: 'group'
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as member
      await supabase
        .from('chat_group_members')
        .insert({
          group_id: group.id,
          user_id: currentUserId,
          role: 'admin'
        });

      toast.success('Group created!');
      setNewGroupName('');
      setShowCreateGroup(false);
      fetchChatGroups();
    } catch (err) {
      console.error('Error creating group:', err);
      toast.error('Failed to create group');
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[600px] w-full max-w-md glass">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (currentUserId === 'guest') {
    return (
      <Card className="flex flex-col items-center justify-center h-[600px] w-full max-w-md glass p-8 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-bold text-lg mb-2">Sign in to Chat</h3>
        <p className="text-muted-foreground">Create an account to join group chats and message friends.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px] w-full max-w-md glass neon-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Chat</h3>
            <p className="text-xs text-muted-foreground">
              {chatRooms.find(r => r.id === activeChat)?.participants.filter(p => p.isOnline).length || 0} online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name..."
                />
                <Button onClick={createGroup} className="w-full">
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/10">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {chatRooms.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-bold text-lg mb-2">No Groups Yet</h3>
          <p className="text-muted-foreground mb-4">Create a group to start chatting with friends!</p>
          <Button onClick={() => setShowCreateGroup(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      ) : (
        <Tabs value={activeChat} onValueChange={setActiveChat} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2 mx-3 mt-3 bg-muted/50">
            {chatRooms.slice(0, 2).map((room) => (
              <TabsTrigger 
                key={room.id} 
                value={room.id} 
                className="relative text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {room.type === 'group' && <Users className="h-3 w-3 mr-1" />}
                <span className="truncate">{room.name}</span>
                {room.unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive">
                    {room.unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeChat} className="flex-1 flex flex-col m-0 p-0">
            {/* Online Users */}
            <div className="flex gap-3 p-3 border-b border-border/30 overflow-x-auto scrollbar-hide">
              {chatRooms.find((r) => r.id === activeChat)?.participants.map((p) => (
                <motion.div
                  key={p.id}
                  whileHover={{ scale: 1.1 }}
                  className="flex flex-col items-center min-w-[48px] cursor-pointer"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl">
                      {p.avatar}
                    </div>
                    <div
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                        p.isOnline ? 'bg-green-500' : 'bg-muted'
                      )}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[48px] mt-1">
                    {p.name}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'flex gap-2',
                        message.senderId === currentUserId ? 'flex-row-reverse' : ''
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg shrink-0">
                        {message.senderAvatar}
                      </div>
                      <div className="space-y-1 max-w-[70%]">
                        {message.senderId !== currentUserId && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{message.senderName}</span>
                            {message.isNPC && (
                              <Badge variant="outline" className="h-4 px-1 text-[10px] border-primary/30">
                                <Bot className="h-2.5 w-2.5 mr-0.5" />
                                AI
                              </Badge>
                            )}
                          </div>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl p-3 text-sm',
                            message.senderId === currentUserId
                              ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-tr-sm'
                              : 'bg-muted/50 border border-border/50 rounded-tl-sm text-foreground'
                          )}
                        >
                          <p className={cn(message.type === 'sticker' && 'text-3xl')}>
                            {message.content}
                          </p>
                        </div>
                        
                        {/* Time & Reactions */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{formatTime(message.timestamp)}</span>
                          {message.reactions && message.reactions.length > 0 && (
                            <div className="flex gap-1">
                              {message.reactions.map((r) => (
                                <motion.span
                                  key={r.emoji}
                                  whileHover={{ scale: 1.2 }}
                                  className="text-xs bg-muted/50 rounded-full px-1.5 py-0.5 cursor-pointer hover:bg-muted"
                                  onClick={() => addReaction(message.id, r.emoji)}
                                >
                                  {r.emoji} {r.count}
                                </motion.span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Message Actions */}
                      {message.senderId !== currentUserId && (
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                          {QUICK_REACTIONS.map(({ emoji, icon: Icon }) => (
                            <motion.button
                              key={emoji}
                              whileHover={{ scale: 1.2 }}
                              onClick={() => addReaction(message.id, emoji)}
                              className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted"
                            >
                              <Icon className="h-3 w-3 text-muted-foreground" />
                            </motion.button>
                          ))}
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            onClick={() => reportMessage(message.id)}
                            className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-destructive/20"
                          >
                            <Flag className="h-3 w-3 text-destructive" />
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
                
                {/* Typing Indicator */}
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg">
                        🤖
                      </div>
                      <div className="bg-muted/50 rounded-2xl px-4 py-2 flex items-center gap-1">
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                          className="w-2 h-2 bg-muted-foreground rounded-full"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                          className="w-2 h-2 bg-muted-foreground rounded-full"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                          className="w-2 h-2 bg-muted-foreground rounded-full"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Emoji/Sticker Picker */}
            <AnimatePresence>
              {(showEmojiPicker || showStickerPicker) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border/30 bg-muted/30"
                >
                  <div className="flex flex-wrap gap-2 p-3">
                    {(showEmojiPicker ? EMOJI_PICKER : STICKERS).map((item) => (
                      <motion.button
                        key={item}
                        whileHover={{ scale: 1.3 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => sendMessage(item, showEmojiPicker ? 'emoji' : 'sticker')}
                        className="text-xl p-1 hover:bg-muted rounded-lg transition-colors"
                      >
                        {item}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-3 border-t border-border/30 bg-card/50">
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
                  className="shrink-0 hover:bg-primary/10"
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowStickerPicker(false);
                  }}
                >
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-muted/50 border-border/50"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0 bg-gradient-to-r from-primary to-accent"
                  disabled={!inputText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
};

export default EnhancedChatSystem;
