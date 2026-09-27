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
    const { studentId } = await req.json();

    if (!studentId) {
      return new Response(JSON.stringify({ error: 'Student ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const { data: allowed, error: rateError } = await supabaseClient.rpc("consume_edge_rate_limit", {
      p_function_name: "generate-parent-insights",
      p_limit: 5,
      p_window_seconds: 600,
    });
    if (rateError || allowed !== true) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait and try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify parent-student relationship
    const { data: parentLink, error: linkError } = await supabaseClient
      .from('parent_links')
      .select('*')
      .eq('parent_id', user.id)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .single();

    if (linkError || !parentLink) {
      return new Response(JSON.stringify({ error: 'You are not linked to this student' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch student data
    const [profileRes, resultsRes, learningDnaRes, streakRes] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id', studentId).single(),
      supabaseClient.from('quiz_results').select('*').eq('student_id', studentId).order('completed_at', { ascending: false }).limit(20),
      supabaseClient.from('learning_dna').select('*').eq('user_id', studentId).single(),
      supabaseClient.from('user_streaks').select('*').eq('user_id', studentId).single(),
    ]);

    const profile = profileRes.data;
    const results = resultsRes.data || [];
    const learningDna = learningDnaRes.data;
    const streak = streakRes.data;

    // Calculate statistics
    const totalQuizzes = results.length;
    const avgScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
      : 0;
    const totalXP = results.reduce((sum, r) => sum + (r.xp_earned || 0), 0);

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentResults = results.filter(r => new Date(r.completed_at) > weekAgo);
    const recentActivity = recentResults.length;

    // Call AI for insights
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiInsights = null;

    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: 'You are an educational advisor providing insights for parents about their child\'s learning progress. Be encouraging, constructive, and provide actionable advice. Write in a warm, supportive tone.'
              },
              {
                role: 'user',
                content: `Generate insights for a parent about their child's educational progress:

Student: ${profile?.name || 'Student'}
Grade: ${profile?.grade || 'Not specified'}
Level: ${profile?.level || 1}
XP: ${profile?.xp || 0}
Current Streak: ${streak?.current_streak || 0} days
Longest Streak: ${streak?.longest_streak || 0} days

Recent Performance (last 20 quizzes):
- Average Score: ${avgScore.toFixed(1)}%
- Quizzes Completed: ${totalQuizzes}
- XP Earned: ${totalXP}
- Activity This Week: ${recentActivity} quizzes

Learning Analysis:
- Strengths: ${learningDna?.strengths?.join(', ') || 'Still being assessed'}
- Areas for Improvement: ${learningDna?.weaknesses?.join(', ') || 'Still being assessed'}
- Learning Style: ${learningDna?.learning_style || 'Being determined'}

Provide a JSON response with:
- overallSummary: 2-3 sentence summary of the child's progress (encouraging tone)
- strengths: array of 2-3 positive observations
- areasToSupport: array of 2-3 ways the parent can help
- suggestedActivities: array of 2-3 activities to do together
- motivationalNote: a short encouraging message for the parent`
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'generate_parent_insights',
                description: 'Generate structured insights for parents',
                parameters: {
                  type: 'object',
                  properties: {
                    overallSummary: { type: 'string' },
                    strengths: { type: 'array', items: { type: 'string' } },
                    areasToSupport: { type: 'array', items: { type: 'string' } },
                    suggestedActivities: { type: 'array', items: { type: 'string' } },
                    motivationalNote: { type: 'string' }
                  },
                  required: ['overallSummary', 'strengths', 'areasToSupport', 'suggestedActivities', 'motivationalNote']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'generate_parent_insights' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            aiInsights = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (aiError) {
        console.error('AI insights error:', aiError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        student: {
          name: profile?.name,
          grade: profile?.grade,
          level: profile?.level,
          xp: profile?.xp,
          avatar: profile?.avatar,
        },
        stats: {
          totalQuizzes,
          avgScore: Math.round(avgScore),
          totalXP,
          currentStreak: streak?.current_streak || 0,
          longestStreak: streak?.longest_streak || 0,
          recentActivity,
        },
        learningDna: {
          strengths: learningDna?.strengths || [],
          weaknesses: learningDna?.weaknesses || [],
          learningStyle: learningDna?.learning_style,
          topicMastery: learningDna?.topic_mastery || {},
        },
        aiInsights,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-parent-insights:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
