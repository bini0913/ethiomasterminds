import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Flag,
  Moon,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  Sun,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';

import BackButton from '@/components/ui/BackButton';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type ChatType = 'private' | 'room' | 'class' | 'community';

type ChatGroup = {
  id: string;
  name: string;
  group_type: string;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ProfileMap = Record<string, { name: string; avatar?: string }>;

const LOBBY_QUICK_MESSAGES = ['Ready!', 'Wait', "Let\'s go", 'Good luck', '🔥', '😎', '🎯'];
const LEARNING_PROMPTS = [
  'Generate quiz from this chat.',
  'Explain this topic with simple examples.',
  'Give 3 revision questions for this lesson.',
] as const;
const BANNED_PATTERNS = ['kill yourself', 'hate you', 'stupid'];

const resolveChatType = (groupType: string): ChatType => {
  if (groupType === 'private') return 'private';
  if (groupType === 'room') return 'room';
  if (groupType === 'class') return 'class';
  return 'community';
};

const sanitizeMessage = (text: string): { blocked: boolean; value: string } => {
  const cleaned = text.trim();
  if (!cleaned) return { blocked: true, value: '' };

  const lowered = cleaned.toLowerCase();
  const toxic = BANNED_PATTERNS.some((pattern) => lowered.includes(pattern));
  const spammy = /(.)\1{8,}/.test(cleaned);

  if (toxic || spammy) {
    return { blocked: true, value: cleaned };
  }

  return { blocked: false, value: cleaned };
};

const Chat: React.FC = () => {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<number | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [activeFilter, setActiveFilter] = useState<ChatType | 'all'>('all');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [isDark, setIsDark] = useState(true);
  const [currentGrade, setCurrentGrade] = useState<number | null>(null);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const activeChatType = useMemo(
    () => (activeGroup ? resolveChatType(activeGroup.group_type) : null),
    [activeGroup],
  );

  const visibleGroups = useMemo(() => {
    const eligibleGroups = groups.filter((group) => {
      const groupType = resolveChatType(group.group_type);
      if (groupType !== 'community') return true;
      return (currentGrade ?? 12) >= 5;
    });

    if (activeFilter === 'all') return eligibleGroups;
    return eligibleGroups.filter((group) => resolveChatType(group.group_type) === activeFilter);
  }, [activeFilter, currentGrade, groups]);

  const isLobbyChat = activeChatType === 'room';

  const loadProfiles = useCallback(async (userIds: string[]) => {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return;

    const { data } = await supabase.from('profiles').select('id, name, avatar').in('id', ids);
    if (!data?.length) return;

    const next: ProfileMap = {};
    data.forEach((row) => {
      next[row.id] = {
        name: row.name || 'Learner',
        avatar: row.avatar || '👤',
      };
    });

    setProfiles((prev) => ({ ...prev, ...next }));
  }, []);

  const loadMessages = useCallback(
    async (groupId: string) => {
      if (!groupId) return;

      setLoadingMessages(true);
      const { data, error } = await supabase
        .from('group_messages')
        .select('id, sender_id, content, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        toast.error('Could not load messages right now.');
        setLoadingMessages(false);
        return;
      }

      const fetched = data || [];
      setMessages(fetched);
      void loadProfiles(fetched.map((m) => m.sender_id));
      setLoadingMessages(false);
    },
    [loadProfiles],
  );

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/');
    }
  }, [isLoading, navigate, user]);

  useEffect(() => {
    const loadCurrentGrade = async () => {
      if (!user?.id) return;

      const { data } = await supabase.from('profiles').select('grade').eq('id', user.id).single();
      if (!data?.grade) return;

      const numericGrade = Number.parseInt(String(data.grade).replace(/[^\d]/g, ''), 10);
      if (!Number.isNaN(numericGrade)) {
        setCurrentGrade(numericGrade);
      }
    };

    void loadCurrentGrade();
  }, [user?.id]);

  useEffect(() => {
    const loadGroups = async () => {
      if (!user?.id) return;

      setLoadingGroups(true);

      const { data: memberships, error: membershipError } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (membershipError) {
        toast.error('Could not load chat rooms right now.');
        setLoadingGroups(false);
        return;
      }

      const groupIds = (memberships || []).map((row) => row.group_id);
      if (!groupIds.length) {
        setGroups([]);
        setActiveGroupId('');
        setLoadingGroups(false);
        return;
      }

      const { data: rows, error: groupError } = await supabase
        .from('chat_groups')
        .select('id, name, group_type')
        .in('id', groupIds)
        .order('updated_at', { ascending: false });

      if (groupError) {
        toast.error('Could not load chat rooms right now.');
        setLoadingGroups(false);
        return;
      }

      const mappedGroups = (rows || []).map((r) => ({
        id: r.id,
        name: r.name,
        group_type: r.group_type,
      }));
      setGroups(mappedGroups);

      if (!activeGroupId && mappedGroups.length > 0) {
        setActiveGroupId(mappedGroups[0].id);
      }

      setLoadingGroups(false);
    };

    void loadGroups();
  }, [activeGroupId, user?.id]);

  useEffect(() => {
    const loadPresence = async () => {
      const { data } = await supabase.from('user_presence').select('user_id, status, last_seen');
      const now = Date.now();
      const online = (data || [])
        .filter((u) => u.status === 'online' && now - new Date(u.last_seen).getTime() < 5 * 60 * 1000)
        .map((u) => u.user_id);
      setOnlineUsers(online);
      void loadProfiles(online);
    };

    void loadPresence();
  }, [loadProfiles]);

  useEffect(() => {
    if (!activeGroupId) {
      setMessages([]);
      return;
    }

    void loadMessages(activeGroupId);
  }, [activeGroupId, loadMessages]);

  useEffect(() => {
    if (!activeGroupId) return;

    const typingChannel = supabase.channel(`typing-${activeGroupId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typedBy = payload.payload?.userName as string | undefined;
        const typedById = payload.payload?.userId as string | undefined;

        if (!typedById || typedById === user?.id) return;

        setTypingUsers((prev) => ({ ...prev, [typedById]: typedBy || 'Learner' }));
        window.setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[typedById];
            return next;
          });
        }, 1400);
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    const channel = supabase
      .channel(`chat-updates-${activeGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${activeGroupId}` },
        () => {
          void loadMessages(activeGroupId);
        },
      )
      .subscribe();

    return () => {
      if (typingChannelRef.current) {
        void supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [activeGroupId, loadMessages, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const sendMessage = useCallback(
    async (forcedMessage?: string) => {
      const raw = forcedMessage ?? draft;
      const moderated = sanitizeMessage(raw);

      if (!user?.id || !activeGroupId || moderated.blocked || isSending) {
        if (moderated.blocked && raw.trim()) {
          toast.error('Message blocked by safety moderation. Keep chat respectful and spam-free.');
        }
        return;
      }

      if (isLobbyChat && !LOBBY_QUICK_MESSAGES.includes(moderated.value)) {
        toast.warning('Lobby chat only supports safe quick messages and emotes.');
        return;
      }

      setIsSending(true);

      const { error } = await supabase.from('group_messages').insert({
        group_id: activeGroupId,
        sender_id: user.id,
        message_type: 'text',
        content: moderated.value,
      });

      if (error) {
        toast.error('Message not sent. Please try again.');
        setIsSending(false);
        return;
      }

      setDraft('');
      setIsTyping(false);
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setIsSending(false);
    },
    [activeGroupId, draft, isLobbyChat, isSending, user?.id],
  );

  const askAI = useCallback(async () => {
    if (!activeGroupId || isSending) return;

    const context = messages.slice(-5).map((m) => m.content).join(' | ');
    const aiReply = context
      ? `🧠 AI Study Coach: Based on this discussion, focus on key definitions first, then practice with 3 quiz questions.`
      : '🧠 AI Study Coach: Start by asking a specific topic, and I can generate a quick explanation or quiz.';

    await sendMessage(aiReply);
  }, [activeGroupId, isSending, messages, sendMessage]);

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!user?.id) return;

    setIsTyping(Boolean(value.trim()));
    setTypingUsers((prev) => ({
      ...prev,
      [user.id]: user.name || 'You',
    }));

    if (value.trim() && typingChannelRef.current) {
      void typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          userName: user.name || 'Learner',
        },
      });
    }

    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = window.setTimeout(() => {
      setIsTyping(false);
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }, 1200);
  };

  const onAttachFile = () => fileInputRef.current?.click();

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!activeGroupId || !user?.id) return;

    const filePath = `${activeGroupId}/${user.id}/${Date.now()}-${file.name}`;
    const upload = await supabase.storage.from('chat-attachments').upload(filePath, file, { upsert: false });

    if (upload.error) {
      await sendMessage(`📎 Shared file: ${file.name}`);
      toast.warning('File metadata shared, but binary upload bucket is unavailable.');
      event.target.value = '';
      return;
    }

    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
    const attachmentUrl = data.publicUrl;

    const { error } = await supabase.from('group_messages').insert({
      group_id: activeGroupId,
      sender_id: user.id,
      message_type: 'file',
      content: `📎 ${file.name}`,
      attachment_url: attachmentUrl,
    });

    if (error) {
      toast.error('Attachment upload succeeded, but chat message save failed.');
      event.target.value = '';
      return;
    }

    toast.success('Attachment shared in chat.');
    event.target.value = '';
  };

  const chatTypes: Array<{ label: string; value: ChatType | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Private', value: 'private' },
    { label: 'Room', value: 'room' },
    { label: 'Class', value: 'class' },
    { label: 'Community', value: 'community' },
  ];

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900')}>
      <AnimatedBackground />

      <main className="relative z-10 mx-auto flex h-screen max-w-7xl flex-col gap-4 p-4">
        <header
          className={cn(
            'flex items-center justify-between rounded-2xl border p-4 backdrop-blur',
            isDark ? 'border-cyan-400/30 bg-slate-900/70' : 'border-slate-300 bg-white/80',
          )}
        >
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-xl font-semibold tracking-wide">Master Minds Chat</h1>
              <p className={cn('text-sm', isDark ? 'text-cyan-200/80' : 'text-slate-600')}>
                Real-time learning communication for students, teachers, and multiplayer rooms.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setIsDark((prev) => !prev)}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Sparkles className="text-cyan-300" aria-hidden="true" />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[320px_1fr]">
          <aside
            className={cn(
              'rounded-2xl border p-3 backdrop-blur',
              isDark ? 'border-cyan-400/20 bg-slate-900/70' : 'border-slate-300 bg-white/80',
            )}
          >
            <h2 className="mb-3 text-sm font-medium uppercase">Chats</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {chatTypes.map((tab) => (
                <Button
                  key={tab.value}
                  type="button"
                  size="sm"
                  variant={activeFilter === tab.value ? 'default' : 'outline'}
                  onClick={() => setActiveFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[44vh] pr-2">
              <div className="space-y-2">
                {loadingGroups && <p className="text-sm opacity-70">Loading chats...</p>}
                {!loadingGroups && visibleGroups.length === 0 && (
                  <p className="text-sm opacity-70">No chats match this filter yet.</p>
                )}
                {visibleGroups.map((group) => {
                  const type = resolveChatType(group.group_type);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setActiveGroupId(group.id)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left transition',
                        group.id === activeGroupId
                          ? 'border-cyan-300 bg-cyan-500/20'
                          : isDark
                            ? 'border-slate-700 bg-slate-900/70 hover:border-cyan-400/40'
                            : 'border-slate-300 bg-white hover:border-cyan-400/70',
                      )}
                    >
                      <p className="font-medium">{group.name || 'Untitled Chat'}</p>
                      <Badge variant="secondary" className="mt-1 text-[10px] uppercase tracking-wide">
                        {type}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="mt-4 rounded-xl border border-emerald-400/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase">Online learners</p>
              <div className="space-y-1 text-sm">
                {onlineUsers.slice(0, 6).map((id) => (
                  <p key={id}>🟢 {profiles[id]?.name || 'Learner'}</p>
                ))}
                {!onlineUsers.length && <p className="opacity-70">No active users detected.</p>}
              </div>
            </div>
          </aside>

          <section
            className={cn(
              'flex min-h-0 flex-col rounded-2xl border p-3 backdrop-blur',
              isDark ? 'border-cyan-400/20 bg-slate-900/70' : 'border-slate-300 bg-white/80',
            )}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-500/30 pb-3">
              <div>
                <h2 className="font-semibold">{activeGroup?.name || 'Select a chat'}</h2>
                <p className="text-xs opacity-70">
                  {isLobbyChat ? 'Lobby quick-chat mode (safe presets only)' : 'Learning collaboration channel'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{onlineUsers.length} online</Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => void askAI()}>
                  <Bot className="mr-1 h-4 w-4" /> Ask AI
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-3">
                {loadingMessages && <p className="text-sm opacity-70">Loading messages...</p>}
                {!loadingMessages && messages.length === 0 && (
                  <p className="text-sm opacity-70">Start with a question, note, or class update.</p>
                )}
                {messages.map((message) => {
                  const isOwn = message.sender_id === user?.id;
                  const sender = isOwn ? 'You' : profiles[message.sender_id]?.name || 'Learner';
                  return (
                    <article key={message.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl border px-3 py-2 text-sm shadow-sm transition duration-200',
                          isOwn
                            ? 'border-cyan-300/40 bg-cyan-500/20'
                            : isDark
                              ? 'border-slate-700 bg-slate-900'
                              : 'border-slate-300 bg-white',
                        )}
                      >
                        <p className="text-xs font-medium opacity-75">{sender}</p>
                        <p>{message.content}</p>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-70">
                          <time dateTime={message.created_at}>
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                          {isOwn && <span>✓✓</span>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-1 mt-2 h-7 w-7"
                        onClick={async () => {
                          if (!user?.id) return;
                          const { error } = await supabase.from('reports').insert({
                            reporter_id: user.id,
                            reported_type: 'group_message',
                            reported_id: message.id,
                            reason: 'Chat safety report',
                            description: `Reported from group ${activeGroupId}`,
                          });

                          if (error) {
                            toast.error('Unable to submit report right now.');
                            return;
                          }
                          toast.success('Message reported. Moderators will review it.');
                        }}
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </Button>
                    </article>
                  );
                })}

                {Object.values(typingUsers).length > 0 && (
                  <p className="text-xs italic opacity-70">{Object.values(typingUsers).join(', ')} typing...</p>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="mt-3 space-y-3 border-t border-slate-500/30 pt-3">
              <div className="flex flex-wrap gap-2">
                {LEARNING_PROMPTS.map((prompt) => (
                  <Button key={prompt} type="button" size="sm" variant="outline" onClick={() => setDraft(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>

              {isLobbyChat && (
                <div className="flex flex-wrap gap-2">
                  {LOBBY_QUICK_MESSAGES.map((preset) => (
                    <Button key={preset} type="button" variant="secondary" size="sm" onClick={() => void sendMessage(preset)}>
                      {preset}
                    </Button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />
                <Button type="button" variant="outline" size="icon" onClick={onAttachFile} aria-label="Attach file">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="Emoji">
                  <Smile className="h-4 w-4" />
                </Button>
                <Input
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder={
                    isLobbyChat
                      ? 'Use quick-chat buttons for safe multiplayer communication.'
                      : 'Ask a question, share notes, or collaborate with your class...'
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={!activeGroupId || isSending || isLobbyChat}
                  aria-label="Message input"
                />
                <Button type="button" variant="outline" size="icon" aria-label="Sound notifications">
                  <Volume2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => void sendMessage()}
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  disabled={!draft.trim() || !activeGroupId || isSending || isLobbyChat}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {isTyping && <p className="text-xs opacity-70">Typing indicator active...</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Chat;
