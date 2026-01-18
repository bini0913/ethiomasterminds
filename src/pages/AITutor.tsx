import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bot, Send, Loader2, BookOpen, Calculator, Globe, 
  Beaker, History, Music, Sparkles, ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import type { Json } from '@/integrations/supabase/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const subjects = [
  { id: 'math', name: 'Mathematics', icon: Calculator, color: 'bg-blue-500' },
  { id: 'science', name: 'Science', icon: Beaker, color: 'bg-green-500' },
  { id: 'english', name: 'English', icon: BookOpen, color: 'bg-purple-500' },
  { id: 'history', name: 'History', icon: History, color: 'bg-amber-500' },
  { id: 'geography', name: 'Geography', icon: Globe, color: 'bg-teal-500' },
  { id: 'general', name: 'General', icon: Sparkles, color: 'bg-pink-500' },
];

const AITutor: React.FC = () => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('general');
  const [conversations, setConversations] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversations = async () => {
    if (!user?.id) return;
    
    const { data } = await supabase
      .from('ai_tutor_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10);

    setConversations(data || []);
  };

  const loadConversation = (conv: any) => {
    setConversationId(conv.id);
    setSelectedSubject(conv.subject || 'general');
    const msgs = conv.messages as Message[];
    setMessages(msgs || []);
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: {
          message: userMessage.content,
          conversationId,
          subject: selectedSubject,
        },
      });

      if (error) throw error;

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      loadConversations();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AI Tutor</h1>
              <p className="text-sm text-muted-foreground">Your 24/7 learning companion</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={startNewConversation}>
            New Chat
          </Button>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-6 px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Previous Conversations */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="glass border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Subject</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {subjects.map((subject) => (
                  <Button
                    key={subject.id}
                    variant={selectedSubject === subject.id ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedSubject(subject.id)}
                  >
                    <div className={`w-6 h-6 rounded-md ${subject.color} flex items-center justify-center mr-2`}>
                      <subject.icon className="h-3 w-3 text-white" />
                    </div>
                    {subject.name}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recent Chats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <Button
                      key={conv.id}
                      variant={conversationId === conv.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => loadConversation(conv)}
                    >
                      <span className="truncate">
                        {conv.subject || 'General'} - {new Date(conv.updated_at).toLocaleDateString()}
                      </span>
                    </Button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="glass border-border/50 h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Master Mind AI</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Ask me anything about {subjects.find(s => s.id === selectedSubject)?.name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Powered
                  </Badge>
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Hi! I'm your AI Tutor 👋</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        I'm here to help you learn. Ask me any question about your studies, 
                        and I'll explain it in a way that's easy to understand.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {['Explain photosynthesis', 'Help with algebra', 'What is gravity?'].map((prompt) => (
                          <Button
                            key={prompt}
                            variant="outline"
                            size="sm"
                            onClick={() => setInput(prompt)}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border/50">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
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
