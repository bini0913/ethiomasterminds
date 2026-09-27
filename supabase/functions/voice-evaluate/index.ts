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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: allowed, error: rateError } = await client.rpc("consume_edge_rate_limit", {
      p_function_name: "voice-evaluate", p_limit: 30, p_window_seconds: 60,
    });
    if (rateError || allowed !== true) {
      return new Response(JSON.stringify({ error: "Too many voice evaluation requests. Please wait a moment and try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transcribedText, correctAnswer, questionType, options }: RequestBody = await req.json();

    // Input validation
    if (typeof transcribedText !== "string" || transcribedText.length === 0 || transcribedText.length > 500) {
      return new Response(
        JSON.stringify({ error: "Invalid transcribedText (1-500 chars required)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof correctAnswer !== "string" || correctAnswer.length === 0 || correctAnswer.length > 500) {
      return new Response(
        JSON.stringify({ error: "Invalid correctAnswer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!["multiple_choice", "true_false", "fill_blank"].includes(questionType)) {
      return new Response(
        JSON.stringify({ error: "Invalid questionType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length > 10 || options.some((o) => typeof o !== "string" || o.length > 200)) {
        return new Response(
          JSON.stringify({ error: "Invalid options" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const normalizedInput = transcribedText.toLowerCase().trim();
    const normalizedCorrect = correctAnswer.toLowerCase().trim();

    let isCorrect = false;
    let matchedOption = "";

    if (questionType === "true_false") {
      const trueVariants = ["true", "yes", "correct", "right", "affirmative"];
      const falseVariants = ["false", "no", "incorrect", "wrong", "negative"];
      
      const userSaysTrue = trueVariants.some(v => normalizedInput.includes(v));
      const userSaysFalse = falseVariants.some(v => normalizedInput.includes(v));
      
      if (normalizedCorrect === "true" && userSaysTrue) {
        isCorrect = true;
        matchedOption = "True";
      } else if (normalizedCorrect === "false" && userSaysFalse) {
        isCorrect = true;
        matchedOption = "False";
      }
    } else if (questionType === "multiple_choice" && options) {
      // Check for letter answers (A, B, C, D)
      const letterMatch = normalizedInput.match(/\b([a-d])\b/);
      if (letterMatch) {
        const letterIndex = letterMatch[1].charCodeAt(0) - 97; // 'a' = 0
        if (letterIndex >= 0 && letterIndex < options.length) {
          matchedOption = options[letterIndex];
          isCorrect = matchedOption.toLowerCase() === normalizedCorrect;
        }
      }
      
      // Check for direct option matches
      if (!matchedOption) {
        for (const option of options) {
          if (normalizedInput.includes(option.toLowerCase())) {
            matchedOption = option;
            isCorrect = option.toLowerCase() === normalizedCorrect;
            break;
          }
        }
      }
      
      // Fuzzy matching for numbers
      if (!matchedOption) {
        const numbers = normalizedInput.match(/\d+/g);
        if (numbers) {
          for (const num of numbers) {
            for (const option of options) {
              if (option.includes(num)) {
                matchedOption = option;
                isCorrect = option.toLowerCase() === normalizedCorrect;
                break;
              }
            }
            if (matchedOption) break;
          }
        }
      }
    } else if (questionType === "fill_blank") {
      // For fill in the blank, check if the answer is substantially correct
      const similarity = calculateSimilarity(normalizedInput, normalizedCorrect);
      isCorrect = similarity > 0.8;
      matchedOption = transcribedText;
    }

    return new Response(
      JSON.stringify({
        isCorrect,
        matchedOption,
        transcribedText,
        confidence: isCorrect ? 1 : 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in voice-evaluate function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to evaluate voice answer", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}
