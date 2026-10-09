import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Bot, Send, Loader2, BookOpen, Calculator, Globe, Beaker, History,
  Sparkles, Mic, MicOff, Volume2, VolumeX, Lightbulb, ListChecks,
  RefreshCw, Copy, Check, Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const subjects = [
  { id: 'math', name: 'Mathematics', icon: Calculator, color: 'from-blue-500 to-cyan-500' },
  { id: 'science', name: 'Science', icon: Beaker, color: 'from-green-500 to-emerald-500' },
  { id: 'english', name: 'English', icon: BookOpen, color: 'from-purple-500 to-fuchsia-500' },
  { id: 'history', name: 'History', icon: History, color: 'from-amber-500 to-orange-500' },
  { id: 'geography', name: 'Geography', icon: Globe, color: 'from-teal-500 to-cyan-500' },
  { id: 'general', name: 'General', icon: Sparkles, color: 'from-pink-500 to-rose-500' },
];

const quickActions = [
  { label: 'Explain simpler', prompt: 'Explain that in simpler words, like I am 12.', icon: Lightbulb },
  { label: 'Give an example', prompt: 'Give me a real-world example.', icon: Brain },
  { label: 'Quiz me', prompt: 'Quiz me with 3 questions on what we just discussed. Wait for my answers.', icon: ListChecks },
  { label: 'Summarize', prompt: 'Summarize everything in 5 short bullet points.', icon: BookOpen },
];

const starterPrompts: Record<string, string[]> = {
  math: ['Explain Pythagoras theorem with a story', 'Help me solve quadratic equations', 'What is calculus used for?'],
  science: ['Why is the sky blue?', 'How do vaccines work?', 'Explain Newton\'s laws'],
  english: ['Improve this sentence: ...', 'What is a metaphor?', 'Help me write an essay intro'],
  history: ['Tell me about Ethiopian history', 'Who was Menelik II?', 'Explain World War II briefly'],
  geography: ['What causes monsoons?', 'Tallest mountains on Earth', 'How are deserts formed?'],
  general: ['Teach me something new today', 'Give me a study tip', 'Help me focus better'],
};

const AITutor: React.FC = () => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('general');
  const [conversations, setConversations] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { if (user?.id) loadConversations(); }, [user?.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  const speak = (text: string) => {
    if (!voiceOut || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, ''));
    u.rate = 1; u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) { toast.error('Voice input not supported'); return; }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const loadConversations = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('ai_tutor_conversations')
      .select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(15);
    setConversations(data || []);
  };

  const loadConversation = (conv: any) => {
    setConversationId(conv.id);
    setSelectedSubject(conv.subject || 'general');
    setMessages((conv.messages as Message[]) || []);
  };

  const startNew = () => { setConversationId(null); setMessages([]); inputRef.current?.focus(); };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    const userMsg: Message = { role: 'user', content, timestamp: new Date().toISOString() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: { message: content, conversationId, subject: selectedSubject },
      });
      if (error) throw error;
      if (data.conversationId && !conversationId) setConversationId(data.conversationId);
      const aiMsg: Message = { role: 'assistant', content: data.message, timestamp: new Date().toISOString() };
      setMessages(p => [...p, aiMsg]);
      speak(data.message);
      loadConversations();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to get response');
    } finally { setIsLoading(false); inputRef.current?.focus(); }
  };

  const copyMsg = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const subj = subjects.find(s => s.id === selectedSubject)!;
  const prompts = starterPrompts[selectedSubject] || starterPrompts.general;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />

      <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", subj.color)}>
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Coach <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Plus</span></h1>
              <p className="text-xs text-muted-foreground">Smart, patient, and always here for you</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setVoiceOut(v => !v)} title="Toggle voice">
              {voiceOut ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={startNew}><RefreshCw className="h-4 w-4 mr-2" />New chat</Button>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-6 px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="glass border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Subject focus</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {subjects.map(s => (
                  <Button key={s.id} variant={selectedSubject === s.id ? 'default' : 'ghost'} size="sm"
                    className="w-full justify-start" onClick={() => setSelectedSubject(s.id)}>
                    <div className={cn("w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center mr-2", s.color)}>
                      <s.icon className="h-3 w-3 text-white" />
                    </div>
                    {s.name}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Recent chats</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 max-h-72 overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                ) : conversations.map(c => (
                  <Button key={c.id} variant={conversationId === c.id ? 'secondary' : 'ghost'} size="sm"
                    className="w-full justify-start text-left h-auto py-2" onClick={() => loadConversation(c)}>
                    <div className="truncate">
                      <div className="text-xs font-medium truncate capitalize">{c.subject || 'general'}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="glass border-border/50 h-[calc(100vh-180px)] min-h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center", subj.color)}>
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Plus · {subj.name} Coach</CardTitle>
                    <p className="text-xs text-muted-foreground">Encouraging, patient, step-by-step</p>
                  </div>
                  <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />Groq powered</Badge>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}
                        className={cn("w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-xl", subj.color)}>
                        <Bot className="h-10 w-10 text-white" />
                      </motion.div>
                      <h3 className="text-xl font-bold mb-2">Hey {user?.name?.split(' ')[0] || 'there'} 👋</h3>
                      <p className="text-muted-foreground max-w-md mx-auto mb-6">
                        I'll explain anything, quiz you, give examples, and adapt to how you learn best.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                        {prompts.map(p => (
                          <Button key={p} variant="outline" size="sm" onClick={() => send(p)}
                            className="hover-scale">
                            <Sparkles className="h-3 w-3 mr-1.5 text-primary" />{p}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.map((msg, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className={cn('flex group', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 relative',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted/70 backdrop-blur rounded-tl-sm border border-border/50')}>
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-2 prose-li:my-0.5 prose-code:text-primary prose-code:bg-background/50 prose-code:px-1 prose-code:rounded prose-pre:bg-background/70">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-1.5">
                              <p className={cn('text-[10px]', msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {msg.role === 'assistant' && (
                                <button onClick={() => copyMsg(msg.content, idx)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                                  {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="bg-muted/70 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 border border-border/50">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Plus is thinking…</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {messages.length > 0 && !isLoading && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-border/30 pt-2">
                  {quickActions.map(a => (
                    <Button key={a.label} variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => send(a.prompt)}>
                      <a.icon className="h-3 w-3 mr-1" />{a.label}
                    </Button>
                  ))}
                </div>
              )}

              <div className="p-3 border-t border-border/50 bg-card/30">
                <div className="flex gap-2">
                  <Button type="button" variant={isListening ? 'default' : 'outline'} size="icon"
                    onClick={toggleMic}
                    className={cn('shrink-0', isListening && 'bg-destructive hover:bg-destructive/90 animate-pulse')}>
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={isListening ? 'Listening…' : `Ask Plus about ${subj.name.toLowerCase()}…`}
                    disabled={isLoading} className="flex-1" />
                  <Button onClick={() => send()} disabled={isLoading || !input.trim()} className="shrink-0">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITutor;
