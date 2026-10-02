import React from "react";
import { Button } from "@/components/ui/button";

const CHEERS = ["Amazing!", "You got it!", "Super smart!", "Brilliant!", "Wow, great job!"];
const NUDGES = ["Almost! Let's learn it.", "Good try! Here's the trick.", "Nice effort — now you know!"];

/** Gentle Duolingo-style bottom sheet: celebrates correct answers, teaches on wrong ones. */
export const FeedbackOverlay: React.FC<{
  state: "correct" | "wrong";
  answer: string;
  explain: string;
  onNext: () => void;
}> = ({ state, answer, explain, onNext }) => {
  const correct = state === "correct";
  const title = React.useMemo(() => (correct ? CHEERS : NUDGES)[Math.floor(Math.random() * 5) % (correct ? CHEERS.length : NUDGES.length)], [correct]);
  return (
    <div role="status" aria-live="polite" className={`early-sheet fixed inset-x-0 bottom-0 z-40 border-t-4 px-4 pb-6 pt-4 ${correct ? "border-success bg-success/15" : "border-warning bg-warning/15"} backdrop-blur`}>
      <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl ${correct ? "early-pop bg-success text-success-foreground" : "early-wiggle bg-warning text-warning-foreground"}`} aria-hidden="true">
          {correct ? "🎉" : "💡"}
        </div>
        <div className="flex-1">
          <p className={`font-display text-xl font-bold ${correct ? "text-success" : "text-foreground"}`}>{title}</p>
          {!correct && <p className="mt-1 text-sm font-semibold">Answer: <span className="text-success">{answer}</span></p>}
          <p className="mt-1 text-sm text-muted-foreground">{explain}</p>
        </div>
        <Button size="lg" autoFocus onClick={onNext} className={`min-h-14 rounded-2xl px-8 text-lg font-bold ${correct ? "" : "bg-warning text-warning-foreground hover:bg-warning/90"}`}>
          {correct ? "Next" : "Got it!"}
        </Button>
      </div>
    </div>
  );
};
