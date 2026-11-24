import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/safeStorage";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import AvatarCreator from "@/components/profile/AvatarCreator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ArrowRight, AtSign, BookOpen, Check, CheckCircle2, Crown,
  Eye, EyeOff, GraduationCap, Loader2, Lock, ShieldCheck, Sparkles,
  Target, Trophy, Users, User, X, Clock3,
} from "lucide-react";
import type { UserTier } from "@/lib/getUserTier";

interface UnifiedAuthFormProps {
  onSuccess: () => void;
  onBack?: () => void;
  initialTab?: "student" | "teacher" | "admin" | "manager";
  initialMode?: "signin" | "signup";
}

type Role = "student" | "teacher" | "admin" | "manager" | "parent_view" | "finance";
type SignupStep = 1 | 2 | 3 | 4;
type LearningGoal = { id: string; title: string; minutes: number; xp: number; description: string };
const goals: LearningGoal[] = [
  { id: "casual", title: "Casual", minutes: 10, xp: 50, description: "A relaxed start, one day at a time." },
  { id: "regular", title: "Regular", minutes: 20, xp: 120, description: "A steady rhythm for real progress." },
  { id: "serious", title: "Serious", minutes: 35, xp: 250, description: "More practice, stronger mastery." },
  { id: "intense", title: "Exam prep", minutes: 50, xp: 400, description: "A focused goal for ambitious study days." },
];
const tiers: { id: UserTier; title: string; grades: string; description: string; icon: React.ElementType; accent: string }[] = [
  { id: "early", title: "Early Explorers", grades: "KG – Grade 4", description: "Games, stories, phonics and joyful discovery.", icon: Sparkles, accent: "from-amber-300 to-orange-400" },
  { id: "middle", title: "Middle Champions", grades: "Grades 5 – 8", description: "Curriculum practice, XP leagues and multiplayer.", icon: Trophy, accent: "from-emerald-300 to-teal-500" },
  { id: "upper", title: "Academic Studio", grades: "Grades 9 – 12", description: "Exam preparation, study tools and focused revision.", icon: Target, accent: "from-cyan-300 to-blue-600" },
];
const gradeByTier: Record<UserTier, string[]> = {
  early: ["K", "Grade 1", "Grade 2", "Grade 3", "Grade 4"],
  middle: ["Grade 5", "Grade 6", "Grade 7", "Grade 8"],
  upper: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
};
const passwordScore = (value: string) =>
  [value.length >= 8, /[A-Z]/.test(value), /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;

const UnifiedAuthForm: React.FC<UnifiedAuthFormProps> = ({
  onSuccess, onBack, initialTab = "student", initialMode = "signin",
}) => {
  const { loginWithUsername, signupWithRole, isLoading: authLoading } = useUser();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(initialTab);
  const [isSignup, setIsSignup] = useState(initialMode === "signup");
  const [step, setStep] = useState<SignupStep>(1);
  const [tier, setTier] = useState<UserTier | null>(null);
  const [grade, setGrade] = useState("");
  const [academicStream, setAcademicStream] = useState<"Natural Science" | "Social Science" | "">("");
  const [goalId, setGoalId] = useState("regular");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [avatar, setAvatar] = useState("avatar-1");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const goal = useMemo(() => goals.find((item) => item.id === goalId) ?? goals[1], [goalId]);
  const score = passwordScore(password);
  const selectedTier = tiers.find((item) => item.id === tier);

  // Debounced username availability feedback while the learner types.
  useEffect(() => {
    if (!isSignup || step !== 4) return;
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      setUsernameStatus("idle");
      return;
    }
    let active = true;
    setUsernameStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("username-auth", {
          body: { action: "availability", username: normalized },
        });
        if (!active) return;
        setUsernameStatus(error || typeof data?.available !== "boolean" ? "idle" : data.available ? "available" : "taken");
      } catch (error) {
        if (!active) return;
        console.warn("Username availability check failed:", error);
        setUsernameStatus("idle");
      }
    }, 450);
    return () => { active = false; window.clearTimeout(timer); };
  }, [username, isSignup, step]);

  const resetSignup = () => { setStep(1); setTier(null); setGrade(""); setUsernameStatus("idle"); };
  const switchMode = (signup: boolean) => { setIsSignup(signup); setRole("student"); resetSignup(); };
  const backStep = () => {
    if (step === 1) { onBack?.(); return; }
    setStep((current) => (current - 1) as SignupStep);
  };

  const checkUsername = async () => {
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      toast.error("Use 3–20 letters, numbers or underscores for your username.");
      return false;
    }
    setUsernameStatus("checking");
    try {
      const { data, error } = await supabase.functions.invoke("username-auth", {
        body: { action: "availability", username: normalized },
      });
      if (error || typeof data?.available !== "boolean") {
        setUsernameStatus("idle");
        toast.error("We couldn't check that username. Please try again.");
        return false;
      }
      if (!data.available) {
        setUsernameStatus("taken");
        toast.error("That username is already taken.");
        return false;
      }
      setUsernameStatus("available");
      return true;
    } catch (error) {
      console.error("Username availability check failed:", error);
      setUsernameStatus("idle");
      toast.error("We couldn't check that username. Please try again.");
      return false;
    }
  };

  const submitSignup = async () => {
    if (!name.trim() || !username.trim() || !email.trim() || !password || !grade || !tier || !gender) {
      toast.error("Please complete the required profile fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address. Supabase uses it for account authentication and recovery.");
      setStep(4);
      return;
    }
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 3 || parsedAge > 120) {
      toast.error("Enter a valid age.");
      return;
    }
    if (parsedAge < 18 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
      toast.error("Learners under 18 need a valid parent or guardian email. Social features remain locked until it is verified.");
      setStep(4);
      return;
    }
    if (password.length < 8 || score < 3) {
      toast.error("Use at least 8 characters and a mix of letters, numbers or symbols.");
      return;
    }
    setLoading(true);
    try {
      const profile = await signupWithRole(
        email.trim(), password, name.trim(), username.trim().toLowerCase(), "student", grade,
        { age: parsedAge, gender, avatar, guardianEmail: parsedAge < 18 ? guardianEmail.trim().toLowerCase() : undefined, learningGoal: { id: goal.id, minutes: goal.minutes, xp: goal.xp }, academicStream: academicStream || undefined },
      );
      if (profile) {
        safeStorage.setItem("masterminds_learning_goal", JSON.stringify({ id: goal.id, minutes: goal.minutes, xp: goal.xp, academicStream: academicStream || null }));
        toast.success("Your Master Minds learning journey is ready!");
        onSuccess();
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("We couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 1) {
      if (!tier) { toast.error("Choose the learning stage that matches your grade."); return; }
      setStep(2); return;
    }
    if (step === 2) {
      if (!grade) { toast.error("Choose your current grade."); return; }
      if ((grade === "Grade 11" || grade === "Grade 12") && !academicStream) { toast.error("Choose your academic stream."); return; }
      setStep(3); return;
    }
    if (step === 3) { setStep(4); return; }
    if (!name.trim() || !age || !gender || !email.trim() || !username.trim() || !password) {
      toast.error("Complete the profile details to create your account."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address."); return;
    }
    if (!Number.isInteger(Number(age)) || Number(age) < 3 || Number(age) > 120) {
      toast.error("Enter a valid age."); return;
    }
    if (Number(age) < 18 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
      toast.error("Learners under 18 need a valid parent or guardian email. Social features remain locked until it is verified."); return;
    }
    if (password.length < 8 || score < 3) {
      toast.error("Choose a stronger password (8+ characters)."); return;
    }
    if (!(await checkUsername())) return;
    await submitSignup();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password."); return;
    }
    setLoading(true);
    try {
      const profile = await loginWithUsername(username, password);
      if (!profile) return;
      if (role === "parent_view") {
        safeStorage.setItem("masterminds_login_mode", "parent");
        await supabase.from("profiles").update({ login_mode: "parent" } as any).eq("id", profile.id);
        navigate("/parent-dashboard", { replace: true });
        return;
      }
      safeStorage.removeItem("masterminds_login_mode");
      switch (profile.role) {
        case "extreme_admin": navigate("/root-control-portal-9xA7", { replace: true }); break;
        case "admin": navigate("/admin", { replace: true }); break;
        case "manager": navigate("/school/manager", { replace: true }); break;
        case "teacher": navigate("/teacher", { replace: true }); break;
        case "finance": navigate("/finance", { replace: true }); break;
        default: navigate("/", { replace: true }); onSuccess();
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(t("auth-failed"));
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/" },
      });
      if (error) toast.error(error.message);
    } catch (error) {
      console.error("Google sign in error:", error);
      toast.error(t("google-signin-failed"));
    } finally { setGoogleLoading(false); }
  };

  const handleForgotPassword = async () => {
    const recoveryEmail = window.prompt("Enter the email address linked to your Master Minds account:");
    if (!recoveryEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
      redirectTo: window.location.origin + "/",
    });
    if (error) toast.error(error.message);
    else toast.success("If that email is registered, a password recovery link will be sent.");
  };

  const roleOptions: { id: Role; label: string; icon: React.ElementType }[] = [
    { id: "student", label: "Student", icon: GraduationCap },
    { id: "teacher", label: "Teacher", icon: Users },
    { id: "parent_view", label: "Parent", icon: User },
    { id: "admin", label: "Admin", icon: ShieldCheck },
    { id: "manager", label: "Staff", icon: Crown },
    { id: "finance", label: "Finance", icon: Lock },
  ];

  const prompts: Record<SignupStep, string> = {
    1: "Hi! Which stage are you in right now?",
    2: tier === "upper" ? "Great choice. What grade are you in?" : "Nice! Which grade are you in?",
    3: "How much time can you study each day?",
    4: "Last step — let's create your profile!",
  };
  const streamNeeded = grade === "Grade 11" || grade === "Grade 12";
  const canContinue = step === 1 ? !!tier : step === 2 ? !!grade && (!streamNeeded || !!academicStream) : true;
  const fade = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.18 } };

  const Guide = ({ text }: { text: string }) => (
    <div className="mb-6 flex items-center gap-4">
      <img src="/brand/master-minds-icon.svg" alt="" className="h-16 w-16 shrink-0 rounded-2xl sm:h-20 sm:w-20" />
      <p className="mm-bubble">{text}</p>
    </div>
  );

  return (
    <main className="flex min-h-[100svh] flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-4 pt-4 sm:pt-8">
        <button
          type="button"
          onClick={isSignup ? backStep : onBack}
          aria-label={isSignup ? "Previous step" : "Back to welcome"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted"
        >
          {isSignup && step > 1 ? <ArrowLeft className="h-6 w-6" /> : <X className="h-6 w-6" />}
        </button>
        {isSignup ? (
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
            <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${step * 25}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
          </div>
        ) : (
          <h1 className="flex-1 text-center text-lg font-extrabold text-muted-foreground">Sign in</h1>
        )}
        <span className="h-10 w-10 shrink-0" />
      </header>

      <form onSubmit={isSignup ? handleNext : handleLogin} className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="flex-1 px-5 pb-6 pt-6 sm:pt-10">
          <AnimatePresence mode="wait">
            {isSignup && step === 1 && (
              <motion.div key="s1" {...fade}>
                <Guide text={prompts[1]} />
                <div className="space-y-3">
                  {tiers.map(({ id, title, grades: gradeLabel, description, icon: Icon }) => (
                    <button key={id} type="button" aria-pressed={tier === id} onClick={() => { setTier(id); setGrade(""); setAcademicStream(""); }} className="mm-option">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="h-6 w-6" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="mm-option-title block text-[16px] font-extrabold">{title}</span>
                        <span className="block text-sm text-muted-foreground">{gradeLabel} · {description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {isSignup && step === 2 && tier && (
              <motion.div key="s2" {...fade}>
                <Guide text={prompts[2]} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gradeByTier[tier].map((item) => (
                    <button key={item} type="button" aria-pressed={grade === item} onClick={() => { setGrade(item); if (item !== "Grade 11" && item !== "Grade 12") setAcademicStream(""); }} className="mm-option justify-center py-5">
                      <span className="mm-option-title text-[16px] font-extrabold">{item === "K" ? "KG" : item}</span>
                    </button>
                  ))}
                </div>
                {streamNeeded && (
                  <div className="mt-8">
                    <p className="mb-3 text-[15px] font-extrabold">Which stream are you in?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["Natural Science", "Social Science"] as const).map((item) => (
                        <button key={item} type="button" aria-pressed={academicStream === item} onClick={() => setAcademicStream(item)} className="mm-option justify-center py-4">
                          <span className="mm-option-title text-[15px] font-extrabold">{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {isSignup && step === 3 && (
              <motion.div key="s3" {...fade}>
                <Guide text={prompts[3]} />
                <div className="overflow-hidden rounded-2xl border-2 border-border">
                  {goals.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={goalId === item.id}
                      onClick={() => setGoalId(item.id)}
                      className={`flex w-full items-center justify-between px-5 py-4 text-left transition-colors ${index > 0 ? "border-t-2 border-border" : ""} ${goalId === item.id ? "bg-primary/10" : "bg-card hover:bg-muted"}`}
                    >
                      <span className={`text-[16px] font-extrabold ${goalId === item.id ? "text-primary" : ""}`}>{item.minutes} min / day</span>
                      <span className={`text-sm font-bold ${goalId === item.id ? "text-primary" : "text-muted-foreground"}`}>{item.title}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">Daily target: <span className="font-bold text-foreground">{goal.xp} XP</span> · you can change this later.</p>
              </motion.div>
            )}

            {isSignup && step === 4 && (
              <motion.div key="s4" {...fade} className="space-y-4">
                <Guide text={prompts[4]} />
                <AvatarCreator onSelect={setAvatar} selectedAvatar={avatar} />
                <input aria-label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mm-field" />
                <div>
                  <input aria-label="Username" autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)); setUsernameStatus("idle"); }} placeholder="Username" className="mm-field" />
                  <p className="mt-1.5 px-1 text-xs font-semibold">
                    {usernameStatus === "checking" ? <span className="text-muted-foreground">Checking…</span>
                      : usernameStatus === "available" ? <span className="text-success">Username is available</span>
                      : usernameStatus === "taken" ? <span className="text-destructive">That username is taken</span>
                      : <span className="text-muted-foreground">3–20 letters, numbers or _</span>}
                  </p>
                </div>
                <input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (for account recovery)" className="mm-field" />
                <div className="grid grid-cols-2 gap-3">
                  <input aria-label="Age" type="number" min="3" max="120" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="mm-field" />
                  <select aria-label="Gender" value={gender} onChange={(e) => setGender(e.target.value as "male" | "female" | "")} className="mm-field">
                    <option value="">Gender</option><option value="male">Male</option><option value="female">Female</option>
                  </select>
                </div>
                {Number(age) > 0 && Number(age) < 18 && (
                  <div className="space-y-3 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
                    <div>
                      <p className="text-sm font-extrabold text-foreground">Guardian consent required</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">Learners under 18 need a guardian email and permission before an account can be created.</p>
                    </div>
                    <input aria-label="Guardian email" type="email" autoComplete="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="Parent or guardian email" className="mm-field" />
                    <label className="flex items-start gap-3 text-xs font-semibold text-foreground">
                      <input type="checkbox" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                      <span>I confirm that my parent or legal guardian has given permission for this account.</span>
                    </label>
                  </div>
                )}
                <div>
                  <div className="relative">
                    <input aria-label="Password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mm-field pr-12" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                  </div>
                  {password && <div className="mt-2 grid grid-cols-5 gap-1 px-1">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-1.5 rounded-full ${i < score ? "bg-success" : "bg-muted"}`} />)}</div>}
                </div>
              </motion.div>
            )}

            {!isSignup && (
              <motion.div key="login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Account type">
                  {roleOptions.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setRole(id)} aria-pressed={role === id} className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition ${role === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      <Icon className="h-4 w-4" />{label}
                    </button>
                  ))}
                </div>
                <div className="overflow-hidden rounded-2xl border-2 border-border bg-muted/60">
                  <input aria-label="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="Username" className="h-[56px] w-full bg-transparent px-4 text-[15px] font-medium outline-none" />
                  <div className="relative border-t-2 border-border">
                    <input aria-label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="h-[56px] w-full bg-transparent px-4 pr-24 text-[15px] font-medium outline-none" />
                    <button type="button" onClick={handleForgotPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground hover:text-primary">Forgot?</button>
                  </div>
                </div>
                <button type="submit" disabled={loading || authLoading} className="mm-btn">
                  {loading || authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
                </button>
                <div className="flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground"><span className="h-0.5 flex-1 bg-border" />or<span className="h-0.5 flex-1 bg-border" /></div>
                <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading || loading} className="mm-btn-outline">
                  {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue with Google"}
                </button>
                <p className="pt-2 text-center text-sm text-muted-foreground">
                  New here? <button type="button" onClick={() => switchMode(true)} className="font-extrabold text-primary">Create a student account</button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isSignup && (
          <div className="sticky bottom-0 border-t-2 border-border bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <button type="submit" disabled={!canContinue || loading || authLoading} className="mm-btn">
              {loading || authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : step === 4 ? "Create account" : "Continue"}
            </button>
            {step === 1 && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Already have an account? <button type="button" onClick={() => switchMode(false)} className="font-extrabold text-primary">Sign in</button>
              </p>
            )}
          </div>
        )}
      </form>
    </main>
  );
};

export default UnifiedAuthForm;
