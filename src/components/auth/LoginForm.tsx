
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
  initialTab?: "student" | "teacher" | "admin" | "manager";
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, initialTab = "student" }) => {
  const { login } = useUser();
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "admin" | "manager">(initialTab);
  
  // Student login fields
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  
  // Teacher/admin/manager login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // For now, allow login without credentials
      await login("student@demo.com", "demo123", "student");
      onSuccess();
    } finally {
      setLoading(false);
    }
  };
  
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // For now, allow login without credentials - use demo accounts
      if (activeTab === "teacher") {
        await login("teacher1", "pass123", activeTab);
      } else if (activeTab === "admin") {
        await login("admin1", "pass123", activeTab);
      } else {
        await login("biniam", "2004", activeTab);
      }
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
            <p>Username: teacher2, Password: pass123</p>
            <p>Username: teacher3, Password: pass345</p>
          </div>
        ),
        duration: 10000,
      });
    } else if (activeTab === "admin") {
      toast.info("Admin login credentials", {
        description: (
          <div className="text-sm space-y-1">
            <p>Username: admin1, Password: pass123</p>
            <p>Username: admin2, Password: pass123</p>
            <p>Username: admin3, Password: pass345</p>
          </div>
        ),
        duration: 10000,
      });
    } else if (activeTab === "manager") {
      toast.info("Manager login credentials", {
        description: (
          <div className="text-sm space-y-1">
            <p>Username: biniam, Password: 2004</p>
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
        onValueChange={(value) => setActiveTab(value as "student" | "teacher" | "admin" | "manager")}
        className="p-6"
      >
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="teacher">Teacher</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="manager">Manager</TabsTrigger>
        </TabsList>
        
        <TabsContent value="student">
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">Click below to enter as a student</p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-dark"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Enter as Student"}
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="teacher">
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">Click below to enter as a teacher</p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-dark"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Enter as Teacher"}
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="admin">
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">Click below to enter as an admin</p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Enter as Admin"}
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="manager">
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">Click below to enter as a manager</p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Enter as Manager"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default LoginForm;
