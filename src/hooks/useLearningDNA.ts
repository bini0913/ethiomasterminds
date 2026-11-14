import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TopicMastery {
  mastery: number;
  status: string;
}

export interface LearningActivitySummary {
  earlyLearning: {
    activitiesAttempted: number;
    skills: string[];
    videoViews: number;
    videosCompleted: number;
    secondsWatchedRecorded: number;
  };
  revision: { scheduledItems: number; reviewedItems: number; totalReviewsRecorded: number };
  participation: { tournamentsJoined: number; studyCompetitionsJoined: number };
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
    excludedSources: string[];
    window: string;
  } | null;
  totalAttempts: number;
  totalActivityEvents: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

// Migration defaults and legacy rows can contain empty JSON objects rather than reports.
// Treat incomplete nested payloads as absent so the page renders its safe empty state.
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const normalizeActivitySummary = (value: unknown): LearningActivitySummary | null => {
  if (!isRecord(value)) return null;
  const { quizzes, reading, study, multiplayer, flashcards, studyModeCalls, earlyLearning, revision, participation } = value;
  if (!isRecord(quizzes) || !isRecord(reading) || !isRecord(study) || !isRecord(multiplayer) || !isRecord(flashcards) || !isRecord(studyModeCalls) || !isRecord(earlyLearning) || !isRecord(revision) || !isRecord(participation)) return null;
  if (!isFiniteNumber(quizzes.attempts) || !isNullableNumber(quizzes.accuracy) || !isFiniteNumber(quizzes.learningAreas) || !isStringArray(quizzes.subjects)) return null;
  if (!isFiniteNumber(reading.booksOpened) || !isFiniteNumber(reading.booksCompleted) || !isFiniteNumber(reading.averageCompletionPercent) || !isFiniteNumber(reading.totalReadingSeconds) || !Array.isArray(reading.books)) return null;
  if (!reading.books.every((book) => isRecord(book) && typeof book.title === "string" && typeof book.subject === "string" && isFiniteNumber(book.completionPercent) && isFiniteNumber(book.timeSpentSeconds) && isFiniteNumber(book.lastPageReached))) return null;
  const studyNumbers = ["sessions", "completedSessions", "activeDaysLast30", "completedPlans", "totalPlans", "completedTasks", "totalTasks", "totalStudyMinutes"];
  if (studyNumbers.some((key) => !isFiniteNumber(study[key])) || !["planCompletionPercent", "taskCompletionPercent", "sessionDurationAdherencePercent"].every((key) => isNullableNumber(study[key]))) return null;
  if (!["matches", "wins", "podiumFinishes", "answeredQuestions", "totalQuestions"].every((key) => isFiniteNumber(multiplayer[key])) || !["averageAccuracy", "questionCompletionPercent"].every((key) => isNullableNumber(multiplayer[key]))) return null;
  if (!["trackedCards", "reviewedCards", "totalRepetitions"].every((key) => isFiniteNumber(flashcards[key])) || !isFiniteNumber(studyModeCalls.acceptedOrJoined)) return null;
  if (!["activitiesAttempted", "videoViews", "videosCompleted", "secondsWatchedRecorded"].every((key) => isFiniteNumber(earlyLearning[key])) || !isStringArray(earlyLearning.skills)) return null;
  if (!["scheduledItems", "reviewedItems", "totalReviewsRecorded"].every((key) => isFiniteNumber(revision[key]))) return null;
  if (!isFiniteNumber(participation.tournamentsJoined) || !isFiniteNumber(participation.studyCompetitionsJoined)) return null;
  return value as unknown as LearningActivitySummary;
};

const normalizeInsights = (value: unknown): LearningAIInsights | null => {
  if (!isRecord(value) || typeof value.summary !== "string") return null;
  const keys = ["learningPatterns", "readingInsights", "disciplineInsights", "multiplayerInsights", "recommendations", "evidenceLimitations"];
  if (keys.some((key) => !isStringArray(value[key]))) return null;
  return value as unknown as LearningAIInsights;
};

const normalizeCoverage = (value: unknown): LearningData["dataCoverage"] => {
  if (!isRecord(value) || !isRecord(value.sources) || !isRecord(value.records) ||
      !Array.isArray(value.sampleLimits) || !Array.isArray(value.excludedSources) ||
      typeof value.window !== "string") return null;
  return value as unknown as LearningData["dataCoverage"];
};

const normalizeTopicMastery = (value: unknown): Record<string, TopicMastery> => {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, TopicMastery>>((result, [topic, raw]) => {
    if (!isRecord(raw)) return result;
    const mastery = Number(raw.mastery);
    if (!Number.isFinite(mastery)) return result;
    result[topic] = {
      mastery: Math.max(0, Math.min(100, mastery)),
      status: typeof raw.status === "string" ? raw.status : "developing",
    };
    return result;
  }, {});
};
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
        const activitySummary = normalizeActivitySummary(data.activity_summary);
        const aiInsights = normalizeInsights(data.ai_insights);
        const dataCoverage = normalizeCoverage(data.data_coverage);
        setLearningData({
          topicMastery: normalizeTopicMastery(data.topic_mastery),
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
