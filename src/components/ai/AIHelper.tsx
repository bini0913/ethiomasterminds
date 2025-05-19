
import React, { useState, useRef, useEffect } from 'react';
import { useAIHelper } from '@/context/AIHelperContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, X, Send, ArrowUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const AIHelper: React.FC = () => {
  const { 
    isOpen, 
    closeHelper, 
    messages, 
    sendMessage, 
    isLoading 
  } = useAIHelper();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    try {
      await sendMessage(input);
      setInput('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't send message. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50"
        >
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] sm:w-[450px] max-w-[450px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-primary p-3 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot size={20} />
                <h3 className="font-medium">AI Learning Assistant</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={closeHelper}
                className="text-white h-8 w-8 hover:bg-primary-dark hover:text-white"
              >
                <X size={18} />
              </Button>
            </div>
            
            {/* Messages */}
            <ScrollArea className="flex-1 p-3 max-h-[60vh]">
              <div className="flex flex-col space-y-3" ref={scrollRef}>
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`
                        max-w-[80%] p-3 rounded-lg 
                        ${message.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        }
                      `}
                    >
                      <div className="text-sm">{message.content}</div>
                      <div className="text-xs opacity-70 mt-1 text-right">
                        {format(message.timestamp, 'HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 p-3 rounded-lg rounded-tl-none max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Input */}
            <div className="p-3 border-t">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1"
                  ref={inputRef}
                />
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={isLoading || !input.trim()}
                  className="bg-primary hover:bg-primary-dark"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIHelper;
