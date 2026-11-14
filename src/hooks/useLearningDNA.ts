import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TopicMastery {
  mastery: number;
  status: string;
}

export interface LearningActivitySummary {
  quizzes: { attempts: number; accuracy: number | null; learningAreas: number; subjects: string[] };
  reading: {
    booksOpened: number;
    booksCompleted: number;
    averageCompletionPercent: number;
    totalReadingSeconds: number;
    books: Array<{ title: string; subject: string; completionPercent: number; timeSpentSeconds: number; lastPageReached: number }>;
  };
  study: {
    sessions: number;
    completedSessions: number;
    activeDaysLast30: number;
    completedPlans: number;
    totalPlans: number;
    planCompletionPercent: number | null;
    completedTasks: number;
    totalTasks: number;
    taskCompletionPercent: number | null;
    sessionDurationAdherencePercent: number | null;
    totalStudyMinutes: number;
  };
  multiplayer: {
    matches: number;
    wins: number;
    podiumFinishes: number;
    averageAccuracy: number | null;
    questionCompletionPercent: number | null;
    answeredQuestions: number;
    totalQuestions: number;
  };
  flashcards: { trackedCards: number; reviewedCards: number; totalRepetitions: number };
  studyModeCalls: { acceptedOrJoined: number };
}

export interface LearningAIInsights {
  summary: string;
  learningPatterns: string[];
  readingInsights: string[];
  disciplineInsights: string[];
  multiplayerInsights: string[];
  recommendations: string[];
  evidenceLimitations: string[];
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
  activitySummary: LearningActivitySummary | null;
  aiInsights: LearningAIInsights | null;
  dataCoverage: {
    sources: Record<string, boolean>;
    records: Record<string, number>;
    sampleLimits: string[];
    window: string;
  } | null;
  totalAttempts: number;
  totalActivityEvents: number;
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
        supabase.from("learning_dna").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("question_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      if (queryError && queryError.code !== "PGRST116") throw new Error(queryError.message);
      if (attemptsError) throw new Error(attemptsError.message);

      const recordedAttempts = count ?? 0;
      setAttemptCount(recordedAttempts);

      if (data) {
        const activitySummary = (data.activity_summary || null) as unknown as LearningActivitySummary | null;
        const aiInsights = (data.ai_insights || null) as unknown as LearningAIInsights | null;
        const dataCoverage = (data.data_coverage || null) as unknown as LearningData["dataCoverage"];
        setLearningData({
          topicMastery: (data.topic_mastery as unknown as Record<string, TopicMastery>) || {},
          strengths: (data.strengths as string[]) || [],
          weaknesses: (data.weaknesses as string[]) || [],
          learningStyle: data.learning_style || "not_assessed",
          predictedPath: data.predicted_path as LearningData["predictedPath"],
          activitySummary,
          aiInsights,
          dataCoverage,
          totalAttempts: recordedAttempts,
          totalActivityEvents: Object.values(dataCoverage?.records || {}).reduce((sum, value) => sum + Number(value || 0), 0),
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
