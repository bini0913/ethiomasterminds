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

    const rateLimit = await supabase.rpc("consume_edge_rate_limit", { p_bucket: "ai-academic-insights", p_limit: 10, p_window_seconds: 300 });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return new Response(JSON.stringify({ error: "Please wait before generating another analysis." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { stats, topicData, streak, grade, xp } = body;
    if (typeof grade !== "string" || grade.length > 40) return new Response(JSON.stringify({ error: "Invalid grade" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(topicData) || topicData.length > 100) return new Response(JSON.stringify({ error: "Invalid topic data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (JSON.stringify({ stats, topicData, streak, xp }).length > 20000) return new Response(JSON.stringify({ error: "Request data is too large" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are an academic advisor for a Grade ${grade} Ethiopian student preparing for university entrance exams.

Student data:
- XP: ${xp}, Overall accuracy: ${stats?.accuracy || 0}%, Quizzes completed: ${stats?.total_quizzes || 0}
- Current streak: ${streak?.current_streak || 0} days, Longest: ${streak?.longest_streak || 0} days
- Topic performance: ${JSON.stringify((topicData || []).slice(0, 15).map((t: any) => ({ subject: t.subject, topic: t.topic, accuracy: t.accuracy_percentage, attempted: t.questions_attempted })))}

Provide a personalized academic analysis with:
1. Overall performance assessment (2-3 sentences)
2. Strongest areas and why
3. Weakest areas with specific improvement strategies
4. Study consistency evaluation
5. 4-5 actionable recommendations for entrance exam preparation
6. Predicted readiness level (percentage) for the entrance exam

Use emojis for visual appeal. Be encouraging but honest. Keep it concise and actionable.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
