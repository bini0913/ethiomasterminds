
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import { motion } from "framer-motion";

interface AuthFormProps {
  onSuccess: () => void;
  initialTab?: "student" | "teacher" | "admin";
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, initialTab }) => {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  
  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Tabs defaultValue={authMode} onValueChange={(value) => setAuthMode(value as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm onSuccess={onSuccess} initialTab={initialTab} />
          </TabsContent>
          <TabsContent value="signup">
            <SignupForm onSuccess={onSuccess} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default AuthForm;
