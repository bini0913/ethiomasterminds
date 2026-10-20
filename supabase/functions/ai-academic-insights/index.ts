import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return new Response(JSON.stringify({ error: "Invalid authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const dailyLimit = await supabase.rpc("consume_configured_ai_request");
    if (dailyLimit.error) throw dailyLimit.error;
    if (!dailyLimit.data) return new Response(JSON.stringify({ error: "AI is disabled by the administrator or your rolling 24-hour request limit has been reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const rateLimit = await supabase.rpc("consume_edge_rate_limit", { p_bucket: "ai-academic-insights", p_limit: 10, p_window_seconds: 300 });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return new Response(JSON.stringify({ error: "Please wait before generating another analysis." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { stats, topicData, streak, grade, xp, curriculum, studyGoal, book, subjects } = body;
    if (typeof grade !== "string" || grade.length > 40) return new Response(JSON.stringify({ error: "Invalid grade" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(topicData) || topicData.length > 100) return new Response(JSON.stringify({ error: "Invalid topic data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (JSON.stringify({ stats, topicData, streak, xp, curriculum, studyGoal, book, subjects }).length > 20000) return new Response(JSON.stringify({ error: "Request data is too large" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const safeSubjects = Array.isArray(subjects) ? subjects.filter((s: unknown) => typeof s === "string").slice(0, 20) : [];
    const prompt = `You are the adaptive Academic Prep advisor for a Grade ${grade} student. Do not assume university entrance preparation unless the saved goal explicitly calls for it.

Personal learning context:
- Goal: ${String(studyGoal || "general academic progress").slice(0, 200)}
- Curriculum: ${String(curriculum || "not specified").slice(0, 120)}
- Selected subjects: ${JSON.stringify(safeSubjects)}
- Library resources: ${String(book || "not specified").slice(0, 500)}

Student data:
- XP: ${xp}, Overall accuracy: ${stats?.accuracy || 0}%, Quizzes completed: ${stats?.total_quizzes || 0}
- Current streak: ${streak?.current_streak || 0} days, Longest: ${streak?.longest_streak || 0} days
- Topic performance: ${JSON.stringify((topicData || []).slice(0, 15).map((t: any) => ({ subject: t.subject, topic: t.topic, accuracy: t.accuracy_percentage, attempted: t.questions_attempted })))}

Provide a personalized academic analysis with:
1. Overall performance assessment (2-3 sentences)
2. Strongest areas and why
3. Weakest areas with specific improvement strategies
4. Study consistency evaluation
5. 4-5 actionable recommendations aligned with the saved goal, grade, subjects, curriculum, Library resources, and weak areas
6. Give a readiness estimate only for a specific exam goal with enough relevant practice data; otherwise explain what evidence is missing instead of inventing a percentage

Separate measured results from hypotheses. If little data exists, say so and recommend a short diagnostic. Be encouraging, specific, and concise.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: "You are a supportive Ethiopian academic advisor. Be encouraging, specific, and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status);
      return new Response(JSON.stringify({ insights: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const insights = result.choices?.[0]?.message?.content || null;

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ insights: null, error: "Failed to generate academic insights" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
