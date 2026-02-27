import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Brain, Sparkles, Flame, Shield, Rocket } from "lucide-react";
import { MindForgeReactionType } from "@/lib/mindforge";

interface MindForgeReactionOverlayProps {
  activeReaction: MindForgeReactionType | null;
  streak: number;
  reducedMotion: boolean;
  tip?: string;
}

const avatars = [
  { name: "The Scholar", icon: Brain },
  { name: "The Strategist", icon: Flame },
  { name: "The Inventor", icon: Sparkles },
  { name: "The Guardian", icon: Shield },
  { name: "The Visionary", icon: Rocket },
] as const;

const reactionCopy: Record<MindForgeReactionType, { title: string; subtitle: string }> = {
  correct_basic: { title: "Brilliant Move!", subtitle: "Mind Power +100" },
  correct_combo: { title: "Combo Unlocked!", subtitle: "You're on fire 🔥" },
  correct_power: { title: "Brain Overdrive Mode", subtitle: "Genius Energy Activated!" },
  wrong_growth: { title: "Close! Let's master this.", subtitle: "Mistakes build strength." },
  level_up: { title: "LEVEL UP", subtitle: "New badge energy unlocked." },
  focus_boost: { title: "Focus Boost Mode", subtitle: "Let's master this together." },
};

const MindForgeReactionOverlay: React.FC<MindForgeReactionOverlayProps> = ({
  activeReaction,
  streak,
  reducedMotion,
  tip,
}) => {
  if (!activeReaction) return null;

  const copy = reactionCopy[activeReaction];
  const AvatarIcon = avatars[streak % avatars.length].icon;
  const scaleAnim = reducedMotion ? { opacity: 1 } : { opacity: 1, scale: [0.95, 1.02, 1] };

  return (
    <AnimatePresence>
      <motion.div
        key={activeReaction}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={scaleAnim}
          transition={{ duration: reducedMotion ? 0.15 : 0.45 }}
          className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl backdrop-blur-md ${
            activeReaction === "wrong_growth" || activeReaction === "focus_boost"
              ? "border-blue-300/40 bg-slate-900/85"
              : "border-purple-300/40 bg-gradient-to-br from-indigo-900/90 to-purple-900/90"
          } text-white`}
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-full bg-white/15 p-2">
              <AvatarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-white/70">MindForge Reactions™</p>
              <h3 className="text-lg font-semibold">{copy.title}</h3>
            </div>
          </div>

          <p className="text-sm text-white/90">{copy.subtitle}</p>

          {(activeReaction === "correct_combo" || activeReaction === "correct_power") && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>Streak Energy</span>
                <span>{streak}x</span>
              </div>
              <Progress value={Math.min((streak / 10) * 100, 100)} className="h-2 bg-white/20" />
            </div>
          )}

          {(activeReaction === "wrong_growth" || activeReaction === "focus_boost") && tip && (
            <div className="mt-3 rounded-md border border-white/20 bg-white/10 p-2 text-xs text-blue-100">
              Tip: {tip}
            </div>
          )}

          {activeReaction === "correct_power" && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-amber-200">⚡ Faster XP gain active</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MindForgeReactionOverlay;
