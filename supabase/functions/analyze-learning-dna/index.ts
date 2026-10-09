import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rateLimit = await supabaseClient.rpc("consume_edge_rate_limit", { p_bucket: "learning-dna", p_limit: 5, p_window_seconds: 300 });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) {
      return new Response(JSON.stringify({ error: "Please wait before generating another report." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch user's question attempts
    const { data: attempts, error: attemptsError } = await supabaseClient
      .from('question_attempts')
      .select(`
        *,
        questions (
          question_text,
          quiz_id,
          quizzes (subject, difficulty)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (attemptsError) {
      console.error('Error fetching attempts:', attemptsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch attempts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze by subject
    const subjectStats: Record<string, { correct: number; total: number; avgTime: number; times: number[] }> = {};
    
    for (const attempt of attempts || []) {
      const subject = attempt.questions?.quizzes?.subject || 'Unknown';
      
      if (!subjectStats[subject]) {
        subjectStats[subject] = { correct: 0, total: 0, avgTime: 0, times: [] };
      }
      
      subjectStats[subject].total++;
      if (attempt.is_correct) subjectStats[subject].correct++;
      subjectStats[subject].times.push(attempt.time_taken_seconds);
    }

    // Calculate topic mastery
    const topicMastery: Record<string, { mastery: number; status: string }> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const [subject, stats] of Object.entries(subjectStats)) {
      const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      const avgTime = stats.times.length > 0 
        ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length 
        : 0;

      let status = 'needs-work';
      if (accuracy >= 80) status = 'mastered';
      else if (accuracy >= 60) status = 'learning';

      topicMastery[subject] = { mastery: Math.round(accuracy), status };

      if (accuracy >= 80) strengths.push(subject);
      else if (accuracy < 50) weaknesses.push(subject);
    }

    // Determine learning style based on patterns
    let learningStyle = 'visual';
    const totalAttempts = attempts?.length || 0;
    const avgTimeOverall = attempts && attempts.length > 0
      ? attempts.reduce((sum, a) => sum + a.time_taken_seconds, 0) / attempts.length
      : 0;

    if (avgTimeOverall > 60) learningStyle = 'analytical';
    else if (avgTimeOverall < 20) learningStyle = 'quick-thinker';
    else learningStyle = 'balanced';

    // Call AI for personalized insights
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    let predictedPath = null;
    
    if (GROQ_API_KEY && Object.keys(topicMastery).length > 0) {
      try {
        const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: 'You are an educational AI that analyzes student learning patterns. Provide brief, actionable insights.'
              },
              {
                role: 'user',
                content: `Analyze this student's learning data and suggest a study path:
                
Strengths: ${strengths.join(', ') || 'None identified yet'}
Weaknesses: ${weaknesses.join(', ') || 'None identified yet'}
Topic Mastery: ${JSON.stringify(topicMastery)}
Learning Style: ${learningStyle}
Total Questions Attempted: ${totalAttempts}

Provide a JSON response with: 
- recommendedFocus: array of 3 subjects to focus on
- studyTips: array of 3 personalized study tips
- predictedCareerPaths: array of 3 potential career paths based on strengths`
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'analyze_learning_path',
                description: 'Return structured learning path analysis',
                parameters: {
                  type: 'object',
                  properties: {
                    recommendedFocus: { type: 'array', items: { type: 'string' } },
                    studyTips: { type: 'array', items: { type: 'string' } },
                    predictedCareerPaths: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['recommendedFocus', 'studyTips', 'predictedCareerPaths']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'analyze_learning_path' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            predictedPath = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
      }
    }

    // Save to learning_dna table
    const dnaData = {
      user_id: user.id,
      topic_mastery: topicMastery,
      strengths: strengths,
      weaknesses: weaknesses,
      learning_style: learningStyle,
      predicted_path: predictedPath,
      last_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabaseClient
      .from('learning_dna')
      .upsert(dnaData, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error saving learning DNA:', upsertError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        topicMastery,
        strengths,
        weaknesses,
        learningStyle,
        predictedPath,
        totalAttempts
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-learning-dna:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
