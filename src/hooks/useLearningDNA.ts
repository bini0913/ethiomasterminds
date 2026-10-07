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
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<Error | null>(null);

  const loadLearningDNA = useCallback(async () => {
    if (!userId) {
      setLearningData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("learning_dna")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (queryError && queryError.code !== "PGRST116") {
      setError(new Error(queryError.message));
      setLearningData(null);
    } else if (data) {
      setLearningData({
        topicMastery: (data.topic_mastery as unknown as Record<string, TopicMastery>) || {},
        strengths: (data.strengths as string[]) || [],
        weaknesses: (data.weaknesses as string[]) || [],
        learningStyle: data.learning_style || "balanced",
        predictedPath: data.predicted_path as LearningData["predictedPath"],
        totalAttempts: 0,
      });
    } else {
      setLearningData(null);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadLearningDNA();
  }, [loadLearningDNA]);

  return { learningData, isLoading, error, reload: loadLearningDNA, setLearningData };
}
