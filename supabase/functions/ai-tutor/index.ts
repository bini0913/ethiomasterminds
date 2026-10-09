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
    const { message, conversationId, subject } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (typeof message !== "string" || message.trim().length === 0 || message.length > 4000) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
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

    const rateLimit = await supabaseClient.rpc("consume_edge_rate_limit", { p_bucket: "ai-tutor", p_limit: 20, p_window_seconds: 60 });
    if (rateLimit.error) throw rateLimit.error;
    if (!rateLimit.data) return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (conversationId !== undefined && conversationId !== null && (typeof conversationId !== "string" || conversationId.length > 100)) {
      return new Response(JSON.stringify({ error: "Invalid conversation id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (subject !== undefined && (typeof subject !== "string" || subject.length > 100)) {
      return new Response(JSON.stringify({ error: "Invalid subject" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      const { data } = await supabaseClient
        .from('ai_tutor_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      conversation = data;
    }

    const messages = Array.isArray(conversation?.messages) ? conversation.messages.slice(-10) : [];
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    // Get user's learning data for context
    const { data: learningDna } = await supabaseClient
      .from('learning_dna')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get user profile for grade context
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('grade, level')
      .eq('id', user.id)
      .single();

    // Ground the tutor in the student's own recent activity.
    const { data: recentAttempts } = await supabaseClient
      .from('question_attempts')
      .select('created_at, is_correct, time_taken_seconds, questions (quizzes (subject, difficulty))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const activity = recentAttempts || [];
    const totalRecent = activity.length;
    const correctRecent = activity.filter((attempt: any) => attempt.is_correct === true).length;
    const recentAccuracy = totalRecent ? Math.round((correctRecent / totalRecent) * 100) : null;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const attemptsLast7Days = activity.filter((attempt: any) => new Date(attempt.created_at).getTime() >= cutoff).length;
    const subjectActivity: Record<string, { correct: number; total: number }> = {};
    for (const attempt of activity as any[]) {
      const subjectName = attempt.questions?.quizzes?.subject || 'Unknown';
      if (!subjectActivity[subjectName]) subjectActivity[subjectName] = { correct: 0, total: 0 };
      subjectActivity[subjectName].total += 1;
      if (attempt.is_correct === true) subjectActivity[subjectName].correct += 1;
    }
    const activitySummary = Object.entries(subjectActivity).map(([name, stats]) => ({
      subject: name,
      questions: stats.total,
      accuracy: Math.round((stats.correct / stats.total) * 100),
    }));

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are Plus, the AI Coach inside Master Minds — a brilliant, warm, world-class personal tutor for Ethiopian students (Grades 4-12). You sound like a confident older sibling who happens to be a PhD educator.

STUDENT PROFILE
- Grade: ${profile?.grade || 'Unknown'}    Level: ${profile?.level || 1}
- Subject focus right now: ${subject || 'General'}
- Strengths: ${learningDna?.strengths?.join(', ') || 'still discovering'}
- Needs work on: ${learningDna?.weaknesses?.join(', ') || 'still discovering'}
- Preferred style: ${learningDna?.learning_style || 'balanced'}

RECENT LEARNING ACTIVITY (based on the student's own saved question attempts)
- Questions in recent activity sample: ${totalRecent}
- Correct answers in sample: ${correctRecent}
- Recent accuracy: ${recentAccuracy === null ? 'not enough data yet' : `${recentAccuracy}%`}
- Questions answered in the last 7 days (within the recent sample): ${attemptsLast7Days}
- Subject performance: ${JSON.stringify(activitySummary)}
Use this evidence to personalize help when relevant. Mention a specific strength or practice opportunity only when the data supports it. If there is little or no activity, do not invent a history; help the student start building one. Never shame, label, or make high-stakes judgments about the student. Treat accuracy as a learning signal, not a measure of worth.

HOW YOU TEACH
1. Sound like a natural, helpful conversational AI tutor. Answer the exact question first; avoid scripted greetings, repeated introductions, and filler.
2. Use clean, readable formatting like a normal chat assistant. Use short paragraphs and occasional bullets when useful. Do not overuse headings, emojis, bold text, or huge title-style headings. Avoid putting every sentence on a separate line.
3. For math, show the working step by step and explain why each step is valid.
4. Use Ethiopian and East-African examples when they genuinely help the explanation.
5. Adapt vocabulary and depth to the student's grade. Grades 4-6: simple; Grades 7-9: structured; Grades 10-12: rigorous.
6. Give a small follow-up question or practice suggestion when useful, not as a forced ending on every reply.
7. If the student is stuck, offer a hint before revealing the full solution. Correct mistakes kindly and clearly.
8. Keep ordinary replies concise (usually 2-6 short paragraphs); go deeper when asked.
9. If asked about something outside studies, answer normally when appropriate instead of rigidly redirecting every non-study question.
10. Never invent facts, activity, scores, or personal details. Explain uncertainty honestly.

Personalize across the student's conversation and saved learning data. Be warm and respectful, not overly enthusiastic or repetitive.`;

    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content }))
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText.slice(0, 300));
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI service limit reached. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";

    messages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() });

    // Save conversation
    let savedConversationId = conversationId;
    if (conversationId && conversation) {
      await supabaseClient
        .from('ai_tutor_conversations')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } else {
      const { data: newConv } = await supabaseClient
        .from('ai_tutor_conversations')
        .insert({
          user_id: user.id,
          subject: subject || 'General',
          messages,
        })
        .select('id')
        .single();
      savedConversationId = newConv?.id;
    }

    return new Response(JSON.stringify({
      success: true,
      message: assistantMessage,
      conversationId: savedConversationId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-tutor:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ 
      error: 'Failed to process AI tutor request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
