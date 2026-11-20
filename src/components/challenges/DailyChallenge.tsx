import React, { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DailyQuestion = {
  id: string;
  text: string;
  options: string[];
};

const DailyChallenge: React.FC = () => {
  const { user, refreshProfile } = useUser();
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadChallenge = async () => {
      if (!user?.id) {
        setQuestion(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await (supabase as any).rpc("get_daily_challenge_question");
      if (!active) return;

      if (error) {
        console.error("Daily challenge load failed:", error);
        setQuestion(null);
        setIsLoading(false);
        return;
      }

      if (!data?.available || !data?.question_id) {
        setQuestion(null);
        setIsLoading(false);
        return;
      }

      setQuestion({
        id: data.question_id,
        text: data.question_text,
        options: Array.isArray(data.options) ? data.options : [],
      });
      if (data.already_completed) {
        setAlreadyCompleted(true);
        setWasCorrect(data.was_correct === true);
        setXpAwarded(Number(data.xp_awarded ?? 0));
        setIsAnswered(true);
      } else {
        setAlreadyCompleted(false);
        setWasCorrect(false);
        setXpAwarded(0);
        setIsAnswered(false);
      }
      setIsLoading(false);
    };

    void loadChallenge();
    return () => { active = false; };
  }, [user?.id]);

  const handleOptionSelect = async (option: string) => {
    if (isAnswered || isSubmitting || !question) return;

    setIsSubmitting(true);
    setSelectedOption(option);
    const { data, error } = await (supabase as any).rpc("submit_daily_challenge_answer", {
      p_question_id: question.id,
      p_answer: option,
    });
    setIsSubmitting(false);

    if (error) {
      console.error("Daily challenge submission failed:", error);
      setSelectedOption(null);
      toast.error("Your answer could not be submitted. Please try again.");
      return;
    }

    setIsAnswered(true);
    if (data?.already_submitted) {
      setAlreadyCompleted(true);
      setWasCorrect(data.was_correct === true);
      setXpAwarded(Number(data.xp_awarded ?? 0));
      toast.info("You have already completed today's challenge.");
      return;
    }

    setAlreadyCompleted(false);
    setWasCorrect(data?.correct === true);
    setXpAwarded(Number(data?.xp_awarded ?? 0));

    if (data?.success && data?.correct) {
      toast.success(`Correct! +${Number(data.xp_awarded ?? 0)} XP awarded!`);
      await refreshProfile();
    } else if (data?.success) {
      toast.error("Not quite. Review the answer and come back tomorrow.");
    } else {
      toast.error("The daily challenge could not be completed.");
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader><CardTitle>Daily Challenge</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!question) {
    return (
      <Card className="shadow-md">
        <CardHeader><CardTitle>Daily Challenge</CardTitle></CardHeader>
        <CardContent>
          <p className="py-4 text-center text-muted-foreground">No approved challenge is available right now. Check back later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-accent text-white">
        <CardTitle className="flex items-center justify-between">
          <span>Daily Challenge</span>
          <span className="rounded-full bg-white px-2 py-1 text-sm text-blue-600">+15 XP</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {alreadyCompleted ? (
          <div className="rounded-lg border p-4 text-center">
            <p className="font-semibold">You have completed today's challenge.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {wasCorrect ? `You earned ${xpAwarded} XP. Great work!` : "Come back tomorrow for a new challenge."}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 font-medium">{question.text}</p>
            <div className="space-y-2">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isAnswered || isSubmitting}
                  onClick={() => void handleOptionSelect(option)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition-all disabled:cursor-default ${
                    isSubmitting && selectedOption === option
                      ? "border-blue-300 bg-blue-50 animate-pulse"
                      : isAnswered && option === selectedOption
                      ? "border-blue-500 bg-blue-50"
                      : selectedOption === option
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
      {!alreadyCompleted && (
        <CardFooter className="border-t pt-3">
          <div className="w-full text-sm text-muted-foreground">
            {isAnswered
              ? (wasCorrect ? `Correct! +${xpAwarded} XP earned.` : "Answer submitted. Review the explanation and come back tomorrow.")
              : "Submit your answer to complete today's challenge."}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default DailyChallenge;
