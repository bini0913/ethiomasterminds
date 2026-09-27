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

    const rateLimit = await supabase.rpc("consume_edge_rate_limit", { p_bucket: "ai-study-planner", p_limit: 10, p_window_seconds: 300 });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return new Response(JSON.stringify({ error: "Please wait before generating another study plan." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { weakTopics, analytics, grade, existingPlans } = await req.json();
    if (typeof grade !== "string" || grade.length > 40) return new Response(JSON.stringify({ error: "Invalid grade" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(weakTopics) || weakTopics.length > 50 || !Array.isArray(analytics) || analytics.length > 100 || !Array.isArray(existingPlans) || existingPlans.length > 50) return new Response(JSON.stringify({ error: "Invalid planning data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (JSON.stringify({ weakTopics, analytics, existingPlans }).length > 30000) return new Response(JSON.stringify({ error: "Request data is too large" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are an academic study planner for a Grade ${grade} Ethiopian student preparing for university entrance exams.

Based on their performance data:
- Weak topics: ${JSON.stringify(weakTopics?.slice(0, 10) || [])}
- Subject analytics: ${JSON.stringify(analytics || [])}
- Existing plans: ${JSON.stringify(existingPlans?.slice(0, 5) || [])}

Generate a 7-day study plan. Return ONLY a JSON object with a "suggestions" array. Each item must have:
- subject: "math", "science", "english", or "history"
- topic: specific topic to study
- priority: "high", "medium", or "low"
- day_offset: 0-6 (0=today)
- notes: brief study tip

Prioritize weak areas. Include variety. Focus on entrance exam topics.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert Ethiopian academic tutor. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_study_plan",
            description: "Create a weekly study plan",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      subject: { type: "string", enum: ["math", "science", "english", "history"] },
                      topic: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      day_offset: { type: "number" },
                      notes: { type: "string" },
                    },
                    required: ["subject", "topic", "priority", "day_offset", "notes"],
                  },
                },
              },
              required: ["suggestions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_study_plan" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = toolCall ? JSON.parse(toolCall.function.arguments) : { suggestions: [] };

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ suggestions: [], error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
