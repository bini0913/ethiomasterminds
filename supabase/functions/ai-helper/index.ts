import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message { role: "user" | "assistant" | "system"; content: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return new Response(JSON.stringify({ error: "Invalid authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allowed = await supabase.rpc("consume_edge_rate_limit", { p_bucket: "ai-helper", p_limit: 30, p_window_seconds: 60 });
    if (allowed.error) throw allowed.error;
    if (!allowed.data) return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const messages = body?.messages as Message[];
    const mode = body?.mode ?? "explain";
    const context = body?.context;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) return new Response(JSON.stringify({ error: "messages must contain 1-50 items" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    for (const msg of messages) {
      if (!msg || !["user", "assistant", "system"].includes(msg.role) || typeof msg.content !== "string" || msg.content.length > 5000) {
        return new Response(JSON.stringify({ error: "Invalid message format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!["hint", "explain", "coach", "silent"].includes(mode)) return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const clip = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : undefined;
    const safeContext = context ? {
      subject: clip(context.subject, 100),
      topic: clip(context.topic, 200),
      question: clip(context.question, 1000),
      userAnswer: clip(context.userAnswer, 1000),
      correctAnswer: clip(context.correctAnswer, 500),
    } : undefined;

    let systemPrompt = `You are Plus, a friendly and encouraging AI learning assistant for Master Minds, an educational quiz platform. You speak like a supportive friend and tutor.

Your personality:
- Friendly, warm, and encouraging
- Uses simple language appropriate for students
- Celebrates successes with enthusiasm
- Gently guides through mistakes without making students feel bad
- Uses occasional emojis to be engaging (but not excessive)

Current mode: ${mode}
`;

    if (mode === "hint") systemPrompt += "\nYou are in HINT mode. Give subtle hints without revealing the answer directly.";
    if (mode === "explain") systemPrompt += "\nYou are in EXPLAIN mode. Explain the concept clearly and correct misunderstandings.";
    if (mode === "coach") systemPrompt += "\nYou are in COACH mode. Guide the student step-by-step.";
    if (mode === "silent") systemPrompt += "\nYou are in SILENT mode. Keep responses brief.";

    if (safeContext) {
      systemPrompt += "\n\nContext:";
      if (safeContext.subject) systemPrompt += `\n- Subject: ${safeContext.subject}`;
      if (safeContext.topic) systemPrompt += `\n- Topic: ${safeContext.topic}`;
      if (safeContext.question) systemPrompt += `\n- Current Question: ${safeContext.question}`;
      if (safeContext.userAnswer) systemPrompt += `\n- User's Answer: ${safeContext.userAnswer}`;
      if (safeContext.correctAnswer) systemPrompt += `\n- Correct Answer: ${safeContext.correctAnswer}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText.slice(0, 500));
      return new Response(JSON.stringify({ error: response.status === 429 ? "AI rate limit reached" : "AI service error" }), { status: response.status === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again!";
    return new Response(JSON.stringify({ response: aiResponse }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in ai-helper function:", error);
    return new Response(JSON.stringify({ error: "Failed to get AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
