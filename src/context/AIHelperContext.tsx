
import React, { createContext, useContext, useState, ReactNode } from 'react';

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

// Sample responses based on keywords
const getAIResponse = (message: string): Promise<string> => {
  // Convert to lowercase for easier matching
  const lowerMsg = message.toLowerCase();
  
  // Create a promise to simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // Subject-specific responses
      if (lowerMsg.includes('math') || lowerMsg.includes('mathematics')) {
        resolve("I can help with math! What specific topic are you studying? Algebra, geometry, arithmetic, or something else?");
      } 
      else if (lowerMsg.includes('science')) {
        resolve("Science is fascinating! Are you interested in biology, chemistry, physics, or another branch of science?");
      }
      else if (lowerMsg.includes('english') || lowerMsg.includes('grammar')) {
        resolve("I'd be happy to help with English! Do you need assistance with grammar, vocabulary, reading comprehension, or writing?");
      }
      // Game and quiz related responses  
      else if (lowerMsg.includes('quiz') || lowerMsg.includes('question')) {
        resolve("To practice with quizzes, go to the Quiz section from the main menu. You can filter by subject, grade level, and difficulty!");
      }
      else if (lowerMsg.includes('multiplayer') || lowerMsg.includes('friend') || lowerMsg.includes('compete')) {
        resolve("The multiplayer mode lets you challenge friends to quiz battles! Visit the Lobby to find opponents or create a custom game room.");
      }
      // General app help
      else if (lowerMsg.includes('help') || lowerMsg.includes('how to')) {
        resolve("I'm your AI helper in Master Minds! I can explain topics, guide you through the app, or assist with study questions. What would you like help with?");
      }
      else if (lowerMsg.includes('contact') || lowerMsg.includes('creator')) {
        resolve("Master Minds was created by Biniam Bogale from Ethiopia. You can contact them at +251713445505.");
      }
      // Greetings and general conversation
      else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
        resolve("Hello! I'm your AI learning assistant. How can I help you today with your studies or using the Master Minds app?");
      }
      else if (lowerMsg.includes('thank')) {
        resolve("You're welcome! Don't hesitate to ask if you have more questions. Happy learning!");
      }
      // Specific topics in subjects
      else if (lowerMsg.includes('algebra')) {
        resolve("Algebra involves using letters and symbols to represent values in equations and formulas. What specific algebra concept are you studying?");
      }
      else if (lowerMsg.includes('geometry')) {
        resolve("Geometry is all about shapes, sizes, properties of space, and measurements. What geometry problem are you working on?");
      }
      else if (lowerMsg.includes('photosynthesis')) {
        resolve("Photosynthesis is the process plants use to convert light energy into chemical energy. They take in CO2 and water and produce glucose and oxygen. Would you like more details on a specific part of this process?");
      }
      // Fallback response
      else {
        resolve("I'm here to help you learn and navigate Master Minds! Feel free to ask about specific subjects, quiz features, or how to use the app.");
      }
    }, 1000); // 1 second delay to simulate thinking
  });
};

export const AIHelperProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI learning assistant. How can I help you today with your studies or using the Master Minds app?",
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
      // Get AI response
      const response = await getAIResponse(content);
      
      // Add AI response
      addMessage(response, 'assistant');
    } catch (error) {
      // Handle error
      console.error('Error getting AI response:', error);
      addMessage("I'm sorry, I couldn't process your request. Please try again.", 'assistant');
    } finally {
      // Hide loading state
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your AI learning assistant. How can I help you today?",
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
