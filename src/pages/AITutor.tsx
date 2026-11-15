import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUser } from '@/context/UserContext';
import { getUserTier } from '@/lib/getUserTier';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowUp, Bot, Check, Copy, Loader2, Mic, MicOff, MoreHorizontal,
  Plus, RefreshCw, RotateCcw, Sparkles, Volume2, VolumeX,
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

type Conversation = {
  id: string;
  updated_at?: string | null;
  messages?: unknown;
};

const starterPrompts = [
  'Explain a difficult topic step by step',
  'Help me plan a focused study session',
  'Quiz me on something I am learning',
];

const AITutor: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === 'upper';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const gradeLabel = user?.grade ? `Grade ${user.grade}` : 'your learning level';

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
    if (!user?.id) return;
    setHistoryError(false);
    try {
      const { data, error } = await supabase
        .from('ai_tutor_conversations')
        .select('id,updated_at,messages')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setConversations((data || []).map((conversation) => ({
        id: conversation.id,
        updated_at: conversation.updated_at,
        messages: conversation.messages,
      })));
    } catch (error) {
      console.error('AI Tutor conversation history failed:', error);
      setHistoryError(true);
    }
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setSendError(null);
    setLastFailedPrompt(null);
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  const openConversation = (conversation: Conversation) => {
    setConversationId(conversation.id);
    setMessages(Array.isArray(conversation.messages) ? conversation.messages as Message[] : []);
    setInput('');
    setSendError(null);
    setLastFailedPrompt(null);
    setShowHistory(false);
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
        body: { message: content, conversationId, subject: 'general' },
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
    <div className={cn('flex min-h-screen flex-col bg-white text-[#202123]', upperStudent && 'tier-upper')}>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#ececf1] bg-white/90 px-3 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {!upperStudent && <BackButton />}
          <button type="button" onClick={startNew} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#f7f7f8]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#287c68] text-white"><Sparkles className="h-4 w-4" /></span>
            <span className="truncate text-sm font-semibold">AI Tutor</span>
            <span className="hidden text-xs text-[#8e8ea0] sm:inline">· {gradeLabel}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setVoiceOut((value) => !value)} className="h-9 w-9 rounded-lg text-[#6e6e80] hover:bg-[#f7f7f8]" aria-label={voiceOut ? 'Turn voice responses off' : 'Turn voice responses on'}>
            {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowHistory((value) => !value)} className="h-9 w-9 rounded-lg text-[#6e6e80] hover:bg-[#f7f7f8]" aria-label="Show chat history"><MoreHorizontal className="h-4 w-4" /></Button>
          <Button onClick={startNew} variant="outline" size="sm" className="ml-1 hidden h-9 gap-1.5 rounded-lg border-[#d9d9e3] text-[#4a4a57] sm:inline-flex"><Plus className="h-4 w-4" /> New chat</Button>
        </div>
      </header>

      {showHistory && (
        <div className="absolute right-3 top-[60px] z-30 w-[min(360px,calc(100vw-24px))] rounded-xl border border-[#e5e5eb] bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,0.12)] sm:right-5">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-semibold text-[#565869]">Recent chats</p>
            <button type="button" onClick={() => void loadConversations()} className="rounded-md p-1.5 text-[#8e8ea0] hover:bg-[#f7f7f8]" aria-label="Refresh chat history"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          {historyError ? <div className="px-2 py-3 text-xs text-[#b45309]"><p>History could not be loaded.</p><button type="button" onClick={() => void loadConversations()} className="mt-1 font-semibold underline">Try again</button></div> : conversations.length === 0 ? <p className="px-2 py-3 text-xs text-[#8e8ea0]">No saved conversations yet.</p> : conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => openConversation(conversation)} className={cn('block w-full truncate rounded-lg px-2 py-2 text-left text-xs hover:bg-[#f7f7f8]', conversationId === conversation.id && 'bg-[#f1f7f5] text-[#287c68]')}>Study conversation<span className="ml-2 text-[10px] text-[#a0a0ad]">{conversation.updated_at ? new Date(conversation.updated_at).toLocaleDateString() : ''}</span></button>)}
        </div>
      )}

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[800px] px-4 pb-44 pt-8 sm:px-6 sm:pt-12">
          {messages.length === 0 ? (
            <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-[#287c68] text-white"><Sparkles className="h-6 w-6" /></div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#202123] sm:text-3xl">How can I help you learn?</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#6e6e80]">Ask anything, paste a problem, or continue a conversation. I’ll explain ideas clearly and work through problems with you.</p>
              <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-3">
                {starterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => void send(prompt)} className="min-h-16 rounded-xl border border-[#e5e5eb] bg-white px-3 py-3 text-left text-xs text-[#565869] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-[#b8d8ce] hover:bg-[#f8fbfa] hover:text-[#287c68]">{prompt}</button>)}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((message, index) => (
                <motion.div key={`${message.timestamp}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group mb-8 flex gap-4">
                  <div className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full', message.role === 'assistant' ? 'bg-[#287c68] text-white' : 'bg-[#ececf1] text-[#565869]')}>
                    {message.role === 'assistant' ? <Bot className="h-4 w-4" /> : <span className="text-[10px] font-bold">YOU</span>}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {message.role === 'assistant' ? <div className="prose prose-sm max-w-none text-[15px] leading-7 text-[#2d2d36] prose-p:my-2 prose-p:leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-base prose-strong:text-[#202123] prose-code:rounded prose-code:bg-[#f7f7f8] prose-code:px-1"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#202123]">{message.content}</p>}
                    <div className="mt-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <span className="text-[10px] text-[#a0a0ad]">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {message.role === 'assistant' && <button type="button" onClick={() => void copyMessage(message.content, index)} className="rounded p-1 text-[#8e8ea0] hover:bg-[#f7f7f8] hover:text-[#287c68]" aria-label="Copy response">{copiedIdx === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {isLoading && <div className="mb-8 flex gap-4"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#287c68] text-white"><Bot className="h-4 w-4" /></div><div className="flex items-center gap-2 pt-1 text-sm text-[#8e8ea0]"><Loader2 className="h-4 w-4 animate-spin text-[#287c68]" /> Thinking…</div></div>}
          {sendError && <div role="alert" className="mb-5 ml-11 flex items-center justify-between gap-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-xs text-[#9a3412]"><span>{sendError}</span>{lastFailedPrompt && <button type="button" onClick={() => void send(lastFailedPrompt)} className="inline-flex shrink-0 items-center gap-1 font-semibold underline"><RotateCcw className="h-3 w-3" /> Retry</button>}</div>}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white/95 to-transparent px-3 pb-3 pt-8 sm:px-6 sm:pb-5">
        <div className="mx-auto max-w-[800px]">
          <div className="flex items-end gap-2 rounded-2xl border border-[#d9d9e3] bg-white p-2 shadow-[0_4px_18px_rgba(0,0,0,0.08)] focus-within:border-[#287c68] focus-within:ring-2 focus-within:ring-[#287c68]/10">
            <Button type="button" variant="ghost" size="icon" onClick={toggleMic} className={cn('mb-0.5 h-9 w-9 shrink-0 rounded-xl text-[#6e6e80] hover:bg-[#f7f7f8] hover:text-[#287c68]', isListening && 'bg-red-50 text-red-600 hover:bg-red-100')} aria-label={isListening ? 'Stop voice input' : 'Start voice input'}>{isListening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}</Button>
            <Textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Message AI Tutor…" disabled={isLoading} rows={1} className="max-h-32 min-h-[38px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0" />
            <Button type="button" onClick={() => void send()} disabled={isLoading || !input.trim()} className="mb-0.5 h-9 w-9 shrink-0 rounded-xl bg-[#202123] p-0 text-white hover:bg-[#343541]" aria-label="Send message"><ArrowUp className="h-4 w-4" /></Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#8e8ea0]">AI Tutor can make mistakes. Check important answers with your textbook.</p>
        </div>
      </footer>
    </div>
  );
};

export default AITutor;
