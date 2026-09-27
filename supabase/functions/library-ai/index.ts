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

  return `You are a reading assistant for students.\nAction: ${payload.action}\nSubject: ${payload.subject || "General"}\nGrade: ${grade}\nStyle: ${style}\n\nRules:\n- Keep response grounded in the provided excerpt only.\n- If details are missing, say what is missing.\n- Output plain text only.\n\nExcerpt:\n${payload.text.slice(0, MAX_TEXT_CHARS)}`;
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

    const prompt = buildPrompt(payload);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      console.error("library-ai gateway error:", text);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ response: content || "No AI output generated." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("library-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate AI content.", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
