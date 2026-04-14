import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Users, Globe, Search, Plus, Settings,
  ArrowLeft, Send, Smile, Paperclip, MoreVertical,
  Phone, Video, UserPlus, Swords, BookOpen, BrainCircuit,
  Check, CheckCheck, Image, FileText, Mic, X, Hash,
  Crown, Shield, Gamepad2, Loader2, Bell, Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import BackButton from '@/components/ui/BackButton';

// Types
interface ChatRoom {
  id: string;
  name: string;
  group_type: string;
  avatar_url?: string;
  created_by: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  memberCount: number;
  isOnline?: boolean;
  members?: ChatMember[];
}

interface ChatMember {
  id: string;
  user_id: string;
  role: string;
  name: string;
  avatar: string;
  level: number;
  isOnline: boolean;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachment_url?: string;
  reply_to_id?: string;
  created_at: string;
  senderName: string;
  senderAvatar: string;
  senderLevel: number;
  status: 'sent' | 'delivered' | 'seen';
  reactions: { emoji: string; users: string[] }[];
  replyTo?: { content: string; senderName: string };
}

type ChatFilter = 'all' | 'private' | 'group' | 'room' | 'public';

const EMOJI_LIST = ['😀','😂','😍','🤔','👍','👎','🎉','💪','🧠','⭐','🔥','❤️','😎','🎯','💯','🚀','✨','👑','💎','📚'];
const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '💯'];
const BANNED_PATTERNS = ['kill yourself', 'hate you'];

