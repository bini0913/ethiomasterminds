import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const payload = (await req.json()) as RequestBody;

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
