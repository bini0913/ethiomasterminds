import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/context/UserContext";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

interface LoginFormProps {
  onSuccess: () => void;
  initialTab?: "student" | "teacher" | "admin" | "manager";
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, initialTab = "student" }) => {
  const { login, isLoading } = useUser();
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "admin" | "manager">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md w-full mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-[#0A1526] p-6 text-white text-center">
        <img src="/brand/master-minds-icon.svg" alt="Master Minds" className="mx-auto mb-3 h-16 w-16 rounded-2xl" />
        <h1 className="text-2xl font-bold">Master Minds</h1>
        <p className="text-white/70">Learn. Challenge. Grow.</p>
      </div>
      
      <form onSubmit={handleLogin} className="p-6 space-y-4">
        <div className="grid grid-cols-4 mb-6 gap-1">
          {(["student", "teacher", "admin", "manager"] as const).map((tab) => (
            <Button
              key={tab}
              type="button"
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="capitalize"
            >
              {tab}
            </Button>
          ))}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        <Button 
          type="submit"
          className="w-full bg-primary hover:bg-primary/90"
          disabled={loading || isLoading}
        >
          {loading || isLoading ? "Logging in..." : `Login as ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </Button>
      </form>
    </motion.div>
  );
};

export default LoginForm;
