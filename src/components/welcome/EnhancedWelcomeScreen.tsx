import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Crown, Users, ShieldCheck, GraduationCap, Sparkles, BookOpen, Trophy, Zap, Globe, Info, Play } from "lucide-react";
import LanguageSelector from "@/components/common/LanguageSelector";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription } from
"@/components/ui/dialog";

interface EnhancedWelcomeScreenProps {
  onContinue: (userType?: "student" | "teacher" | "admin" | "manager") => void;
}

const EnhancedWelcomeScreen: React.FC<EnhancedWelcomeScreenProps> = ({ onContinue }) => {
  const [showIntro, setShowIntro] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  // Auto-hide intro after logo animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setShowRoleSelect(true);
  };

  const handleRoleSelect = (role: "student" | "teacher" | "admin") => {
    setShowRoleSelect(false);
    onContinue(role);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="default" />

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <LanguageSelector />
      </div>

      {/* Intro Animation */}
      <AnimatePresence>
        {showIntro &&
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}>

            <div className="relative">
              {/* Animated Logo */}
              <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1, type: "spring", bounce: 0.4 }}
              className="relative">

                {/* Outer Glow Ring */}
                <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, hsl(250 89% 67%), hsl(320 100% 60%))',
                  filter: 'blur(30px)'
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 2, repeat: Infinity }} />

                
                {/* Logo Circle */}
                <div className="relative w-40 h-40 rounded-full neon-border p-1">
                  <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                    <motion.span
                    className="text-5xl font-display font-black text-gradient"
                    animate={{
                      textShadow: [
                      '0 0 20px hsl(250 89% 67%)',
                      '0 0 40px hsl(320 100% 60%)',
                      '0 0 20px hsl(250 89% 67%)']

                    }}
                    transition={{ duration: 2, repeat: Infinity }}>

                      MM
                    </motion.span>
                  </div>
                </div>

                {/* Orbiting Icons */}
                <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>

                  <BookOpen className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-primary" />
                  <Trophy className="absolute top-1/2 -right-6 -translate-y-1/2 w-8 h-8 text-accent" />
                  <Sparkles className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 text-secondary" />
                  <Zap className="absolute top-1/2 -left-6 -translate-y-1/2 w-8 h-8 text-glow-yellow" />
                </motion.div>
              </motion.div>

              {/* Light Streaks */}
              {[...Array(6)].map((_, i) =>
            <motion.div
              key={i}
              className="absolute h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
              style={{
                width: '200px',
                top: '50%',
                left: '50%',
                transformOrigin: 'center',
                rotate: `${i * 60}deg`
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: 1.5,
                delay: 0.5 + i * 0.1,
                repeat: Infinity,
                repeatDelay: 1
              }} />

            )}

              {/* Title */}
              <motion.h1
              className="text-center mt-8 text-4xl font-display font-black text-gradient"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}>

                MASTER MINDS
              </motion.h1>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen p-6">
        {/* Creator Credit */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6">

          <div className="text-center glass rounded-2xl p-4 border border-primary/30">
            <h4 className="text-xl font-display font-bold text-gradient">
              A Smart Multiplayer Quiz World
            </h4>
            <p className="text-sm text-foreground/80 mt-1">
              Created by <span className="text-primary font-semibold">Biniam Bogale</span>, from Ethiopia 🇪🇹
            </p>
          </div>
        </motion.div>

        {/* Main Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
          className="mb-10">

          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-accent to-secondary blur-2xl opacity-50 animate-pulse-glow" />
            
            {/* Logo */}
            <div className="relative w-36 h-36 rounded-full neon-border p-1 pulse-glow">
              <div className="w-full h-full rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
                <motion.div
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="text-6xl font-display font-black text-gradient">

                  MM
                </motion.div>
              </div>
            </div>

            {/* Orbiting Elements */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-20px]">

              <BookOpen className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 text-primary drop-shadow-lg" />
              <Trophy className="absolute top-1/2 -right-2 -translate-y-1/2 w-6 h-6 text-accent drop-shadow-lg" />
              <Sparkles className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 text-secondary drop-shadow-lg" />
              <Zap className="absolute top-1/2 -left-2 -translate-y-1/2 w-6 h-6 text-glow-yellow drop-shadow-lg" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center mb-10">

          <h1 className="text-5xl md:text-6xl font-display font-black text-gradient mb-3">
            MASTER MINDS
          </h1>
          <p className="text-lg text-foreground/70 max-w-md">
            Where Learning Meets Adventure • Battle • Win
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="w-full max-w-sm space-y-4">

          {/* Start Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleStart}
              className="w-full h-16 text-xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 border-0 rounded-2xl shadow-lg pulse-glow"
              size="lg">

              <Play className="mr-3 h-7 w-7" />
              START
            </Button>
          </motion.div>

          {/* About & Language Row */}
          <div className="flex gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button
                onClick={() => setShowAbout(true)}
                variant="outline"
                className="w-full h-14 text-lg font-display glass border-primary/30 hover:bg-primary/20 rounded-xl"
                size="lg">

                <Info className="mr-2 h-5 w-5" />
                About
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button
                variant="outline"
                className="w-full h-14 text-lg font-display glass border-secondary/30 hover:bg-secondary/20 rounded-xl"
                size="lg"
                onClick={() => {
                  const langs = ['english', 'amharic', 'afaan-oromoo'] as const;
                  const currentIndex = langs.indexOf(language as any);
                  setLanguage(langs[(currentIndex + 1) % langs.length]);
                }}>

                <Globe className="mr-2 h-5 w-5" />
                {language === 'english' ? 'EN' : language === 'amharic' ? 'አማ' : 'AF'}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-4 text-center">

          <p className="text-xs text-foreground/50 font-display">Created by Biniam Bogale • Master Minds v2.0

          </p>
        </motion.div>
      </div>

      {/* About Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="glass border-primary/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-gradient text-center">
              About Master Minds
            </DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-4 text-foreground/80">
              <p className="text-center">
                Master Minds is a revolutionary educational platform combining the thrill of gaming with powerful learning tools.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Trophy className="h-6 w-6 text-accent" />
                  <span>Real-time multiplayer quiz battles</span>
                </div>
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                  <span>Adaptive difficulty & XP progression</span>
                </div>
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Users className="h-6 w-6 text-secondary" />
                  <span>Tournaments & global leaderboards</span>
                </div>
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Globe className="h-6 w-6 text-glow-cyan" />
                  <span>English, Amharic & Afaan Oromoo</span>
                </div>
              </div>
              <p className="text-center text-sm text-foreground/60 pt-2">
                Inspired by PUBG, Duolingo & 99math
              </p>
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {/* Role Selection Dialog */}
      <Dialog open={showRoleSelect} onOpenChange={setShowRoleSelect}>
        <DialogContent className="glass border-primary/30 max-w-lg p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 p-6">
            <DialogTitle className="text-2xl font-display text-gradient text-center">
              Choose Your Role
            </DialogTitle>
            <p className="text-center text-sm text-foreground/70 mt-2">
              Select how you want to use Master Minds
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            {/* Student */}
            <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleRoleSelect("student")}
                className="w-full p-4 glass rounded-xl border border-primary/30 hover:border-primary transition-all flex items-center gap-4 group">

                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/50 transition-shadow">
                  <GraduationCap className="h-7 w-7 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-foreground">Student</h3>
                  <p className="text-sm text-foreground/60">Learn, compete & earn rewards</p>
                </div>
                <Sparkles className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>

            {/* Teacher */}
            <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleRoleSelect("teacher")}
                className="w-full p-4 glass rounded-xl border border-secondary/30 hover:border-secondary transition-all flex items-center gap-4 group">

                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary to-glow-cyan flex items-center justify-center shadow-lg group-hover:shadow-secondary/50 transition-shadow">
                  <Users className="h-7 w-7 text-background" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-foreground">Teacher</h3>
                  <p className="text-sm text-foreground/60">Create exams & monitor students</p>
                </div>
                <Sparkles className="h-5 w-5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>

            {/* Admin */}
            <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleRoleSelect("admin")}
                className="w-full p-4 glass rounded-xl border border-accent/30 hover:border-accent transition-all flex items-center gap-4 group">

                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-glow-pink flex items-center justify-center shadow-lg group-hover:shadow-accent/50 transition-shadow">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-foreground">Admin</h3>
                  <p className="text-sm text-foreground/60">Full system control & management</p>
                </div>
                <Crown className="h-5 w-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default EnhancedWelcomeScreen;