const Chat: React.FC = () => {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<string>('private');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [profileCache, setProfileCache] = useState<Record<string, { name: string; avatar: string; level: number }>>({});
  const [searchResults, setSearchResults] = useState<ChatRoom[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Load profiles helper
  const loadProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter(id => !profileCache[id]);
    if (!missing.length) return;
    const { data } = await supabase.from('profiles').select('id, name, avatar, level').in('id', missing);
    if (data) {
      const map: Record<string, any> = {};
      data.forEach(p => { map[p.id] = { name: p.name || 'User', avatar: p.avatar || '👤', level: p.level || 1 }; });
      setProfileCache(prev => ({ ...prev, ...map }));
    }
  }, [profileCache]);

  // Load online status
  useEffect(() => {
    const loadOnline = async () => {
      const { data } = await supabase.from('user_presence').select('user_id, status, last_seen');
      const now = Date.now();
      const online = new Set((data || [])
        .filter(u => u.status === 'online' && now - new Date(u.last_seen).getTime() < 5 * 60 * 1000)
        .map(u => u.user_id));
      setOnlineUserIds(online);
    };
    loadOnline();
    const interval = setInterval(loadOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load rooms
  const loadRooms = useCallback(async () => {
    if (!user?.id) return;
    setLoadingRooms(true);
    try {
      const { data: memberships } = await supabase
        .from('chat_group_members').select('group_id').eq('user_id', user.id);
      const groupIds = (memberships || []).map(m => m.group_id);
      if (!groupIds.length) { setRooms([]); setLoadingRooms(false); return; }

      const { data: groups } = await supabase
        .from('chat_groups').select('*').in('id', groupIds).order('updated_at', { ascending: false });

      // Get last messages
      const roomList: ChatRoom[] = [];
      for (const g of (groups || [])) {
        const { data: lastMsg } = await supabase
          .from('group_messages').select('content, created_at')
          .eq('group_id', g.id).order('created_at', { ascending: false }).limit(1);
        
        const { count } = await supabase
          .from('chat_group_members').select('*', { count: 'exact', head: true })
          .eq('group_id', g.id);

        roomList.push({
          id: g.id,
          name: g.name,
          group_type: g.group_type,
          avatar_url: g.avatar_url,
          created_by: g.created_by,
          lastMessage: lastMsg?.[0]?.content,
          lastMessageTime: lastMsg?.[0]?.created_at,
          unreadCount: 0,
          memberCount: count || 0,
        });
      }
      setRooms(roomList);
    } catch (err) {
      console.error('Error loading rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, [user?.id]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Load messages for active room
  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);
    try {
      const { data } = await supabase
        .from('group_messages').select('*')
        .eq('group_id', roomId)
        .order('created_at', { ascending: true }).limit(200);

      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      await loadProfiles(senderIds);

      // Load reply-to messages
      const replyIds = (data || []).filter(m => m.reply_to_id).map(m => m.reply_to_id!);
      let replyMap: Record<string, any> = {};
      if (replyIds.length) {
        const { data: replies } = await supabase
          .from('group_messages').select('id, content, sender_id').in('id', replyIds);
        (replies || []).forEach(r => { replyMap[r.id] = r; });
      }

      const msgs: ChatMessage[] = (data || []).map(m => {
        const profile = profileCache[m.sender_id] || { name: 'User', avatar: '👤', level: 1 };
        const reply = m.reply_to_id ? replyMap[m.reply_to_id] : null;
        const replyProfile = reply ? (profileCache[reply.sender_id] || { name: 'User' }) : null;
        return {
          id: m.id,
          sender_id: m.sender_id,
          content: m.content,
          message_type: m.message_type,
          attachment_url: m.attachment_url,
          reply_to_id: m.reply_to_id,
          created_at: m.created_at,
          senderName: profile.name,
          senderAvatar: profile.avatar,
          senderLevel: profile.level,
          status: 'delivered' as const,
          reactions: [],
          replyTo: reply ? { content: reply.content, senderName: replyProfile?.name || 'User' } : undefined,
        };
      });
      setMessages(msgs);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [loadProfiles, profileCache]);

  // Load members for active room
  const loadMembers = useCallback(async (roomId: string) => {
    const { data } = await supabase.from('chat_group_members').select('*').eq('group_id', roomId);
    const userIds = (data || []).map(m => m.user_id);
    await loadProfiles(userIds);
    const memberList: ChatMember[] = (data || []).map(m => {
      const p = profileCache[m.user_id] || { name: 'User', avatar: '👤', level: 1 };
      return {
        id: m.id, user_id: m.user_id, role: m.role,
        name: p.name, avatar: p.avatar, level: p.level,
        isOnline: onlineUserIds.has(m.user_id),
      };
    });
    setMembers(memberList);
  }, [loadProfiles, profileCache, onlineUserIds]);

  // Select room
  const selectRoom = useCallback((room: ChatRoom) => {
    setActiveRoom(room);
    setShowMobileChat(true);
    loadMessages(room.id);
    loadMembers(room.id);
  }, [loadMessages, loadMembers]);

  // Realtime subscription
  useEffect(() => {
    if (!activeRoom) return;

    // Typing channel
    const typingCh = supabase.channel(`typing-${activeRoom.id}`, { config: { broadcast: { self: false } } });
    typingCh.on('broadcast', { event: 'typing' }, (payload) => {
      const uid = payload.payload?.userId as string;
      const uname = payload.payload?.userName as string;
      if (!uid || uid === user?.id) return;
      setTypingUsers(prev => ({ ...prev, [uid]: uname || 'User' }));
      setTimeout(() => setTypingUsers(prev => { const n = { ...prev }; delete n[uid]; return n; }), 2000);
    }).subscribe();
    typingChannelRef.current = typingCh;

    // Message channel
    const msgCh = supabase.channel(`msg-${activeRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${activeRoom.id}`
      }, async (payload) => {
        const m = payload.new as any;
        const profile = profileCache[m.sender_id] || { name: 'User', avatar: '👤', level: 1 };
        if (!profileCache[m.sender_id]) {
          const { data } = await supabase.from('profiles').select('id, name, avatar, level').eq('id', m.sender_id).single();
          if (data) {
            setProfileCache(prev => ({ ...prev, [data.id]: { name: data.name, avatar: data.avatar || '👤', level: data.level || 1 } }));
          }
        }
        const newMsg: ChatMessage = {
          id: m.id, sender_id: m.sender_id, content: m.content,
          message_type: m.message_type, attachment_url: m.attachment_url,
          reply_to_id: m.reply_to_id, created_at: m.created_at,
          senderName: profileCache[m.sender_id]?.name || profile.name,
          senderAvatar: profileCache[m.sender_id]?.avatar || profile.avatar,
          senderLevel: profileCache[m.sender_id]?.level || profile.level,
          status: 'delivered', reactions: [],
        };
        setMessages(prev => prev.some(p => p.id === newMsg.id) ? prev : [...prev, newMsg]);
      }).subscribe();

    return () => {
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      supabase.removeChannel(msgCh);
      typingChannelRef.current = null;
    };
  }, [activeRoom, user?.id, profileCache]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Auth guard
  useEffect(() => {
    if (!isLoading && !user) navigate('/');
  }, [isLoading, user, navigate]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!user?.id || !activeRoom || !draft.trim() || sending) return;
    const text = draft.trim();
    if (BANNED_PATTERNS.some(p => text.toLowerCase().includes(p))) {
      toast.error('Message blocked by safety filter.');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('group_messages').insert({
      group_id: activeRoom.id, sender_id: user.id,
      content: text, message_type: 'text',
      reply_to_id: replyTo?.id || null,
    });
    if (error) { toast.error('Failed to send'); setSending(false); return; }
    setDraft(''); setReplyTo(null); setSending(false);
    await supabase.from('chat_groups').update({ updated_at: new Date().toISOString() }).eq('id', activeRoom.id);
  }, [user?.id, activeRoom, draft, sending, replyTo]);

  // Broadcast typing
  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (val.trim() && typingChannelRef.current && user) {
      typingChannelRef.current.send({
        type: 'broadcast', event: 'typing',
        payload: { userId: user.id, userName: user.name || 'User' },
      });
    }
  };

  // Create group
  const createGroup = async () => {
    if (!user?.id || !newGroupName.trim()) return;
    try {
      const { data, error } = await supabase.from('chat_groups')
        .insert({ name: newGroupName.trim(), group_type: newGroupType, created_by: user.id })
        .select().single();
      if (error) throw error;
      await supabase.from('chat_group_members')
        .insert({ group_id: data.id, user_id: user.id, role: 'owner' });
      toast.success('Chat created!');
      setNewGroupName(''); setShowCreateDialog(false);
      loadRooms();
    } catch { toast.error('Failed to create chat'); }
  };

  // Search groups
  const searchGroups = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from('chat_groups').select('*')
      .or('group_type.eq.public,group_type.eq.class')
      .ilike('name', `%${q}%`).limit(10);
    setSearchResults((data || []).map(g => ({
      id: g.id, name: g.name, group_type: g.group_type,
      avatar_url: g.avatar_url, created_by: g.created_by,
      unreadCount: 0, memberCount: 0,
    })));
  };

  // Join group
  const joinGroup = async (groupId: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from('chat_group_members')
      .insert({ group_id: groupId, user_id: user.id, role: 'member' });
    if (error?.code === '23505') { toast.info('Already a member'); return; }
    if (error) { toast.error('Failed to join'); return; }
    toast.success('Joined!');
    loadRooms();
    setShowSearch(false);
  };

  // Challenge from chat
  const challengeUser = async (targetUserId: string) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.rpc('create_multiplayer_invite', {
        p_receiver_id: targetUserId,
      });
      if (error) throw error;
      toast.success('Challenge sent!');
    } catch { toast.error('Failed to send challenge'); }
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (filter !== 'all') list = list.filter(r => r.group_type === filter);
    if (searchQuery) list = list.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [rooms, filter, searchQuery]);

  // Format time
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Room type icon
  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'private': return <MessageCircle className="h-4 w-4" />;
      case 'group': return <Users className="h-4 w-4" />;
      case 'room': return <Gamepad2 className="h-4 w-4" />;
      case 'public': return <Globe className="h-4 w-4" />;
      case 'class': return <BookOpen className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="h-3 w-3 text-yellow-400" />;
    if (role === 'admin') return <Shield className="h-3 w-3 text-blue-400" />;
    return null;
  };

  const typingText = useMemo(() => {
    const names = Object.values(typingUsers).filter(n => n !== user?.name);
    if (!names.length) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    return `${names.slice(0, 2).join(', ')} are typing...`;
  }, [typingUsers, user?.name]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── SIDEBAR ──
  const Sidebar = () => (
    <div className="flex flex-col h-full border-r border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-lg font-bold text-foreground">💬🧠 Master Minds Chat</h1>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(true)}>
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Search */}
        <Input
          placeholder="Search chats..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-9 bg-muted/50 border-border/30 text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto">
        {(['all', 'private', 'group', 'room', 'public'] as ChatFilter[]).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'}
            className={cn('text-xs capitalize shrink-0 h-7', filter === f && 'bg-primary text-primary-foreground')}
            onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      {/* Room list */}
      <ScrollArea className="flex-1">
        {loadingRooms ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No chats yet</p>
            <Button size="sm" className="mt-3" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3 w-3 mr-1" /> New Chat
            </Button>
          </div>
        ) : (
          <div className="px-2 py-1">
            {filteredRooms.map(room => (
              <button key={room.id}
                onClick={() => selectRoom(room)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left',
                  'hover:bg-accent/50',
                  activeRoom?.id === room.id && 'bg-accent/70 shadow-sm'
                )}>
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg border border-border/30">
                    {room.avatar_url ? (
                      <img src={room.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : getRoomIcon(room.group_type)}
                  </div>
                  {room.group_type === 'private' && (
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                      'bg-green-500'
                    )} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate">{room.name}</span>
                    {room.lastMessageTime && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatTime(room.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {room.lastMessage || 'No messages yet'}
                    </p>
                    {room.unreadCount > 0 && (
                      <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-primary text-primary-foreground shrink-0 ml-2">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // ── CHAT AREA ──
  const ChatArea = () => {
    if (!activeRoom) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-background/50">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Select a Chat</h3>
          <p className="text-sm text-muted-foreground">Choose a conversation to start messaging</p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-background/30 min-h-0">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setShowMobileChat(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-border/30">
              {getRoomIcon(activeRoom.group_type)}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">{activeRoom.name}</h3>
              <p className="text-[11px] text-muted-foreground">
                {typingText || `${activeRoom.memberCount} members`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/lobby')}>
              <Gamepad2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/multiplayer')}>
              <Trophy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setShowMembers(!showMembers)}>
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Messages */}
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-4 py-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === user?.id;
                    const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
                    const showTime = i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id;

                    return (
                      <motion.div key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn('flex gap-2 mb-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        {/* Avatar */}
                        <div className="w-8 shrink-0">
                          {showAvatar && !isMe && (
                            <button
                              onClick={() => navigate(`/profile/${msg.sender_id}`)}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm border border-border/30 hover:ring-2 hover:ring-primary/50 transition-all">
                              {msg.senderAvatar}
                            </button>
                          )}
                        </div>

                        {/* Bubble */}
                        <div className={cn('max-w-[75%] group', isMe ? 'items-end' : 'items-start')}>
                          {showAvatar && !isMe && (
                            <p className="text-[11px] text-muted-foreground mb-0.5 px-3">{msg.senderName}</p>
                          )}

                          {/* Reply preview */}
                          {msg.replyTo && (
                            <div className={cn(
                              'text-[11px] px-3 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/50',
                              isMe ? 'bg-primary/10' : 'bg-muted/50'
                            )}>
                              <span className="font-medium text-primary">{msg.replyTo.senderName}</span>
                              <p className="text-muted-foreground truncate">{msg.replyTo.content}</p>
                            </div>
                          )}

                          <div className={cn(
                            'px-3 py-2 rounded-2xl text-sm relative',
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted/70 text-foreground rounded-bl-md',
                          )}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                            {/* Quick react on hover */}
                            <div className={cn(
                              'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-card shadow-lg rounded-full px-1 py-0.5 border border-border/30',
                              isMe ? '-left-24' : '-right-24'
                            )}>
                              {QUICK_REACTIONS.slice(0, 3).map(emoji => (
                                <button key={emoji} className="hover:scale-125 transition-transform text-xs p-0.5"
                                  onClick={() => setReplyTo(msg)}>
                                  {emoji}
                                </button>
                              ))}
                              <button className="hover:scale-110 transition-transform text-xs p-0.5 text-muted-foreground"
                                onClick={() => setReplyTo(msg)}>
                                ↩️
                              </button>
                            </div>
                          </div>

                          {/* Reactions */}
                          {msg.reactions.length > 0 && (
                            <div className="flex gap-1 mt-0.5 px-2">
                              {msg.reactions.map((r, ri) => (
                                <span key={ri} className="text-xs bg-muted/50 rounded-full px-1.5 py-0.5 border border-border/20">
                                  {r.emoji} {r.users.length}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Time + Status */}
                          {showTime && (
                            <div className={cn('flex items-center gap-1 mt-0.5 px-3', isMe && 'justify-end')}>
                              <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                              {isMe && (
                                <CheckCheck className={cn('h-3 w-3', msg.status === 'seen' ? 'text-blue-400' : 'text-muted-foreground')} />
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Typing indicator */}
                  {typingText && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-2 px-3 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{typingText}</span>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </ScrollArea>

            {/* Reply bar */}
            <AnimatePresence>
              {replyTo && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pt-2 border-t border-border/20 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-1 h-8 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium text-primary">{replyTo.senderName}</p>
                        <p className="text-muted-foreground truncate max-w-[200px]">{replyTo.content}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="px-3 py-3 border-t border-border/30 bg-card/50">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={() => setDraft(prev => `${prev}${prev ? ' ' : ''}📚 Quiz link: `)}>
                  <BookOpen className="h-3 w-3" /> Quiz
                </Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={() => setDraft(prev => `${prev}${prev ? ' ' : ''}📝 Study note: `)}>
                  <FileText className="h-3 w-3" /> Notes
                </Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={() => setDraft(prev => `${prev}${prev ? ' ' : ''}🎮 Join my room: `)}>
                  <Gamepad2 className="h-3 w-3" /> Join Room
                </Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={() => setDraft(prev => `${prev}${prev ? ' ' : ''}⚔️ Challenge accepted!`)}>
                  <Swords className="h-3 w-3" /> Challenge
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7"><Bell className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" side="top">
                    <div className="grid grid-cols-5 gap-1">
                      {EMOJI_LIST.map(emoji => (
                        <button key={emoji}
                          className="text-xl hover:bg-accent/50 rounded-lg p-1.5 transition-colors"
                          onClick={() => { setDraft(prev => prev + emoji); setShowEmojiPicker(false); }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !activeRoom || !user?.id) return;
                  await sendMessage();
                  const msg = `📎 ${file.name}`;
                  await supabase.from('group_messages').insert({
                    group_id: activeRoom.id, sender_id: user.id,
                    content: msg, message_type: 'text',
                  });
                  e.target.value = '';
                }} />

                <Input ref={inputRef}
                  value={draft}
                  onChange={e => handleDraftChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message, emoji, quiz link, notes, or match invite..."
                  className="flex-1 h-9 bg-muted/50 border-border/30 text-sm rounded-full"
                />

                <Button size="icon" className="h-9 w-9 rounded-full shrink-0"
                  disabled={!draft.trim() || sending}
                  onClick={sendMessage}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Members sidebar */}
          <AnimatePresence>
            {showMembers && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="border-l border-border/30 bg-card/50 overflow-hidden shrink-0 hidden md:block">
                <div className="p-3 border-b border-border/30">
                  <h4 className="text-sm font-semibold text-foreground">Members ({members.length})</h4>
                </div>
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {members.map(m => (
                      <button key={m.id}
                        onClick={() => navigate(`/profile/${m.user_id}`)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm border border-border/30">
                            {m.avatar}
                          </div>
                          <div className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                            m.isOnline ? 'bg-green-500' : 'bg-muted-foreground/30'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium truncate text-foreground">{m.name}</span>
                            {getRoleIcon(m.role)}
                          </div>
                          <span className="text-[10px] text-muted-foreground">Lv. {m.level}</span>
                        </div>
                        {m.user_id !== user?.id && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                            onClick={(e) => { e.stopPropagation(); challengeUser(m.user_id); }}>
                            <Swords className="h-3 w-3" />
                          </Button>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Desktop: side by side */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="w-80 shrink-0">
          <Sidebar />
        </div>
        <ChatArea />
      </div>

      {/* Mobile: toggle */}
      <div className="flex md:hidden flex-1 min-h-0">
        {showMobileChat && activeRoom ? <ChatArea /> : <Sidebar />}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder="Chat name..." />
            <div className="flex gap-2 flex-wrap">
              {['private', 'group', 'public', 'class'].map(t => (
                <Button key={t} size="sm" variant={newGroupType === t ? 'default' : 'outline'}
                  className="capitalize" onClick={() => setNewGroupType(t)}>
                  {getRoomIcon(t)} <span className="ml-1">{t}</span>
                </Button>
              ))}
            </div>
            <Button className="w-full" onClick={createGroup} disabled={!newGroupName.trim()}>
              Create Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search/Join Dialog */}
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Find & Join Chats</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Search public chats..." onChange={e => searchGroups(e.target.value)} />
            <ScrollArea className="max-h-60">
              {searchResults.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
                  <div className="flex items-center gap-2">
                    {getRoomIcon(r.group_type)}
                    <span className="text-sm font-medium">{r.name}</span>
                  </div>
                  <Button size="sm" onClick={() => joinGroup(r.id)}>Join</Button>
                </div>
              ))}
              {searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Search for public chats to join</p>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
