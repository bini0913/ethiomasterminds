import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import BackButton from '@/components/ui/BackButton';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';

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

const LEARNING_PROMPTS = [
  'Summarize today's science lesson in 3 bullet points.',
  'Ask for a quick quiz on algebra fundamentals.',
  'Explain one history topic like I am 12 years old.',
] as const;

const Chat: React.FC = () => {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const loadMessages = useCallback(async (groupId: string) => {
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

    setMessages(data || []);
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/');
    }
  }, [isLoading, navigate, user]);

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
    if (!activeGroupId) {
      setMessages([]);
      return;
    }

    void loadMessages(activeGroupId);
  }, [activeGroupId, loadMessages]);

  useEffect(() => {
    if (!activeGroupId) return;

    const channel = supabase
      .channel(`simple-chat-${activeGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${activeGroupId}` },
        () => {
          void loadMessages(activeGroupId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeGroupId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const sanitizedMessage = draft.trim();
    if (!user?.id || !activeGroupId || !sanitizedMessage || isSending) return;

    setIsSending(true);

    const { error } = await supabase.from('group_messages').insert({
      group_id: activeGroupId,
      sender_id: user.id,
      message_type: 'text',
      content: sanitizedMessage,
    });

    if (error) {
      toast.error('Message not sent. Please try again.');
      setIsSending(false);
      return;
    }

    setDraft('');
    setIsSending(false);
  }, [activeGroupId, draft, isSending, user?.id]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AnimatedBackground />

      <main className="relative z-10 mx-auto flex h-screen max-w-7xl flex-col gap-4 p-4">
        <header className="flex items-center justify-between rounded-2xl border border-cyan-400/30 bg-slate-900/70 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-xl font-semibold tracking-wide">Edu Chat Nexus</h1>
              <p className="text-sm text-cyan-200/80">Simple, futuristic, and focused on learning.</p>
            </div>
          </div>
          <Sparkles className="text-cyan-300" aria-hidden="true" />
        </header>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-cyan-400/20 bg-slate-900/70 p-3 backdrop-blur">
            <h2 className="mb-3 text-sm font-medium uppercase text-cyan-200">Rooms</h2>
            <ScrollArea className="h-[60vh] pr-2">
              <div className="space-y-2">
                {loadingGroups && <p className="text-sm text-slate-400">Loading rooms...</p>}
                {!loadingGroups && groups.length === 0 && (
                  <p className="text-sm text-slate-400">No rooms available yet.</p>
                )}
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroupId(group.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                      group.id === activeGroupId
                        ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100'
                        : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-400/40'
                    }`}
                    aria-pressed={group.id === activeGroupId}
                  >
                    <p className="font-medium">{group.name || 'Untitled Room'}</p>
                    <p className="text-xs uppercase opacity-70">{group.group_type}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-h-0 flex-col rounded-2xl border border-cyan-400/20 bg-slate-900/70 p-3 backdrop-blur">
            <div className="mb-3 flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div>
                <h2 className="font-semibold">{activeGroup?.name || 'Select a room'}</h2>
                <p className="text-xs text-slate-400">Educational collaboration channel</p>
              </div>
              <Bot className="text-cyan-300" aria-hidden="true" />
            </div>

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-3">
                {loadingMessages && <p className="text-sm text-slate-400">Loading messages...</p>}
                {!loadingMessages && messages.length === 0 && (
                  <p className="text-sm text-slate-400">Start the discussion with a study question.</p>
                )}
                {messages.map((message) => {
                  const isOwn = message.sender_id === user?.id;
                  return (
                    <article key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl border px-3 py-2 text-sm ${
                          isOwn
                            ? 'border-cyan-300/40 bg-cyan-500/20 text-cyan-50'
                            : 'border-slate-700 bg-slate-900 text-slate-100'
                        }`}
                      >
                        <p>{message.content}</p>
                        <time className="mt-1 block text-[11px] opacity-70" dateTime={message.created_at}>
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    </article>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="mt-3 space-y-3 border-t border-slate-700/80 pt-3">
              <div className="flex flex-wrap gap-2">
                {LEARNING_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-cyan-300/40 bg-transparent text-xs text-cyan-100 hover:bg-cyan-500/20"
                    onClick={() => setDraft(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask a question, share a concept, or help a classmate..."
                  className="border-cyan-300/30 bg-slate-950/60"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={!activeGroupId || isSending}
                  aria-label="Message input"
                />
                <Button
                  onClick={() => void sendMessage()}
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  disabled={!draft.trim() || !activeGroupId || isSending}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Chat;
