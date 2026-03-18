import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const { t } = useLanguage();
  const [role, setRole] = useState<"student" | "teacher" | "admin" | "manager">(initialTab);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/",
        },
      });
      
      if (error) {
        toast.error(t("google-signin-failed") + ": " + error.message);
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      toast.error(t("google-signin-failed"));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignup) {
      if (!name.trim()) { toast.error(t("please-enter-name")); return; }
      if (!email.trim()) { toast.error(t("please-enter-email")); return; }
      if (!username.trim()) { toast.error(t("please-enter-username")); return; }
      if (username.includes(" ")) { toast.error(t("username-no-spaces")); return; }
      if (!password.trim()) { toast.error(t("please-enter-password")); return; }
      if (password.length < 6) { toast.error(t("password-min-length")); return; }
    } else {
      if (!username.trim()) { toast.error(t("please-enter-username")); return; }
      if (!password.trim()) { toast.error(t("please-enter-password")); return; }
    }

    setLoading(true);

    try {
      let success = false;
      if (isSignup) {
        success = await signupWithRole(email, password, name, username, role);
      } else {
        success = await loginWithUsername(username, password);
      }
      if (success) { onSuccess(); }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(t("auth-failed"));
    } finally {
      setLoading(false);
    }
  };

  const roleConfig = {
    student: {
      icon: GraduationCap,
      gradient: "from-primary via-accent to-primary",
      title: t("student"),
      description: t("student-desc")
    },
    teacher: {
      icon: Users,
      gradient: "from-emerald-500 via-teal-500 to-emerald-500",
      title: t("teacher"),
      description: t("teacher-desc")
    },
    admin: {
      icon: ShieldCheck,
      gradient: "from-orange-500 via-red-500 to-orange-500",
      title: t("admin"),
      description: t("admin-desc")
    },
    manager: {
      icon: Crown,
      gradient: "from-purple-500 via-pink-500 to-purple-500",
      title: t("manager"),
      description: t("manager-desc")
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
          <div className="glass rounded-3xl overflow-hidden border border-primary/20">
            {/* Header */}
            <div className={`bg-gradient-to-r ${config.gradient} bg-[length:200%_100%] p-6 relative overflow-hidden`}>
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{ left: `${20 + i * 15}%`, top: `${30 + (i % 2) * 40}%` }}
                    animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
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
                  {isSignup ? `${config.title} ${t("signup")}` : `${config.title} ${t("login")}`}
                </h1>
                <p className="text-white/80 text-sm mt-1">{config.description}</p>
              </div>
            </div>

            {/* Role Selector Tabs */}
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
                      <span className="text-xs font-medium hidden sm:inline">{t(r)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <AnimatePresence mode="wait">
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="name" className="text-foreground/80 font-medium">{t("full-name")}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input id="name" type="text" placeholder={t("enter-full-name")} value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="email" className="text-foreground/80 font-medium">{t("email")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input id="email" type="email" placeholder={t("enter-email")} value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground/80 font-medium">{t("username")}</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input id="username" type="text" placeholder={isSignup ? t("choose-username") : t("enter-username")} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} className="pl-10 h-12 bg-muted/50 border-border/50 rounded-xl" />
                </div>
                {isSignup && <p className="text-xs text-muted-foreground">{t("username-for-login")}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80 font-medium">{t("password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder={t("enter-password")} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 rounded-xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {isSignup && <p className="text-xs text-muted-foreground">{t("min-6-chars")}</p>}
              </div>

              <Button type="submit" disabled={loading || authLoading} className={`w-full h-14 text-lg font-display font-bold bg-gradient-to-r ${config.gradient} bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 rounded-xl shadow-lg text-white`}>
                {loading || authLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    {isSignup ? t("create-account") : t("login")}
                  </>
                )}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t("or-continue-with")}</span>
                </div>
              </div>

              <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={googleLoading || loading || authLoading} className="w-full h-12 rounded-xl border-border/50 hover:bg-muted/50">
                {googleLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full" />
                ) : (
                  <>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t("sign-in-google")}
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <button type="button" onClick={() => setIsSignup(!isSignup)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {isSignup ? t("already-have-account") : t("no-account")}
                </button>
              </div>
            </form>

            <div className="px-6 pb-6">
              <div className="text-center text-xs text-muted-foreground">
                <p>Master Minds • {t("created-by")} Biniam Bogale</p>
              </div>
            </div>
          </div>

          {onBack && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4 text-center">
              <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("back-to-welcome")}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UnifiedAuthForm;
