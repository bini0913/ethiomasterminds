import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "summary" | "simple" | "questions" | "flashcards" | "concepts";

interface RequestBody {
  action: Action;
  text: string;
  grade?: number;
  subject?: string;
}

const MAX_TEXT_CHARS = 3500;

function buildPrompt(payload: RequestBody) {
  const grade = payload.grade || 9;
  const style = grade <= 4 ? "simple vocabulary" : "exam-ready concise academic tone";
  const actionInstructions: Record<Action, string> = {
    summary: "Write a concise, structured summary with the main ideas and important terms.",
    simple: "Explain the excerpt in clear steps using age-appropriate language. Define difficult terms.",
    questions: "Create exactly 5 useful question-and-answer pairs. Each pair must be a separate block with exactly two lines: Q1: question text, then A1: answer text. Continue numbering. Do not omit answers.",
    flashcards: "Create exactly 8 study flashcards. Each card must be a separate block with exactly two lines: Front: a clear recall question or term, then Back: a concise accurate answer. Do not use generic labels such as Concept 1.",
    concepts: "List the key concepts, each with a short definition and why it matters for this subject.",
  };

  return `You are a careful reading and study assistant for students.
Action: ${payload.action}
Subject: ${payload.subject || "General"}
Grade: ${grade}
Style: ${style}

Task:
${actionInstructions[payload.action]}

Rules:
- Use only information supported by the provided excerpt.
- Do not invent facts, formulas, page references, or citations.
- If the excerpt does not contain enough information, say so clearly.
- Use language appropriate for the student's grade.
- Output plain text only and follow the requested format exactly.

Excerpt:
${payload.text.slice(0, MAX_TEXT_CHARS)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return new Response(JSON.stringify({ error: "Invalid authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const dailyLimit = await supabase.rpc("consume_configured_ai_request");
    if (dailyLimit.error) {
      if (dailyLimit.error.code === "PGRST202") {
        console.error("Admin AI settings migration is not applied yet; existing per-minute protection remains active.");
      } else {
        throw dailyLimit.error;
      }
    } else if (!dailyLimit.data) {
      return new Response(JSON.stringify({ error: "AI is disabled by the administrator or your rolling 24-hour request limit has been reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rateLimit = await supabase.rpc("consume_edge_rate_limit", { p_bucket: "library-ai", p_limit: 30, p_window_seconds: 60 });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = (await req.json()) as RequestBody;

    if (!["summary", "simple", "questions", "flashcards", "concepts"].includes(payload?.action)) {
      return new Response(JSON.stringify({ error: "Invalid action." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof payload?.text !== "string" || payload.text.length > MAX_TEXT_CHARS) {
      return new Response(JSON.stringify({ error: "Text is required and must be 3500 characters or fewer." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (payload.grade !== undefined && (!Number.isInteger(payload.grade) || payload.grade < 1 || payload.grade > 12)) {
      return new Response(JSON.stringify({ error: "Invalid grade." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (payload.subject !== undefined && (typeof payload.subject !== "string" || payload.subject.length > 100)) {
      return new Response(JSON.stringify({ error: "Invalid subject." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!payload?.text?.trim()) {
      return new Response(JSON.stringify({ error: "Text is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const prompt = buildPrompt(payload);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: "You help students study from book excerpts. Follow requested action exactly and be concise.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("library-ai gateway error:", response.status, text.slice(0, 300));
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ response: content || "No AI output generated." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("library-ai error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "Failed to generate AI content." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
