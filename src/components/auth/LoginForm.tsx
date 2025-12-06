import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { motion } from "framer-motion";

interface LoginFormProps {
  onSuccess: () => void;
  initialTab?: "student" | "teacher" | "admin" | "manager";
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, initialTab = "student" }) => {
  const { login } = useUser();
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "admin" | "manager">(initialTab);
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const getCredentials = () => {
    switch (activeTab) {
      case "student": return { username: "student1", password: "pass123" };
      case "teacher": return { username: "teacher1", password: "pass123" };
      case "admin": return { username: "admin1", password: "pass123" };
      case "manager": return { username: "biniam", password: "2004" };
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md w-full mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary to-purple-600 p-6 text-white text-center">
        <h1 className="text-2xl font-bold">Master Minds</h1>
        <p className="opacity-90">Learn. Challenge. Grow.</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-4 mb-6 gap-1">
          {(["student", "teacher", "admin", "manager"] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="capitalize"
            >
              {tab}
            </Button>
          ))}
        </div>
        
        <div className="text-center py-6">
          <p className="text-gray-600 mb-4">Click below to enter as {activeTab}</p>
          <p className="text-xs text-gray-400 mb-2">
            Demo: {getCredentials().username} / {getCredentials().password}
          </p>
        </div>
        
        <Button 
          onClick={() => {
            const creds = getCredentials();
            handleLogin(creds.username, creds.password);
          }}
          className="w-full bg-primary hover:bg-primary/90"
          disabled={loading}
        >
          {loading ? "Logging in..." : `Enter as ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </Button>
      </div>
    </motion.div>
  );
};

export default LoginForm;
