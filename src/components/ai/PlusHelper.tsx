import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bot, X, Send, Mic, MicOff, Volume2, VolumeX, 
  Sparkles, Lightbulb, BookOpen, GraduationCap 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import '@/types/speech.d.ts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type HelperMode = 'hint' | 'explain' | 'coach' | 'silent';

interface PlusHelperProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    subject?: string;
    topic?: string;
    question?: string;
    userAnswer?: string;
    correctAnswer?: string;
  };
}

const modeIcons = {
  hint: Lightbulb,
  explain: BookOpen,
  coach: GraduationCap,
  silent: VolumeX,
};

const modeLabels = {
  hint: 'Hint Only',
  explain: 'Explain',
  coach: 'Step-by-Step',
  silent: 'Silent',
};

const PlusHelper: React.FC<PlusHelperProps> = ({ isOpen, onClose, context }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi there! I'm Plus, your learning buddy! 🌟 How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<HelperMode>('explain');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast.error('Voice recognition failed. Please try again.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input not supported in this browser');
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

  const speakText = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    synthRef.current = new SpeechSynthesisUtterance(text);
    synthRef.current.rate = 0.9;
    synthRef.current.pitch = 1.1;
    
    synthRef.current.onstart = () => setIsSpeaking(true);
    synthRef.current.onend = () => setIsSpeaking(false);
    synthRef.current.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(synthRef.current);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-helper', {
        body: {
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode,
          context,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      speakText(data.response);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ duration: 0.3, type: 'spring' }}
        className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50"
      >
        <div className="glass neon-border rounded-2xl w-[95vw] sm:w-[420px] max-w-[420px] overflow-hidden flex flex-col shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary via-accent to-secondary p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative"
              >
                <div className="bg-background/20 backdrop-blur-sm rounded-full p-2">
                  <Sparkles className="h-6 w-6 text-foreground" />
                </div>
                <motion.div
                  className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <h3 className="font-display font-bold text-foreground">Plus</h3>
                <p className="text-xs text-foreground/70">Your Learning Buddy</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="h-8 w-8 text-foreground hover:bg-background/20"
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-foreground hover:bg-background/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-1 p-2 bg-card/50 border-b border-border">
            {(Object.keys(modeLabels) as HelperMode[]).map((m) => {
              const Icon = modeIcons[m];
              return (
                <Button
                  key={m}
                  variant={mode === m ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 text-xs gap-1',
                    mode === m && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {modeLabels[m]}
                </Button>
              );
            })}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 max-h-[50vh] bg-background/50">
            <div className="flex flex-col space-y-3" ref={scrollRef}>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] p-3 rounded-2xl',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card text-card-foreground rounded-tl-sm border border-border'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-[10px] opacity-60 mt-1 text-right">
                      {format(message.timestamp, 'HH:mm')}
                    </p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-card border border-border p-3 rounded-2xl rounded-tl-sm">
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Bot className="h-4 w-4 text-primary" />
                      </motion.div>
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border bg-card/50">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Button
                type="button"
                variant={isListening ? 'default' : 'outline'}
                size="icon"
                onClick={toggleListening}
                className={cn(
                  'shrink-0',
                  isListening && 'bg-destructive hover:bg-destructive/90 animate-pulse'
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Listening...' : 'Ask Plus anything...'}
                className="flex-1 bg-background"
                disabled={isListening}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="shrink-0 bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlusHelper;
