import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Lock, Star, Trophy, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SkillNode = { topic: string; status: "new" | "progress" | "mastered"; accuracy: number; attempted: number; unlocked: boolean };

const OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];

const SkillTree: React.FC<{ nodes: SkillNode[]; onPractice: (topic: string) => void }> = ({ nodes, onPractice }) => {
  const currentIndex = nodes.findIndex((n) => n.unlocked && n.status !== "mastered");
  const [open, setOpen] = useState<number | null>(currentIndex >= 0 ? currentIndex : null);
  const units: SkillNode[][] = [];
  nodes.forEach((n, i) => { if (i % 4 === 0) units.push([]); units[units.length - 1].push(n); });

  return (
    <div className="space-y-8">
      {units.map((unit, u) => {
        const done = unit.filter((n) => n.status === "mastered").length;
        return (
          <section key={u} aria-label={`Unit ${u + 1}`}>
            <div className="mb-6 flex items-center justify-between rounded-2xl border-b-4 border-primary/40 bg-primary p-4 text-primary-foreground">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Unit {u + 1}</p>
                <p className="font-bold">{unit[0].topic}</p>
              </div>
              <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold">{done}/{unit.length}</span>
            </div>
            <div className="relative flex flex-col items-center gap-5">
              <div aria-hidden className="pointer-events-none absolute inset-y-4 left-1/2 w-0 -translate-x-1/2 border-l-4 border-dashed border-border" />
              {unit.map((node, j) => {
                const i = u * 4 + j;
                const isCurrent = i === currentIndex;
                const tone = node.status === "mastered"
                  ? "bg-accent text-accent-foreground border-accent/50"
                  : node.unlocked ? "bg-primary text-primary-foreground border-primary/50" : "bg-muted text-muted-foreground border-border";
                return (
                  <div key={node.topic + i} className="relative flex flex-col items-center" style={{ transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)` }}>
                    {isCurrent && <span className="mb-2 rounded-xl border-2 border-primary bg-background px-3 py-1 text-xs font-extrabold uppercase text-primary">Start</span>}
                    <motion.button
                      type="button"
                      whileTap={{ y: 4 }}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setOpen(open === i ? null : i)}
                      aria-label={`${node.topic}${node.unlocked ? "" : " (locked)"}`}
                      className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-b-[6px] shadow-lg transition ${tone} ${isCurrent ? "ring-4 ring-primary/30 ring-offset-4 ring-offset-background" : ""}`}
                    >
                      {node.status === "mastered" ? <Crown className="h-8 w-8" /> : node.unlocked ? <Star className="h-8 w-8 fill-current" /> : <Lock className="h-7 w-7" />}
                      {node.status === "mastered" && <Check className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-background p-1 text-accent" />}
                    </motion.button>
                    <p className="mt-2 max-w-[150px] text-center text-xs font-semibold leading-tight">{node.topic}</p>
                    {open === i && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full z-20 mt-2 w-60 rounded-2xl border bg-card p-4 text-card-foreground shadow-xl">
                        <p className="font-bold">{node.topic}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {node.attempted > 0 ? `${node.attempted} questions · ${Math.round(node.accuracy)}% accuracy` : node.unlocked ? "Not started yet" : "Finish the previous topic to unlock"}
                        </p>
                        <Button className="mt-3 w-full" disabled={!node.unlocked} onClick={() => onPractice(node.topic)}>
                          <BookOpen className="mr-2 h-4 w-4" />{node.status === "mastered" ? "Review" : node.attempted ? "Continue" : "Start practice"}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                );
              })}
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border-b-4 ${done === unit.length ? "bg-accent text-accent-foreground border-accent/50" : "bg-muted text-muted-foreground border-border"}`} aria-label="Unit checkpoint">
                <Trophy className="h-8 w-8" />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default SkillTree;
