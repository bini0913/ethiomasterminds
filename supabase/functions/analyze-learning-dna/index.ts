import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const asArray = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];
const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const average = (values: number[]) => values.length
  ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  : 0;
const percent = (numerator: number, denominator: number) => denominator > 0
  ? Math.round((numerator / denominator) * 100)
  : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Learning DNA is missing required Supabase environment configuration.");
      return jsonResponse({ error: "Learning DNA is temporarily unavailable." }, 500);
    }
    if (!authorization) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!groqApiKey) {
      console.error("Learning DNA requires the existing Groq secret (GROQ_API_KEY).");
      return jsonResponse({ error: "Groq AI is not configured for Learning DNA. Ask an administrator to verify the server-side GROQ_API_KEY." }, 503);
    }

    // All source reads use the student's JWT and existing RLS policies.
    const studentClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await studentClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const dailyLimit = await studentClient.rpc("consume_configured_ai_request");
    if (dailyLimit.error) {
      if (dailyLimit.error.code === "PGRST202") {
        console.error("Admin AI settings migration is not applied; per-minute Learning DNA protection remains active.");
      } else {
        throw dailyLimit.error;
      }
    } else if (!dailyLimit.data) {
      return jsonResponse({ error: "AI is disabled by the administrator or your rolling 24-hour request limit has been reached." }, 429);
    }

    const rateLimit = await studentClient.rpc("consume_edge_rate_limit", {
      p_bucket: "learning-dna",
      p_limit: 5,
      p_window_seconds: 300,
    });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return jsonResponse({ error: "Please wait before generating another Learning DNA report." }, 429);

    // Each source is independently degradable: one unavailable feature does not hide valid activity from others.
    const readSource = async (name: string, query: any) => {
      const { data, error } = await query;
      if (error) {
        console.error("Learning DNA source unavailable:", name, error.message);
        return { rows: [] as any[], available: false };
      }
      return { rows: asArray(data), available: true };
    };

    const [attemptSource, readingSource, sessionSource, planSource, taskSource, flashcardSource, multiplayerSource, callSource, earlyAttemptSource, videoSource, revisionSource, tournamentSource, studyCompetitionSource] = await Promise.all([
      readSource("question_attempts", studentClient.from("question_attempts")
        .select("is_correct,time_taken_seconds,created_at,questions(subject,quizzes(subject,title))")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(500)),
      readSource("reading_progress", studentClient.from("reading_progress")
        .select("book_id,completion_percent,last_page,time_spent_seconds,updated_at,library_books(title,subject)")
        .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(300)),
      readSource("study_sessions", studentClient.from("study_sessions")
        .select("duration,planned_duration,status,start_time,end_time,mode,created_at")
        .eq("user_id", user.id).order("start_time", { ascending: false }).limit(500)),
      readSource("study_plans", studentClient.from("study_plans")
        .select("completed,scheduled_date,subject,topic,created_at")
        .eq("user_id", user.id).order("scheduled_date", { ascending: false }).limit(500)),
      readSource("study_tasks", studentClient.from("study_tasks")
        .select("completed,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(500)),
      readSource("user_flashcard_progress", studentClient.from("user_flashcard_progress")
        .select("status,repetition_count,last_reviewed_at,next_review_date,flashcard_id")
        .eq("user_id", user.id).order("last_reviewed_at", { ascending: false }).limit(500)),
      readSource("multiplayer_match_results", studentClient.from("multiplayer_match_results")
        .select("placement,player_count,correct_answers,answered_questions,total_questions,accuracy,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(300)),
      readSource("study_call_participants", studentClient.from("study_call_participants")
        .select("status,created_at,responded_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(200)),
      // Early activity correctness is excluded because the reward RPC still accepts client-supplied correctness/completion flags.
      readSource("early_activity_attempts", studentClient.from("early_activity_attempts")
        .select("activity_id,skill,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(500)),
      readSource("early_video_views", studentClient.from("early_video_views")
        .select("video_id,seconds_watched,completed,updated_at")
        .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(300)),
      readSource("revision_schedule", studentClient.from("revision_schedule")
        .select("last_reviewed_at,times_reviewed,status,scheduled_for")
        .eq("user_id", user.id).order("scheduled_for", { ascending: false }).limit(500)),
      // Tournament participation is counted only; client-editable rank/score are not trusted.
      readSource("tournament_participants", studentClient.from("tournament_participants")
        .select("tournament_id,registered_at")
        .eq("user_id", user.id).order("registered_at", { ascending: false }).limit(200)),
      readSource("study_participants", studentClient.from("study_participants")
        .select("competition_id,joined_at")
        .eq("user_id", user.id).order("joined_at", { ascending: false }).limit(200)),
    ]);

    const attempts = attemptSource.rows;
    const reading = readingSource.rows;
    const sessions = sessionSource.rows;
    const plans = planSource.rows;
    const tasks = taskSource.rows;
    const flashcards = flashcardSource.rows;
    const matches = multiplayerSource.rows;
    const calls = callSource.rows;
    const earlyAttempts = earlyAttemptSource.rows;
    const videoViews = videoSource.rows;
    const revisions = revisionSource.rows;
    const tournamentEntries = tournamentSource.rows;
    const studyCompetitionEntries = studyCompetitionSource.rows;

    const topicStats: Record<string, { correct: number; total: number }> = {};
    for (const attempt of attempts) {
      const question = Array.isArray(attempt.questions) ? attempt.questions[0] : attempt.questions;
      const quiz = Array.isArray(question?.quizzes) ? question.quizzes[0] : question?.quizzes;
      const subject = String(quiz?.subject || question?.subject || "Uncategorized").slice(0, 100);
      const quizTitle = String(quiz?.title || "Practice questions").slice(0, 120);
      const area = subject + " — " + quizTitle;
      if (!topicStats[area]) topicStats[area] = { correct: 0, total: 0 };
      topicStats[area].total += 1;
      if (attempt.is_correct === true) topicStats[area].correct += 1;
    }

    const topicMastery: Record<string, { mastery: number; status: string }> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    for (const [area, stats] of Object.entries(topicStats)) {
      const accuracy = percent(stats.correct, stats.total) ?? 0;
      const status = stats.total < 3 ? "developing" : accuracy >= 80 ? "mastered" : accuracy >= 60 ? "learning" : "needs-work";
      topicMastery[area] = { mastery: accuracy, status };
      if (stats.total >= 5 && accuracy >= 80) strengths.push(area);
      if (stats.total >= 5 && accuracy < 50) weaknesses.push(area);
    }

    const bookSummaries = reading.slice(0, 20).map((row: any) => {
      const book = Array.isArray(row.library_books) ? row.library_books[0] : row.library_books;
      return {
        title: String(book?.title || "Untitled book").slice(0, 120),
        subject: String(book?.subject || "Uncategorized").slice(0, 80),
        completionPercent: Math.max(0, Math.min(100, numberOrZero(row.completion_percent))),
        timeSpentSeconds: numberOrZero(row.time_spent_seconds),
        lastPageReached: numberOrZero(row.last_page),
      };
    });
    const readingTimeSeconds = reading.reduce((sum: number, row: any) => sum + numberOrZero(row.time_spent_seconds), 0);
    const completedBooks = reading.filter((row: any) => numberOrZero(row.completion_percent) >= 100).length;

    const completedSessions = sessions.filter((row: any) => String(row.status).toLowerCase() === "completed").length;
    const activeCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activeStudyDays = new Set(sessions
      .map((row: any) => row.start_time)
      .filter((value: unknown) => typeof value === "string" && new Date(value).getTime() >= activeCutoff)
      .map((value: string) => value.slice(0, 10))).size;
    const plannedDuration = sessions.reduce((sum: number, row: any) => sum + numberOrZero(row.planned_duration), 0);
    const actualDuration = sessions.reduce((sum: number, row: any) => sum + numberOrZero(row.duration), 0);
    const sessionAdherence = plannedDuration > 0 ? Math.min(100, Math.round((actualDuration / plannedDuration) * 100)) : null;

    const completedPlans = plans.filter((row: any) => row.completed === true).length;
    const completedTasks = tasks.filter((row: any) => row.completed === true).length;
    const reviewedCards = flashcards.filter((row: any) => Boolean(row.last_reviewed_at)).length;
    const totalRepetitions = flashcards.reduce((sum: number, row: any) => sum + numberOrZero(row.repetition_count), 0);
    const multiplayerCorrect = matches.reduce((sum: number, row: any) => sum + numberOrZero(row.correct_answers), 0);
    const multiplayerAnswered = matches.reduce((sum: number, row: any) => sum + numberOrZero(row.answered_questions), 0);
    const multiplayerTotal = matches.reduce((sum: number, row: any) => sum + numberOrZero(row.total_questions), 0);
    const multiplayerWins = matches.filter((row: any) => numberOrZero(row.placement) === 1).length;
    const multiplayerPodiums = matches.filter((row: any) => numberOrZero(row.placement) > 0 && numberOrZero(row.placement) <= 3).length;
    const acceptedCalls = calls.filter((row: any) => row.status === "accepted" || row.status === "left").length;

    const earlyLearning = {
      activitiesAttempted: earlyAttempts.length,
      skills: [...new Set(earlyAttempts.map((row: any) => String(row.skill || "General").slice(0, 80)))].slice(0, 20),
      videoViews: videoViews.length,
      videosCompleted: videoViews.filter((row: any) => row.completed === true).length,
      secondsWatchedRecorded: videoViews.reduce((sum: number, row: any) => sum + numberOrZero(row.seconds_watched), 0),
    };
    const revisionActivity = {
      scheduledItems: revisions.length,
      reviewedItems: revisions.filter((row: any) => Boolean(row.last_reviewed_at)).length,
      totalReviewsRecorded: revisions.reduce((sum: number, row: any) => sum + numberOrZero(row.times_reviewed), 0),
    };
    const participation = {
      tournamentsJoined: tournamentEntries.length,
      studyCompetitionsJoined: studyCompetitionEntries.length,
    };

    const activitySummary = {
      earlyLearning,
      revision: revisionActivity,
      participation,
      quizzes: {
        attempts: attempts.length,
        accuracy: percent(attempts.filter((row: any) => row.is_correct === true).length, attempts.length),
        learningAreas: Object.keys(topicStats).length,
        subjects: [...new Set(Object.keys(topicStats).map((key) => key.split(" — ")[0]))].slice(0, 20),
      },
      reading: {
        booksOpened: reading.length,
        booksCompleted,
        averageCompletionPercent: average(reading.map((row: any) => Math.max(0, Math.min(100, numberOrZero(row.completion_percent))))),
        totalReadingSeconds: readingTimeSeconds,
        books: bookSummaries,
      },
      study: {
        sessions: sessions.length,
        completedSessions,
        activeDaysLast30: activeStudyDays,
        completedPlans,
        totalPlans: plans.length,
        planCompletionPercent: percent(completedPlans, plans.length),
        completedTasks,
        totalTasks: tasks.length,
        taskCompletionPercent: percent(completedTasks, tasks.length),
        sessionDurationAdherencePercent: sessionAdherence,
        totalStudyMinutes: actualDuration,
      },
      multiplayer: {
        matches: matches.length,
        wins: multiplayerWins,
        podiumFinishes: multiplayerPodiums,
        averageAccuracy: percent(multiplayerCorrect, multiplayerAnswered),
        questionCompletionPercent: percent(multiplayerAnswered, multiplayerTotal),
        answeredQuestions: multiplayerAnswered,
        totalQuestions: multiplayerTotal,
      },
      flashcards: {
        trackedCards: flashcards.length,
        reviewedCards,
        totalRepetitions,
      },
      studyModeCalls: { acceptedOrJoined: acceptedCalls },
    };

    const sourceRows = {
      quizAttempts: attempts.length,
      readingProgress: reading.length,
      studySessions: sessions.length,
      studyPlans: plans.length,
      studyTasks: tasks.length,
      flashcardProgress: flashcards.length,
      multiplayerMatches: matches.length,
      studyModeCalls: calls.length,
      earlyLearningAttempts: earlyAttempts.length,
      videoViews: videoViews.length,
      revisionItems: revisions.length,
      tournamentEntries: tournamentEntries.length,
      studyCompetitionEntries: studyCompetitionEntries.length,
    };
    const totalActivityEvents = Object.values(sourceRows).reduce((sum, count) => sum + count, 0);
    const anySourceAvailable = [
      attemptSource, readingSource, sessionSource, planSource, taskSource, flashcardSource,
      multiplayerSource, callSource, earlyAttemptSource, videoSource, revisionSource,
      tournamentSource, studyCompetitionSource,
    ].some((source) => source.available);
    if (totalActivityEvents === 0 && !anySourceAvailable) {
      console.error("Learning DNA could not read any activity source for the authenticated student.");
      return jsonResponse({ error: "Your learning activity could not be loaded. Please try again later." }, 500);
    }
    if (totalActivityEvents === 0) {
      return jsonResponse({
        success: true,
        status: "insufficient_data",
        message: "Your Learning DNA is ready to grow. Complete a learning activity such as reading, a study session, flashcard review, quiz or multiplayer match first.",
        data: null,
      });
    }

    const sampleLimits = [
      ["quizAttempts", 500], ["readingProgress", 300], ["studySessions", 500],
      ["studyPlans", 500], ["studyTasks", 500], ["flashcardProgress", 500],
      ["multiplayerMatches", 300], ["studyModeCalls", 200], ["earlyLearningAttempts", 500],
      ["videoViews", 300], ["revisionItems", 500], ["tournamentEntries", 200], ["studyCompetitionEntries", 200],
    ].filter(([key, limit]) => sourceRows[key as keyof typeof sourceRows] >= (limit as number)).map(([key]) => key);

    const dataCoverage = {
      sources: {
        quizAttempts: attemptSource.available,
        readingProgress: readingSource.available,
        studySessions: sessionSource.available,
        studyPlans: planSource.available,
        studyTasks: taskSource.available,
        flashcardProgress: flashcardSource.available,
        multiplayerMatches: multiplayerSource.available,
        studyModeCalls: callSource.available,
        earlyLearningAttempts: earlyAttemptSource.available,
        videoViews: videoSource.available,
        revisionItems: revisionSource.available,
        tournamentEntries: tournamentSource.available,
        studyCompetitionEntries: studyCompetitionSource.available,
      },
      records: sourceRows,
      sampleLimits,
      excludedSources: [
        "topic_progress (client-editable snapshot; quiz mastery is derived from verified question_attempts instead)",
        "user_missions and user_achievements (client-editable state; not used as proof of completed learning)",
        "tournament rank and score (client-editable fields; only registration is counted)",
        "early activity correctness/rewards (not used because the current reward RPC accepts client-supplied correctness/completion flags)",
      ],
      window: "Most recent records returned by each source; source limits are recorded above.",
    };

    const learningDnaSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        learningPatterns: { type: "array", items: { type: "string" } },
        readingInsights: { type: "array", items: { type: "string" } },
        disciplineInsights: { type: "array", items: { type: "string" } },
        multiplayerInsights: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        evidenceLimitations: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "learningPatterns", "readingInsights", "disciplineInsights", "multiplayerInsights", "recommendations", "evidenceLimitations"],
    };

    const prompt = [
      "You are the learning intelligence engine inside Master Minds, an Ethiopian educational app.",
      "Analyze only the supplied aggregated records for this one signed-in student.",
      "Do not infer personality, intelligence, motivation, mental health, family circumstances, or career suitability.",
      "Do not shame, rank, diagnose, or label the student. Describe discipline as observable consistency and follow-through, never as a moral judgement.",
      "Reading progress and time do not prove comprehension. Reading progress is a per-book snapshot, not a complete session-by-session reading history. Early learning activity counts are engagement only and must not be treated as correctness or mastery. Video watch time, reading progress, study sessions, study-plan/task completion, flashcard reviews, and revision counts are app-recorded activity signals; they do not prove focused attention or comprehension. Treat them as usage records, not verified learning outcomes. Tournament and study-competition participation counts do not prove performance. Multiplayer wins do not prove teamwork or fair play; answered-question completion is only an engagement measure. Never claim these things are measured.",
      "Do not invent missing events, subjects, book titles, progress, or causes. If a source is unavailable or empty, say evidence is not available. Do not use client-editable topic_progress, mission or achievement state, tournament scores/ranks, or early-activity correctness/reward values as proof of learning.",
      "Separate measured facts from possible interpretations. Give specific, age-appropriate, encouraging recommendations that are realistic for a student.",
      "Use only the provided evidence. Do not make predictions about careers. Return concise, useful content matching the required JSON schema.",
      "Verified activity data:",
      JSON.stringify({ activitySummary, topicMastery, strengths, weaknesses, dataCoverage }),
    ].join("\n\n");

    // Use the same Groq endpoint and model already configured by Master Minds' AI Tutor,
    // AI Helper, Academic Insights, and Study Planner functions.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    let aiInsights: any;
    try {
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: "Bearer " + groqApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 0.2,
          max_completion_tokens: 1600,
          messages: [
            {
              role: "system",
              content: "You are a careful educational learning analyst. Return the requested structured report using only the supplied evidence.",
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_learning_dna_report",
                description: "Return a structured evidence-based Learning DNA report for the authenticated student.",
                parameters: learningDnaSchema,
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "create_learning_dna_report" },
          },
        }),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error("Groq Learning DNA request failed:", groqResponse.status, errorText.slice(0, 500));
        if (groqResponse.status === 429) {
          return jsonResponse({ error: "Groq is busy or its free-tier limit has been reached. Please try again later." }, 429);
        }
        if (groqResponse.status === 401 || groqResponse.status === 403) {
          return jsonResponse({ error: "The server-side Groq API key was rejected. Ask an administrator to check GROQ_API_KEY." }, 503);
        }
        return jsonResponse({ error: "Groq could not complete your Learning DNA analysis. Please try again." }, 502);
      }

      const groqData = await groqResponse.json();
      const toolCall = groqData.choices?.[0]?.message?.tool_calls?.find(
        (call: any) => call.function?.name === "create_learning_dna_report",
      );
      const outputText = toolCall?.function?.arguments;
      if (typeof outputText !== "string") throw new Error("Groq returned no structured Learning DNA report.");
      aiInsights = JSON.parse(outputText);
      const requiredArrays = ["learningPatterns", "readingInsights", "disciplineInsights", "multiplayerInsights", "recommendations", "evidenceLimitations"];
      if (typeof aiInsights.summary !== "string" || requiredArrays.some((key) => !Array.isArray(aiInsights[key]) || !aiInsights[key].every((entry: unknown) => typeof entry === "string"))) {
        throw new Error("Groq returned an invalid Learning DNA report.");
      }
      for (const key of requiredArrays) aiInsights[key] = aiInsights[key].slice(0, 6).map((value: string) => value.slice(0, 320));
      aiInsights.summary = aiInsights.summary.slice(0, 1200);
    } finally {
      clearTimeout(timeoutId);
    }

    const now = new Date().toISOString();
    const predictedPath = {
      recommendedFocus: aiInsights.recommendations.slice(0, 5),
      studyTips: aiInsights.disciplineInsights.concat(aiInsights.readingInsights).slice(0, 5),
      predictedCareerPaths: [],
    };
    const report = {
      user_id: user.id,
      topic_mastery: topicMastery,
      strengths,
      weaknesses,
      learning_style: "not_assessed",
      predicted_path: predictedPath,
      activity_summary: activitySummary,
      ai_insights: aiInsights,
      data_coverage: dataCoverage,
      last_analyzed_at: now,
      updated_at: now,
    };

    // The service role is used only for this authenticated user's server-generated report.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: upsertError } = await adminClient
      .from("learning_dna")
      .upsert(report, { onConflict: "user_id" });
    if (upsertError) {
      console.error("Learning DNA report save failed:", upsertError);
      return jsonResponse({ error: "Your Learning DNA report could not be saved. Please try again." }, 500);
    }

    return jsonResponse({
      success: true,
      status: "ready",
      data: {
        topicMastery,
        strengths,
        weaknesses,
        learningStyle: "not_assessed",
        predictedPath,
        activitySummary,
        aiInsights,
        dataCoverage,
        totalAttempts: attempts.length,
        totalActivityEvents,
      },
    });
  } catch (error) {
    console.error("Learning DNA analysis failed:", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: "Learning DNA could not be updated. Please try again." }, 500);
  }
});
