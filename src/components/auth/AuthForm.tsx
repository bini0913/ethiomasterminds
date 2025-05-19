
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, UserRole } from "@/context/UserContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, UserRound, KeyRound } from "lucide-react";

interface AuthFormProps {
  onSuccess: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const { login, signup } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState<"student" | "teacher" | "admin">("student");
  const [accessCode, setAccessCode] = useState("");
  const [username, setUsername] = useState("");

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (loginType === "student") {
        if (!validateEmail(email)) {
          toast.error("Please enter a valid email address");
          setIsLoading(false);
          return;
        }
        
        // Student login with email and password
        await login(email, password, "student");
      } else {
        // Teacher or admin login with username and password
        if (!username) {
          toast.error("Please enter a username");
          setIsLoading(false);
          return;
        }
        
        // Pass the loginType to know which credentials to check
        await login(username, password, loginType);
      }
      
      onSuccess();
      toast.success(`Welcome back, ${loginType}!`);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to login. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (!validateEmail(email)) {
        toast.error("Please enter a valid email address");
        setIsLoading(false);
        return;
      }
      
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters long");
        setIsLoading(false);
        return;
      }
      
      if (password !== confirmPassword) {
        toast.error("Passwords don't match");
        setIsLoading(false);
        return;
      }
      
      // Only students can sign up - teachers and admins use predefined credentials
      await signup(email, password, name);
      toast.success("Account created successfully!");
      onSuccess();
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="flex flex-col space-y-6 p-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Master Minds</h1>
          <p className="text-gray-500">Log in or sign up to continue</p>
          <p className="text-xs text-gray-500 mt-2">Contact: +251713445505</p>
        </div>
        
        {/* Login Type Selection */}
        <div className="mb-4">
          <Label>I am a:</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {["student", "teacher", "admin"].map((type) => (
              <Button
                key={type}
                type="button"
                variant={loginType === type ? "default" : "outline"}
                className={loginType === type ? "bg-primary hover:bg-primary-dark" : ""}
                onClick={() => setLoginType(type as "student" | "teacher" | "admin")}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue={loginType === "student" ? "login" : "login-secure"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            {loginType === "student" && <TabsTrigger value="signup">Sign Up</TabsTrigger>}
            {loginType !== "student" && <TabsTrigger value="login-secure">Secure Login</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-dark" 
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Log in"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="login-secure">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secure-username">Username</Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="secure-username"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secure-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="secure-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-dark" 
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Secure Login"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="name"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-dark" 
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default AuthForm;
