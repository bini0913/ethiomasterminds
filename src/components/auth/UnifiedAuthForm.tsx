import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";
import { 
  GraduationCap, 
  Users, 
  ShieldCheck, 
  Crown,
  Eye, 
  EyeOff, 
  ArrowLeft,
  Sparkles,
  Lock,
  User,
  Mail,
  AtSign
} from "lucide-react";
import AnimatedBackground from "@/components/ui/AnimatedBackground";

interface UnifiedAuthFormProps {
  onSuccess: () => void;
  onBack?: () => void;
  initialTab?: "student" | "teacher" | "admin" | "manager";
}

const UnifiedAuthForm: React.FC<UnifiedAuthFormProps> = ({ 
  onSuccess, 
  onBack,
  initialTab = "student" 
}) => {
  const { loginWithUsername, signupWithRole, isLoading: authLoading } = useUser();
  const [role, setRole] = useState<"student" | "teacher" | "admin" | "manager">(initialTab);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignup) {
      // Signup validation
      if (!name.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      if (!email.trim()) {
        toast.error("Please enter your email");
        return;
      }
      if (!username.trim()) {
        toast.error("Please enter a username");
        return;
      }
      if (username.includes(" ")) {
        toast.error("Username cannot contain spaces");
        return;
      }
      if (!password.trim()) {
        toast.error("Please enter a password");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    } else {
      // Login validation
      if (!username.trim()) {
        toast.error("Please enter your username");
        return;
      }
      if (!password.trim()) {
        toast.error("Please enter your password");
        return;
      }
    }

    setLoading(true);

    try {
      let success = false;
      
      if (isSignup) {
        success = await signupWithRole(email, password, name, username, role);
      } else {
        success = await loginWithUsername(username, password);
      }
      
      if (success) {
        onSuccess();
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roleConfig = {
    student: {
      icon: GraduationCap,
      gradient: "from-primary via-accent to-primary",
      title: "Student",
      description: "Learn, compete & earn rewards"
    },
    teacher: {
      icon: Users,
      gradient: "from-emerald-500 via-teal-500 to-emerald-500",
      title: "Teacher",
      description: "Create exams & monitor students"
    },
    admin: {
      icon: ShieldCheck,
      gradient: "from-orange-500 via-red-500 to-orange-500",
      title: "Admin",
      description: "Full system control"
    },
    manager: {
      icon: Crown,
      gradient: "from-purple-500 via-pink-500 to-purple-500",
      title: "Manager",
      description: "Organization management"
    }
  };

  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" />

      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Card */}
          <div className="glass rounded-3xl overflow-hidden border border-primary/20">
            {/* Header */}
            <div className={`bg-gradient-to-r ${config.gradient} bg-[length:200%_100%] p-6 relative overflow-hidden`}>
              {/* Animated Sparkles */}
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${20 + i * 15}%`,
                      top: `${30 + (i % 2) * 40}%`
                    }}
                    animate={{
                      opacity: [0.3, 0.8, 0.3],
                      scale: [0.8, 1.2, 0.8]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.3,
                      repeat: Infinity
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-white/50" />
                  </motion.div>
                ))}
              </div>

              <div className="relative text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl"
                >
                  <Icon className="h-10 w-10 text-white" />
                </motion.div>
                <h1 className="text-2xl font-display font-bold text-white">
                  {isSignup ? `${config.title} Sign Up` : `${config.title} Login`}
                </h1>
                <p className="text-white/80 text-sm mt-1">{config.description}</p>
              </div>
            </div>

            {/* Role Selector Tabs - Only show for signup */}
            {isSignup && (
              <div className="flex border-b border-border/50">
                {(['student', 'teacher', 'admin', 'manager'] as const).map((r) => {
                  const RoleIcon = roleConfig[r].icon;
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`flex-1 py-3 px-2 flex items-center justify-center gap-1 transition-all ${
                        role === r 
                          ? 'bg-primary/20 text-primary border-b-2 border-primary' 
                          : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <RoleIcon className="h-4 w-4" />
                      <span className="text-xs font-medium capitalize hidden sm:inline">{r}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name (signup only) */}
              <AnimatePresence mode="wait">
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="name" className="text-foreground/80 font-medium">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email (signup only) */}
              <AnimatePresence mode="wait">
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="email" className="text-foreground/80 font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email (for recovery)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground/80 font-medium">
                  Username
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={isSignup ? "Choose a username" : "Enter your username"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl"
                  />
                </div>
                {isSignup && (
                  <p className="text-xs text-muted-foreground">This will be used for login</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80 font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {isSignup && (
                  <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || authLoading}
                className={`w-full h-14 text-lg font-display font-bold bg-gradient-to-r ${config.gradient} bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 rounded-xl shadow-lg text-white`}
              >
                {loading || authLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    {isSignup ? "Create Account" : "Login"}
                  </>
                )}
              </Button>

              {/* Toggle Signup/Login */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignup(!isSignup)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 pb-6">
              <div className="text-center text-xs text-muted-foreground">
                <p>Master Minds • Created by Biniam Bogale</p>
              </div>
            </div>
          </div>

          {/* Back Button */}
          {onBack && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-center"
            >
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Welcome
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UnifiedAuthForm;
