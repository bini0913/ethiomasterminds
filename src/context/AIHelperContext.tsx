
import React, { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";

// Types
export type AIHelperMessage = {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
};

interface AIHelperContextType {
  isOpen: boolean;
  messages: AIHelperMessage[];
  openHelper: () => void;
  closeHelper: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
}

const AIHelperContext = createContext<AIHelperContextType | undefined>(undefined);

export const AIHelperProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<AIHelperMessage[]>([
    {
      id: "welcome",
      text: "Hi there! I'm your AI Helper. How can I assist you today with Master Minds?",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);

  const openHelper = () => {
    setIsOpen(true);
  };

  const closeHelper = () => {
    setIsOpen(false);
  };

  const sendMessage = async (message: string): Promise<void> => {
    // Add user message
    const userMessage: AIHelperMessage = {
      id: `user-${Date.now()}`,
      text: message,
      sender: "user",
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    // Enhanced AI responses
    setTimeout(() => {
      let response = "I'm here to help with Master Minds! You can ask about quizzes, subjects, multiplayer, or how to use the app.";
      
      const lowerCaseMessage = message.toLowerCase();
      
      if (lowerCaseMessage.includes("quiz") || lowerCaseMessage.includes("question")) {
        response = "Our quiz system includes subjects like Math, Science, General Knowledge, and English. Questions are arranged by grade level and difficulty. Each grade has unlimited questions that adapt to your learning progress!";
      } else if (lowerCaseMessage.includes("multiplayer") || lowerCaseMessage.includes("play with friend")) {
        response = "In multiplayer mode, you can play 1v1, 2v2, or create custom rooms. You can invite friends or auto-match with other players. Each match has a countdown timer before starting.";
      } else if (lowerCaseMessage.includes("profile") || lowerCaseMessage.includes("avatar")) {
        response = "You can customize your avatar and earn outfits and accessories through achievements. As you play and win quizzes, you'll earn XP and level up from Rookie to Master Mind!";
      } else if (lowerCaseMessage.includes("language") || lowerCaseMessage.includes("translate")) {
        response = "Master Minds supports English, Amharic, and Afaan Oromoo languages. You can switch languages anytime in the settings menu.";
      } else if (lowerCaseMessage.includes("teacher") || lowerCaseMessage.includes("admin")) {
        response = "Teachers can create quiz questions, assign quizzes to students, and view detailed progress results. Admins have full control over app content, user management, and moderation.";
      } else if (lowerCaseMessage.includes("hello") || lowerCaseMessage.includes("hi") || lowerCaseMessage.includes("hey")) {
        response = "Hello! I'm the Master Minds AI Helper. I can answer questions about the app, explain difficult quiz questions, or offer learning tips. What would you like to know?";
      } else if (lowerCaseMessage.includes("thank")) {
        response = "You're welcome! If you have more questions about Master Minds, feel free to ask!";
      } else if (lowerCaseMessage.includes("contact") || lowerCaseMessage.includes("help") || lowerCaseMessage.includes("support")) {
        response = "Need help? You can contact Master Minds support at +251713445505 or visit the Contact Us section at the bottom of the Quiz page.";
      } else if (lowerCaseMessage.includes("grade") || lowerCaseMessage.includes("level")) {
        response = "Master Minds has content for grades 1-8 with appropriate difficulty levels for each. As you progress and earn XP, you'll unlock more challenging questions!";
      } else if (lowerCaseMessage.includes("difficult") || lowerCaseMessage.includes("hard") || lowerCaseMessage.includes("easy")) {
        response = "Questions in Master Minds come in three difficulty levels: Easy, Medium, and Hard. The difficulty determines how many points and XP you can earn!";
      }
      
      const aiMessage: AIHelperMessage = {
        id: `ai-${Date.now()}`,
        text: response,
        sender: "ai",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    }, 800);
  };

  const clearMessages = () => {
    setMessages([
      {
        id: "welcome",
        text: "Hi there! I'm your AI Helper. How can I assist you today with Master Minds?",
        sender: "ai",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <AIHelperContext.Provider
      value={{
        isOpen,
        messages,
        openHelper,
        closeHelper,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </AIHelperContext.Provider>
  );
};

export const useAIHelper = () => {
  const context = useContext(AIHelperContext);
  if (context === undefined) {
    throw new Error("useAIHelper must be used within an AIHelperProvider");
  }
  return context;
};
