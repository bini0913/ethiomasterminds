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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Learning DNA function is missing required Supabase environment configuration.");
      return jsonResponse({ error: "Learning DNA is temporarily unavailable." }, 500);
    }

    if (!authorization) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Keep reads scoped to the caller's JWT and RLS policies.
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const dailyLimit = await supabaseClient.rpc("consume_configured_ai_request");
    if (dailyLimit.error) {
      if (dailyLimit.error.code === "PGRST202") {
        console.error("Admin AI settings migration is not applied; Learning DNA per-minute protection remains active.");
      } else {
        throw dailyLimit.error;
      }
    } else if (!dailyLimit.data) {
      return jsonResponse({
        error: "AI is disabled by the administrator or your rolling 24-hour request limit has been reached.",
      }, 429);
    }

    const rateLimit = await supabaseClient.rpc("consume_edge_rate_limit", {
      p_bucket: "learning-dna",
      p_limit: 5,
      p_window_seconds: 300,
    });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) {
      return jsonResponse({ error: "Please wait before generating another report." }, 429);
    }

    const { data: attempts, error: attemptsError } = await supabaseClient
      .from("question_attempts")
      .select("is_correct,time_taken_seconds,questions(subject,quizzes(subject))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (attemptsError) {
      console.error("Error fetching Learning DNA attempts:", attemptsError);
      return jsonResponse({ error: "Your quiz history could not be loaded. Please try again." }, 500);
    }

    const totalAttempts = attempts?.length ?? 0;
    if (totalAttempts === 0) {
      return jsonResponse({
        success: true,
        status: "insufficient_data",
        message: "Complete at least one quiz first. Your Learning DNA will be created from your recorded answers.",
        data: null,
      });
    }

    const subjectStats: Record<string, { correct: number; total: number; times: number[] }> = {};

    for (const attempt of attempts ?? []) {
      const subject = attempt.questions?.quizzes?.subject || attempt.questions?.subject || "Uncategorized";
      if (!subjectStats[subject]) {
        subjectStats[subject] = { correct: 0, total: 0, times: [] };
      }

      subjectStats[subject].total += 1;
      if (attempt.is_correct) subjectStats[subject].correct += 1;
      subjectStats[subject].times.push(Math.max(0, Number(attempt.time_taken_seconds) || 0));
    }

    const topicMastery: Record<string, { mastery: number; status: string }> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const [subject, stats] of Object.entries(subjectStats)) {
      const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      let status = "needs-work";
      if (accuracy >= 80) status = "mastered";
      else if (accuracy >= 60) status = "learning";

      topicMastery[subject] = { mastery: Math.round(accuracy), status };
      if (accuracy >= 80) strengths.push(subject);
      else if (accuracy < 50) weaknesses.push(subject);
    }

    const avgTimeOverall = attempts.reduce(
      (sum, attempt) => sum + Math.max(0, Number(attempt.time_taken_seconds) || 0),
      0,
    ) / totalAttempts;

    const learningStyle = avgTimeOverall > 60
      ? "analytical"
      : avgTimeOverall < 20
        ? "quick-thinker"
        : "balanced";

    let predictedPath: {
      recommendedFocus: string[];
      studyTips: string[];
      predictedCareerPaths: string[];
    } | null = null;

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (groqApiKey && Object.keys(topicMastery).length > 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: "Bearer " + groqApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [
              {
                role: "system",
                content: "You are an educational AI that analyzes student learning patterns. Provide brief, actionable insights.",
              },
              {
                role: "user",
                content: [
                  "Analyze this student's learning data and suggest a study path.",
                  "Strengths: " + (strengths.join(", ") || "None identified yet"),
                  "Weaknesses: " + (weaknesses.join(", ") || "None identified yet"),
                  "Topic mastery: " + JSON.stringify(topicMastery),
                  "Response pace category: " + learningStyle,
                  "Total questions attempted: " + totalAttempts,
                  "Return recommendedFocus, studyTips, and predictedCareerPaths as arrays of strings.",
                ].join("\n"),
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "analyze_learning_path",
                description: "Return structured learning path analysis",
                parameters: {
                  type: "object",
                  properties: {
                    recommendedFocus: { type: "array", items: { type: "string" } },
                    studyTips: { type: "array", items: { type: "string" } },
                    predictedCareerPaths: { type: "array", items: { type: "string" } },
                  },
                  required: ["recommendedFocus", "studyTips", "predictedCareerPaths"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "analyze_learning_path" } },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawArguments = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (typeof rawArguments === "string") {
            const parsed = JSON.parse(rawArguments);
            const isStringArray = (value: unknown) =>
              Array.isArray(value) && value.every((entry) => typeof entry === "string");
            if (
              isStringArray(parsed.recommendedFocus) &&
              isStringArray(parsed.studyTips) &&
              isStringArray(parsed.predictedCareerPaths)
            ) {
              predictedPath = {
                recommendedFocus: parsed.recommendedFocus.slice(0, 5),
                studyTips: parsed.studyTips.slice(0, 5),
                predictedCareerPaths: parsed.predictedCareerPaths.slice(0, 5),
              };
            }
          }
        } else {
          console.error("Learning DNA AI recommendation request failed:", aiResponse.status);
        }
      } catch (aiError) {
        console.error("Learning DNA AI recommendation error:", aiError);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const now = new Date().toISOString();
    const dnaData = {
      user_id: user.id,
      topic_mastery: topicMastery,
      strengths,
      weaknesses,
      learning_style: learningStyle,
      predicted_path: predictedPath,
      last_analyzed_at: now,
      updated_at: now,
    };

    // Only this authenticated server function writes reports. The service key
    // never leaves the Edge Function and is used only after auth.getUser().
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: upsertError } = await supabaseAdmin
      .from("learning_dna")
      .upsert(dnaData, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Error saving Learning DNA report:", upsertError);
      return jsonResponse({ error: "Your Learning DNA report could not be saved. Please try again." }, 500);
    }

    return jsonResponse({
      success: true,
      status: "ready",
      data: {
        topicMastery,
        strengths,
        weaknesses,
        learningStyle,
        predictedPath,
        totalAttempts,
      },
    });
  } catch (error) {
    console.error("Error in analyze-learning-dna:", error);
    return jsonResponse({ error: "Learning DNA could not be updated. Please try again." }, 500);
  }
});
