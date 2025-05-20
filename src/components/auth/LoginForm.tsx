
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/context/UserContext";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface LoginFormProps {
  onSuccess: () => void;
  initialTab?: "student" | "teacher" | "admin";
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, initialTab = "student" }) => {
  const { login } = useUser();
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "admin">(initialTab);
  
  // Student login fields
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  
  // Teacher/admin login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(studentEmail, studentPassword, "student");
      onSuccess();
    } finally {
      setLoading(false);
    }
  };
  
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(username, password, activeTab);
      onSuccess();
    } finally {
      setLoading(false);
    }
  };
  
  const handleShowCredentials = () => {
    if (activeTab === "teacher") {
      toast.info("Teacher login credentials", {
        description: (
          <div className="text-sm space-y-1">
            <p>Username: teacher1, Password: pass123</p>
            <p>Username: teacher2, Password: pass234</p>
            <p>Username: teacher3, Password: pass345</p>
          </div>
        ),
        duration: 10000,
      });
    } else if (activeTab === "admin") {
      toast.info("Admin login credentials", {
        description: (
          <div className="text-sm space-y-1">
            <p>Username: admin1, Password: admin123</p>
            <p>Username: admin2, Password: admin234</p>
            <p>Username: admin3, Password: admin345</p>
          </div>
        ),
        duration: 10000,
      });
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
      
      <Tabs 
        defaultValue={activeTab} 
        onValueChange={(value) => setActiveTab(value as "student" | "teacher" | "admin")}
        className="p-6"
      >
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="teacher">Teacher</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
        
        <TabsContent value="student">
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-email">Email</Label>
              <Input
                id="student-email"
                type="email"
                placeholder="student@example.com"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="student-password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="student-password"
                type="password"
                placeholder="••••••••"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-dark"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
            
            <div className="text-center text-sm text-gray-500 mt-4">
              Don't have an account? <a href="#" className="text-primary hover:underline">Sign up</a>
            </div>
          </form>
        </TabsContent>
        
        <TabsContent value="teacher">
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacher-username">Username</Label>
              <Input
                id="teacher-username"
                type="text"
                placeholder="teacher_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="teacher-password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="teacher-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-dark"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login as Teacher"}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full mt-2"
              onClick={handleShowCredentials}
            >
              Show Sample Credentials
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="admin">
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                type="text"
                placeholder="admin_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="admin-password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login as Admin"}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full mt-2"
              onClick={handleShowCredentials}
            >
              Show Sample Credentials
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default LoginForm;
