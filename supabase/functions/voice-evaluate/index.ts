import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  transcribedText: string;
  correctAnswer: string;
  questionType: "multiple_choice" | "true_false" | "fill_blank";
  options?: string[];
}

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

    const allowed = await supabase.rpc("consume_edge_rate_limit", { p_bucket: "voice-evaluate", p_limit: 60, p_window_seconds: 60 });
    if (allowed.error) throw allowed.error;
    if (!allowed.data) return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: RequestBody = await req.json();
    const { transcribedText, correctAnswer, questionType, options } = body;

    if (typeof transcribedText !== "string" || transcribedText.length < 1 || transcribedText.length > 500) return new Response(JSON.stringify({ error: "Invalid transcribedText" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (typeof correctAnswer !== "string" || correctAnswer.length < 1 || correctAnswer.length > 500) return new Response(JSON.stringify({ error: "Invalid correctAnswer" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!["multiple_choice", "true_false", "fill_blank"].includes(questionType)) return new Response(JSON.stringify({ error: "Invalid questionType" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (options !== undefined && (!Array.isArray(options) || options.length > 10 || options.some((option) => typeof option !== "string" || option.length > 200))) return new Response(JSON.stringify({ error: "Invalid options" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const normalizedInput = transcribedText.toLowerCase().trim();
    const normalizedCorrect = correctAnswer.toLowerCase().trim();
    let isCorrect = false;
    let matchedOption = "";

    if (questionType === "true_false") {
      const userSaysTrue = ["true", "yes", "correct", "right", "affirmative"].some((v) => normalizedInput.includes(v));
      const userSaysFalse = ["false", "no", "incorrect", "wrong", "negative"].some((v) => normalizedInput.includes(v));
      if (normalizedCorrect === "true" && userSaysTrue) { isCorrect = true; matchedOption = "True"; }
      else if (normalizedCorrect === "false" && userSaysFalse) { isCorrect = true; matchedOption = "False"; }
    } else if (questionType === "multiple_choice" && options) {
      const letterMatch = normalizedInput.match(/\b([a-d])\b/);
      if (letterMatch) {
        const index = letterMatch[1].charCodeAt(0) - 97;
        if (index >= 0 && index < options.length) {
          matchedOption = options[index];
          isCorrect = matchedOption.toLowerCase() === normalizedCorrect;
        }
      }
      if (!matchedOption) {
        for (const option of options) {
          if (normalizedInput.includes(option.toLowerCase())) {
            matchedOption = option;
            isCorrect = option.toLowerCase() === normalizedCorrect;
            break;
          }
        }
      }
    } else if (questionType === "fill_blank") {
      const similarity = calculateSimilarity(normalizedInput, normalizedCorrect);
      isCorrect = similarity > 0.8;
      matchedOption = transcribedText;
    }

    return new Response(JSON.stringify({ isCorrect, matchedOption, transcribedText, confidence: isCorrect ? 1 : 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in voice-evaluate function:", error);
    return new Response(JSON.stringify({ error: "Failed to evaluate voice answer" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return 1 - matrix[s1.length][s2.length] / Math.max(s1.length, s2.length);
}
