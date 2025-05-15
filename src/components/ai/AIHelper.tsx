
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { X, Send, Bot } from "lucide-react";
import { useAIHelper, AIHelperMessage } from "@/context/AIHelperContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const AIHelper: React.FC = () => {
  const { isOpen, messages, openHelper, closeHelper, sendMessage } = useAIHelper();
  const [userInput, setUserInput] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInput.trim()) {
      sendMessage(userInput);
      setUserInput("");
    }
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <>
      {/* AI Helper Button */}
      {!isOpen && (
        <Button
          onClick={openHelper}
          className="fixed bottom-4 right-4 h-14 w-14 rounded-full bg-primary shadow-lg"
        >
          <Bot className="h-6 w-6 text-white" />
        </Button>
      )}
      
      {/* AI Helper Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 w-96 z-50"
          >
            <Card className="border shadow-lg">
              <CardHeader className="bg-primary text-white py-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    AI Helper
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={closeHelper} className="h-8 w-8 text-white hover:bg-primary-dark">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-80 overflow-y-auto p-4 space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex flex-col max-w-[80%] mb-2",
                        message.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm",
                          message.sender === "user"
                            ? "bg-primary text-white"
                            : "bg-gray-100"
                        )}
                      >
                        {message.text}
                      </div>
                      <span className="text-xs text-gray-500 mt-1">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
              <CardFooter className="border-t p-2">
                <form onSubmit={handleSubmit} className="flex w-full gap-2">
                  <Input
                    placeholder="Ask a question..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIHelper;
