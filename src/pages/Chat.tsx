import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Bot, MessageCircle, Plus, Send, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';

import BackButton from '@/components/ui/BackButton';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';

type ConversationType = 'direct' | 'group' | 'study_room' | 'class' | 'ai';
type MessageType = 'text' | 'image' | 'file' | 'flashcard' | 'quiz' | 'ai_reply';

type Conversation = {
  id: string;
  name: string | null;
  type: ConversationType;
  grade_restriction: number[] | null;
  created_by: string | null;
  created_at: string;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  message_type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  is_deleted: boolean;
  created_at: string;
};

const Chat: React.FC = () => {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar?: string }>>({});
  const [messageInput, setMessageInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newConversationName, setNewConversationName] = useState('');
  const [newConversationType, setNewConversationType] = useState<ConversationType>('group');
  const [gradeRestriction, setGradeRestriction] = useState('');

  const gradeNum = Number(user?.grade || '9');
  const isJunior = gradeNum >= 1 && gradeNum <= 8;
  const isAdmin = user?.role === 'admin';

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(
    () => conversations.filter((item) => (item.name || item.type).toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('id, name, avatar').in('id', ids as never);
    const map: Record<string, { name: string; avatar?: string }> = {};
    (data || []).forEach((item: any) => {
      map[item.id] = { name: item.name || 'User', avatar: item.avatar || undefined };
    });
    setProfiles((prev) => ({ ...prev, ...map }));
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    setLoadingConversations(true);

    const client = supabase as any;
    const { data: memberRows, error: memberError } = await client
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (memberError) {
      toast.error('Failed to load chat rooms');
      setLoadingConversations(false);
      return;
    }

    const conversationIds = (memberRows || []).map((item: any) => item.conversation_id);
    if (!conversationIds.length) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const { data: rows, error } = await client
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Failed to load conversations');
    } else {
      setConversations(rows || []);
      if (!selectedConversationId && rows?.length) setSelectedConversationId(rows[0].id);
    }

    setLoadingConversations(false);
  }, [selectedConversationId, user?.id]);

  const fetchMessages = useCallback(async () => {
    if (!selectedConversationId || !user?.id) return;
    setLoadingMessages(true);
    const client = supabase as any;

    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', selectedConversationId)
      .order('created_at', { ascending: true })
      .range(0, 59);

    if (error) {
      toast.error('Failed to load messages');
      setLoadingMessages(false);
      return;
    }

    setMessages(data || []);
    await fetchProfiles((data || []).map((item: any) => item.sender_id).filter(Boolean));
    setLoadingMessages(false);

    const unreadIds = (data || []).filter((item: ChatMessage) => item.sender_id !== user.id).map((item: ChatMessage) => item.id);
    if (unreadIds.length) {
      await Promise.all(
        unreadIds.map((messageId: string) =>
          client.from('message_reads').upsert({ message_id: messageId, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' }),
        ),
      );
    }

    const { data: readRows } = await client.from('message_reads').select('message_id').in('message_id', (data || []).map((item: any) => item.id));
    const countMap: Record<string, number> = {};
    (readRows || []).forEach((item: any) => {
      countMap[item.message_id] = (countMap[item.message_id] || 0) + 1;
    });
    setReads(countMap);
  }, [fetchProfiles, selectedConversationId, user?.id]);

  useEffect(() => {
    if (!isLoading && !user) navigate('/');
  }, [isLoading, navigate, user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const client = supabase as any;

    const messagesChannel = client
      .channel(`chat-messages-${selectedConversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversationId}` }, () => fetchMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, () => fetchMessages())
      .subscribe();

    const typingChannel = client
      .channel(`chat-typing-${selectedConversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_status', filter: `conversation_id=eq.${selectedConversationId}` }, async () => {
        const { data } = await client
          .from('typing_status')
          .select('user_id')
          .eq('conversation_id', selectedConversationId)
          .eq('is_typing', true)
          .neq('user_id', user?.id || '');
        const userIds = (data || []).map((item: any) => item.user_id);
        await fetchProfiles(userIds);
        setTypingUsers(userIds);
      })
      .subscribe();

    return () => {
      client.removeChannel(messagesChannel);
      client.removeChannel(typingChannel);
    };
  }, [fetchMessages, fetchProfiles, selectedConversationId, user?.id]);

  const createConversation = async () => {
    if (!user?.id || !newConversationName.trim()) return;

    if (isJunior && ['group', 'study_room'].includes(newConversationType)) {
      toast.error('Grades 1-8 can only use direct/classrooms managed by teachers.');
      return;
    }

    const grades = gradeRestriction
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((n) => !Number.isNaN(n));

    const client = supabase as any;
    const { data, error } = await client
      .from('conversations')
      .insert({
        type: newConversationType,
        name: newConversationName,
        grade_restriction: grades,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      toast.error('Unable to create conversation');
      return;
    }

    await client.from('conversation_members').insert({ conversation_id: data.id, user_id: user.id, role: isAdmin ? 'admin' : 'moderator' });
    toast.success('Conversation created');
    setCreateOpen(false);
    setNewConversationName('');
    setGradeRestriction('');
    setNewConversationType('group');
    fetchConversations();
    setSelectedConversationId(data.id);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversationId || !user?.id) return;

    const text = messageInput.trim();
    setMessageInput('');

    const mentionTokens = Array.from(text.matchAll(/@([a-zA-Z0-9_]+)/g)).map((item) => item[1]);

    const payload = {
      conversation_id: selectedConversationId,
      sender_id: user.id,
      message_type: 'text' as MessageType,
      content: text,
      metadata: {
        mentions: mentionTokens,
        xpEligible: text.length > 40,
      },
    };

    const client = supabase as any;
    const { error } = await client.from('messages').insert(payload);
    if (error) {
      toast.error('Message failed to send');
    }
  };

  const setTyping = async (state: boolean) => {
    if (!selectedConversationId || !user?.id) return;
    const client = supabase as any;
    await client
      .from('typing_status')
      .upsert({ conversation_id: selectedConversationId, user_id: user.id, is_typing: state, updated_at: new Date().toISOString() }, { onConflict: 'conversation_id,user_id' });
  };

  const askAiTutor = async () => {
    if (!messageInput.trim() || !user?.id || !selectedConversationId) return;
    const question = messageInput.trim();
    setMessageInput('');

    const client = supabase as any;
    await client.from('messages').insert({
      conversation_id: selectedConversationId,
      sender_id: user.id,
      message_type: 'text',
      content: question,
      metadata: { aiQuestion: true },
    });

    const { data, error } = await supabase.functions.invoke('ai-tutor', {
      body: { message: question, subject: 'General' },
    });

    if (error || !data?.message) {
      toast.error('AI tutor unavailable right now');
      return;
    }

    await client.from('messages').insert({
      conversation_id: selectedConversationId,
      sender_id: null,
      message_type: 'ai_reply',
      content: data.message,
      metadata: { source: 'ai-tutor', saveToFlashcard: true },
    });
  };

  const sharedContent = messages.filter((item) => ['file', 'flashcard', 'quiz'].includes(item.message_type));

  return (
    <div className="min-h-screen relative text-foreground">
      <AnimatedBackground variant="minimal" />
      <div className="relative z-10 h-screen flex flex-col">
        <header className="px-4 py-3 border-b border-white/10 backdrop-blur-xl bg-background/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackButton to="/" />
              <div>
                <h1 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Master Minds Chat Nexus</h1>
                <p className="text-xs text-muted-foreground">Real-time, moderated, grade-safe collaboration</p>
              </div>
            </div>
            <Badge variant="secondary">Grade {user?.grade || 'N/A'}</Badge>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <aside className="w-80 border-r border-white/10 bg-card/40 backdrop-blur-xl p-3 space-y-3">
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." />
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline"><Plus className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create conversation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <Input placeholder="Name" value={newConversationName} onChange={(e) => setNewConversationName(e.target.value)} />
                    <Select value={newConversationType} onValueChange={(v) => setNewConversationType(v as ConversationType)}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                        <SelectItem value="study_room">Study room</SelectItem>
                        <SelectItem value="class">Class</SelectItem>
                        <SelectItem value="ai">AI Tutor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Grade restriction (comma separated)" value={gradeRestriction} onChange={(e) => setGradeRestriction(e.target.value)} />
                    <Button onClick={createConversation} className="w-full">Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[calc(100vh-190px)]">
              {loadingConversations ? (
                <p className="text-sm text-muted-foreground">Loading conversations...</p>
              ) : (
                <div className="space-y-2">
                  {filteredConversations.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full text-left p-3 rounded-xl border transition ${item.id === selectedConversationId ? 'bg-primary/15 border-primary/40 shadow-[0_0_24px_rgba(99,102,241,0.2)]' : 'bg-card/40 border-white/10 hover:border-primary/30'}`}
                      onClick={() => setSelectedConversationId(item.id)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{item.name || `${item.type} conversation`}</p>
                        <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </aside>

          <main className="flex-1 flex flex-col bg-background/20 backdrop-blur-xl">
            {!selectedConversation ? (
              <div className="m-auto text-center text-muted-foreground">
                <MessageCircle className="mx-auto mb-2 opacity-70" />
                Select or create a conversation.
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{selectedConversation.name || selectedConversation.type}</h2>
                    <p className="text-xs text-muted-foreground">Instant sync • Read receipts • AI moderation active</p>
                  </div>
                  {isJunior && <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Junior Safety Mode</Badge>}
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {loadingMessages ? <p className="text-sm text-muted-foreground">Loading messages...</p> : messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      const senderName = msg.sender_id ? profiles[msg.sender_id]?.name || 'User' : 'AI Tutor';

                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2 border ${isMe ? 'bg-primary text-primary-foreground border-primary/60' : 'bg-card/50 border-white/10'}`}>
                            <div className="text-[11px] mb-1 opacity-80 flex items-center gap-1">{msg.message_type === 'ai_reply' && <Bot className="h-3 w-3" />}{senderName}</div>
                            <p className={msg.is_deleted ? 'italic opacity-70' : ''}>{msg.is_deleted ? 'Message removed by moderation.' : msg.content}</p>
                            <div className="mt-1 text-[10px] opacity-70 flex items-center gap-2 justify-end">
                              <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                              {isMe && <span>{reads[msg.id] ? `Read by ${reads[msg.id] - 1}` : 'Sent'}</span>}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    {!!typingUsers.length && (
                      <p className="text-xs text-muted-foreground">{typingUsers.map((id) => profiles[id]?.name || 'Someone').join(', ')} typing...</p>
                    )}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-white/10 bg-background/40">
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        setTyping(true);
                      }}
                      onBlur={() => setTyping(false)}
                      placeholder="Message, @mention, share flashcard/quiz metadata..."
                    />
                    <Button onClick={sendMessage} disabled={!messageInput.trim()}><Send className="h-4 w-4" /></Button>
                    <Button variant="secondary" onClick={askAiTutor} disabled={!messageInput.trim() || selectedConversation.type !== 'ai'}>
                      <Bot className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </main>

          <aside className="hidden xl:block w-80 border-l border-white/10 bg-card/40 backdrop-blur-xl p-4 space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Shared academic content</h3>
              <p className="text-xs text-muted-foreground">Flashcards, quiz challenges, files, links</p>
            </div>
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2">
                {sharedContent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shared resources yet.</p>
                ) : sharedContent.map((item) => (
                  <div key={item.id} className="rounded-xl p-3 border border-primary/20 bg-primary/5">
                    <p className="text-xs uppercase tracking-wide text-primary mb-1">{item.message_type}</p>
                    <p className="text-sm line-clamp-3">{item.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Chat;
