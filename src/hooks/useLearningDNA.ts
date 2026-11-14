import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TopicMastery {
  mastery: number;
  status: string;
}

export interface LearningData {
  topicMastery: Record<string, TopicMastery>;
  strengths: string[];
  weaknesses: string[];
  learningStyle: string;
  predictedPath: {
    recommendedFocus: string[];
    studyTips: string[];
    predictedCareerPaths: string[];
  } | null;
  totalAttempts: number;
}

export function useLearningDNA(userId?: string) {
  const [learningData, setLearningData] = useState<LearningData | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<Error | null>(null);

  const loadLearningDNA = useCallback(async () => {
    if (!userId) {
      setLearningData(null);
      setAttemptCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [{ data, error: queryError }, { count, error: attemptsError }] = await Promise.all([
        supabase
          .from("learning_dna")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("question_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      if (queryError && queryError.code !== "PGRST116") {
        throw new Error(queryError.message);
      }
      if (attemptsError) {
        throw new Error(attemptsError.message);
      }

      const recordedAttempts = count ?? 0;
      setAttemptCount(recordedAttempts);

      if (data) {
        setLearningData({
          topicMastery: (data.topic_mastery as unknown as Record<string, TopicMastery>) || {},
          strengths: (data.strengths as string[]) || [],
          weaknesses: (data.weaknesses as string[]) || [],
          learningStyle: data.learning_style || "balanced",
          predictedPath: data.predicted_path as LearningData["predictedPath"],
          totalAttempts: recordedAttempts,
        });
      } else {
        setLearningData(null);
      }
    } catch (loadError) {
      console.error("Learning DNA load failed", loadError);
      setError(loadError instanceof Error ? loadError : new Error("Unable to load Learning DNA."));
      setLearningData(null);
      setAttemptCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadLearningDNA();
  }, [loadLearningDNA]);

  return { learningData, attemptCount, isLoading, error, reload: loadLearningDNA, setLearningData };
}
