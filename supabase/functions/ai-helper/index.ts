import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: Message[];
  mode?: "hint" | "explain" | "coach" | "silent";
  context?: {
    subject?: string;
    topic?: string;
    question?: string;
    userAnswer?: string;
    correctAnswer?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode = "explain", context }: RequestBody = await req.json();

    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Too many messages (max 50)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    for (const msg of messages) {
      if (!msg || typeof msg.role !== "string" || typeof msg.content !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid message format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!["user", "assistant", "system"].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: "Invalid message role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg.content.length > 5000) {
        return new Response(
          JSON.stringify({ error: "Message content too long (max 5000 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    if (!["hint", "explain", "coach", "silent"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const clip = (s: unknown, max: number) =>
      typeof s === "string" ? s.slice(0, max) : undefined;
    const safeContext = context
      ? {
          subject: clip(context.subject, 100),
          topic: clip(context.topic, 200),
          question: clip(context.question, 1000),
          userAnswer: clip(context.userAnswer, 1000),
          correctAnswer: clip(context.correctAnswer, 500),
        }
      : undefined;

    let systemPrompt = `You are Plus, a friendly and encouraging AI learning assistant for Master Minds, an educational quiz platform. You speak like a supportive friend and tutor.

Your personality:
- Friendly, warm, and encouraging
- Uses simple language appropriate for students
- Celebrates successes with enthusiasm
- Gently guides through mistakes without making students feel bad
- Uses occasional emojis to be engaging (but not excessive)

Current mode: ${mode}
`;

    if (mode === "hint") {
      systemPrompt += `\nYou are in HINT mode. Give subtle hints without revealing the answer directly. Be encouraging and guide the student toward the solution.`;
    } else if (mode === "explain") {
      systemPrompt += `\nYou are in EXPLAIN mode. After an answer is given, explain the concept clearly with step-by-step reasoning. If the answer was wrong, explain what the correct answer is and why.`;
    } else if (mode === "coach") {
      systemPrompt += `\nYou are in COACH mode. Guide the student step-by-step through solving the problem, asking questions to help them think.`;
    } else if (mode === "silent") {
      systemPrompt += `\nYou are in SILENT mode. Keep responses brief and only respond when directly asked.`;
    }

    if (safeContext) {
      systemPrompt += `\n\nContext:`;
      if (safeContext.subject) systemPrompt += `\n- Subject: ${safeContext.subject}`;
      if (safeContext.topic) systemPrompt += `\n- Topic: ${safeContext.topic}`;
      if (safeContext.question) systemPrompt += `\n- Current Question: ${safeContext.question}`;
      if (safeContext.userAnswer) systemPrompt += `\n- User's Answer: ${safeContext.userAnswer}`;
      if (safeContext.correctAnswer) systemPrompt += `\n- Correct Answer: ${safeContext.correctAnswer}`;
    }

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again!";

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-helper function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get AI response", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
