import React, { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIHelperContextType {
  isOpen: boolean;
  openHelper: () => void;
  closeHelper: () => void;
  toggleHelper: () => void;
  messages: Message[];
  addMessage: (content: string, role: 'user' | 'assistant') => void;
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  clearMessages: () => void;
}

const AIHelperContext = createContext<AIHelperContextType | undefined>(undefined);

export const AIHelperProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Plus, your AI learning assistant. 🎓 How can I help you today with your studies or using Master Minds?",
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const openHelper = () => setIsOpen(true);
  const closeHelper = () => setIsOpen(false);
  const toggleHelper = () => setIsOpen(!isOpen);

  const addMessage = (content: string, role: 'user' | 'assistant') => {
    setMessages(prev => [
      ...prev,
      { role, content, timestamp: new Date() }
    ]);
  };

  const sendMessage = async (content: string) => {
    // Add user message
    addMessage(content, 'user');
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // Call the ai-helper edge function
      const { data, error } = await supabase.functions.invoke('ai-helper', {
        body: {
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content }
          ],
          mode: 'explain'
        }
      });

      if (error) {
        console.error('AI Helper error:', error);
        addMessage("I'm sorry, I couldn't process your request. Please try again.", 'assistant');
        return;
      }

      // Add AI response
      addMessage(data.response || "I'm sorry, I couldn't process your request. Please try again.", 'assistant');
    } catch (error) {
      console.error('Error getting AI response:', error);
      addMessage("I'm sorry, I couldn't process your request. Please try again.", 'assistant');
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm Plus, your AI learning assistant. 🎓 How can I help you today?",
        timestamp: new Date()
      }
    ]);
  };

  const value = {
    isOpen,
    openHelper,
    closeHelper,
    toggleHelper,
    messages,
    addMessage,
    sendMessage,
    isLoading,
    clearMessages
  };

  return <AIHelperContext.Provider value={value}>{children}</AIHelperContext.Provider>;
};

export const useAIHelper = (): AIHelperContextType => {
  const context = useContext(AIHelperContext);
  if (context === undefined) {
    throw new Error('useAIHelper must be used within an AIHelperProvider');
  }
  return context;
};
