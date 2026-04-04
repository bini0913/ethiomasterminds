import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { stats, topicData, streak, grade, xp } = await req.json();
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
    console.error("Error:", e);
    return new Response(JSON.stringify({ insights: null, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
