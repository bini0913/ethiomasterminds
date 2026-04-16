import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { 
  GraduationCap, 
  Users, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  Sparkles,
  Lock,
  User,
  Mail
} from "lucide-react";
import AnimatedBackground from "@/components/ui/AnimatedBackground";

interface AuthFormProps {
  onSuccess: () => void;
  initialTab?: "student" | "teacher" | "admin" | "manager";
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, initialTab = "student" }) => {
  const { login, signup, isLoading: authLoading } = useUser();
  const [role, setRole] = useState<"student" | "teacher" | "admin">(
    initialTab === "manager" ? "admin" : initialTab
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      return;
    }

    if (isSignup && !name.trim()) {
      return;
    }

    setLoading(true);

    try {
      let success = false;
      
      if (isSignup) {
        success = await signup(email, password, name);
      } else {
        success = await login(email, password);
      }
      
      if (success) {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const roleConfig = {
    student: {
      icon: GraduationCap,
      gradient: "from-primary via-accent to-primary",
      title: "Student Login",
      description: "Learn, compete & earn rewards"
    },
    teacher: {
      icon: Users,
      gradient: "from-secondary via-glow-cyan to-secondary",
      title: "Teacher Login",
      description: "Create exams & monitor students"
    },
    admin: {
      icon: ShieldCheck,
      gradient: "from-accent via-glow-pink to-accent",
      title: "Admin Login",
      description: "Full system control"
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
                  {isSignup ? "Create Account" : config.title}
                </h1>
                <p className="text-white/80 text-sm mt-1">{config.description}</p>
              </div>
            </div>

            {/* Role Selector Tabs */}
            {!isSignup ? (
              <div className="flex border-b border-border/50">
                {(['student', 'teacher', 'admin'] as const).map((r) => {
                  const RoleIcon = roleConfig[r].icon;
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
                        role === r 
                          ? 'bg-primary/20 text-primary border-b-2 border-primary' 
                          : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <RoleIcon className="h-4 w-4" />
                      <span className="text-sm font-medium capitalize hidden sm:inline">{r}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border-b border-border/50 px-4 py-3 text-center">
                <p className="text-sm font-medium text-foreground">Student Sign Up</p>
                <p className="text-xs text-muted-foreground">Only student accounts can be created.</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                        className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl focus:border-primary focus:ring-primary"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80 font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl focus:border-primary focus:ring-primary"
                  />
                </div>
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
                    className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 rounded-xl focus:border-primary focus:ring-primary"
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
                  <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || authLoading}
                className={`w-full h-14 text-lg font-display font-bold bg-gradient-to-r ${config.gradient} bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 rounded-xl shadow-lg`}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center"
          >
            <Button
              variant="ghost"
              onClick={() => window.location.reload()}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Welcome
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthForm;
