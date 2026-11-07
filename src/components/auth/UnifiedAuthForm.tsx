import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import AvatarCreator from "@/components/profile/AvatarCreator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ArrowRight, AtSign, BookOpen, Check, CheckCircle2, Crown,
  Eye, EyeOff, GraduationCap, Loader2, Lock, Mail, ShieldCheck, Sparkles,
  Target, Trophy, Users, User, X, Clock3,
} from "lucide-react";
import type { UserTier } from "@/lib/getUserTier";

interface UnifiedAuthFormProps {
  onSuccess: () => void;
  onBack?: () => void;
  initialTab?: "student" | "teacher" | "admin" | "manager";
  initialMode?: "signin" | "signup";
}

type Role = "student" | "teacher" | "admin" | "manager" | "parent_view";
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
  const [goalId, setGoalId] = useState("regular");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
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
    const { data, error } = await supabase.rpc("get_email_by_username", { _username: normalized } as any);
    if (error) {
      setUsernameStatus("idle");
      toast.error("We couldn't check that username. Please try again.");
      return false;
    }
    if (data) {
      setUsernameStatus("taken");
      toast.error("That username is already taken.");
      return false;
    }
    setUsernameStatus("available");
    return true;
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
    if (password.length < 8 || score < 3) {
      toast.error("Use at least 8 characters and a mix of letters, numbers or symbols.");
      return;
    }
    setLoading(true);
    try {
      const profile = await signupWithRole(
        email.trim(), password, name.trim(), username.trim().toLowerCase(), "student", grade,
        { age: parsedAge, gender, avatar, learningGoal: { id: goal.id, minutes: goal.minutes, xp: goal.xp } } as any,
      );
      if (profile) {
        localStorage.setItem("masterminds_learning_goal", JSON.stringify({ id: goal.id, minutes: goal.minutes, xp: goal.xp }));
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
        localStorage.setItem("masterminds_login_mode", "parent");
        await supabase.from("profiles").update({ login_mode: "parent" } as any).eq("id", profile.id);
        navigate("/parent-dashboard", { replace: true });
        return;
      }
      localStorage.removeItem("masterminds_login_mode");
      switch (profile.role) {
        case "extreme_admin": navigate("/root-control-portal-9xA7", { replace: true }); break;
        case "admin": navigate("/admin", { replace: true }); break;
        case "manager": navigate("/manager-dashboard", { replace: true }); break;
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
  ];
  const steps = ["Learning stage", "Your grade", "Daily goal", "Your profile"];

  return (
    <main className="min-h-[100svh] bg-[#F8FAFC] px-3 py-5 text-slate-950 dark:bg-[#0A1120] dark:text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-[#131F37] lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="relative hidden min-h-[690px] flex-col justify-between overflow-hidden bg-[#0A1120] p-10 text-white lg:flex xl:p-12">
            <div className="absolute -right-28 top-20 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <img src="/brand/master-minds-icon.svg" alt="" className="h-12 w-12 rounded-xl" />
              <span className="text-xl font-black">Master Minds</span>
            </div>
            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-200"><Sparkles className="h-4 w-4" /> Learn. Compete. Level Up.</p>
              <h1 className="mt-6 text-4xl font-black leading-tight">Small steps today. Big wins tomorrow.</h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">A learning space that grows with you — from your first discoveries to national exam preparation.</p>
              <div className="mt-9 space-y-4 text-sm text-slate-200">
                <p className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-cyan-300" /> Grade-aware lessons and practice</p>
                <p className="flex items-center gap-3"><Trophy className="h-5 w-5 text-amber-300" /> XP, challenges and learning leagues</p>
                <p className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Your account and progress stay connected</p>
              </div>
            </div>
            <p className="relative text-xs text-slate-500">Master Minds · Built for learners across Ethiopia</p>
          </aside>

          <section className="flex min-w-0 flex-col">
            <header className="border-b border-slate-100 px-5 pb-5 pt-5 dark:border-slate-800 sm:px-8 sm:pt-7">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={isSignup ? backStep : onBack} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                  <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{isSignup ? "Back" : "Welcome"}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold tracking-tight lg:hidden">Master Minds</span>
                  {onBack && <button type="button" onClick={onBack} aria-label="Close authentication" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>}
                </div>
              </div>

              {isSignup ? (
                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-cyan-300">Step {step} of 4</span>
                    <span className="text-xs font-medium text-slate-500">{steps[step - 1]}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#0055FF]" animate={{ width: `${step * 25}%` }} transition={{ duration: 0.25 }} />
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <h2 className="text-2xl font-black tracking-tight">Welcome back</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in with your Master Minds username.</p>
                </div>
              )}
            </header>

            {!isSignup && (
              <nav aria-label="Sign in portal" className="grid grid-cols-3 gap-1 border-b border-slate-100 p-2 dark:border-slate-800 sm:grid-cols-5">
                {roleOptions.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setRole(id)} aria-pressed={role === id} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition ${role === id ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-cyan-200" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </nav>
            )}

            <form onSubmit={isSignup ? handleNext : handleLogin} className="flex flex-1 flex-col">
              <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
                <AnimatePresence mode="wait">
                  {isSignup && step === 1 && (
                    <motion.div key="tier" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="space-y-5">
                      <div><h2 className="text-xl font-black sm:text-2xl">What do you want to learn?</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Choose your stage — we will adapt the learning experience to your level.</p></div>
                      <div className="grid gap-3">
                        {tiers.map(({ id, title, grades: gradeLabel, description, icon: Icon, accent }) => (
                          <button key={id} type="button" onClick={() => { setTier(id); setGrade(""); }} aria-pressed={tier === id} className={`card-3d-choice flex w-full items-center gap-4 rounded-2xl border p-4 text-left ${tier === id ? "selected border-blue-600 bg-blue-50/70 dark:bg-blue-500/10" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
                            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-[#07152b] shadow-lg`}><Icon className="h-7 w-7" /></span>
                            <span className="min-w-0 flex-1"><span className="block font-extrabold">{title}</span><span className="mt-0.5 block text-xs font-bold text-blue-700 dark:text-cyan-300">{gradeLabel}</span><span className="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</span></span>
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tier === id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-transparent dark:border-slate-600"}`}><Check className="h-4 w-4" /></span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {isSignup && step === 2 && tier && (
                    <motion.div key="grade" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="space-y-5">
                      <div><h2 className="text-xl font-black sm:text-2xl">Select your grade</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your grade helps us personalize lessons, practice and your student home.</p></div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {gradeByTier[tier].map((item) => (
                          <button key={item} type="button" onClick={() => setGrade(item)} aria-pressed={grade === item} className={`card-3d-choice min-h-16 rounded-2xl border px-4 py-3 text-sm font-extrabold ${grade === item ? "selected border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-cyan-200" : "border-slate-200 bg-white hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900"}`}>
                            {item}{grade === item && <CheckCircle2 className="ml-2 inline h-4 w-4" />}
                          </button>
                        ))}
                      </div>
                      {selectedTier && <p className="rounded-xl bg-blue-50 p-3 text-xs font-medium text-blue-800 dark:bg-blue-500/10 dark:text-cyan-200">Selected path: {selectedTier.title}</p>}
                    </motion.div>
                  )}

                  {isSignup && step === 3 && (
                    <motion.div key="goal" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="space-y-5">
                      <div><h2 className="text-xl font-black sm:text-2xl">Set your daily learning goal</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a pace that feels achievable. You can adjust your goal later.</p></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {goals.map((item) => (
                          <button key={item.id} type="button" onClick={() => setGoalId(item.id)} aria-pressed={goalId === item.id} className={`card-3d-choice rounded-2xl border p-4 text-left ${goalId === item.id ? "selected border-blue-600 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
                            <div className="flex items-center justify-between"><span className="font-extrabold">{item.title}</span>{goalId === item.id && <CheckCircle2 className="h-5 w-5 text-blue-600" />}</div>
                            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Clock3 className="h-4 w-4 text-blue-600" />{item.minutes} min / day</div>
                            <div className="mt-1 text-sm font-bold text-amber-600">+{item.xp} XP daily goal</div>
                            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {isSignup && step === 4 && (
                    <motion.div key="profile" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="space-y-4">
                      <div><h2 className="text-xl font-black sm:text-2xl">Create your profile</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">One last step. Your account details stay protected.</p></div>
                      <div className="space-y-2"><Label htmlFor="profile-avatar">Choose an avatar</Label><AvatarCreator onSelect={setAvatar} selectedAvatar={avatar} /></div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2"><Label htmlFor="signup-name">Full name</Label><Input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="h-12 rounded-xl" /></div>
                        <div className="space-y-2"><Label htmlFor="signup-username">Username</Label><div className="relative"><AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="signup-username" autoComplete="username" value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20)); setUsernameStatus("idle"); }} placeholder="choose_username" className="h-12 rounded-xl pl-9 pr-8" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{username.length}/20</span></div>
                          <p className="min-h-4 text-xs">{usernameStatus === "checking" ? "Checking availability…" : usernameStatus === "available" ? <span className="text-emerald-600">✓ Username available</span> : usernameStatus === "taken" ? <span className="text-red-600">Username already taken</span> : "3–20 letters, numbers or underscores"}</p>
                        </div>
                        <div className="space-y-2"><Label htmlFor="signup-email">Email address</Label><Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 rounded-xl" /><p className="text-[11px] text-slate-500">Required by the current account and recovery flow.</p></div>
                        <div className="space-y-2"><Label htmlFor="signup-age">Age</Label><Input id="signup-age" type="number" min="3" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="h-12 rounded-xl" /></div>
                        <div className="space-y-2"><Label htmlFor="signup-gender">Gender</Label><select id="signup-gender" value={gender} onChange={(e) => setGender(e.target.value as "male" | "female" | "")} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option></select></div>
                        <div className="space-y-2"><Label htmlFor="signup-password">Password</Label><div className="relative"><Input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="h-12 rounded-xl pr-11" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-slate-500">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                          <div className="grid grid-cols-5 gap-1">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-1.5 rounded-full ${i < score ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />)}</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <span className="font-bold">Your path:</span> {grade} · {goal.minutes} minutes/day · {goal.xp} XP goal
                      </div>
                    </motion.div>
                  )}

                  {!isSignup && (
                    <motion.div key="login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-5">
                      <div className="space-y-2"><Label htmlFor="login-username">Username</Label><div className="relative"><AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="login-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="Your username" className="h-12 rounded-xl pl-9" /></div></div>
                      <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="login-password">Password</Label><button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-blue-700 hover:underline dark:text-cyan-300">Forgot password?</button></div><div className="relative"><Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="h-12 rounded-xl pr-11" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-slate-500">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                      <Button type="submit" disabled={loading || authLoading} className="btn-3d-primary h-13 w-full rounded-xl text-base font-extrabold text-white">{loading || authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lock className="mr-2 h-4 w-4" /> Sign in</>}</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {isSignup && (
                <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-[#131F37]/95 sm:px-8">
                  {step > 1 && <Button type="button" variant="outline" onClick={() => setStep((current) => (current - 1) as SignupStep)} className="h-12 flex-1 rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>}
                  <Button type="submit" disabled={loading || authLoading || (step === 1 && !tier) || (step === 2 && !grade)} className="btn-3d-primary h-12 flex-[2] rounded-xl font-extrabold text-white">
                    {loading || authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : step === 4 ? "START LEARNING NOW" : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              )}

              {!isSignup && (
                <div className="space-y-4 border-t border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-8">
                  <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={googleLoading || loading} className="h-12 w-full rounded-xl font-bold">{googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 font-black">G</span>} Sign in with Google</Button>
                  <p className="text-center text-xs text-slate-500">New to Master Minds? <button type="button" onClick={() => switchMode(true)} className="font-bold text-blue-700 hover:underline dark:text-cyan-300">Create a student account</button></p>
                </div>
              )}
              {isSignup && <p className="border-t border-slate-100 px-5 py-4 text-center text-xs text-slate-500 dark:border-slate-800">Already have an account? <button type="button" onClick={() => switchMode(false)} className="font-bold text-blue-700 hover:underline dark:text-cyan-300">Sign in</button></p>}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
};

export default UnifiedAuthForm;
