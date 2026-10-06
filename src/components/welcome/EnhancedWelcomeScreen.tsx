import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Crown, Users, ShieldCheck, GraduationCap, Sparkles, Trophy, Zap, Globe, Info, Play } from "lucide-react";
import LanguageSelector from "@/components/common/LanguageSelector";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import MasterMindsLogo from "@/components/brand/MasterMindsLogo";
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1526]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}>

            <div className="relative">
              <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, type: "spring", bounce: 0.25 }}
              className="relative flex flex-col items-center">
                <motion.div
                  className="absolute inset-0 rounded-full bg-[#0055FF]/20 blur-3xl"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.55, 0.35] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                />
                <MasterMindsLogo variant="light" layout="symbol" symbolClassName="h-40 w-40 drop-shadow-[0_0_28px_rgba(0,229,255,0.28)]" />
              </motion.div>

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

              <motion.h1
              className="text-center mt-8 text-4xl font-display font-black text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}>
                {t("app-name")}
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
          <div className="text-center rounded-2xl p-4 border border-white/10 bg-white/[0.06] backdrop-blur-xl">
            <h4 className="text-xl font-display font-bold text-white">
              {t("smart-quiz-world")}
            </h4>
            <p className="text-sm text-white/70 mt-1">
              {t("created-by")} <span className="text-primary font-semibold">Biniam Bogale</span>, from Ethiopia 🇪🇹
            </p>
          </div>
        </motion.div>

        {/* Master Minds Brand Mark */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.7, type: "spring", bounce: 0.2 }}
          className="mb-10"
        >
          <MasterMindsLogo
            variant="light"
            layout="stacked"
            showTagline
            symbolClassName="h-28 w-28 sm:h-32 sm:w-32"
            className="text-white"
          />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-display font-black text-white mb-3">
            {t("app-name")}
          </h1>
          <p className="text-lg text-white/70 max-w-md">
            {t("app-tagline")}
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="w-full max-w-sm space-y-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleStart}
              className="w-full h-16 text-xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 border-0 rounded-2xl shadow-lg pulse-glow"
              size="lg">
              <Play className="mr-3 h-7 w-7" />
              {t("start")}
            </Button>
          </motion.div>

          <div className="flex gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button
                onClick={() => setShowAbout(true)}
                variant="outline"
                className="w-full h-14 text-lg font-display glass border-primary/30 hover:bg-primary/20 rounded-xl"
                size="lg">
                <Info className="mr-2 h-5 w-5" />
                {t("about")}
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
          <p className="text-xs text-foreground/50 font-display">{t("created-by")} Biniam Bogale • Master Minds v2.0</p>
        </motion.div>
      </div>

      {/* About Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="bg-[#0A1526] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-white text-center">
              {t("about-master-minds")}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-4 text-foreground/80">
              <p className="text-center">
                {t("about-description")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Trophy className="h-6 w-6 text-accent" />
                  <span>{t("realtime-battles")}</span>
                </div>
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                  <span>{t("adaptive-difficulty")}</span>
                </div>
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Users className="h-6 w-6 text-secondary" />
                  <span>{t("tournaments-leaderboards")}</span>
                </div>
                <div className="flex items-center gap-3 p-3 glass rounded-lg">
                  <Globe className="h-6 w-6 text-glow-cyan" />
                  <span>{t("multi-language")}</span>
                </div>
              </div>
              <p className="text-center text-sm text-foreground/60 pt-2">
                {t("inspired-by")}
              </p>
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {/* Role Selection Dialog */}
      <Dialog open={showRoleSelect} onOpenChange={setShowRoleSelect}>
        <DialogContent className="bg-[#0A1526] border-white/10 text-white max-w-lg p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0055FF]/25 via-[#00E5FF]/15 to-[#0055FF]/25 p-6">
            <DialogTitle className="text-2xl font-display text-gradient text-center">
              {t("choose-role")}
            </DialogTitle>
            <p className="text-center text-sm text-foreground/70 mt-2">
              {t("select-role-desc")}
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleRoleSelect("student")}
                className="w-full p-4 glass rounded-xl border border-primary/30 hover:border-primary transition-all flex items-center gap-4 group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/50 transition-shadow">
                  <GraduationCap className="h-7 w-7 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-foreground">{t("student")}</h3>
                  <p className="text-sm text-foreground/60">{t("student-desc")}</p>
                </div>
                <Sparkles className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleRoleSelect("teacher")}
                className="w-full p-4 glass rounded-xl border border-secondary/30 hover:border-secondary transition-all flex items-center gap-4 group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary to-glow-cyan flex items-center justify-center shadow-lg group-hover:shadow-secondary/50 transition-shadow">
                  <Users className="h-7 w-7 text-background" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-foreground">{t("teacher")}</h3>
                  <p className="text-sm text-foreground/60">{t("teacher-desc")}</p>
                </div>
                <Sparkles className="h-5 w-5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleRoleSelect("admin")}
                className="w-full p-4 glass rounded-xl border border-accent/30 hover:border-accent transition-all flex items-center gap-4 group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-glow-pink flex items-center justify-center shadow-lg group-hover:shadow-accent/50 transition-shadow">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-foreground">{t("admin")}</h3>
                  <p className="text-sm text-foreground/60">{t("admin-desc")}</p>
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
