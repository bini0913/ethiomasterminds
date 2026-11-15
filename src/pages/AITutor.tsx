import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUser } from '@/context/UserContext';
import { getUserTier } from '@/lib/getUserTier';
import { supabase } from '@/integrations/supabase/client';
import {
  Bot, Send, Loader2, BookOpen, Calculator, Globe, Beaker, History,
  Sparkles, Mic, MicOff, Volume2, VolumeX, Lightbulb, ListChecks,
  RefreshCw, Copy, Check, Brain, MessageSquare, MoreHorizontal, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '@/components/ui/BackButton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type Subject = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

const subjects: Subject[] = [
  { id: 'math', name: 'Mathematics', icon: Calculator, tone: 'bg-[#e7f3ef] text-[#287c68]' },
  { id: 'science', name: 'Science', icon: Beaker, tone: 'bg-emerald-50 text-emerald-700' },
  { id: 'english', name: 'English', icon: BookOpen, tone: 'bg-amber-50 text-amber-700' },
  { id: 'history', name: 'History', icon: History, tone: 'bg-orange-50 text-orange-700' },
  { id: 'geography', name: 'Geography', icon: Globe, tone: 'bg-sky-50 text-sky-700' },
  { id: 'general', name: 'General', icon: Sparkles, tone: 'bg-slate-100 text-slate-600' },
];

const quickActions = [
  { label: 'Show a worked example', prompt: 'Show me a clear worked example for this topic, explaining each step.', icon: Lightbulb },
  { label: 'Give me a hint', prompt: 'Give me a hint first, without revealing the full answer.', icon: Brain },
  { label: 'Practice questions', prompt: 'Generate 3 high-yield practice questions for this topic. Hide the answers until I attempt them.', icon: ListChecks },
];

const starterPrompts: Record<string, string[]> = {
  math: ['Explain Pythagoras theorem with a story', 'Help me solve quadratic equations', 'What is calculus used for?'],
  science: ['Why is the sky blue?', 'How do vaccines work?', "Explain Newton's laws"],
  english: ['Improve this sentence: ...', 'What is a metaphor?', 'Help me write an essay intro'],
  history: ['Tell me about Ethiopian history', 'Who was Menelik II?', 'Explain World War II briefly'],
  geography: ['What causes monsoons?', 'Tallest mountains on Earth', 'How are deserts formed?'],
  general: ['Teach me something new today', 'Give me a study tip', 'Help me focus better'],
};

const AITutor: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === 'upper';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('general');
  const [conversations, setConversations] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [conversationLoadError, setConversationLoadError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const subj = subjects.find((subject) => subject.id === selectedSubject) || subjects[subjects.length - 1];
  const prompts = starterPrompts[selectedSubject] || starterPrompts.general;
  const gradeLabel = user?.grade ? `Grade ${user.grade}` : 'your learning level';
  const firstName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    if (user?.id) void loadConversations();
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const loadConversations = async () => {
    if (!user?.id) {
      setConversations([]);
      return;
    }
    setConversationLoadError(false);
    try {
      const { data, error } = await supabase
        .from('ai_tutor_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('AI Tutor conversation list load failed:', error);
      setConversationLoadError(true);
    }
  };

  const loadConversation = (conversation: any) => {
    setConversationId(conversation.id);
    setSelectedSubject(conversation.subject || 'general');
    setMessages((conversation.messages as Message[]) || []);
    setSendError(null);
    setLastFailedPrompt(null);
    textareaRef.current?.focus();
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setSendError(null);
    setLastFailedPrompt(null);
    textareaRef.current?.focus();
  };

  const speak = (text: string) => {
    if (!voiceOut || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, ''));
    utterance.rate = 1;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    const userMessage: Message = { role: 'user', content, timestamp: new Date().toISOString() };
    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setIsLoading(true);
    setSendError(null);
    setLastFailedPrompt(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: { message: content, conversationId, subject: selectedSubject },
      });
      if (error) throw error;
      if (!data?.message) throw new Error('The tutor returned an empty response. Please try again.');
      if (data.conversationId && !conversationId) setConversationId(data.conversationId);
      const assistantMessage: Message = { role: 'assistant', content: data.message, timestamp: new Date().toISOString() };
      setMessages((previous) => [...previous, assistantMessage]);
      speak(data.message);
      void loadConversations();
    } catch (error: any) {
      console.error('AI Tutor response failed:', error);
      setSendError(error?.message || 'The tutor could not respond right now.');
      setLastFailedPrompt(content);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const copyMessage = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(index);
      window.setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast.error('Could not copy this response.');
    }
  };

  return (
    <div className={cn('min-h-screen bg-[#fbfcfa] text-[#1d2b26]', upperStudent && 'tier-upper')}>
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <aside className="w-full border-b border-[#dce6e0] bg-white px-4 py-4 lg:w-[246px] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-3 lg:py-5">
          <div className="mb-5 flex items-center justify-between gap-3 px-1 lg:block">
            <div className="flex items-center gap-3">
              {!upperStudent && <BackButton />}
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f3ef] text-[#287c68]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="lg:mt-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a9891]">Study workspace</p>
                <h1 className="text-lg font-bold tracking-tight">AI Tutor</h1>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-[#61716a] lg:hidden" onClick={() => void loadConversations()} aria-label="Refresh conversations">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={startNew} className="mb-6 h-11 w-full justify-start gap-2 rounded-xl bg-[#287c68] px-4 text-white shadow-none hover:bg-[#216b5a]">
            <span className="text-lg leading-none">+</span> New conversation
          </Button>

          <div className="hidden lg:block">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a9891]">Recent</p>
              <button type="button" onClick={() => void loadConversations()} className="rounded-md p-1 text-[#8a9891] hover:bg-[#f1f5f2] hover:text-[#287c68]" aria-label="Refresh recent conversations">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {conversationLoadError && (
              <div role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p>Recent chats could not be loaded.</p>
                <button type="button" onClick={() => void loadConversations()} className="mt-2 font-bold underline">Try again</button>
              </div>
            )}
            <div className="space-y-1">
              {!conversationLoadError && conversations.length === 0 && (
                <p className="px-2 py-3 text-xs leading-5 text-[#8a9891]">Your saved conversations will appear here.</p>
              )}
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn('flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors', conversationId === conversation.id ? 'bg-[#e7f3ef] text-[#287c68]' : 'text-[#56665f] hover:bg-[#f4f7f5]')}
                  onClick={() => loadConversation(conversation)}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{conversation.title || conversation.subject || 'Study conversation'}</span>
                    <span className="mt-0.5 block text-[11px] text-[#8a9891]">{conversation.updated_at ? new Date(conversation.updated_at).toLocaleDateString() : 'Recent'}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-8 border-t border-[#edf1ee] pt-5">
              <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a9891]">Study focus</p>
              <div className="space-y-1">
                {subjects.map((subject) => {
                  const Icon = subject.icon;
                  return (
                    <button key={subject.id} type="button" onClick={() => setSelectedSubject(subject.id)} className={cn('flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors', selectedSubject === subject.id ? 'bg-[#f0f6f3] text-[#287c68]' : 'text-[#66756e] hover:bg-[#f7f9f7]')}>
                      <span className={cn('grid h-6 w-6 place-items-center rounded-lg', subject.tone)}><Icon className="h-3.5 w-3.5" /></span>
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-[calc(100vh-88px)] min-w-0 flex-1 flex-col bg-[#fbfcfa] lg:min-h-screen">
          <header className="flex min-h-[72px] items-center gap-3 border-b border-[#dce6e0] bg-white px-4 py-3 sm:px-7">
            <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#287c68] text-white shadow-[0_5px_12px_rgba(40,124,104,0.18)]')}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold sm:text-base">Selam AI Tutor</h2>
              <p className="flex items-center gap-1.5 truncate text-xs text-[#7e8d85]"><span className="h-1.5 w-1.5 rounded-full bg-[#39a67c]" /> Online · Personalised for {gradeLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={() => setVoiceOut((value) => !value)} className="text-[#66756e] hover:bg-[#f0f6f3] hover:text-[#287c68]" aria-label={voiceOut ? 'Turn voice responses off' : 'Turn voice responses on'}>
                {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowFocusMenu((value) => !value)} className="text-[#66756e] hover:bg-[#f0f6f3] hover:text-[#287c68]" aria-label="Choose study focus"><MoreHorizontal className="h-5 w-5" /></Button>
            </div>
          </header>

          {showFocusMenu && (
            <div className="border-b border-[#dce6e0] bg-white px-4 py-3 sm:px-7 lg:hidden">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a9891]">Study focus</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {subjects.map((subject) => {
                  const Icon = subject.icon;
                  return <button key={subject.id} type="button" onClick={() => { setSelectedSubject(subject.id); setShowFocusMenu(false); }} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold', selectedSubject === subject.id ? 'border-[#287c68] bg-[#e7f3ef] text-[#287c68]' : 'border-[#dce6e0] text-[#66756e]')}><Icon className="h-3.5 w-3.5" />{subject.name}</button>;
                })}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-[8%] sm:py-8">
            <div className="mx-auto max-w-[720px]">
              {messages.length === 0 ? (
                <div className="flex min-h-[52vh] flex-col items-center justify-center text-center">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#287c68] text-white shadow-[0_12px_24px_rgba(40,124,104,0.18)]">
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#287c68]">Your study companion</p>
                  <h3 className="text-2xl font-bold tracking-tight text-[#1d2b26]">Hi {firstName}. What are you working on today?</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[#7e8d85]">Ask for an explanation, paste a problem, or tell me where you are stuck. I’ll meet you at the right step.</p>
                  <div className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
                    {prompts.map((prompt) => (
                      <button key={prompt} type="button" onClick={() => void send(prompt)} className="rounded-full border border-[#cfe1da] bg-white px-3.5 py-2 text-xs font-semibold text-[#287c68] transition-colors hover:bg-[#e7f3ef]">{prompt}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((message, index) => (
                    <motion.div key={`${message.timestamp}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('mb-6 flex gap-2.5', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {message.role === 'assistant' && <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#287c68] text-white"><Sparkles className="h-3.5 w-3.5" /></div>}
                      <div className={cn('max-w-[92%] min-w-0 rounded-2xl px-4 py-3.5 text-sm leading-6 sm:max-w-[78%]', message.role === 'user' ? 'rounded-tr-sm bg-[#287c68] text-white' : 'rounded-tl-sm border border-[#e1ebe5] bg-[#f0f3f0] text-[#304139]')}>
                        {message.role === 'assistant' ? <div className="prose prose-sm max-w-none text-[#304139] prose-p:my-2 prose-p:leading-6 prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-base prose-strong:text-[#1d2b26] prose-code:rounded prose-code:bg-white/70 prose-code:px-1"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
                        <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-1.5">
                          <span className={cn('text-[10px]', message.role === 'user' ? 'text-white/65' : 'text-[#8a9891]')}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {message.role === 'assistant' && <button type="button" onClick={() => void copyMessage(message.content, index)} className="text-[#8a9891] transition-colors hover:text-[#287c68]" aria-label="Copy response">{copiedIdx === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {isLoading && (
                <div className="mb-6 flex gap-2.5">
                  <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#287c68] text-white"><Sparkles className="h-3.5 w-3.5" /></div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-[#e1ebe5] bg-[#f0f3f0] px-4 py-3 text-sm text-[#7e8d85]"><Loader2 className="h-4 w-4 animate-spin text-[#287c68]" /> Selam is thinking…</div>
                </div>
              )}

              {sendError && (
                <div role="alert" className="mb-5 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                  <span>{sendError}</span>
                  {lastFailedPrompt && <button type="button" onClick={() => void send(lastFailedPrompt)} className="inline-flex items-center gap-1 font-bold text-[#287c68] underline"><RotateCcw className="h-3.5 w-3.5" /> Retry</button>}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#dce6e0] bg-white px-4 pb-4 pt-3 sm:px-[8%] sm:pb-5">
            <div className="mx-auto max-w-[720px]">
              {messages.length > 0 && !isLoading && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return <button key={action.label} type="button" onClick={() => void send(action.prompt)} className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe1da] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#287c68] hover:bg-[#e7f3ef]"><Icon className="h-3 w-3" />{action.label}</button>;
                  })}
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-[#cbd9d1] bg-white p-2 shadow-[0_5px_20px_rgba(27,51,43,0.06)] focus-within:border-[#287c68] focus-within:ring-2 focus-within:ring-[#287c68]/10">
                <Button type="button" variant="ghost" size="icon" onClick={toggleMic} className={cn('mb-0.5 shrink-0 rounded-xl text-[#718078] hover:bg-[#e7f3ef] hover:text-[#287c68]', isListening && 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700')} aria-label={isListening ? 'Stop voice input' : 'Start voice input'}>
                  {isListening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={`Ask a question or paste a problem…`} disabled={isLoading} rows={1} className="max-h-32 min-h-[38px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0" />
                <Button type="button" onClick={() => void send()} disabled={isLoading || !input.trim()} className="mb-0.5 h-9 w-9 shrink-0 rounded-xl bg-[#287c68] p-0 text-white hover:bg-[#216b5a]" aria-label="Send message">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-center text-[11px] text-[#929c97]">Selam can make mistakes. Check important answers with your textbook.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AITutor;
